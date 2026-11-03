"""Enable explicitly requested anonymous AI, retaining all other settings and a backup."""
import os
from pathlib import Path
import sys
import tempfile

def enable(path):
    path = Path(path)
    if path.is_symlink() or not path.is_file():
        raise ValueError('Expected an existing regular config file')
    original = path.read_text()
    key = 'BOPok_AI_ALLOW_ANONYMOUS='
    lines = [line for line in original.splitlines() if not line.startswith(key)]
    updated = '\n'.join(lines) + '\n' + key + 'true\n'
    if updated == original:
        print('Anonymous AI already enabled; all limits retained.')
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
    print('Account/storage permissions and AI request/token/cost limits are unchanged.')

if __name__ == '__main__':
    enable(sys.argv[1])
