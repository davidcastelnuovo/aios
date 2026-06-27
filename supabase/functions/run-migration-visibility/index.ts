// Temporary migration runner — delete after first successful run
// Uses run_ddl_once RPC (same pattern as run-db-migration).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const SB_URL = Deno.env.get('SUPABASE_URL')!;
const SB_SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const db = createClient(SB_URL, SB_SERVICE, { auth: { persistSession: false } });

  const ddl = [
    `ALTER TABLE public.tenant_integrations ADD COLUMN IF NOT EXISTS connection_visibility text NOT NULL DEFAULT 'private' CHECK (connection_visibility IN ('private', 'org', 'shared'))`,
    `UPDATE public.tenant_integrations SET connection_visibility = 'org' WHERE user_id IS NULL AND connection_visibility = 'private'`,
    `UPDATE public.tenant_integrations ti SET connection_visibility = 'shared' WHERE ti.user_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.integration_user_permissions iup WHERE iup.integration_id = ti.id)`,
    `CREATE INDEX IF NOT EXISTS idx_tenant_integrations_visibility ON public.tenant_integrations (tenant_id, integration_type, connection_visibility) WHERE is_active = true`,
    `CREATE OR REPLACE FUNCTION public.user_has_integration_permission(p_user_id uuid, p_integration_id uuid) RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $f$ DECLARE v_integration RECORD; BEGIN SELECT * INTO v_integration FROM tenant_integrations WHERE id = p_integration_id; IF NOT FOUND THEN RETURN FALSE; END IF; IF is_super_admin(p_user_id) THEN RETURN TRUE; END IF; IF v_integration.user_id = p_user_id THEN RETURN TRUE; END IF; IF v_integration.user_id IS NULL OR v_integration.connection_visibility = 'org' THEN RETURN EXISTS (SELECT 1 FROM tenant_users WHERE tenant_id = v_integration.tenant_id AND user_id = p_user_id); END IF; IF v_integration.connection_visibility = 'shared' THEN RETURN EXISTS (SELECT 1 FROM integration_user_permissions WHERE integration_id = p_integration_id AND user_id = p_user_id); END IF; RETURN FALSE; END; $f$`,
    `CREATE OR REPLACE FUNCTION public.user_has_integration_access(p_integration_id uuid) RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $f$ DECLARE v_integration RECORD; BEGIN SELECT * INTO v_integration FROM tenant_integrations WHERE id = p_integration_id; IF NOT FOUND THEN RETURN FALSE; END IF; IF v_integration.user_id = auth.uid() THEN RETURN TRUE; END IF; IF v_integration.user_id IS NULL OR v_integration.connection_visibility = 'org' THEN RETURN EXISTS (SELECT 1 FROM tenant_users WHERE tenant_id = v_integration.tenant_id AND user_id = auth.uid()); END IF; IF v_integration.connection_visibility = 'shared' THEN RETURN EXISTS (SELECT 1 FROM integration_user_permissions WHERE integration_id = p_integration_id AND user_id = auth.uid()); END IF; RETURN FALSE; END; $f$`,
  ];

  const results: { sql: string; result: string }[] = [];
  for (const sql of ddl) {
    const { data, error } = await db.rpc('run_ddl_once', { sql });
    results.push({ sql: sql.slice(0, 80), result: error ? error.message : (data || 'ok') });
  }

  return new Response(JSON.stringify({ success: true, results }), { status: 200, headers: cors });
});
