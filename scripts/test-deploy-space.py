import os,tempfile,subprocess
from pathlib import Path
with tempfile.TemporaryDirectory() as td:
 p=Path(td)
 scripts={
 'sudo':'#!/bin/sh\n[ "$1" != -n ] || shift\nexec "$@"\n',
 'docker':'''#!/bin/sh
printf '%s\\n' "$*" >> "$MOCK_LOG"
case "$*" in
 'info --format {{.DockerRootDir}}') echo /tmp;;
 'image ls --format {{.Repository}}:{{.Tag}} yeohaengit-preview:*') printf 'yeohaengit-preview:old\\nyeohaengit-preview:live\\n';;
 'ps -aq --filter ancestor=yeohaengit-preview:live') echo running-container;;
esac
''',
 'df':'''#!/bin/sh
case "$1" in
 -Pk) echo 'Filesystem 1024-blocks Used Available Capacity Mounted'; echo "fake 9000000 0 ${MOCK_FREE:-8000000} 1% /tmp";;
 -Pi) echo 'Filesystem Inodes IUsed IFree IUse% Mounted'; echo 'fake 1000000 0 1000000 1% /tmp';;
 *) echo 'mock disk report';;
esac
'''}
 for name,src in scripts.items():
  f=p/name;f.write_text(src);f.chmod(0o755)
 env=dict(os.environ,PATH=td+':'+os.environ['PATH'],MOCK_LOG=str(p/'log'))
 r=subprocess.run(['bash','scripts/prepare-deploy-space.sh','--clean'],env=env,capture_output=True,text=True)
 assert r.returncode==0,r.stderr
 log=(p/'log').read_text()
 assert 'image rm yeohaengit-preview:old' in log
 assert 'image rm yeohaengit-preview:live' not in log
 assert 'image prune -f' in log
 assert 'image prune -a' not in log
 assert 'volume' not in log and 'stop' not in log
 env['MOCK_FREE']='100'
 r=subprocess.run(['bash','scripts/prepare-deploy-space.sh'],env=env,capture_output=True,text=True)
 assert r.returncode==1 and 'current app has not been stopped' in r.stdout
 print('PASS: unused image cleanup; referenced image preserved; low-space build blocked; no volume/container removal')
