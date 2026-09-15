/**
 * manus-wa-sync-groups — pull Carmen's WhatsApp group membership from Manus Gateway
 * and upsert into whatsapp_groups for conversation-access configuration.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { normalizeManusGroupsPayload } from '../_shared/manus-wa-groups.mjs';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BASE_URL = Deno.env.get('MANUS_GATEWAY_URL') || 'https://whatsappgw-pzpyrrww.manus.space';
const WORKER_SECRET = Deno.env.get('MANUS_GATEWAY_WORKER_SECRET') || '';

type IntegrationRow = {
  id: string;
  tenant_id: string;
  api_key: string | null;
  settings: Record<string, unknown> | null;
  display_name: string | null;
};

async function fetchGroupsFromGateway(instanceId: string, apiKey: string) {
  const restPath = `/api/v1/instances/${instanceId}/groups`;
  const restRes = await fetch(`${BASE_URL}${restPath}`, {
    method: 'GET',
    headers: { 'X-Api-Key': apiKey },
  });
  if (restRes.ok) {
    const data = await restRes.json();
    return { groups: normalizeManusGroupsPayload(data), via: 'instance_api_key' };
  }

  if (WORKER_SECRET) {
    const adminPath = `/api/admin/instances/${instanceId}/groups`;
    const adminRes = await fetch(`${BASE_URL}${adminPath}`, {
      method: 'GET',
      headers: { 'X-Worker-Secret': WORKER_SECRET },
    });
    if (adminRes.ok) {
      const data = await adminRes.json();
      return { groups: normalizeManusGroupsPayload(data), via: 'admin_worker_secret' };
    }
    const text = await adminRes.text();
    throw new Error(`Gateway admin groups failed: ${adminRes.status} — ${text.slice(0, 300)}`);
  }

  const text = await restRes.text();
  throw new Error(`Gateway groups failed: ${restRes.status} — ${text.slice(0, 300)}`);
}

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

    let query = userClient
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

    const supabaseSvc = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const synced: Array<{ integrationId: string; groupChatId: string; groupId: string; name: string }> = [];
    const errors: Array<{ integrationId: string; error: string }> = [];

    for (const integ of integrations as IntegrationRow[]) {
      const settings = (integ.settings || {}) as Record<string, unknown>;
      const instanceId = String(settings.instance_id || '');
      const apiKey = integ.api_key || '';
      if (!instanceId || !apiKey) {
        errors.push({ integrationId: integ.id, error: 'חסר instance_id או api_key' });
        continue;
      }

      try {
        const { groups, via } = await fetchGroupsFromGateway(instanceId, apiKey);
        const groupChatIds: string[] = [];

        for (const g of groups) {
          const { data: row, error: upsertErr } = await supabaseSvc
            .from('whatsapp_groups')
            .upsert(
              {
                tenant_id: integ.tenant_id,
                group_chat_id: g.id,
                group_name: g.name || g.id,
                description: 'manus_wa_sync',
                updated_at: new Date().toISOString(),
              },
              { onConflict: 'tenant_id,group_chat_id' },
            )
            .select('id, group_name, group_chat_id')
            .maybeSingle();
          if (upsertErr) throw upsertErr;
          if (row?.id) {
            groupChatIds.push(g.id);
            synced.push({
              integrationId: integ.id,
              groupChatId: g.id,
              groupId: row.id,
              name: row.group_name || g.name,
            });
          }
        }

        const mergedSettings = {
          ...settings,
          manus_groups_sync: {
            synced_at: new Date().toISOString(),
            group_chat_ids: groupChatIds,
            count: groupChatIds.length,
            via,
          },
        };
        await supabaseSvc
          .from('tenant_integrations')
          .update({ settings: mergedSettings })
          .eq('id', integ.id);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[manus-wa-sync-groups] integration failed', integ.id, msg);
        errors.push({ integrationId: integ.id, error: msg });
      }
    }

    if (!synced.length && errors.length) {
      return new Response(JSON.stringify({
        success: false,
        error: errors[0]?.error || 'סנכרון קבוצות נכשל',
        errors,
      }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const uniqueGroups = [...new Map(synced.map((g) => [g.groupId, g])).values()];

    return new Response(JSON.stringify({
      success: true,
      syncedCount: uniqueGroups.length,
      groups: uniqueGroups,
      errors: errors.length ? errors : undefined,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    console.error('[manus-wa-sync-groups] error:', msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
