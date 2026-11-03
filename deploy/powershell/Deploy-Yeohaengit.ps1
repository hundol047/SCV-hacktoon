param(
    [string]$Server = '52.65.9.104',
    [string]$User = 'ubuntu',
    [string]$KeyPath = "$HOME\hackathon-e5-t02.pem",
    [ValidateRange(1024,65535)][int]$Port = 8000
)
$ErrorActionPreference = 'Stop'
if ($Server -notmatch '^[a-zA-Z0-9][a-zA-Z0-9.-]*$' -or $User -notmatch '^[a-z_][a-z0-9_-]*$') { throw 'Invalid server or SSH username.' }
foreach ($tool in @('ssh','scp')) { if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) { throw 'Install Windows OpenSSH Client in Optional Features first.' } }
if (-not (Test-Path -LiteralPath $KeyPath -PathType Leaf)) { throw "SSH key not found: $KeyPath. Use -KeyPath to specify your PEM file." }
$bundle = Join-Path $PSScriptRoot 'yeohaengit-source.tar.gz'
if (-not (Test-Path -LiteralPath $bundle)) { throw 'Extract the entire ZIP before running this script.' }
$remote = "$User@$Server"
$upload = 'yeohaengit-upload-' + [guid]::NewGuid().ToString('N')
Write-Host "Uploading Yeohaengit to $remote ..."
& ssh -i $KeyPath -o ConnectTimeout=15 $remote "mkdir -m 700 $upload"
if ($LASTEXITCODE -ne 0) { throw 'SSH connection failed. Check IP, key, username, and inbound port 22.' }
& scp -i $KeyPath $bundle "${remote}:$upload/source.tar.gz"
if ($LASTEXITCODE -ne 0) { throw 'Upload failed.' }
& ssh -t -i $KeyPath $remote "tar -xzf $upload/source.tar.gz -C $upload && cd $upload && bash deploy-server.sh $Port"
if ($LASTEXITCODE -ne 0) { throw 'Server deployment failed. See the server error above.' }
Write-Host "Open http://${Server}:$Port"
Write-Host "If the page does not open, allow inbound TCP $Port in the EC2 security group for your IP."
Write-Host 'This is the web preview, not an Android APK or a fully configured production service.'
