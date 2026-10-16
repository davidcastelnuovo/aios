"""Attest every live Staging Edge entrypoint before enabling data imports."""
import argparse
import hashlib
import importlib.util
import os
import re
import subprocess
import tempfile
import time
from pathlib import Path

spec = importlib.util.spec_from_file_location('mirror', Path(__file__).with_name('sync-staging-data.py'))
mirror = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mirror)

def download_function(name, target, destination, *, run=subprocess.run, pause=time.sleep):
    # The CLI's all-functions download bursts above the Management API limit.
    # Pace individual downloads and retry only explicit transient failures.
    for attempt in range(4):
        result = run(['supabase', 'functions', 'download', name, '--use-api', '--project-ref', target],
                     cwd=destination, capture_output=True, text=True)
        if result.returncode == 0:
            pause(0.75)
            return
        transient = re.search(r'\b(429|502|503|504)\b', result.stderr + result.stdout)
        if not transient or attempt == 3:
            raise RuntimeError(f'{name}: source download failed (exit {result.returncode})')
        delay = min(60, 30 * (attempt + 1))
        print(f'{name}: temporary API limit; retrying in {delay}s', flush=True)
        pause(delay)


def record_state(api, versions, sha, *, verified=False, state=None):
    if not re.fullmatch(r'[0-9a-f]{40}', sha):
        raise RuntimeError('A complete source revision is required')
    flag, stamp = ('true', 'now()') if verified else ('false', 'NULL')
    # Per-function attestation is only replaced by a completed verification.
    attested = mirror.json_sql(state or {})
    api.query(f"""INSERT INTO environment_sync.safety(singleton,guard_version,outbound_blocked,verified_at,source_sha,own_origin,edge_versions,verified_state)
VALUES(true,1,{flag},{stamp},{mirror.literal(sha)},{mirror.literal(f'https://{api.target}.supabase.co')},{mirror.json_sql(versions)},{attested})
ON CONFLICT(singleton) DO UPDATE SET guard_version=1,outbound_blocked=EXCLUDED.outbound_blocked,verified_at=EXCLUDED.verified_at,source_sha=EXCLUDED.source_sha,own_origin=EXCLUDED.own_origin,edge_versions=EXCLUDED.edge_versions{',verified_state=EXCLUDED.verified_state' if verified else ''}""")


def file_digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest() if path.exists() else None


def tracked_digests(root, names):
    # Content digests of exactly what verification compares, so attestation
    # survives squashed or rebased history without consulting git.
    functions = root / 'supabase/functions'
    return {'guard': file_digest(functions / '_shared/staging-outbound.mjs'),
            'functions': {name: file_digest(functions / name / 'index.ts') for name in names}}


def attested_state(versions, digests):
    return {'guard': digests['guard'],
            'functions': {name: {'live': versions[name], 'digest': digests['functions'][name]} for name in versions}}


def pending_functions(rows, versions, digests):
    """Functions whose live copy must be downloaded and compared again."""
    if not rows or not rows[0]['verified_at'] or not digests['guard']:
        return sorted(versions)
    state = rows[0].get('verified_state') or {}
    if state.get('guard') != digests['guard']:
        return sorted(versions)
    attested = state.get('functions') or {}
    return sorted(name for name in versions
                  if not digests['functions'][name]
                  or attested.get(name) != {'live': versions[name], 'digest': digests['functions'][name]})


def main():
    root = Path.cwd()
    api = mirror.Management(os.environ['PRODUCTION_REF'], os.environ['STAGING_REF'], os.environ['SUPABASE_ACCESS_TOKEN'])
    parser = argparse.ArgumentParser()
    modes = parser.add_mutually_exclusive_group()
    modes.add_argument('--prepare-only', action='store_true')
    modes.add_argument('--record-deployment', action='store_true')
    options = parser.parse_args()
    for name in ['install_staging_data_mirror.sql', 'install_staging_outbound_guard.sql', 'reconcile_staging_report_columns.sql']:
        api.query((root / 'supabase/ops' / name).read_text())
    api.query('UPDATE environment_sync.safety SET outbound_blocked=false WHERE singleton')
    if options.prepare_only:
        print('Staging import gate closed for deployment')
        return
    versions = api.function_versions()
    if not versions: raise RuntimeError('No live Staging functions to verify')
    sha = os.environ.get('SOURCE_SHA', '')
    digests = tracked_digests(root, versions)
    rows = api.query('SELECT verified_at,verified_state FROM environment_sync.safety WHERE singleton AND guard_version=1')
    pending = pending_functions(rows, versions, digests)
    state = attested_state(versions, digests)
    if options.record_deployment:
        if not pending:
            print('Reviewed sources and live versions are unchanged; preserving their attestation with imports closed')
            return
        record_state(api, versions, sha)
        print('Source deployment checkpoint recorded; imports remain blocked')
        return
    if not pending:
        print('Reusing complete source attestation: all function files and live versions are unchanged')
        finish_verification(api, versions, sha, state)
        return
    help_result = subprocess.run(['supabase','functions','download','--help'], capture_output=True, text=True, check=True)
    if '--use-api' not in help_result.stdout:
        raise RuntimeError('Pinned CLI must support server-side source download')
    print(f'Verifying {len(pending)} of {len(versions)} Staging entrypoints; the rest match their attested version and source', flush=True)
    with tempfile.TemporaryDirectory(prefix='aios-guard-verify-') as directory:
        destination = Path(directory)
        (destination / 'supabase').mkdir()
        (destination / 'supabase/config.toml').write_text('project_id = "aios-guard-verify"\n')
        base = destination / 'supabase/functions'
        for index, name in enumerate(pending, 1):
            download_function(name, api.target, destination)
            entry = base / name / 'index.ts'
            if not entry.exists(): raise RuntimeError(f'{name}: entrypoint missing from download')
            source = entry.read_text()
            if 'installStagingOutboundGuard' not in source or "await import('./_aios-source.ts')" not in source:
                raise RuntimeError(f'{name}: live entrypoint has no Staging guard')
            original = base / name / '_aios-source.ts'
            tracked = root / 'supabase/functions' / name / 'index.ts'
            if not tracked.exists() or original.read_text() != tracked.read_text():
                raise RuntimeError(f'{name}: deployed source differs from reviewed revision')
            guard = base / '_shared/staging-outbound.mjs'
            if guard.read_text() != (root / 'supabase/functions/_shared/staging-outbound.mjs').read_text():
                raise RuntimeError(f'{name}: deployed outbound guard differs from reviewed source')
            if index % 20 == 0 or index == len(pending):
                print(f'Verified {index}/{len(pending)} Staging entrypoints', flush=True)
    finish_verification(api, versions, sha, state)


def finish_verification(api, versions, sha, state):
    row = api.query("SELECT EXISTS(SELECT 1 FROM pg_catalog.pg_trigger WHERE tgrelid='net.http_request_queue'::regclass AND tgname='aios_staging_outbound_block' AND tgenabled='O') AS guarded")[0]
    if not row['guarded']: raise RuntimeError('Database webhook containment is missing')
    if api.function_versions() != versions:
        raise RuntimeError('Staging deployment changed during source verification')
    record_state(api, versions, sha, verified=True, state=state)
    print(f'Verified {len(versions)} Staging entrypoints and database webhook containment')


if __name__ == '__main__':
    main()
