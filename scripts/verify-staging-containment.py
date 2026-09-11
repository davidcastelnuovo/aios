"""Attest every live Staging Edge entrypoint before enabling data imports."""
import argparse
import importlib.util
import os
import subprocess
import tempfile
from pathlib import Path

spec = importlib.util.spec_from_file_location('mirror', Path(__file__).with_name('sync-staging-data.py'))
mirror = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mirror)
root = Path.cwd()
api = mirror.Management(os.environ['PRODUCTION_REF'], os.environ['STAGING_REF'], os.environ['SUPABASE_ACCESS_TOKEN'])
parser = argparse.ArgumentParser()
parser.add_argument('--prepare-only', action='store_true')
options = parser.parse_args()

# Initialize bookkeeping and DB egress containment on Staging only, before
# reading customer rows. These scripts never run through a Production endpoint.
for name in ['install_staging_data_mirror.sql', 'install_staging_outbound_guard.sql', 'reconcile_staging_report_columns.sql']:
    api.query((root / 'supabase/ops' / name).read_text())
api.query("UPDATE environment_sync.safety SET outbound_blocked=false WHERE singleton")
if options.prepare_only:
    print('Staging import gate closed for deployment')
    raise SystemExit(0)

versions = api.function_versions()
expected = set(versions)
if not expected: raise RuntimeError('No live Staging functions to verify')
help_result = subprocess.run(['supabase','functions','download','--help'], capture_output=True, text=True, check=True)
if '--use-api' not in help_result.stdout:
    raise RuntimeError('Pinned CLI must support server-side source download')
with tempfile.TemporaryDirectory(prefix='aios-guard-verify-') as directory:
    destination = Path(directory)
    (destination / 'supabase').mkdir()
    (destination / 'supabase/config.toml').write_text('project_id = "aios-guard-verify"\n')
    subprocess.run(['supabase','functions','download','--use-api','--project-ref',api.target],
                   cwd=destination, check=True, stdout=subprocess.DEVNULL)
    base = destination / 'supabase/functions'
    for name in sorted(expected):
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
        raise RuntimeError('Deployed outbound guard differs from reviewed source')

row = api.query("SELECT EXISTS(SELECT 1 FROM pg_catalog.pg_trigger WHERE tgrelid='net.http_request_queue'::regclass AND tgname='aios_staging_outbound_block' AND tgenabled='O') AS guarded")[0]
if not row['guarded']: raise RuntimeError('Database webhook containment is missing')
if api.function_versions() != versions:
    raise RuntimeError('Staging deployment changed during source verification')
origin = f'https://{api.target}.supabase.co'
sha = os.environ.get('SOURCE_SHA', '')
api.query(f"""INSERT INTO environment_sync.safety(singleton,guard_version,outbound_blocked,verified_at,source_sha,own_origin,edge_versions)
VALUES(true,1,true,now(),{mirror.literal(sha)},{mirror.literal(origin)},{mirror.json_sql(versions)})
ON CONFLICT(singleton) DO UPDATE SET guard_version=1,outbound_blocked=true,verified_at=now(),source_sha=EXCLUDED.source_sha,own_origin=EXCLUDED.own_origin,edge_versions=EXCLUDED.edge_versions""")
print(f'Verified {len(expected)} Staging entrypoints and database webhook containment')
