#!/usr/bin/env bash
set -Eeuo pipefail
port="${1:-8000}"
mode="${2:-}"
[[ "$mode" == "" || "$mode" == "--anonymous-ai" || "$mode" == "--experiment-ai" ]] || { echo "Unknown deployment option"; exit 1; }
[[ "$port" =~ ^[0-9]+$ ]] && ((port >= 1024 && port <= 65535)) || { echo 'Invalid port'; exit 1; }
cd "$(dirname "$0")"
if ! command -v docker >/dev/null; then
  sudo -n apt-get update
  sudo -n apt-get install -y docker.io
fi
sudo -n systemctl daemon-reload
sudo -n systemctl start docker
sudo -n docker info >/dev/null
name=yeohaengit-web
owner=yeohaengit-powershell
old=''
if sudo -n docker container inspect "$name" >/dev/null 2>&1; then
  label="$(sudo -n docker inspect -f '{{index .Config.Labels "app.deployer"}}' "$name")"
  [[ "$label" == "$owner" ]] || { echo 'Existing yeohaengit-web container is not owned by this installer. Nothing changed.'; exit 1; }
fi
# Read the server's existing configuration, never overwrite it or embed keys in the ZIP.
envfile=/etc/yeohaengit/server.env
sudo -n test -f "$envfile" || { echo 'Missing /etc/yeohaengit/server.env. Copy server.env.example and set server AWS_REGION, session/storage and AI usage-price settings first.'; exit 1; }
if sudo -n grep -Eq '^(AWS_ACCESS_KEY_ID|AWS_SECRET_ACCESS_KEY|AWS_SESSION_TOKEN|AWS_PROFILE|AWS_EC2_METADATA_SERVICE_ENDPOINT|BOPok_AI_KEY)=' "$envfile"; then
  echo 'Remove static AWS/API credentials, profiles and metadata endpoint overrides. Only the EC2 instance role is supported.'; exit 1
fi
sudo -n grep -Eq '^(AWS_REGION|AWS_DEFAULT_REGION)=.+$' "$envfile" || { echo 'Set the existing server AWS region in server.env.'; exit 1; }
if [[ "$mode" == "--anonymous-ai" || "$mode" == "--experiment-ai" ]]; then
  options=(); [[ "$mode" != "--experiment-ai" ]] || options+=(--experiment)
  sudo -n python3 scripts/configure-anonymous-ai.py "$envfile" "${options[@]}"
fi
image="yeohaengit-preview:$(date +%s)-$$"
echo 'Building the Next.js web app. The first build can take several minutes.'
sudo -n docker build -t "$image" .
# Validate inside the same image/network before stopping the previous deployment.
# This performs one short paid Converse request using the instance profile.
sudo -n docker run --rm --env-file "$envfile" -e AWS_EC2_METADATA_V1_DISABLED=true \
  -e NO_PROXY=169.254.169.254,localhost,127.0.0.1 "$image" node bedrock-role-probe.cjs --converse
if sudo -n docker container inspect "$name" >/dev/null 2>&1; then
  old="${name}-previous-$(date +%s)-$$"
  sudo -n docker stop "$name" >/dev/null
  sudo -n docker rename "$name" "$old"
fi
rollback() {
  echo 'Startup failed. Restoring the previous container if present.'
  sudo -n docker logs --tail 40 "$name" 2>/dev/null || true
  sudo -n docker rm -f "$name" >/dev/null 2>&1 || true
  if [[ -n "$old" ]]; then sudo -n docker rename "$old" "$name"; sudo -n docker start "$name" >/dev/null; fi
}
trap rollback ERR
sudo -n docker run -d --name "$name" --label "app.deployer=$owner" \
  --restart unless-stopped --log-opt max-size=10m --log-opt max-file=3 \
  --env-file "$envfile" -e AWS_EC2_METADATA_V1_DISABLED=true \
  -e NO_PROXY=169.254.169.254,localhost,127.0.0.1 \
  --mount type=volume,source=yeohaengit-lab-data,target=/app/.lab-data \
  -p "$port:3000" "$image"
ready=false
for attempt in {1..30}; do
  if sudo -n docker exec "$name" node -e 'fetch("http://127.0.0.1:3000/lab/").then(async r=>{const html=await r.text();const css=await fetch("http://127.0.0.1:3000/lab/bopok-bright.css").then(x=>x.text());process.exit(r.ok&&html.includes("bopok-bright-v4")&&css.includes("color-scheme:only light")?0:1)}).catch(()=>process.exit(1))' >/dev/null 2>&1; then ready=true; break; fi
  sleep 2
done
[[ "$ready" == true ]]
trap - ERR
if [[ -n "$old" ]]; then sudo -n docker rm "$old" >/dev/null; fi
echo "Verified Bopok bright-v4 HTML and light stylesheet. Port: $port"
echo 'Logs: sudo -n docker logs --tail 100 yeohaengit-web'
echo 'Stop: sudo -n docker stop yeohaengit-web'
echo 'Restart: sudo -n docker start yeohaengit-web'
echo 'AI, accounts, sharing, and provider readiness are separate from this startup check.'
