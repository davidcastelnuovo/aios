// Temporary migration runner — delete after first successful run
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const results: string[] = [];

  const run = async (label: string, sql: string) => {
    const { error } = await supabase.rpc('exec_sql' as any, { sql }).single().catch(() => ({ error: null }));
    // Use raw query via the postgres extension
    const res = await fetch(`${Deno.env.get('SUPABASE_URL')}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!}`,
      },
      body: JSON.stringify({ sql }),
    });
    results.push(`${label}: ${res.status}`);
  };

  // Step 1: Add column
  await run('add_column', `
    ALTER TABLE public.tenant_integrations
      ADD COLUMN IF NOT EXISTS connection_visibility text NOT NULL DEFAULT 'private'
        CHECK (connection_visibility IN ('private', 'org', 'shared'));
  `);

  // Step 2: Update org-level rows
  await run('update_org', `
    UPDATE public.tenant_integrations
      SET connection_visibility = 'org'
      WHERE user_id IS NULL AND connection_visibility = 'private';
  `);

  // Step 3: Update rows with existing permissions
  await run('update_shared', `
    UPDATE public.tenant_integrations ti
      SET connection_visibility = 'shared'
      WHERE ti.user_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM public.integration_user_permissions iup
          WHERE iup.integration_id = ti.id
        );
  `);

  // Step 4: Update user_has_integration_permission function
  await run('update_fn_permission', `
    CREATE OR REPLACE FUNCTION public.user_has_integration_permission(p_user_id uuid, p_integration_id uuid)
     RETURNS boolean
     LANGUAGE plpgsql
     STABLE SECURITY DEFINER
     SET search_path TO 'public'
    AS $$
    DECLARE
      v_integration RECORD;
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
    END;
    $$;
  `);

  // Step 5: Update user_has_integration_access function
  await run('update_fn_access', `
    CREATE OR REPLACE FUNCTION public.user_has_integration_access(p_integration_id uuid)
     RETURNS boolean
     LANGUAGE plpgsql
     STABLE SECURITY DEFINER
     SET search_path TO 'public'
    AS $$
    DECLARE
      v_integration RECORD;
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
    END;
    $$;
  `);

  // Step 6: Create index
  await run('create_index', `
    CREATE INDEX IF NOT EXISTS idx_tenant_integrations_visibility
      ON public.tenant_integrations (tenant_id, integration_type, connection_visibility)
      WHERE is_active = true;
  `);

  return new Response(JSON.stringify({ ok: true, results }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
