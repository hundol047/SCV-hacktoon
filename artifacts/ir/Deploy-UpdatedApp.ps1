$ErrorActionPreference = 'Stop'
$KeyPath = 'C:\Users\AISEMI003\Desktop\2조\hackathon-e5-t02.pem'
if (!(Test-Path -LiteralPath $KeyPath)) { throw "PEM 파일을 찾을 수 없습니다: $KeyPath" }
$DeployCode = @'
set -euo pipefail
sudo -n true
sudo -n test -f /etc/yeohaengit/server.env
# One deployment at a time; the lock does not store credentials.
exec 9>/tmp/bopok-deploy.lock
flock -n 9 || { echo 'Another Bopok deployment is running.'; exit 1; }
curl -fsSL --retry 3 https://raw.githubusercontent.com/hundol047/SCV-hacktoon/feat/gangwon-lab-ui/scripts/prepare-deploy-space.sh | bash -s -- --clean
WORK_DIR=$(mktemp -d /tmp/yeohaengit-update.XXXXXX)
trap 'rm -rf -- "$WORK_DIR"' EXIT
cd "$WORK_DIR"
curl -fL --retry 3 --connect-timeout 20 --max-time 300 https://github.com/hundol047/SCV-hacktoon/archive/refs/heads/feat/gangwon-lab-ui.tar.gz -o source.tar.gz
tar -xzf source.tar.gz --strip-components=1
rm -f source.tar.gz
cp deploy/powershell/deploy-server.sh ./deploy-server.sh
bash deploy-server.sh 8000
'@
$DeployCode | ssh -i "$KeyPath" -o ConnectTimeout=20 ubuntu@52.65.9.104 "tr -d '\r' | bash -s"
if ($LASTEXITCODE -ne 0) { throw '배포가 중단됐습니다. 위 오류를 확인해 주세요.' }
Start-Process 'http://52.65.9.104:8000/lab/?release=bopok-bright-v4'
