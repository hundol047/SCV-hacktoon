"""Create a source-only Windows-to-Ubuntu deployment ZIP, without local secrets."""
from pathlib import Path
import io
import tarfile
import zipfile
import tempfile

root = Path(__file__).resolve().parent.parent
output = root / 'downloads/yeohaengit-powershell.zip'
with tempfile.TemporaryDirectory() as tmp:
    archive = Path(tmp) / 'yeohaengit-source.tar.gz'
    with tarfile.open(archive, 'w:gz') as tar:
        for name in ['package.json', 'package-lock.json', 'next.config.ts', 'tsconfig.json', '.dockerignore']:
            tar.add(root / name, arcname=name)
        tar.add(root / '.env.example', arcname='server.env.example')
        for name in ['src', 'data', 'public', 'scripts']:
            tar.add(root / name, arcname=name)
        # The development Dockerfile has a proxy-CA mount; a public EC2 build
        # needs neither that private CA nor BuildKit's --mount support.
        dockerfile = (root / 'Dockerfile').read_text()
        first = dockerfile.index('RUN --mount=')
        last = dockerfile.index('\nCOPY . .', first)
        dockerfile = dockerfile[:first] + 'RUN npm ci --no-audit --no-fund' + dockerfile[last:]
        content = dockerfile.encode()
        member = tarfile.TarInfo('Dockerfile')
        member.size = len(content)
        tar.addfile(member, io.BytesIO(content))
        tar.add(root / 'deploy/powershell/deploy-server.sh', arcname='deploy-server.sh')
    with zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED) as zipped:
        zipped.write(archive, 'yeohaengit-powershell/yeohaengit-source.tar.gz')
        zipped.write(root / '.env.example', 'yeohaengit-powershell/server.env.example')
        zipped.write(root / 'supabase/migrations/013_group_votes.sql', 'yeohaengit-powershell/013_group_votes.sql')
        zipped.write(root / 'supabase/migrations/014_live_plans.sql', 'yeohaengit-powershell/014_live_plans.sql')
        for name in ['Deploy-Yeohaengit.ps1', 'deploy-server.sh', 'README.txt']:
            zipped.write(root / 'deploy/powershell' / name, 'yeohaengit-powershell/' + name)
    with zipfile.ZipFile(output) as zipped:
        assert zipped.testzip() is None
print(output)
