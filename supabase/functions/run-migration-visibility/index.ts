// Temporary migration runner — delete after first successful run
// Uses postgres.js to connect directly to the DB via SUPABASE_DB_URL.
import postgres from 'https://deno.land/x/postgresjs@v3.4.5/mod.js';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  // SUPABASE_DB_URL is available in edge functions as the direct postgres connection
  const dbUrl = Deno.env.get('SUPABASE_DB_URL');
  if (!dbUrl) {
    return new Response(JSON.stringify({ error: 'SUPABASE_DB_URL not available' }), {
      status: 500,
      headers: cors,
    });
  }

  const sql = postgres(dbUrl, { max: 1 });
  const results: { step: string; result: string }[] = [];

  const run = async (step: string, query: string) => {
    try {
      await sql.unsafe(query);
      results.push({ step, result: 'ok' });
    } catch (e: any) {
      results.push({ step, result: e.message || String(e) });
    }
  };

  await run('add_column', `
    ALTER TABLE public.tenant_integrations
      ADD COLUMN IF NOT EXISTS connection_visibility text NOT NULL DEFAULT 'private'
        CHECK (connection_visibility IN ('private', 'org', 'shared'))
  `);

  await run('update_org', `
    UPDATE public.tenant_integrations
      SET connection_visibility = 'org'
      WHERE user_id IS NULL AND connection_visibility = 'private'
  `);

  await run('update_shared', `
    UPDATE public.tenant_integrations ti
      SET connection_visibility = 'shared'
      WHERE ti.user_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM public.integration_user_permissions iup
          WHERE iup.integration_id = ti.id
        )
  `);

  await run('create_index', `
    CREATE INDEX IF NOT EXISTS idx_tenant_integrations_visibility
      ON public.tenant_integrations (tenant_id, integration_type, connection_visibility)
      WHERE is_active = true
  `);

  await run('update_fn_permission', `
    CREATE OR REPLACE FUNCTION public.user_has_integration_permission(p_user_id uuid, p_integration_id uuid)
     RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
    AS $f$
    DECLARE v_integration RECORD;
    BEGIN
      SELECT * INTO v_integration FROM tenant_integrations WHERE id = p_integration_id;
      IF NOT FOUND THEN RETURN FALSE; END IF;
      IF is_super_admin(p_user_id) THEN RETURN TRUE; END IF;
      IF v_integration.user_id = p_user_id THEN RETURN TRUE; END IF;
      IF v_integration.user_id IS NULL OR v_integration.connection_visibility = 'org' THEN
        RETURN EXISTS (SELECT 1 FROM tenant_users WHERE tenant_id = v_integration.tenant_id AND user_id = p_user_id);
      END IF;
      IF v_integration.connection_visibility = 'shared' THEN
        RETURN EXISTS (SELECT 1 FROM integration_user_permissions WHERE integration_id = p_integration_id AND user_id = p_user_id);
      END IF;
      RETURN FALSE;
    END; $f$
  `);

  await run('update_fn_access', `
    CREATE OR REPLACE FUNCTION public.user_has_integration_access(p_integration_id uuid)
     RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
    AS $f$
    DECLARE v_integration RECORD;
    BEGIN
      SELECT * INTO v_integration FROM tenant_integrations WHERE id = p_integration_id;
      IF NOT FOUND THEN RETURN FALSE; END IF;
      IF v_integration.user_id = auth.uid() THEN RETURN TRUE; END IF;
      IF v_integration.user_id IS NULL OR v_integration.connection_visibility = 'org' THEN
        RETURN EXISTS (SELECT 1 FROM tenant_users WHERE tenant_id = v_integration.tenant_id AND user_id = auth.uid());
      END IF;
      IF v_integration.connection_visibility = 'shared' THEN
        RETURN EXISTS (SELECT 1 FROM integration_user_permissions WHERE integration_id = p_integration_id AND user_id = auth.uid());
      END IF;
      RETURN FALSE;
    END; $f$
  `);

  await sql.end();

  return new Response(JSON.stringify({ success: true, results }), { status: 200, headers: cors });
});
