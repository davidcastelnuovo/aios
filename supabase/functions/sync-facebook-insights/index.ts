import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';
import {
  buildInsightRecord,
  buildResultLeadTypeMap,
  type CampaignStatus,
  type InsightRecord,
  FB_INSIGHTS_FIELD_KEYS,
  FB_INSIGHTS_FIELD_NAMES,
  FB_INSIGHTS_FIELD_TYPES,
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

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { table_id } = await req.json();
    
    if (!table_id) {
      return new Response(JSON.stringify({ error: 'table_id required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { data: tenantId } = await supabase.rpc('get_user_tenant_id', { _user_id: user.id });
    if (!tenantId) {
      return new Response(JSON.stringify({ error: 'No tenant found' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get table with integration settings - let RLS handle access control
    const { data: table, error: tableError } = await supabase
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
    
    // Use the table's tenant_id for subsequent operations
    const tableTenantId = table.tenant_id;

    if (table.integration_type !== 'facebook_insights') {
      return new Response(JSON.stringify({ error: 'Table is not a Facebook Insights table' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const settings = table.integration_settings || {};
    const adAccountId = settings.ad_account_id;
    const dateRange = settings.date_range || 'last_30_days';

    if (!adAccountId) {
      return new Response(JSON.stringify({ error: 'No ad account configured' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get Facebook access token (including shared integrations)
    let { data: integration } = await supabase
      .from('tenant_integrations')
      .select('api_key, shared_from_integration_id')
      .eq('tenant_id', tableTenantId)
      .in('integration_type', ['facebook', 'facebook_lead_ads'])
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();

    // If this is a shared integration, fetch the source integration's token
    if (integration?.shared_from_integration_id && !integration?.api_key) {
      const { data: sourceIntegration } = await supabase
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
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let until = new Date(today);

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
      case 'last_7_days':
        since = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
        until = today;
        break;
      case 'last_14_days':
        since = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 14);
        until = today;
        break;
      case 'this_month':
        since = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'last_30_days':
        since = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30);
        until = today;
        break;
      case 'last_90_days':
        since = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 90);
        until = today;
        break;
      case 'last_180_days':
        since = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 180);
        until = today;
        break;
      case 'last_365_days':
        since = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 365);
        until = today;
        break;
      default:
        since = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30);
        until = today;
    }

    const sinceStr = since.toISOString().split('T')[0];
    const untilStr = until.toISOString().split('T')[0];


    // First, fetch campaign statuses to detect real blocks
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

    // Fetch ad sets' promoted_object so we know the EXACT event each campaign is
    // optimized for (its "Result" in Ads Manager) — e.g. the custom pixel event
    // "NewLead" rather than the broad fb_pixel_lead — keeping leads from inflating.
    const adsets: any[] = [];
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

    // Also fetch ad account status
    const accountUrl = `https://graph.facebook.com/v21.0/${adAccountId}?fields=account_status,disable_reason,name&access_token=${accessToken}`;
    const accountResponse = await fetch(accountUrl);
    const accountData = await accountResponse.json();

    let accountStatus = 'active';
    let accountDisableReason = null;
    if (accountData.account_status) {
      // account_status: 1=Active, 2=Disabled, 3=Unsettled, 7=Pending Risk Review, 9=Pending Settlement, 101=Closed
      const statusMap: Record<number, string> = {
        1: 'active',
        2: 'disabled',
        3: 'unsettled',
        7: 'pending_risk_review',
        9: 'pending_settlement',
        101: 'closed',
      };
      accountStatus = statusMap[accountData.account_status] || `unknown_${accountData.account_status}`;
      accountDisableReason = accountData.disable_reason || null;
    }

    // Fetch insights from Facebook with time_increment=1 for daily breakdown.
    // IMPORTANT: We rely ONLY on use_unified_attribution_setting=true to match the
    // numbers shown in Ads Manager UI. We must NOT pass action_attribution_windows,
    // because doing so makes Facebook return `value` as the SUM across the requested
    // windows (e.g. 7d_click + 1d_view), which double/triple counts the same user
    // and inflates purchases/leads by 2x-3x vs. what Ads Manager displays.
    const insightsUrl = `https://graph.facebook.com/v21.0/${adAccountId}/insights?level=campaign&fields=campaign_id,campaign_name,impressions,clicks,cpm,ctr,actions,action_values,conversions,cost_per_action_type,cost_per_conversion,spend&time_range={"since":"${sinceStr}","until":"${untilStr}"}&time_increment=1&use_unified_attribution_setting=true&limit=500&access_token=${accessToken}`;

    // Paginate through ALL pages. A single page caps at 500 rows; busy accounts
    // (many campaign×day rows) would otherwise be truncated, dropping the most
    // recent dates (Facebook returns rows oldest-first).
    const data: any = { data: [] };
    {
      let next: string | null = insightsUrl;
      while (next) {
        const r = await fetch(next);
        const d: any = await r.json();
        if (d.error) { data.error = d.error; break; }
        if (Array.isArray(d.data)) data.data.push(...d.data);
        next = d.paging?.next || null;
      }
    }

    if (data.error) {
      console.error('Facebook API error:', data.error);
      return new Response(JSON.stringify({ 
        error: 'Facebook API error',
        details: data.error.message
      }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`[sync-facebook-insights] Got ${(data.data || []).length} insight rows from FB`);

    // Build CRM records via the shared helper (single source of truth for lead
    // counting, shared with cron-sync-facebook-insights).
    const insights: InsightRecord[] = (data.data || []).map((insight: any) =>
      buildInsightRecord(insight, campaignStatuses, resultLeadTypes)
    );

    // Make sure fields exist for Facebook Insights table (shared schema)
    const fieldKeys = FB_INSIGHTS_FIELD_KEYS;
    const fieldNames = FB_INSIGHTS_FIELD_NAMES;
    const fieldTypes = FB_INSIGHTS_FIELD_TYPES;
    
    // Bulk-ensure fields exist: one read for all keys, one insert for the missing ones.
    const { data: existingFields } = await supabase
      .from('crm_fields')
      .select('key')
      .eq('table_id', table_id);
    const existingFieldKeys = new Set((existingFields || []).map((f: any) => f.key));
    const fieldsToInsert = fieldKeys
      .map((key, i) => ({ table_id, key, name: fieldNames[i], type: fieldTypes[i], position: i }))
      .filter((f) => !existingFieldKeys.has(f.key));
    if (fieldsToInsert.length > 0) {
      await supabase.from('crm_fields').insert(fieldsToInsert);
    }

    // Delete old fields that are no longer needed (date_start, date_stop, landing_page_views)
    await supabase.from('crm_fields')
      .delete()
      .eq('table_id', table_id)
      .in('key', ['date_start', 'date_stop', 'landing_page_views']);

    // Delete existing records and insert new ones
    await supabase
      .from('crm_records')
      .delete()
      .eq('table_id', table_id)
      .eq('tenant_id', tableTenantId);

    // Bulk insert new records (one round-trip per chunk instead of one per row)
    if (insights.length > 0) {
      const recordRows = insights.map((insight) => ({
        table_id,
        tenant_id: tableTenantId,
        created_by: user.id,
        data: insight,
      }));
      const INSERT_CHUNK = 500;
      for (let i = 0; i < recordRows.length; i += INSERT_CHUNK) {
        const { error: insertError } = await supabase
          .from('crm_records')
          .insert(recordRows.slice(i, i + INSERT_CHUNK));
        if (insertError) throw insertError;
      }
    }

    // Update last_sync_at and account status in integration_settings
    await supabase
      .from('crm_tables')
      .update({
        integration_settings: {
          ...settings,
          last_sync_at: new Date().toISOString(),
          account_status: accountStatus,
          account_disable_reason: accountDisableReason,
        }
      })
      .eq('id', table_id);


    return new Response(JSON.stringify({ 
      success: true,
      records_synced: insights.length,
      account_status: accountStatus,
      last_sync_at: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Error in sync-facebook-insights:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
