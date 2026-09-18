import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';
import {
  buildAllLevelInsightRecords,
  buildCampaignOptimizationGoalMap,
  buildResultLeadTypeMap,
  type CampaignStatus,
  FB_INSIGHTS_FIELD_KEYS,
  FB_INSIGHTS_FIELD_NAMES,
  FB_INSIGHTS_FIELD_TYPES,
  latestCampaignUpdatedTime,
} from '../_shared/fbInsights.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    // Service-role client for writes (bypass RLS - tables can be in different tenants than the requester)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const requestBody = await req.json();
    const { table_id, _internal_cron } = requestBody;

    // Auth: skip user check when called internally by cron
    let userId: string | null = null;
    if (!_internal_cron) {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      userId = user.id;
    }

    if (!table_id) {
      return new Response(JSON.stringify({ error: 'table_id required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Use admin client for reads to support both user and cron contexts
    const readClient = _internal_cron ? supabaseAdmin : supabase;

    // Get table with integration settings
    const { data: table, error: tableError } = await readClient
      .from('crm_tables')
      .select('*')
      .eq('id', table_id)
      .maybeSingle();

    if (tableError || !table) {
      console.error('Table lookup error:', tableError, 'table_id:', table_id);
      return new Response(JSON.stringify({ error: 'Table not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    const tableTenantId = table.tenant_id;

    if (table.integration_type !== 'facebook_ecommerce') {
      return new Response(JSON.stringify({ error: 'Table is not a Facebook Ecommerce table' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const settings = table.integration_settings || {};
    const rawAdAccountId = settings.ad_account_id;
    const adAccountId = rawAdAccountId && !String(rawAdAccountId).startsWith('act_')
      ? `act_${rawAdAccountId}`
      : rawAdAccountId;
    const dateRange = settings.date_range || 'last_30_days';

    if (!adAccountId) {
      return new Response(JSON.stringify({ error: 'No ad account configured' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Prefer the connection stored on the table (Anna/Yuval/David), then any active FB token on the tenant.
    const storedIntegrationId = settings.integration_id || settings.integrationId || null;
    let integration: { api_key?: string | null; shared_from_integration_id?: string | null } | null = null;

    if (storedIntegrationId) {
      const { data: stored } = await supabaseAdmin
        .from('tenant_integrations')
        .select('api_key, shared_from_integration_id')
        .eq('id', storedIntegrationId)
        .in('integration_type', ['facebook', 'facebook_lead_ads'])
        .eq('is_active', true)
        .maybeSingle();
      integration = stored;
    }

    if (!integration?.api_key) {
      const { data: orgIntegration } = await supabaseAdmin
        .from('tenant_integrations')
        .select('api_key, shared_from_integration_id')
        .eq('tenant_id', tableTenantId)
        .in('integration_type', ['facebook', 'facebook_lead_ads'])
        .eq('is_active', true)
        .in('connection_visibility', ['org', 'private'])
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      integration = orgIntegration;
    }

    if (!integration?.api_key) {
      const { data: fallback } = await supabaseAdmin
        .from('tenant_integrations')
        .select('api_key, shared_from_integration_id')
        .eq('tenant_id', tableTenantId)
        .in('integration_type', ['facebook', 'facebook_lead_ads'])
        .eq('is_active', true)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      integration = fallback;
    }

    // If this is a shared integration, fetch the source integration's token
    if (integration?.shared_from_integration_id && !integration?.api_key) {
      const { data: sourceIntegration } = await supabaseAdmin
        .from('tenant_integrations')
        .select('api_key')
        .eq('id', integration.shared_from_integration_id)
        .eq('is_active', true)
        .maybeSingle();
      
      if (sourceIntegration?.api_key) {
        integration = { ...integration, api_key: sourceIntegration.api_key };
      }
    }

    if (!integration?.api_key) {
      return new Response(JSON.stringify({ error: 'Facebook not configured' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const accessToken = integration.api_key;

    // Calculate date range
    const now = new Date();
    let since: Date;
    let until = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    switch (dateRange) {
      case 'today':
        since = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'yesterday':
        since = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
        until = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
        break;
      case 'this_week':
        const dayOfWeek = now.getDay();
        since = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek);
        break;
      case 'last_week': {
        const dow = now.getDay();
        const startOfThisWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dow);
        since = new Date(startOfThisWeek);
        since.setDate(startOfThisWeek.getDate() - 7);
        until = new Date(startOfThisWeek);
        until.setDate(startOfThisWeek.getDate() - 1);
        break;
      }
      case 'last_7_days':
        since = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
        until = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'last_14_days':
        since = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 14);
        break;
      case 'this_month':
        since = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'last_30_days':
        since = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30);
        break;
      case 'last_90_days':
        since = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 90);
        break;
      default:
        since = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30);
    }

    const sinceStr = since.toISOString().split('T')[0];
    const untilStr = until.toISOString().split('T')[0];


    const campaignsUrl = `https://graph.facebook.com/v21.0/${adAccountId}/campaigns?fields=id,name,effective_status,configured_status,objective,updated_time&limit=500&access_token=${accessToken}`;
    const campaignsResponse = await fetch(campaignsUrl);
    const campaignsData = await campaignsResponse.json();

    const campaignStatuses: Record<string, CampaignStatus> = {};
    if (campaignsData.data) {
      for (const campaign of campaignsData.data) {
        campaignStatuses[campaign.id] = {
          id: campaign.id,
          name: campaign.name,
          effective_status: campaign.effective_status,
          configured_status: campaign.configured_status,
          objective: campaign.objective || null,
          updated_time: campaign.updated_time || null,
        };
      }
    }

    const adsets: Array<{ campaign_id?: string; optimization_goal?: string; promoted_object?: unknown }> = [];
    {
      let next: string | null = `https://graph.facebook.com/v21.0/${adAccountId}/adsets?fields=campaign_id,optimization_goal,promoted_object&limit=500&access_token=${accessToken}`;
      while (next) {
        const r = await fetch(next);
        const d: any = await r.json();
        if (d.error) break;
        if (Array.isArray(d.data)) adsets.push(...d.data);
        next = d.paging?.next || null;
      }
    }
    const campaignObjectives: Record<string, string | null | undefined> = {};
    for (const c of Object.values(campaignStatuses)) campaignObjectives[c.id] = c.objective;
    const resultLeadTypes = buildResultLeadTypeMap(adsets, campaignObjectives);
    const optimizationGoals = buildCampaignOptimizationGoalMap(adsets);

    const { records: insights, levelCounts } = await buildAllLevelInsightRecords(
      adAccountId,
      sinceStr,
      untilStr,
      accessToken,
      campaignStatuses,
      resultLeadTypes,
      optimizationGoals,
    );
    console.log(`[sync-facebook-ecommerce] synced ${insights.length} rows`, levelCounts);

    const fieldKeys = FB_INSIGHTS_FIELD_KEYS;
    const fieldNames = FB_INSIGHTS_FIELD_NAMES;
    const fieldTypes = FB_INSIGHTS_FIELD_TYPES;

    // Create/update fields (use admin to bypass RLS for cross-tenant tables)
    for (let i = 0; i < fieldKeys.length; i++) {
      const { data: existingField } = await supabaseAdmin
        .from('crm_fields')
        .select('id')
        .eq('table_id', table_id)
        .eq('key', fieldKeys[i])
        .maybeSingle();
      
      if (!existingField) {
        const { error: fieldErr } = await supabaseAdmin.from('crm_fields').insert({
          table_id,
          key: fieldKeys[i],
          name: fieldNames[i],
          type: fieldTypes[i],
          position: i,
        });
        if (fieldErr) console.error(`[sync-facebook-ecommerce] field insert error for ${fieldKeys[i]}:`, fieldErr.message);
      }
    }

    // Delete existing records and insert new ones (admin client to bypass RLS).
    // table_id only — orphan rows from a previous tenant_id must not survive sync.
    const { error: delErr } = await supabaseAdmin
      .from('crm_records')
      .delete()
      .eq('table_id', table_id);
    if (delErr) console.error('[sync-facebook-ecommerce] delete error:', delErr.message);

    // Insert new records (batched)
    let inserted = 0;
    if (insights.length > 0) {
      const rows = insights.map((insight) => ({
        table_id,
        tenant_id: tableTenantId,
        created_by: userId,
        data: insight as any,
      }));
      const { error: insErr, count } = await supabaseAdmin
        .from('crm_records')
        .insert(rows, { count: 'exact' });
      if (insErr) {
        console.error('[sync-facebook-ecommerce] insert error:', insErr.message);
      } else {
        inserted = count ?? rows.length;
      }
    }
    console.log(`[sync-facebook-ecommerce] inserted: ${inserted}`);

    // Update last_sync_at on both the column and settings so health/pulse do
    // not treat a fresh settings sync as stale because the column was null/old.
    const syncedAt = new Date().toISOString();
    const { data: freshTable } = await supabaseAdmin
      .from('crm_tables')
      .select('integration_settings')
      .eq('id', table_id)
      .maybeSingle();
    const currentSettings = (freshTable?.integration_settings || settings || {}) as Record<string, unknown>;
    const lastCampaignUpdatedAt = latestCampaignUpdatedTime(campaignStatuses);
    await supabaseAdmin
      .from('crm_tables')
      .update({
        last_sync_at: syncedAt,
        integration_settings: {
          ...currentSettings,
          last_sync_at: syncedAt,
          last_campaign_updated_at: lastCampaignUpdatedAt,
        }
      })
      .eq('id', table_id);


    return new Response(JSON.stringify({ 
      success: true,
      records_synced: inserted,
      last_sync_at: syncedAt
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Error in sync-facebook-ecommerce:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
