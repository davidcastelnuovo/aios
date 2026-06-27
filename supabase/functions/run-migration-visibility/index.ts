// Temporary migration runner — delete after first successful run
// Creates run_ddl_once helper first, then runs the visibility migration.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const SB_URL = Deno.env.get('SUPABASE_URL')!;
const SB_SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};

// Execute raw SQL using the postgres REST endpoint (service role)
async function execSQL(sql: string): Promise<{ ok: boolean; result: string }> {
  const res = await fetch(`${SB_URL}/rest/v1/rpc/run_ddl_once`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SB_SERVICE,
      'Authorization': `Bearer ${SB_SERVICE}`,
      'Prefer': 'return=representation',
    },
    body: JSON.stringify({ sql }),
  });
  const text = await res.text();
  return { ok: res.ok, result: text.slice(0, 200) };
}

// Bootstrap: create run_ddl_once via the pg extension endpoint
async function bootstrapDDL(sql: string): Promise<{ ok: boolean; result: string }> {
  // Use the Supabase Management API style — execute via pg_net or direct query
  // The service role can call /rest/v1/rpc/query if it exists, otherwise use
  // the internal postgres connection via the supabase-js client
  const db = createClient(SB_URL, SB_SERVICE, { auth: { persistSession: false } });
  
  // Try using pg extension if available
  const { data, error } = await (db as any).rpc('query', { query: sql }).maybeSingle();
  if (!error) return { ok: true, result: String(data || 'ok') };
  
  // Fallback: try direct postgres via the REST API with a raw query
  const res = await fetch(`${SB_URL}/rest/v1/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SB_SERVICE,
      'Authorization': `Bearer ${SB_SERVICE}`,
      'X-Connection-Encrypted': 'true',
    },
    body: JSON.stringify({ query: sql }),
  });
  return { ok: res.ok, result: (await res.text()).slice(0, 200) };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const db = createClient(SB_URL, SB_SERVICE, { auth: { persistSession: false } });
  const results: { step: string; ok: boolean; result: string }[] = [];

  // Step 0: Create run_ddl_once if it doesn't exist
  const createHelperSQL = `
    CREATE OR REPLACE FUNCTION public.run_ddl_once(sql text)
    RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
    AS $body$
    BEGIN EXECUTE sql; RETURN 'ok';
    EXCEPTION WHEN OTHERS THEN RETURN SQLERRM;
    END; $body$;
    REVOKE ALL ON FUNCTION public.run_ddl_once(text) FROM PUBLIC, authenticated;
    GRANT EXECUTE ON FUNCTION public.run_ddl_once(text) TO service_role;
  `;

  // Try to create the helper using the postgres extension
  const helperRes = await bootstrapDDL(createHelperSQL);
  results.push({ step: 'create_helper', ...helperRes });

  // Now run the actual migration DDL
  const ddl = [
    {
      step: 'add_column',
      sql: `ALTER TABLE public.tenant_integrations ADD COLUMN IF NOT EXISTS connection_visibility text NOT NULL DEFAULT 'private' CHECK (connection_visibility IN ('private', 'org', 'shared'))`,
    },
    {
      step: 'update_org',
      sql: `UPDATE public.tenant_integrations SET connection_visibility = 'org' WHERE user_id IS NULL AND connection_visibility = 'private'`,
    },
    {
      step: 'update_shared',
      sql: `UPDATE public.tenant_integrations ti SET connection_visibility = 'shared' WHERE ti.user_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.integration_user_permissions iup WHERE iup.integration_id = ti.id)`,
    },
    {
      step: 'create_index',
      sql: `CREATE INDEX IF NOT EXISTS idx_tenant_integrations_visibility ON public.tenant_integrations (tenant_id, integration_type, connection_visibility) WHERE is_active = true`,
    },
    {
      step: 'update_fn_permission',
      sql: `CREATE OR REPLACE FUNCTION public.user_has_integration_permission(p_user_id uuid, p_integration_id uuid) RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $f$ DECLARE v_integration RECORD; BEGIN SELECT * INTO v_integration FROM tenant_integrations WHERE id = p_integration_id; IF NOT FOUND THEN RETURN FALSE; END IF; IF is_super_admin(p_user_id) THEN RETURN TRUE; END IF; IF v_integration.user_id = p_user_id THEN RETURN TRUE; END IF; IF v_integration.user_id IS NULL OR v_integration.connection_visibility = 'org' THEN RETURN EXISTS (SELECT 1 FROM tenant_users WHERE tenant_id = v_integration.tenant_id AND user_id = p_user_id); END IF; IF v_integration.connection_visibility = 'shared' THEN RETURN EXISTS (SELECT 1 FROM integration_user_permissions WHERE integration_id = p_integration_id AND user_id = p_user_id); END IF; RETURN FALSE; END; $f$`,
    },
    {
      step: 'update_fn_access',
      sql: `CREATE OR REPLACE FUNCTION public.user_has_integration_access(p_integration_id uuid) RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $f$ DECLARE v_integration RECORD; BEGIN SELECT * INTO v_integration FROM tenant_integrations WHERE id = p_integration_id; IF NOT FOUND THEN RETURN FALSE; END IF; IF v_integration.user_id = auth.uid() THEN RETURN TRUE; END IF; IF v_integration.user_id IS NULL OR v_integration.connection_visibility = 'org' THEN RETURN EXISTS (SELECT 1 FROM tenant_users WHERE tenant_id = v_integration.tenant_id AND user_id = auth.uid()); END IF; IF v_integration.connection_visibility = 'shared' THEN RETURN EXISTS (SELECT 1 FROM integration_user_permissions WHERE integration_id = p_integration_id AND user_id = auth.uid()); END IF; RETURN FALSE; END; $f$`,
    },
  ];

  for (const { step, sql } of ddl) {
    const res = await execSQL(sql);
    results.push({ step, ...res });
  }

  return new Response(JSON.stringify({ success: true, results }), { status: 200, headers: cors });
});
