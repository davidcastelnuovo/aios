import importlib.util
import unittest
import json
import subprocess
import tempfile
from types import SimpleNamespace
from pathlib import Path
spec = importlib.util.spec_from_file_location('mirror', Path(__file__).with_name('sync-staging-data.py'))
mirror = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mirror)
verify_spec = importlib.util.spec_from_file_location('verify', Path(__file__).with_name('verify-staging-containment.py'))
verify = importlib.util.module_from_spec(verify_spec)
verify_spec.loader.exec_module(verify)


class MirrorTests(unittest.TestCase):
    def test_connection_parent_keeps_personal_scope_and_no_credentials(self):
        class API:
            def query(self, sql, source=False):
                if source:
                    self.source_sql = sql
                    return [{'items': [{'id': '1', 'user_id': 'owner', 'connection_visibility': 'private'}]}]
                self.target_sql = sql
        api = API()
        mirror.ensure_integration_parents(api)
        self.assertIn('user_id', api.source_sql)
        self.assertIn('tenant_id,user_id,integration_type,connection_visibility', api.target_sql)
        self.assertIn("false,false,'{}'::jsonb", api.target_sql)
        self.assertNotIn('api_key', api.source_sql)

    def test_database_error_logs_schema_but_never_row_data(self):
        body = json.dumps({'message': 'ERROR:  23505: duplicate key violates unique constraint "connections_org_unique"\nDETAIL: Key (email)=(private@example.com) already exists.\nINSERT secret-value'})
        self.assertEqual(mirror.safe_database_error(body), ' (SQLSTATE 23505, constraint connections_org_unique)')
        self.assertEqual(mirror.safe_database_error('private raw body'), '')
    def test_legacy_json_skill_strings_fit_staging_arrays_without_changing_source(self):
        for value, expected in [('seo', ['seo']), ('["seo","copy"]', ['seo','copy']), (['seo'], ['seo']), (None, None)]:
            row = {'task_skills': value}
            self.assertEqual(mirror.normalize_arrays(row, ['task_skills'])['task_skills'], expected)
            self.assertEqual(row['task_skills'], value)

    def test_unchanged_inventory_needs_no_per_table_requests(self):
        class API:
            def query(self, *args, **kwargs):
                raise AssertionError('An unchanged cached table must not make a request')
        result = mirror.mirror_table(API(), {'name': 'clients', 'keys': ['id'], 'columns': ['id', 'name']},
            inventory=[{'key': {'id': '1'}, 'digest': 'same'}],
            previous_rows=[{'row_key': {'id': '1'}, 'digest': 'same'}], record_state=False)
        self.assertEqual(result['changed_rows'], 0)
        self.assertEqual(result['source_rows'], 1)

    def test_source_cannot_be_target(self):
        with self.assertRaises(ValueError): mirror.Management('a'*20, 'a'*20, 'fake')

    def test_fk_order_and_cycle(self):
        tables = [{'name': 'records'}, {'name': 'tables'}, {'name': 'clients'}]
        edges = [{'child': 'records', 'parent': 'tables'}, {'child': 'tables', 'parent': 'clients'}]
        self.assertEqual([x['name'] for x in mirror.dependency_order(tables, edges)], ['clients','tables','records'])
        with self.assertRaises(ValueError): mirror.dependency_order(tables, edges + [{'child': 'clients', 'parent':'records'}])

    def test_sql_strings_identifiers_and_atomic_checkpoint(self):
        with self.assertRaises(ValueError): mirror.ident('clients;drop table users')
        self.assertEqual(mirror.literal("O'Reilly\\n"), "E'O''Reilly\\\\n'")
        sql = mirror.apply_batch_sql('clients',['id'],['id','name'],[{'key':{'id':'1'},'digest':'abc','row':{'id':'1','name':"O'Reilly"}}])
        self.assertTrue(sql.startswith('BEGIN;'))
        self.assertTrue(sql.endswith('COMMIT;'))
        self.assertNotIn('SET LOCAL session_replication_role', sql)
        self.assertNotIn('DISABLE TRIGGER ALL', sql)
        self.assertIn("tgenabled='O'",sql)

    def test_missing_column_blocks_preflight_and_secrets_not_managed(self):
        source = {'social_pages': {'pk':['id'],'columns':[{'name':x,'generated':''} for x in ['id','page_access_token','client_id']]}}
        target = {'social_pages': {'columns':[{'name':x,'generated':''} for x in ['id','page_access_token']]}}
        _, errors = mirror.preflight(['social_pages'],source,target)
        self.assertIn('client_id',errors[0])
        target['social_pages']['columns'].append({'name':'client_id','generated':''})
        plan, errors = mirror.preflight(['social_pages'],source,target)
        self.assertEqual(errors,[])
        self.assertNotIn('page_access_token',plan[0]['columns'])

    def test_checkpoints_survive_management_api_row_limit(self):
        items = [{'key': {'id': str(i)}, 'digest': str(i)} for i in range(2501)]
        previous = [{'row_key': x['key'], 'digest': x['digest']} for x in items]

        class CappedAPI:
            def query(self, sql, source=False):
                rows = items if source else previous
                if 'jsonb_agg' in sql:
                    return [{'items': rows}]
                if 'SELECT row_key,digest' in sql:
                    return rows[:1000]  # Simulated result-row cap.
                if 'AS duplicate' in sql:
                    return [{'duplicate': False}]
                if sql.startswith('INSERT INTO environment_sync.table_state'):
                    return []
                raise AssertionError('Unchanged large table must not fetch/apply rows')

        result = mirror.mirror_table(CappedAPI(), {'name': 'clients', 'keys': ['id'], 'columns': ['id','name']})
        self.assertEqual(result['source_rows'], 2501)
        self.assertEqual(result['changed_rows'], 0)


class RecoveryTests(unittest.TestCase):
    def test_source_attestation_requires_identical_function_files_and_live_versions(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            def git(*args):
                return subprocess.check_output(['git', *args], cwd=root, text=True).strip()
            git('init', '-q')
            git('config', 'user.name', 'Test')
            git('config', 'user.email', 'test@example.invalid')
            function = root / 'supabase/functions/report/index.ts'
            function.parent.mkdir(parents=True)
            function.write_text('guarded source')
            git('add', '.')
            git('commit', '-qm', 'reviewed')
            previous = git('rev-parse', 'HEAD')
            (root / 'mirror.py').write_text('data-only change')
            git('add', '.')
            git('commit', '-qm', 'mirror change')
            class API:
                def query(self, sql): return [{'verified_at': 'timestamp', 'source_sha': previous, 'edge_versions': {'report': 1}}]
            self.assertTrue(verify.verified_sources_unchanged(API(), {'report': 1}, root, git('rev-parse', 'HEAD')))
            self.assertFalse(verify.verified_sources_unchanged(API(), {'report': 2}, root, git('rev-parse', 'HEAD')))
            function.write_text('different runtime')
            git('add', '.')
            git('commit', '-qm', 'runtime change')
            self.assertFalse(verify.verified_sources_unchanged(API(), {'report': 1}, root, git('rev-parse', 'HEAD')))

    def test_download_retries_a_rate_limit_without_restart(self):
        calls, pauses = [], []
        results = [SimpleNamespace(returncode=1, stdout='', stderr='Error status 429'),
                   SimpleNamespace(returncode=0, stdout='', stderr='')]
        def run(args, **kwargs):
            calls.append(args)
            return results.pop(0)
        verify.download_function('crm-records', 's'*20, Path('.'), run=run, pause=pauses.append)
        self.assertEqual(len(calls), 2)
        self.assertEqual(calls[0][3], 'crm-records')
        self.assertEqual(pauses, [30, 0.75])

    def test_unverified_checkpoint_does_not_open_import_gate(self):
        class API:
            target = 's'*20
            def query(self, sql): self.sql = sql
        api = API()
        verify.record_state(api, {'report': {'version': 1}}, 'a'*40)
        self.assertIn('VALUES(true,1,false,NULL,', api.sql)
        verify.record_state(api, {'report': {'version': 1}}, 'a'*40, verified=True)
        self.assertIn('VALUES(true,1,true,now(),', api.sql)

    def test_changed_deployment_cannot_resume_from_old_checkpoint(self):
        class API:
            def query(self, sql): return [{'source_sha': 'a'*40, 'edge_versions': {'report': 1}}]
            def function_versions(self): return {'report': 2}
        self.assertEqual(verify.recover_deployment_base(API()), '')


if __name__ == '__main__': unittest.main()
