import importlib.util
import unittest
from pathlib import Path
spec = importlib.util.spec_from_file_location('mirror', Path(__file__).with_name('sync-staging-data.py'))
mirror = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mirror)


class MirrorTests(unittest.TestCase):
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


if __name__ == '__main__': unittest.main()
