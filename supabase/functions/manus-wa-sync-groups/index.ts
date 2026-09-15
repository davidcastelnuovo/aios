/**
 * manus-wa-sync-groups — pull Carmen's WhatsApp group membership from Manus Gateway
 * and upsert into whatsapp_groups for conversation-access configuration.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { syncManusGroupsForTenant } from '../_shared/manus-wa-sync-groups-core.mjs';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type IntegrationRow = {
  id: string;
  tenant_id: string;
  api_key: string | null;
  settings: Record<string, unknown> | null;
  display_name: string | null;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization') || '';
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } },
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: claims } = await userClient.auth.getClaims(token);
    if (!claims?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { tenantId, integrationId } = await req.json() as { tenantId?: string; integrationId?: string };
    if (!tenantId) {
      return new Response(JSON.stringify({ error: 'tenantId is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: membership, error: memberErr } = await userClient
      .from('tenant_users')
      .select('tenant_id')
      .eq('tenant_id', tenantId)
      .limit(1);
    if (memberErr) throw memberErr;
    if (!membership?.length) {
      return new Response(JSON.stringify({ error: 'אין הרשאה לטננט זה' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseSvc = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    let query = supabaseSvc
      .from('tenant_integrations')
      .select('id, tenant_id, api_key, settings, display_name')
      .eq('tenant_id', tenantId)
      .eq('integration_type', 'manus_wa')
      .eq('is_active', true);
    if (integrationId) query = query.eq('id', integrationId);

    const { data: integrations, error: integErr } = await query;
    if (integErr) throw integErr;
    if (!integrations?.length) {
      return new Response(JSON.stringify({ error: 'לא נמצא חיבור Manus פעיל לטננט' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const result = await syncManusGroupsForTenant(supabaseSvc, integrations as IntegrationRow[]);
    if (!result.success) {
      return new Response(JSON.stringify(result), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    console.error('[manus-wa-sync-groups] error:', msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
