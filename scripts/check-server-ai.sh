#!/usr/bin/env bash
# Read-only configuration checks; --converse makes one short paid model request.
set -Eeuo pipefail
case "${1:-}" in ''|--converse) ;; *) echo 'Usage: bash check-server-ai.sh [--converse]'; exit 2;; esac
echo 'Expected model: global.openai.gpt-6-sol'
sudo python3 - <<'PY'
from pathlib import Path
import json, subprocess, shutil
p=Path('/etc/yeohaengit/server.env')
print('Server env file: '+('present' if p.is_file() else 'MISSING'))
if not shutil.which('docker'):
    print('Docker: MISSING; deployment has not completed'); raise SystemExit(0)
r=subprocess.run(['docker','container','inspect','yeohaengit-web'],capture_output=True,text=True)
if r.returncode:
    print('App container: MISSING; deployment has not completed'); raise SystemExit(0)
c=json.loads(r.stdout)[0]
print('App container state: '+c['State']['Status'])
env=dict(x.split('=',1) for x in c['Config'].get('Env',[]) if '=' in x)
# Report status only: never print credentials, URLs, tokens or environment values.
checks={
 'AWS region': bool(env.get('AWS_REGION') or env.get('AWS_DEFAULT_REGION')),
 'Usage storage URL':bool(env.get('BOPok_SUPABASE_URL')),
 'Usage storage credential':bool(env.get('BOPok_SUPABASE_KEY')),
 'Session secret (32+ chars)':len(env.get('BOPok_SESSION_SECRET',''))>=32,
 'App origin':bool(env.get('BOPok_APP_URL')),
}
for name in ['BOPok_AI_INPUT_USD_PER_MILLION','BOPok_AI_OUTPUT_USD_PER_MILLION']:
    try:
        import math
        n=float(env.get(name,'')); checks[name]=math.isfinite(n) and n>0
    except ValueError: checks[name]=False
for name,ok in checks.items(): print(name+': '+('configured' if ok else 'MISSING/INVALID'))
auth=env.get('BOPok_REQUIRE_AUTH')!='false' and (env.get('BOPok_REQUIRE_AUTH')=='true' or bool(env.get('BOPok_SUPABASE_ANON_KEY')) or env.get('NODE_ENV')=='production')
print('Login required for AI: '+('YES' if auth or env.get('BOPok_REQUIRE_BOT')=='true' else 'NO'))
print('These checks do not validate storage connectivity or the full app request.')
PY
if command -v docker >/dev/null && [[ "$(sudo docker inspect -f '{{.State.Running}}' yeohaengit-web 2>/dev/null || true)" == true ]]; then
  if sudo docker exec yeohaengit-web test -f /app/bedrock-role-probe.cjs; then
    echo 'Checking IAM inside the app container (no credentials printed).'
    args=(); [[ "${1:-}" != --converse ]] || args+=(--converse)
    sudo docker exec yeohaengit-web node /app/bedrock-role-probe.cjs "${args[@]}"
  else
    echo 'Current container lacks the Bedrock probe. Deploy the latest ZIP first.'
    exit 1
  fi
fi
