"""Enable explicitly requested anonymous AI, retaining all other settings and a backup."""
import math
import os
from pathlib import Path
import sys
import tempfile

def enable(path, experiment=False):
    path = Path(path)
    if path.is_symlink() or not path.is_file():
        raise ValueError('Expected an existing regular config file')
    original = path.read_text()
    settings = {'BOPok_AI_ALLOW_ANONYMOUS':'true'}
    if experiment:
        existing=dict(line.split('=',1) for line in original.splitlines() if '=' in line and not line.startswith('#'))
        for key, minimum, maximum in [('BOPok_AI_DAILY_USD_LIMIT',10,100),('BOPok_AI_DAILY_REQUEST_LIMIT',100,10000),('BOPok_AI_DAILY_TOKEN_LIMIT',1000000,10000000)]:
            current=float(existing.get(key,'0'))
            if not math.isfinite(current) or current<0 or current>maximum:
                raise ValueError('Invalid existing experiment limit: '+key)
            settings[key]=str(max(current,minimum)).removesuffix('.0')
    lines = [line for line in original.splitlines() if line.split('=',1)[0] not in settings]
    updated = '\n'.join(lines) + '\n' + ''.join(k+'='+v+'\n' for k,v in settings.items())
    if updated == original:
        print('Requested AI profile is already configured.')
        return
    fd, backup = tempfile.mkstemp(prefix='server.env.before-anonymous-', dir=path.parent)
    with os.fdopen(fd, 'w') as f:
        f.write(original)
    fd, temporary = tempfile.mkstemp(prefix='.server-env-', dir=path.parent)
    try:
        with os.fdopen(fd, 'w') as f:
            f.write(updated)
            f.flush()
            os.fsync(f.fileno())
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary): os.unlink(temporary)
    print('Anonymous AI enabled. Private config backup: ' + backup)
    print('Account/storage permissions and token prices are unchanged.')
    if experiment: print('Experiment minimum limits: calculated USD 10/day, 100 requests/day, 1000000 tokens/day. Existing usage is retained.')

if __name__ == '__main__':
    enable(sys.argv[1], '--experiment' in sys.argv[2:])
