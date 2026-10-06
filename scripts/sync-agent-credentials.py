"""Keep allowlisted agent credentials connected without rewriting equal secrets."""
import importlib.util
import json
import os
import re
import urllib.request
from pathlib import Path

spec = importlib.util.spec_from_file_location('mirror', Path(__file__).with_name('sync-staging-data.py'))
mirror = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mirror)

NAMES = ['CURSOR_API_KEY', 'CURSOR_MCP_BEARER', 'CURSOR_CLOUD_ENV_NAME',
         'CURSOR_DEFAULT_TENANT_ID', 'GROK_MCP_BEARER', 'GROK_CURSOR_MCP_BEARER',
         'AGENT_CHANNEL_MCP_BEARER', 'AGENT_CHANNEL_CALLBACK_SECRET']


def digests(rows):
    result = {}
    if not isinstance(rows, list): raise RuntimeError('Unexpected secret metadata response')
    for row in rows:
        if row.get('name') not in NAMES: continue
        value = row.get('value', '')
        if not isinstance(value, str) or not re.fullmatch('[0-9a-fA-F]{64}', value):
            raise RuntimeError('Secret metadata must contain SHA-256 digests')
        result[row['name']] = value.lower()
    return result


def synchronize(api, tenant):
    headers = {'Authorization': f'Bearer {api.token}', 'Content-Type': 'application/json'}
    def metadata(ref):
        return digests(api.request(urllib.request.Request(
            f'https://api.supabase.com/v1/projects/{ref}/secrets', headers=headers)))
    source, target = metadata(api.source), metadata(api.target)
    if any(target.get(name) != digest for name, digest in source.items()):
        request = urllib.request.Request(
            f'https://{api.source}.supabase.co/functions/v1/copy-edge-secrets-to-staging',
            headers=headers, data=json.dumps({'target_ref': api.target, 'names': NAMES}).encode(), method='POST')
        result = api.request(request)
        if result.get('ok') is not True: raise RuntimeError('Agent credential synchronization failed')
        after = metadata(api.target)
        if any(after.get(name) != digest for name, digest in source.items()):
            raise RuntimeError('Agent credential digests still differ after synchronization')
        print('Agent credential sync OK')
    else:
        # Rewriting equal secrets increments EVERY Edge version in Supabase,
        # invalidating an otherwise valid source attestation and wasting minutes.
        print('Agent credentials already match; no secret rewrite required')
    request = urllib.request.Request(
        f'https://{api.target}.supabase.co/functions/v1/mcp-connect',
        headers={'Content-Type': 'application/json'},
        data=json.dumps({'resync_from_secret': True, 'tenant_id': tenant, 'name': 'Cursor'}).encode(), method='POST')
    result = api.request(request)
    if result.get('state') != 'ready': raise RuntimeError('Cursor MCP is not ready')
    print('Cursor MCP ready')


if __name__ == '__main__':
    api = mirror.Management(os.environ['PRODUCTION_REF'], os.environ['PROJECT_REF'], os.environ['SUPABASE_ACCESS_TOKEN'])
    synchronize(api, os.environ['CARMEN_TENANT_ID'])
