-- Helper function for running DDL from edge functions.
-- Used by run-db-migration edge function.
-- Can be dropped after migration is confirmed.
CREATE OR REPLACE FUNCTION public.run_ddl_once(sql text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  EXECUTE sql;
  RETURN 'ok';
EXCEPTION WHEN OTHERS THEN
  RETURN SQLERRM;
END;
$$;

-- Only service_role can call this
REVOKE ALL ON FUNCTION public.run_ddl_once(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.run_ddl_once(text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.run_ddl_once(text) TO service_role;
