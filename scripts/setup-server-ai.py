"""Interactive first-time server config. Run as ubuntu, not sudo; never prints secrets."""
import getpass
import json
import math
import re
import secrets
import subprocess
import sys
import urllib.request
from pathlib import Path

TARGET = '/etc/yeohaengit/server.env'

def positive_price(value):
    if not re.fullmatch(r'\d+(?:\.\d+)?', value) or not math.isfinite(float(value)) or float(value) <= 0:
        raise ValueError('Enter a positive USD price per 1 million tokens, without commas.')
    return value

def project_url(value):
    if not re.fullmatch(r'https://[a-z0-9-]+\.supabase\.co', value):
        raise ValueError('Enter the HTTPS Supabase Project URL, without a path.')
    return value

def main():
    import boto3
    if Path(TARGET).exists():
        raise ValueError('server.env already exists. Nothing overwritten; inspect its missing settings first.')
    session = boto3.Session()
    region = session.region_name
    if not region:
        raise ValueError('No server AWS region found. Run from the same ubuntu shell as the successful Python AI test.')
    credentials = session.get_credentials()
    if not credentials or credentials.method != 'iam-role':
        raise ValueError('The server test is not using its EC2 IAM role. No static credentials will be copied.')
    print('Model: global.openai.gpt-6-sol; EC2 IAM role detected.')
    print('Enter values here on the server. Do not send keys in chat.')
    url = project_url(input('Supabase Project URL: ').strip().rstrip('/'))
    key = getpass.getpass('Supabase legacy service_role key (hidden): ').strip()
    anon = getpass.getpass('Supabase legacy anon key (hidden): ').strip()
    for value in [key, anon]:
        if not re.fullmatch(r'[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+', value):
            raise ValueError('This app expects the legacy JWT service_role and anon keys from Supabase API Keys.')
    request = urllib.request.Request(url+'/rest/v1/rpc/bopok_health',
        data=json.dumps({'p_required': 12}).encode(),
        headers={'apikey': key, 'Authorization': 'Bearer '+key, 'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            health = json.load(response)
        if health.get('schemaVersion', 0) < 12:
            raise ValueError()
    except Exception:
        raise ValueError('Supabase schema check failed. Verify Project URL, service_role key, and completed SQL installation.') from None
    print('Supabase schema v12 connection confirmed.')
    print('Use the GPT-6 Sol Bedrock prices from your provider. Prices must be USD per 1 MILLION tokens.')
    input_price = positive_price(input('Input token price (USD / 1M): ').strip())
    output_price = positive_price(input('Output token price (USD / 1M): ').strip())
    # ReserveAI conservatively budgets 18k input and 1.6k output tokens per request.
    reservation = (18000*float(input_price)+1600*float(output_price))/1000000
    print(f'One request reserves up to ${reservation:.6f} from the daily budget.')
    limit = positive_price(input('Daily AI USD limit (max 100; enter 1 for $1): ').strip())
    if float(limit) > 100 or float(limit) < reservation:
        raise ValueError('Daily limit must cover at least one reservation and be at most $100.')
    values = {
        'AWS_REGION': region,
        'BOPok_APP_URL': 'http://52.65.9.104:8000',
        'BOPok_ALLOW_HTTP_PREVIEW': 'true',
        'BOPok_SUPABASE_URL': url,
        'BOPok_SUPABASE_KEY': key,
        'BOPok_SUPABASE_ANON_KEY': anon,
        'BOPok_SESSION_SECRET': secrets.token_urlsafe(48),
        'BOPok_REQUIRE_AUTH': 'true',
        'BOPok_REQUIRE_BOT': 'false',
        'BOPok_REQUIRED_FEATURES': 'storage,auth,ai',
        'BOPok_AI_INPUT_USD_PER_MILLION': input_price,
        'BOPok_AI_OUTPUT_USD_PER_MILLION': output_price,
        'BOPok_AI_DAILY_USD_LIMIT': limit,
        'BOPok_AI_DAILY_TOKEN_LIMIT': '200000',
        'BOPok_AI_DAILY_REQUEST_LIMIT': '30',
    }
    for value in values.values():
        if any(c in value for c in '\n\r\0'):
            raise ValueError('Invalid newline or NUL in configuration.')
    subprocess.run(['sudo', '-v'], check=True)
    # O_EXCL protects against concurrent creation; root owns the 0600 file.
    writer = "import os,sys; os.makedirs('/etc/yeohaengit',mode=0o700,exist_ok=True); fd=os.open(sys.argv[1],os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600); f=os.fdopen(fd,'w'); f.write(sys.stdin.read()); f.close()"
    subprocess.run(['sudo', 'python3', '-c', writer, TARGET], input=''.join(f'{k}={v}\n' for k,v in values.items()), text=True, check=True)
    print('Created root-only server.env. No credentials were printed or embedded in the app.')
    print('Next: deploy the latest ZIP. Web AI requires email login; Android login is not yet connected.')

if __name__ == '__main__':
    try:
        main()
    except (ValueError, EOFError, KeyboardInterrupt) as error:
        print('Setup stopped: '+str(error), file=sys.stderr)
        sys.exit(1)
