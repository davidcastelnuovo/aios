"""Production -> Staging business-data mirror. Source API is read-only.

Fingerprints find inserts AND updates without trusting updated_at. Only changed
rows cross the network. Deletions require an explicit --apply-deletes run and
are restricted to rows previously mirrored;
Staging-only test rows, schema, RLS, queues and credentials are never promoted.
"""
import argparse
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path


def ident(value):
    if not re.fullmatch(r"[a-z_][a-z0-9_]*", value):
        raise ValueError("Invalid SQL identifier")
    return '"' + value + '"'


def literal(value):
    # Explicit E literal: never depend on standard_conforming_strings.
    return "E'" + str(value).replace('\\', '\\\\').replace("'", "''") + "'"


def json_sql(value):
    return literal(json.dumps(value, ensure_ascii=False, separators=(',', ':'))) + '::jsonb'


def key_sql(keys, alias='t'):
    return 'jsonb_build_object(' + ','.join(f'{literal(k)}, {alias}.{ident(k)}' for k in keys) + ')'


def key_text(key):
    return json.dumps(key, sort_keys=True, separators=(',', ':'))


def batches(values, size=500):
    for start in range(0, len(values), size):
        yield values[start:start + size]


def read_all(api, query, *, source=False):
    # Management API limits apply to result rows, including bookkeeping. Return
    # one JSON array so larger tenants never silently lose IDs/checkpoints.
    return api.query(f"SELECT coalesce(jsonb_agg(q),'[]'::jsonb) AS items FROM ({query}) q", source=source)[0]['items']


IMPORT_GATE = """DO $gate$ BEGIN
IF NOT EXISTS(SELECT 1 FROM environment_sync.safety WHERE singleton AND outbound_blocked AND guard_version=1) THEN
 RAISE EXCEPTION 'Staging containment is not verified';
END IF; END $gate$;"""


def dependency_order(tables, foreign_keys):
    remaining = {t['name']: t for t in tables}
    preferred = {'tenants', 'profiles', 'tenant_users', 'user_roles', 'user_permissions',
                 'clients', 'crm_tables', 'crm_fields', 'crm_dashboards', 'crm_records'}
    # Load report dependencies first instead of draining every unrelated history
    # table before advancing to the next foreign-key layer.
    while True:
        ancestors = {fk['parent'] for fk in foreign_keys if fk['child'] in preferred}
        if ancestors <= preferred: break
        preferred.update(ancestors)
    ordered = []
    while remaining:
        ready = [name for name in remaining if not any(
            fk['child'] == name and fk['parent'] != name and fk['parent'] in remaining for fk in foreign_keys)]
        if not ready:
            raise ValueError('Foreign-key cycle requires explicit reconciliation: ' + ', '.join(remaining))
        name = min(ready, key=lambda name: (name not in preferred, name))
        ordered.append(remaining.pop(name))
    return ordered


def ensure_identity_parents(api):
    # Keep production user IDs for RLS/FKs, without copying passwords, login
    # sessions, OAuth identities, MFA factors or recovery tokens. Existing
    # Staging accounts keep their authentication settings.
    users = read_all(api, "SELECT id, email, created_at FROM auth.users", source=True)
    for group in batches(users):
        api.query(f"""BEGIN; SET LOCAL lock_timeout='3s';
{IMPORT_GATE}
-- The existing signup trigger links invitations by email. An imported identity
-- must not activate an old Staging invitation or its permissions.
LOCK TABLE public.invitation_tokens IN SHARE MODE;
DO $invites$ BEGIN IF EXISTS(
 SELECT 1 FROM jsonb_to_recordset({json_sql(group)}) x(id uuid,email text)
 JOIN public.invitation_tokens i ON lower(i.email)=lower(x.email)
 WHERE NOT EXISTS(SELECT 1 FROM auth.users u WHERE u.id=x.id)
) THEN RAISE EXCEPTION 'Pending Staging invitations require identity reconciliation'; END IF; END $invites$;
INSERT INTO auth.users(id,instance_id,aud,role,email,created_at,updated_at,raw_app_meta_data,raw_user_meta_data)
SELECT id,'00000000-0000-0000-0000-000000000000'::uuid,'authenticated','authenticated',email,created_at,now(),'{{}}'::jsonb,'{{}}'::jsonb
FROM jsonb_to_recordset({json_sql(group)}) x(id uuid,email text,created_at timestamptz)
ON CONFLICT(id) DO NOTHING; COMMIT;""")


def ensure_integration_parents(api):
    # Insert metadata for newly created connections so client/report relations
    # remain valid. Preserve existing Staging credentials and endpoint settings.
    # Keep personal ownership: dropping user_id changes the connection scope
    # and violates the unique index for tenant-wide connections.
    data = read_all(api, "SELECT id,tenant_id,user_id,integration_type,connection_visibility,display_name,created_at,shared_from_integration_id FROM public.tenant_integrations", source=True)
    api.query(f"""BEGIN; SET LOCAL lock_timeout='3s';
{IMPORT_GATE}
INSERT INTO public.tenant_integrations(id,tenant_id,user_id,integration_type,connection_visibility,display_name,created_at,shared_from_integration_id,is_active,auto_sync_enabled,settings)
SELECT id,tenant_id,user_id,integration_type,connection_visibility,display_name,created_at,shared_from_integration_id,false,false,'{{}}'::jsonb
FROM jsonb_populate_recordset(NULL::public.tenant_integrations,{json_sql(data)})
ON CONFLICT(id) DO NOTHING; COMMIT;""")


class Management:
    def __init__(self, source, target, token):
        if not source or not target or source == target:
            raise ValueError('Distinct source and Staging project refs required')
        for ref in (source, target):
            if not re.fullmatch('[a-z]{20}', ref):
                raise ValueError('Invalid project reference')
        self.source, self.target, self.token = source, target, token
        self.last_request_at = 0.0

    def request(self, request):
        for attempt in range(4):
            # One shared budget for reads and writes, below Management API limits.
            time.sleep(max(0, self.last_request_at + 0.75 - time.monotonic()))
            self.last_request_at = time.monotonic()
            try:
                with urllib.request.urlopen(request, timeout=120) as response:
                    return json.load(response)
            except urllib.error.HTTPError as error:
                if error.code not in (429, 502, 503, 504) or attempt == 3:
                    raise
                retry_after = error.headers.get('Retry-After', '') if error.headers else ''
                delay = min(60, float(retry_after)) if retry_after.isdigit() else min(60, 30 * (attempt + 1))
                print(f'Management API HTTP {error.code}; retrying in {delay:g}s', file=sys.stderr, flush=True)
                time.sleep(delay)

    def function_versions(self):
        request = urllib.request.Request(f'https://api.supabase.com/v1/projects/{self.target}/functions',
                                         headers={'Authorization': f'Bearer {self.token}'})
        rows = self.request(request)
        if isinstance(rows, dict): rows = rows['functions']
        return {f['slug']: {'id': f['id'], 'version': f['version']} for f in rows}

    def query(self, sql, source=False):
        ref = self.source if source else self.target
        suffix = '/read-only' if source else ''
        req = urllib.request.Request(
            f'https://api.supabase.com/v1/projects/{ref}/database/query{suffix}',
            data=json.dumps({'query': sql}).encode(),
            headers={'Authorization': f'Bearer {self.token}', 'Content-Type': 'application/json'},
            method='POST',
        )
        try:
            return self.request(req)
        except urllib.error.HTTPError as error:
            # API errors may echo SQL containing customer data. Never log bodies.
            detail = safe_database_error(error.read())
            raise RuntimeError(f"{'Source read' if source else 'Staging query'} failed: HTTP {error.code}{detail}") from None


def safe_database_error(body):
    # Only schema identifiers and SQLSTATE help operators diagnose failures;
    # row values, SQL statements and arbitrary error text must stay out of logs.
    try:
        value = json.loads(body)
        message = value.get('message', '') if isinstance(value, dict) else ''
    except (ValueError, UnicodeDecodeError):
        return ''
    if not isinstance(message, str): return ''
    parts = []
    code = re.search(r'ERROR:\s*([A-Z0-9]{5}):', message)
    if code: parts.append('SQLSTATE ' + code.group(1))
    for kind, name in re.findall(r'\b(constraint|column|relation) "([a-z_][a-z0-9_]{0,62})"', message.split('DETAIL:')[0]):
        parts.append(kind + ' ' + name)
    return ' (' + ', '.join(parts) + ')' if parts else ''


CATALOG = """
select c.relname as name,
 (select jsonb_agg(jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod),'generated',a.attgenerated) order by a.attnum)
  from pg_catalog.pg_attribute a where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped) as columns,
 (select jsonb_agg(a.attname order by u.ordinality) from pg_catalog.pg_index i
  cross join lateral unnest(i.indkey) with ordinality u(attnum,ordinality)
  join pg_catalog.pg_attribute a on a.attrelid=i.indrelid and a.attnum=u.attnum
  where i.indrelid=c.oid and i.indisprimary) as pk
from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind='r' order by c.relname
"""


def preflight(names, source, target):
    plan, errors = [], []
    for name in names:
        if name not in source or name not in target:
            errors.append(f'{name}: missing table'); continue
        src, dst = source[name], target[name]
        keys = src['pk'] or (['id'] if any(c['name'] == 'id' for c in src['columns']) else None)
        if not keys:
            errors.append(f'{name}: no stable key'); continue
        target_columns = {c['name']: c for c in dst['columns']}
        columns = [c['name'] for c in src['columns'] if not c['generated'] and not re.search(r'(^|_)(api_key|access_token|refresh_token|password|secret|credentials)($|_)', c['name'])]
        missing = [c for c in columns if c not in target_columns]
        if missing:
            errors.append(f'{name}: missing columns {", ".join(missing)}'); continue
        generated = [c for c in columns if target_columns[c]['generated']]
        if generated:
            errors.append(f'{name}: destination generated columns differ'); continue
        # PostgreSQL's typed JSON record conversion handles compatible enum/text,
        # json-array/array and numeric representations; invalid values fail the
        # batch transaction without changing its checkpoint or any other table.
        array_columns = [c['name'] for c in src['columns'] if c['name'] in columns and c.get('type') == 'jsonb' and target_columns[c['name']].get('type') == 'text[]']
        plan.append({'name': name, 'keys': keys, 'columns': columns, 'array_columns': array_columns})
    return plan, errors


def normalize_arrays(row, array_columns):
    result = dict(row)
    for column in array_columns:
        value = result.get(column)
        if value is None or isinstance(value, list): continue
        if not isinstance(value, str):
            raise RuntimeError(f'{column}: incompatible array representation')
        try: decoded = json.loads(value)
        except json.JSONDecodeError: decoded = value
        result[column] = decoded if isinstance(decoded, list) else [decoded if isinstance(decoded, str) else value]
    return result


def apply_batch_sql(table, keys, columns, items, array_columns=()):
    relation = 'public.' + ident(table)
    payload = [normalize_arrays(item['row'], array_columns) for item in items]
    matches = ' AND '.join(f't.{ident(k)} IS NOT DISTINCT FROM s.{ident(k)}' for k in keys)
    nonkeys = [c for c in columns if c not in keys]
    update = ('WHEN MATCHED THEN UPDATE SET ' + ','.join(f'{ident(c)}=s.{ident(c)}' for c in nonkeys)) if nonkeys else ''
    fields = ','.join(map(ident, columns))
    manifest = [{'key': item['key'], 'digest': item['digest']} for item in items]
    return f"""BEGIN;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='90s';
{IMPORT_GATE}
-- Supabase's postgres role cannot SET session_replication_role. Disable only
-- active USER triggers on this owned table; retain all foreign-key enforcement.
CREATE TEMP TABLE mirror_active_triggers ON COMMIT DROP AS
 SELECT tgname FROM pg_catalog.pg_trigger WHERE tgrelid={literal('public.'+table)}::regclass
 AND NOT tgisinternal AND tgenabled='O';
DO $restore$ DECLARE n text; BEGIN FOR n IN SELECT tgname FROM mirror_active_triggers LOOP
 EXECUTE format('ALTER TABLE %s DISABLE TRIGGER %I', {literal(relation)}, n); END LOOP; END $restore$;
MERGE INTO {relation} t USING jsonb_populate_recordset(NULL::{relation}, {json_sql(payload)}) s
ON {matches}
{update}
WHEN NOT MATCHED THEN INSERT ({fields}) VALUES ({','.join('s.'+ident(c) for c in columns)});
INSERT INTO environment_sync.managed_rows(table_name,row_key,digest)
SELECT {literal(table)}, x.key, x.digest FROM jsonb_to_recordset({json_sql(manifest)}) x(key jsonb,digest text)
ON CONFLICT(table_name,row_key) DO UPDATE SET digest=EXCLUDED.digest;
DO $restore$ DECLARE n text; BEGIN FOR n IN SELECT tgname FROM mirror_active_triggers LOOP
 EXECUTE format('ALTER TABLE %s ENABLE TRIGGER %I', {literal(relation)}, n); END LOOP; END $restore$;
COMMIT;"""


def bounded_apply_batches(table, keys, columns, items, array_columns=(), *, max_bytes=2_000_000):
    sql = apply_batch_sql(table, keys, columns, items, array_columns)
    # Bound the actual JSON request, including Unicode and SQL escaping.
    # A single large record stays intact and either succeeds or fails visibly.
    if len(items) > 1 and len(json.dumps({'query': sql}).encode()) > max_bytes:
        middle = len(items) // 2
        yield from bounded_apply_batches(table, keys, columns, items[:middle], array_columns, max_bytes=max_bytes)
        yield from bounded_apply_batches(table, keys, columns, items[middle:], array_columns, max_bytes=max_bytes)
    else:
        yield sql, len(items)


def row_sql(columns):
    parts = ['jsonb_build_object(' + ','.join(f'{literal(c)},t.{ident(c)}' for c in group) + ')' for group in batches(columns, 40)]
    return '(' + ' || '.join(parts) + ')'


def fingerprint_query(tables):
    queries = [f"SELECT {literal(t['name'])} AS name, coalesce(jsonb_agg(jsonb_build_object('key',{key_sql(t['keys'])},'digest',md5({row_sql(t['columns'])}::text))),'[]'::jsonb) AS items FROM public.{ident(t['name'])} t" for t in tables]
    return 'SELECT jsonb_object_agg(name,items) AS inventory FROM (' + ' UNION ALL '.join(queries) + ') q'


def load_inventory(api, plan):
    incoming, previous = {}, {}
    for group in batches(plan, 8):
        incoming.update(api.query(fingerprint_query(group), source=True)[0]['inventory'])
        rows = read_all(api, 'SELECT table_name,row_key,digest FROM environment_sync.managed_rows WHERE table_name IN (' + ','.join(literal(t['name']) for t in group) + ')')
        for row in rows:
            previous.setdefault(row['table_name'], []).append(row)
    return incoming, previous


def record_table_states(api, results):
    payload = [{'table_name': r['table'], 'source_rows': r['source_rows'], 'changed_rows': r['changed_rows']} for r in results]
    api.query(f"""INSERT INTO environment_sync.table_state(table_name,last_success_at,source_rows,changed_rows)
SELECT table_name,now(),source_rows,changed_rows FROM jsonb_to_recordset({json_sql(payload)}) x(table_name text,source_rows bigint,changed_rows bigint)
ON CONFLICT(table_name) DO UPDATE SET last_success_at=EXCLUDED.last_success_at,source_rows=EXCLUDED.source_rows,changed_rows=EXCLUDED.changed_rows""")


def mirror_table(api, table, *, delete_only=False, inventory=None, previous_rows=None, record_state=True):
    name, keys, columns = table['name'], table['keys'], table['columns']
    relation = 'public.' + ident(name)
    # One aggregate row avoids Management API result-row caps. No customer body
    # is downloaded unless the fingerprint changed.
    # jsonb_build_object accepts at most 100 arguments (50 columns).
    row_value = row_sql(columns)
    # The deletion pass only needs IDs, not a second hash of every report body.
    digest_sql = "NULL::text" if delete_only else f"md5({row_value}::text)"
    fingerprints = inventory if inventory is not None else read_all(api, f"SELECT {key_sql(keys)} AS key, {digest_sql} AS digest FROM {relation} t", source=True)
    incoming = {key_text(item['key']): item for item in fingerprints}
    if len(incoming) != len(fingerprints) or any(any(v is None for v in x['key'].values()) for x in fingerprints):
        raise RuntimeError(f'{name}: source keys are not unique/non-null')
    # Also refuse MERGE into ambiguous old Staging rows (some legacy tables lack a PK).
    if previous_rows is None:
        previous_rows = read_all(api, f"SELECT row_key,digest FROM environment_sync.managed_rows WHERE table_name={literal(name)}")
    previous = {key_text(row['row_key']): row for row in previous_rows}
    changed = [item for key, item in incoming.items() if previous.get(key, {}).get('digest') != item['digest']]
    if delete_only: changed = []
    if changed or delete_only:
        duplicate = api.query(f'SELECT EXISTS(SELECT 1 FROM {relation} GROUP BY {",".join(map(ident,keys))} HAVING count(*)>1) AS duplicate')[0]['duplicate']
        if duplicate:
            raise RuntimeError(f'{name}: duplicate Staging keys; reconciliation required')
    applied = 0
    for group in batches(changed):
        matches = ' AND '.join(f't.{ident(k)}=s.{ident(k)}' for k in keys)
        requested = [item['key'] for item in group]
        # Recompute the digest from the SAME row image. A source row can change
        # between inventory and fetch; its newer version must never be skipped.
        rows = api.query(f"SELECT {key_sql(keys)} AS key, md5({row_value}::text) AS digest, {row_value} AS row FROM {relation} t JOIN jsonb_populate_recordset(NULL::{relation},{json_sql(requested)}) s ON {matches}", source=True)
        if rows:
            for statement, count in bounded_apply_batches(name, keys, columns, rows, table.get('array_columns', [])):
                api.query(statement)
                applied += count
    removed = [item['row_key'] for key, item in previous.items() if key not in incoming] if delete_only else []
    deleted = 0
    for group in batches(removed):
        # Confirm absence immediately before deletion. The inventory might have
        # raced a production delete/reinsert. Never delete Staging-only test rows.
        matches = ' AND '.join(f't.{ident(k)}=s.{ident(k)}' for k in keys)
        alive = api.query(f"SELECT {key_sql(keys)} AS key FROM {relation} t JOIN jsonb_populate_recordset(NULL::{relation},{json_sql(group)}) s ON {matches}", source=True)
        alive_keys = {key_text(row['key']) for row in alive}
        gone = [key for key in group if key_text(key) not in alive_keys]
        if not gone: continue
        api.query(f"""BEGIN; SET LOCAL lock_timeout='3s'; SET LOCAL statement_timeout='90s'; {IMPORT_GATE}
DELETE FROM {relation} t USING jsonb_populate_recordset(NULL::{relation},{json_sql(gone)}) s WHERE {matches};
DELETE FROM environment_sync.managed_rows WHERE table_name={literal(name)} AND row_key IN (SELECT value FROM jsonb_array_elements({json_sql(gone)})); COMMIT;""")
        deleted += len(gone)
    if not delete_only and record_state:
        api.query(f"INSERT INTO environment_sync.table_state(table_name,last_success_at,source_rows,changed_rows) VALUES({literal(name)},now(),{len(fingerprints)},{applied}) ON CONFLICT(table_name) DO UPDATE SET last_success_at=EXCLUDED.last_success_at,source_rows=EXCLUDED.source_rows,changed_rows=EXCLUDED.changed_rows")
    return {'table': name, 'source_rows': len(fingerprints), 'changed_rows': applied, 'removed_rows': deleted}


def main():
    args = argparse.ArgumentParser()
    args.add_argument('--apply', action='store_true', help='Default is schema/coverage preflight only')
    args.add_argument('--apply-deletes', action='store_true', help='Requires explicit approval; remove only previously mirrored rows absent from Production')
    options = args.parse_args()
    api = Management(os.environ['PRODUCTION_REF'], os.environ['STAGING_REF'], os.environ['SUPABASE_ACCESS_TOKEN'])
    source = {t['name']: t for t in api.query(CATALOG, source=True)}
    target = {t['name']: t for t in api.query(CATALOG)}
    manifest = json.loads(Path('scripts/staging-data-manifest.json').read_text())
    plan, errors = preflight(manifest['tables'], source, target)
    if errors:
        print(json.dumps({'preflight_errors': errors}, ensure_ascii=False))
        raise SystemExit(1)
    print(f'Preflight: {len(plan)} business tables; source uses the read-only API')
    if not options.apply: return
    gate = api.query("SELECT guard_version,edge_versions FROM environment_sync.safety WHERE singleton AND outbound_blocked")
    if not gate or gate[0]['guard_version'] != 1:
        raise RuntimeError('Staging outbound containment has not been verified')
    if not gate[0]['edge_versions'] or api.function_versions() != gate[0]['edge_versions']:
        api.query("UPDATE environment_sync.safety SET outbound_blocked=false WHERE singleton")
        raise RuntimeError('Staging Edge deployments changed since containment verification')
    foreign_keys = api.query("SELECT child.relname AS child,parent.relname AS parent FROM pg_catalog.pg_constraint c JOIN pg_catalog.pg_class child ON child.oid=c.conrelid JOIN pg_catalog.pg_class parent ON parent.oid=c.confrelid JOIN pg_catalog.pg_namespace n ON n.oid=child.relnamespace WHERE c.contype='f' AND n.nspname='public'")
    plan = dependency_order(plan, foreign_keys)
    incoming, previous = load_inventory(api, plan)
    results = []
    def apply_table(table):
        result = mirror_table(api, table, inventory=incoming[table['name']], previous_rows=previous.get(table['name'], []), record_state=False)
        results.append(result)
        print(json.dumps(result), flush=True)
    ensure_identity_parents(api)
    # Connections can reference a new tenant. Establish tenants first.
    tenant_table = next(t for t in plan if t['name'] == 'tenants')
    apply_table(tenant_table)
    ensure_integration_parents(api)
    failures = []
    for table in plan:
        if table['name'] == 'tenants': continue  # Already loaded for integration parents.
        try:
            apply_table(table)
        except Exception as error:
            # Independent tables still catch up; the run stays red until ALL do.
            failures.append({'table': table['name'], 'error': str(error)})
    record_table_states(api, results)
    if failures:
        print(json.dumps({'failures': failures})); raise SystemExit(1)
    # Child deletions precede parents; FKs remain enabled throughout. If a
    # Staging-only test row references a deleted parent, fail visibly and keep it.
    if options.apply_deletes:
        for table in reversed(plan):
            result = mirror_table(api, table, delete_only=True)
            if result['removed_rows']: print(json.dumps(result), flush=True)
    else:
        print('Upserts complete; deletion mirroring requires explicit approval and --apply-deletes')


if __name__ == '__main__':
    main()
