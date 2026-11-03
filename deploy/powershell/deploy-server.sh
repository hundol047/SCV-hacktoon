#!/usr/bin/env bash
set -Eeuo pipefail
port="${1:-8000}"
[[ "$port" =~ ^[0-9]+$ ]] && ((port >= 1024 && port <= 65535)) || { echo 'Invalid port'; exit 1; }
cd "$(dirname "$0")"
if ! command -v docker >/dev/null; then
  sudo apt-get update
  sudo apt-get install -y docker.io
fi
sudo systemctl start docker
sudo docker info >/dev/null
name=yeohaengit-web
owner=yeohaengit-powershell
old=''
if sudo docker container inspect "$name" >/dev/null 2>&1; then
  label="$(sudo docker inspect -f '{{index .Config.Labels "app.deployer"}}' "$name")"
  [[ "$label" == "$owner" ]] || { echo 'Existing yeohaengit-web container is not owned by this installer. Nothing changed.'; exit 1; }
fi
image="yeohaengit-preview:$(date +%s)-$$"
echo 'Building the Next.js web app. The first build can take several minutes.'
sudo docker build -t "$image" .
if sudo docker container inspect "$name" >/dev/null 2>&1; then
  old="${name}-previous-$(date +%s)-$$"
  sudo docker stop "$name" >/dev/null
  sudo docker rename "$name" "$old"
fi
rollback() {
  echo 'Startup failed. Restoring the previous container if present.'
  sudo docker logs --tail 40 "$name" 2>/dev/null || true
  sudo docker rm -f "$name" >/dev/null 2>&1 || true
  if [[ -n "$old" ]]; then sudo docker rename "$old" "$name"; sudo docker start "$name" >/dev/null; fi
}
trap rollback ERR
sudo docker run -d --name "$name" --label "app.deployer=$owner" \
  --restart unless-stopped --log-opt max-size=10m --log-opt max-file=3 \
  -p "$port:3000" "$image"
ready=false
for attempt in {1..30}; do
  if sudo docker exec "$name" node -e 'fetch("http://127.0.0.1:3000/").then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))' >/dev/null 2>&1; then ready=true; break; fi
  sleep 2
done
[[ "$ready" == true ]]
trap - ERR
if [[ -n "$old" ]]; then sudo docker rm "$old" >/dev/null; fi
echo "Web home page responded successfully. Port: $port"
echo 'Logs: sudo docker logs --tail 100 yeohaengit-web'
echo 'Stop: sudo docker stop yeohaengit-web'
echo 'Restart: sudo docker start yeohaengit-web'
echo 'AI, accounts, sharing, and provider readiness are separate from this startup check.'
