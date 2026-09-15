"""Real PostgreSQL regression tests. Run only against the disposable CI service."""
import importlib.util
import os
from pathlib import Path
import subprocess
import unittest

spec = importlib.util.spec_from_file_location('mirror', Path(__file__).with_name('sync-staging-data.py'))
mirror = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mirror)
DSN = os.environ.get('MIRROR_TEST_DSN')


@unittest.skipUnless(DSN, 'requires disposable PostgreSQL test service')
class MirrorPostgresTests(unittest.TestCase):
    def sql(self, sql, success=True):
        result = subprocess.run(['psql', DSN, '-XAtq', '-v', 'ON_ERROR_STOP=1'], input=sql,
                                capture_output=True, text=True)
        if success:
            self.assertEqual(result.returncode, 0, result.stderr)
        else:
            self.assertNotEqual(result.returncode, 0)
        return result.stdout.strip()

    def setUp(self):
        # These names exist only in the disposable service; no hosted credentials
        # are provided to this job. Abort if accidentally pointed at Supabase.
        self.assertEqual(self.sql("SELECT current_database()"), 'mirror_test')
        self.sql("""
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated; END IF;
END $$;
DROP SCHEMA IF EXISTS environment_sync CASCADE;
DROP TABLE IF EXISTS public.mirror_probe CASCADE;
DROP TABLE IF EXISTS public.mirror_parent CASCADE;
DROP TABLE IF EXISTS public.mirror_side_effects CASCADE;
CREATE TABLE public.mirror_parent(id text PRIMARY KEY);
INSERT INTO public.mirror_parent VALUES('parent');
CREATE TABLE public.mirror_side_effects(id integer);
CREATE TABLE public.mirror_probe(id text PRIMARY KEY,parent_id text REFERENCES public.mirror_parent(id),name text UNIQUE,amount integer CHECK(amount>=0));
INSERT INTO public.mirror_probe VALUES('seed','parent','existing',1);
CREATE OR REPLACE FUNCTION public.mirror_effect() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN INSERT INTO public.mirror_side_effects VALUES(1); RETURN NEW; END $$;
CREATE TRIGGER mirror_effect BEFORE INSERT OR UPDATE ON public.mirror_probe FOR EACH ROW EXECUTE FUNCTION public.mirror_effect();
""" + Path('supabase/ops/install_staging_data_mirror.sql').read_text() + """
INSERT INTO environment_sync.safety(singleton,guard_version,outbound_blocked) VALUES(true,1,true);
""")

    def batch(self, rows):
        items = [{'key': {'id': row['id']}, 'digest': 'hash-'+row['id'], 'row': row} for row in rows]
        return mirror.apply_batch_sql('mirror_probe', ['id'], ['id','parent_id','name','amount'], items)

    def test_bulk_failure_preserves_valid_rows_and_retries_rejected_rows(self):
        good = {'id':'good','parent_id':'parent',"name":"$apply$ O'Reilly \\ נתונים",'amount':1}
        missing = {'id':'missing','parent_id':'later','name':'missing','amount':1}
        duplicate = {'id':'duplicate','parent_id':'parent','name':'existing','amount':1}
        invalid = {'id':'invalid','parent_id':'parent','name':'invalid','amount':-1}
        self.assertEqual(self.sql(self.batch([good,missing,duplicate,invalid])), '3')
        self.assertEqual(self.sql('SELECT count(*) FROM public.mirror_probe'), '2')
        self.assertEqual(self.sql('SELECT count(*) FROM environment_sync.managed_rows'), '1')
        self.assertEqual(self.sql('SELECT count(*) FROM environment_sync.rejected_rows'), '3')
        self.assertEqual(self.sql('SELECT count(*) FROM public.mirror_side_effects'), '0')
        self.assertEqual(self.sql("SELECT tgenabled FROM pg_trigger WHERE tgname='mirror_effect' AND tgrelid='public.mirror_probe'::regclass"), 'O')
        self.sql("INSERT INTO public.mirror_parent VALUES('later')")
        self.assertEqual(self.sql(self.batch([missing])), '0')
        self.assertEqual(self.sql("SELECT count(*) FROM environment_sync.rejected_rows WHERE row_key->>'id'='missing'"), '0')
        self.assertEqual(self.sql('SELECT count(*) FROM environment_sync.managed_rows'), '2')

    def test_closed_gate_cannot_write_or_checkpoint(self):
        self.sql('UPDATE environment_sync.safety SET outbound_blocked=false')
        self.sql(self.batch([{'id':'blocked','parent_id':'parent','name':'blocked','amount':1}]), success=False)
        self.assertEqual(self.sql("SELECT count(*) FROM public.mirror_probe WHERE id='blocked'"), '0')
        self.assertEqual(self.sql('SELECT count(*) FROM environment_sync.managed_rows'), '0')

    def test_checkpoint_failure_rolls_back_data_and_restores_triggers(self):
        self.sql("""CREATE FUNCTION environment_sync.fail_checkpoint() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE unique_violation USING MESSAGE='checkpoint failure'; END $$;
CREATE TRIGGER fail_checkpoint BEFORE INSERT ON environment_sync.managed_rows FOR EACH ROW EXECUTE FUNCTION environment_sync.fail_checkpoint();""")
        self.sql(self.batch([{'id':'rolled_back','parent_id':'parent','name':'rolled_back','amount':1}]), success=False)
        self.assertEqual(self.sql("SELECT count(*) FROM public.mirror_probe WHERE id='rolled_back'"), '0')
        self.assertEqual(self.sql('SELECT count(*) FROM environment_sync.rejected_rows'), '0')
        self.assertEqual(self.sql("SELECT tgenabled FROM pg_trigger WHERE tgname='mirror_effect' AND tgrelid='public.mirror_probe'::regclass"), 'O')


if __name__ == '__main__':
    unittest.main()
