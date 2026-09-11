"""Attest every live Staging Edge entrypoint before enabling data imports."""
import argparse
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


def record_state(api, versions, sha, *, verified=False):
    if not re.fullmatch(r'[0-9a-f]{40}', sha):
        raise RuntimeError('A complete source revision is required')
    flag, stamp = ('true', 'now()') if verified else ('false', 'NULL')
    api.query(f"""INSERT INTO environment_sync.safety(singleton,guard_version,outbound_blocked,verified_at,source_sha,own_origin,edge_versions)
VALUES(true,1,{flag},{stamp},{mirror.literal(sha)},{mirror.literal(f'https://{api.target}.supabase.co')},{mirror.json_sql(versions)})
ON CONFLICT(singleton) DO UPDATE SET guard_version=1,outbound_blocked=EXCLUDED.outbound_blocked,verified_at=EXCLUDED.verified_at,source_sha=EXCLUDED.source_sha,own_origin=EXCLUDED.own_origin,edge_versions=EXCLUDED.edge_versions""")


def recover_deployment_base(api):
    rows = api.query('SELECT source_sha,edge_versions FROM environment_sync.safety WHERE singleton AND guard_version=1')
    if rows and re.fullmatch(r'[0-9a-f]{40}', rows[0]['source_sha'] or '') and rows[0]['edge_versions'] == api.function_versions():
        return rows[0]['source_sha']
    return ''


def main():
    root = Path.cwd()
    api = mirror.Management(os.environ['PRODUCTION_REF'], os.environ['STAGING_REF'], os.environ['SUPABASE_ACCESS_TOKEN'])
    parser = argparse.ArgumentParser()
    modes = parser.add_mutually_exclusive_group()
    modes.add_argument('--prepare-only', action='store_true')
    modes.add_argument('--record-deployment', action='store_true')
    modes.add_argument('--deployment-base', action='store_true')
    options = parser.parse_args()
    if options.deployment_base:
        print(recover_deployment_base(api))
        return
    for name in ['install_staging_data_mirror.sql', 'install_staging_outbound_guard.sql', 'reconcile_staging_report_columns.sql']:
        api.query((root / 'supabase/ops' / name).read_text())
    api.query('UPDATE environment_sync.safety SET outbound_blocked=false WHERE singleton')
    if options.prepare_only:
        print('Staging import gate closed for deployment')
        return
    versions = api.function_versions()
    if not versions: raise RuntimeError('No live Staging functions to verify')
    sha = os.environ.get('SOURCE_SHA', '')
    if options.record_deployment:
        record_state(api, versions, sha)
        print('Source deployment checkpoint recorded; imports remain blocked')
        return
    help_result = subprocess.run(['supabase','functions','download','--help'], capture_output=True, text=True, check=True)
    if '--use-api' not in help_result.stdout:
        raise RuntimeError('Pinned CLI must support server-side source download')
    with tempfile.TemporaryDirectory(prefix='aios-guard-verify-') as directory:
        destination = Path(directory)
        (destination / 'supabase').mkdir()
        (destination / 'supabase/config.toml').write_text('project_id = "aios-guard-verify"\n')
        base = destination / 'supabase/functions'
        for index, name in enumerate(sorted(versions), 1):
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
            if index % 20 == 0 or index == len(versions):
                print(f'Verified {index}/{len(versions)} Staging entrypoints', flush=True)
    row = api.query("SELECT EXISTS(SELECT 1 FROM pg_catalog.pg_trigger WHERE tgrelid='net.http_request_queue'::regclass AND tgname='aios_staging_outbound_block' AND tgenabled='O') AS guarded")[0]
    if not row['guarded']: raise RuntimeError('Database webhook containment is missing')
    if api.function_versions() != versions:
        raise RuntimeError('Staging deployment changed during source verification')
    record_state(api, versions, sha, verified=True)
    print(f'Verified {len(versions)} Staging entrypoints and database webhook containment')


if __name__ == '__main__':
    main()
