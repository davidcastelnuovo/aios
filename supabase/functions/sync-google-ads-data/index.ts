import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const DEVELOPER_TOKEN = Deno.env.get('GOOGLE_ADS_DEVELOPER_TOKEN') || '';
const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID') || '';
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET') || '';

interface GoogleAdsRecord {
  date: string;
  campaign_id: string;
  campaign_name: string;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  cost: number;
  conversions: number;
  conversions_value: number;
  cost_per_conversion: number;
  roas: number;
}

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

    // Allow service-role internal calls (e.g. from cron) to bypass user auth.
    // The caller must include x-internal-cron: true AND a valid service role bearer token.
    const isInternalCron = req.headers.get('x-internal-cron') === 'true';
    const authHeader = req.headers.get('Authorization') || '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const hasServiceRole = !!serviceRoleKey && authHeader === `Bearer ${serviceRoleKey}`;

    let user: { id: string | null };
    if (isInternalCron && hasServiceRole) {
      // System cron: created_by must be NULL (placeholder UUID violates FK to auth.users)
      user = { id: null };
    } else {
      const { data: { user: authedUser }, error: authError } = await supabase.auth.getUser();
      if (authError || !authedUser) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      user = authedUser;
    }

    const { table_id } = await req.json();
    
    if (!table_id) {
      return new Response(JSON.stringify({ error: 'table_id required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get table with integration settings
    const { data: table, error: tableError } = await supabase
      .from('crm_tables')
      .select('*')
      .eq('id', table_id)
      .maybeSingle();

    if (tableError || !table) {
      return new Response(JSON.stringify({ error: 'Table not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const tableTenantId = table.tenant_id;

    if (table.integration_type !== 'google_ads') {
      return new Response(JSON.stringify({ error: 'Table is not a Google Ads table' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const settings = table.integration_settings || {};
    const dataSource = settings.data_source || 'direct_api';
    
    // Check if this table uses Make.com or Webhook for syncing
    if (dataSource === 'make_api' || dataSource === 'webhook') {
      return new Response(JSON.stringify({ 
        error: 'This table uses Make.com for data sync',
        message: 'טבלה זו משתמשת ב-Make.com לסנכרון נתונים. הגדר Scenario ב-Make.com כדי לסנכרן את הנתונים.',
        data_source: dataSource
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    const customerId = settings.customer_id;
    const dateRange = settings.date_range || 'last_30_days';

    if (!customerId) {
      return new Response(JSON.stringify({ error: 'No Google Ads account configured' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get access token — try table tenant first, then fall back to source tenants
    // of cross-tenant agency access (e.g. table in tenant A using Google Ads connected in tenant B
    // because agency is shared via agency_tenant_access).
    let { data: integration } = await supabase
      .from('tenant_integrations')
      .select('*')
      .eq('tenant_id', tableTenantId)
      .eq('integration_type', 'google_ads')
      .eq('is_active', true)
      .maybeSingle();

    if (!integration?.api_key) {
      const { data: accessRows } = await supabase
        .from('agency_tenant_access')
        .select('source_tenant_id')
        .eq('accessing_tenant_id', tableTenantId);
      const sourceTenantIds = (accessRows || [])
        .map((r: any) => r.source_tenant_id)
        .filter((id: any) => !!id && id !== tableTenantId);

      if (sourceTenantIds.length > 0) {
        const { data: fallbackIntegrations } = await supabase
          .from('tenant_integrations')
          .select('*')
          .in('tenant_id', sourceTenantIds)
          .eq('integration_type', 'google_ads')
          .eq('is_active', true);
        integration = (fallbackIntegrations || []).find((i: any) => i.api_key) || null;
      }
    }

    if (!integration?.api_key) {
      return new Response(JSON.stringify({ error: 'Google Ads not connected' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check if token needs refresh
    if (integration.settings?.expires_at && new Date(integration.settings.expires_at) < new Date()) {
      const refreshed = await refreshToken(supabase, integration);
      if (!refreshed) {
        return new Response(JSON.stringify({ error: 'Failed to refresh token' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      // Get updated token
      const { data: updatedIntegration } = await supabase
        .from('tenant_integrations')
        .select('api_key')
        .eq('id', integration.id)
        .single();
      integration.api_key = updatedIntegration?.api_key;
    }

    const accessToken = integration.api_key;

    // Calculate date range
    const now = new Date();
    let startDate: Date;
    let endDate = new Date(now);
    
    switch (dateRange) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'yesterday':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
        break;
      case 'this_week':
        const dayOfWeek = now.getDay();
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek);
        break;
      case 'last_7_days':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
        break;
      case 'last_14_days':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 14);
        break;
      case 'this_month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'last_30_days':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30);
        break;
      case 'last_90_days':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 90);
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30);
    }

    const startDateStr = startDate.toISOString().split('T')[0].replace(/-/g, '');
    const endDateStr = endDate.toISOString().split('T')[0].replace(/-/g, '');


    // Use Google Ads Query Language to fetch campaign performance.
    // We intentionally use ONLY `metrics.conversions` (primary conversions) — not
    // `metrics.all_conversions` — to match exactly the "Conversions" column shown in
    // the Google Ads web UI. all_conversions includes secondary/cross-device/store visits
    // which over-count compared to what the user sees in the UI.
    const query = `
      SELECT
        segments.date,
        campaign.id,
        campaign.name,
        metrics.impressions,
        metrics.clicks,
        metrics.ctr,
        metrics.average_cpc,
        metrics.cost_micros,
        metrics.conversions,
        metrics.conversions_value,
        metrics.cost_per_conversion
      FROM campaign
      WHERE segments.date BETWEEN '${startDate.toISOString().split('T')[0]}' AND '${endDate.toISOString().split('T')[0]}'
      ORDER BY segments.date DESC
    `;

    // Use manager_id (MCC) as login-customer-id if available, otherwise use customerId
    let loginCustomerId = settings.manager_id || customerId;

    let searchResponse = await fetch(
      `https://googleads.googleapis.com/v23/customers/${customerId}/googleAds:searchStream`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'developer-token': DEVELOPER_TOKEN,
          'login-customer-id': loginCustomerId,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query }),
      }
    );

    let searchData = await searchResponse.json();
    console.log(`[sync-google-ads] table=${table_id} customer=${customerId} login=${loginCustomerId} status=${searchResponse.status} dateRange=${startDate.toISOString().split('T')[0]}..${endDate.toISOString().split('T')[0]}`);
    console.log(`[sync-google-ads] response preview:`, JSON.stringify(searchData).slice(0, 800));

    // Helper: detect Google Ads error in any response shape (object, array, or wrapped)
    const detectGAError = (data: any): any | null => {
      if (!data) return null;
      if (data.error) return data.error;
      if (Array.isArray(data) && data.length > 0 && data[0]?.error) return data[0].error;
      return null;
    };

    // Helper: try a list of candidate MCCs and return the first that works
    const tryMccCandidates = async (candidates: string[]): Promise<{ data: any; mcc: string } | null> => {
      for (const mcc of candidates) {
        if (!mcc || mcc === customerId) continue;
        const retryResponse = await fetch(
          `https://googleads.googleapis.com/v23/customers/${customerId}/googleAds:searchStream`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'developer-token': DEVELOPER_TOKEN,
              'login-customer-id': mcc,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ query }),
          }
        );
        const retryData = await retryResponse.json();
        if (!detectGAError(retryData)) {
          console.log(`[sync-google-ads] Found working MCC: ${mcc}`);
          return { data: retryData, mcc };
        }
        console.log(`[sync-google-ads] MCC ${mcc} failed:`, JSON.stringify(detectGAError(retryData)).slice(0, 200));
      }
      return null;
    };

    let initialError = detectGAError(searchData);

    // If failed and no manager_id was set, try to discover the MCC
    if (initialError && !settings.manager_id) {
      console.log('[sync-google-ads] First attempt failed, trying to discover MCC for account', customerId);

      // Build a candidate list:
      // 1) Known historical MCCs (hardcoded fallback for this project)
      // 2) Any MCCs already discovered for other tables in this tenant
      // 3) listAccessibleCustomers
      const knownMccs = ['1625878765', '4568787244', '8225555809', '6200958104'];

      const { data: tenantTables } = await supabaseAdmin
        .from('crm_tables')
        .select('integration_settings')
        .eq('tenant_id', tableTenantId)
        .eq('integration_type', 'google_ads');
      const tenantMccs = Array.from(new Set(
        (tenantTables || [])
          .map((t: any) => t.integration_settings?.manager_id)
          .filter(Boolean)
          .map(String)
      ));

      let listMccs: string[] = [];
      try {
        const listResponse = await fetch('https://googleads.googleapis.com/v23/customers:listAccessibleCustomers', {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'developer-token': DEVELOPER_TOKEN,
          },
        });
        const listData = await listResponse.json();
        listMccs = (listData?.resourceNames || [])
          .map((r: any) => typeof r === 'string' ? r.split('/')[1] : null)
          .filter(Boolean);
      } catch (e) {
        console.warn('[sync-google-ads] listAccessibleCustomers failed:', e);
      }

      const candidates = Array.from(new Set([...tenantMccs, ...knownMccs, ...listMccs]));
      console.log(`[sync-google-ads] MCC candidates to try (${candidates.length}):`, candidates);

      const result = await tryMccCandidates(candidates);
      if (result) {
        searchData = result.data;
        loginCustomerId = result.mcc;
        initialError = null;

        // Save discovered manager_id for future syncs
        await supabaseAdmin
          .from('crm_tables')
          .update({
            integration_settings: { ...settings, manager_id: result.mcc }
          })
          .eq('id', table_id);
      }
    }

    const finalError = detectGAError(searchData);
    if (finalError) {
      console.error('Google Ads API error:', finalError);
      return new Response(JSON.stringify({
        error: 'Google Ads API error',
        details: finalError.message || JSON.stringify(finalError)
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Process results
    const records: GoogleAdsRecord[] = [];
    const batchesArr = Array.isArray(searchData) ? searchData : (searchData?.results ? [searchData] : []);
    console.log(`[sync-google-ads] batches received: ${batchesArr.length}`);

    for (const batch of batchesArr) {
      const results = batch.results || [];
      console.log(`[sync-google-ads] batch results: ${results.length}`);
      for (const result of results) {
        const costMicros = parseInt(result.metrics?.costMicros || '0');
        const cost = costMicros / 1000000; // Convert micros to actual currency
        const conversions = parseFloat(result.metrics?.conversions || '0');
        const conversionsValue = parseFloat(result.metrics?.conversionsValue || '0');
        // ALWAYS use `metrics.conversions` to match the Google Ads UI's "Conversions" column.
        // Previously we fell back to `all_conversions` when conversions==0, but that includes
        // secondary actions (cross-device, store visits, view-through) and over-counted vs UI.
        // If a campaign tracks conversions only via `all_conversions`, the user should see 0
        // here — same as Google Ads UI shows in the primary Conversions column.
        const finalConversions = conversions;
        const roas = cost > 0 ? conversionsValue / cost : 0;

        records.push({
          date: result.segments?.date || '',
          campaign_id: result.campaign?.id || '',
          campaign_name: result.campaign?.name || '',
          impressions: parseInt(result.metrics?.impressions || '0'),
          clicks: parseInt(result.metrics?.clicks || '0'),
          ctr: parseFloat(result.metrics?.ctr || '0') * 100, // Convert to percentage
          cpc: parseInt(result.metrics?.averageCpc || '0') / 1000000,
          cost: cost,
          conversions: finalConversions,
          conversions_value: conversionsValue,
          cost_per_conversion: parseInt(result.metrics?.costPerConversion || '0') / 1000000,
          roas: Math.round(roas * 100) / 100,
        });
      }
    }
    console.log(`[sync-google-ads] total records parsed: ${records.length}`);


    // Create fields if they don't exist (use admin client - table may belong to a different tenant)
    const fieldKeys = ['date', 'campaign_name', 'campaign_id', 'impressions', 'clicks', 'ctr', 'cpc', 'cost', 'conversions', 'conversions_value', 'cost_per_conversion', 'roas'];
    const fieldNames = ['תאריך', 'שם הקמפיין', 'מזהה קמפיין', 'חשיפות', 'קליקים', 'אחוז קליקים', 'עלות לקליק', 'הוצאה', 'המרות', 'ערך המרות', 'עלות להמרה', 'ROAS'];
    const fieldTypes = ['date', 'text', 'text', 'number', 'number', 'number', 'number', 'number', 'number', 'number', 'number', 'number'];

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
        if (fieldErr) console.error(`[sync-google-ads] field insert error for ${fieldKeys[i]}:`, fieldErr.message);
      }
    }

    // Delete existing records and insert new ones (admin client to bypass RLS)
    const { error: delErr } = await supabaseAdmin
      .from('crm_records')
      .delete()
      .eq('table_id', table_id)
      .eq('tenant_id', tableTenantId);
    if (delErr) console.error('[sync-google-ads] delete error:', delErr.message);

    // Insert new records (batched)
    let inserted = 0;
    if (records.length > 0) {
      const rows = records.map((record) => ({
        table_id,
        tenant_id: tableTenantId,
        created_by: user.id,
        data: record as any,
      }));
      const { error: insErr, count } = await supabaseAdmin
        .from('crm_records')
        .insert(rows, { count: 'exact' });
      if (insErr) {
        console.error('[sync-google-ads] insert error:', insErr.message);
      } else {
        inserted = count ?? rows.length;
      }
    }
    console.log(`[sync-google-ads] inserted: ${inserted}`);

    // Update last_sync_at (admin to bypass RLS for cross-tenant tables)
    await supabaseAdmin
      .from('crm_tables')
      .update({
        integration_settings: {
          ...settings,
          last_sync_at: new Date().toISOString(),
        }
      })
      .eq('id', table_id);

    return new Response(JSON.stringify({
      success: true,
      records_synced: inserted,
      last_sync_at: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Error in sync-google-ads-data:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

async function refreshToken(supabase: any, integration: any): Promise<boolean> {
  try {
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        refresh_token: integration.settings.refresh_token,
        grant_type: 'refresh_token',
      }),
    });

    const tokens = await tokenResponse.json();

    if (tokens.error) {
      console.error('Token refresh error:', tokens);
      return false;
    }

    const expiresAt = new Date(Date.now() + (tokens.expires_in * 1000)).toISOString();

    await supabase
      .from('tenant_integrations')
      .update({
        api_key: tokens.access_token,
        settings: {
          ...integration.settings,
          expires_at: expiresAt,
        },
      })
      .eq('id', integration.id);

    return true;
  } catch (err) {
    console.error('Error refreshing token:', err);
    return false;
  }
}
