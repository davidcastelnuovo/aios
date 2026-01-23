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
  cost_per_conversion: number;
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

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
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

    // Get access token
    let { data: integration } = await supabase
      .from('tenant_integrations')
      .select('*')
      .eq('tenant_id', tableTenantId)
      .eq('integration_type', 'google_ads')
      .eq('is_active', true)
      .maybeSingle();

    if (!integration?.api_key) {
      return new Response(JSON.stringify({ error: 'Google Ads not connected' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check if token needs refresh
    if (integration.settings?.expires_at && new Date(integration.settings.expires_at) < new Date()) {
      console.log('Token expired, refreshing...');
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

    console.log(`Syncing Google Ads data for ${customerId} from ${startDateStr} to ${endDateStr}`);

    // Use Google Ads Query Language to fetch campaign performance
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
        metrics.cost_per_conversion
      FROM campaign
      WHERE segments.date BETWEEN '${startDate.toISOString().split('T')[0]}' AND '${endDate.toISOString().split('T')[0]}'
      ORDER BY segments.date DESC
    `;

    const searchResponse = await fetch(
      `https://googleads.googleapis.com/v18/customers/${customerId}/googleAds:searchStream`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'developer-token': DEVELOPER_TOKEN,
          'login-customer-id': customerId,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query }),
      }
    );

    const searchData = await searchResponse.json();

    if (searchData.error) {
      console.error('Google Ads API error:', searchData.error);
      return new Response(JSON.stringify({ 
        error: 'Google Ads API error',
        details: searchData.error.message
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Process results
    const records: GoogleAdsRecord[] = [];
    
    for (const batch of (searchData || [])) {
      for (const result of (batch.results || [])) {
        const costMicros = parseInt(result.metrics?.costMicros || '0');
        const cost = costMicros / 1000000; // Convert micros to actual currency
        
        records.push({
          date: result.segments?.date || '',
          campaign_id: result.campaign?.id || '',
          campaign_name: result.campaign?.name || '',
          impressions: parseInt(result.metrics?.impressions || '0'),
          clicks: parseInt(result.metrics?.clicks || '0'),
          ctr: parseFloat(result.metrics?.ctr || '0') * 100, // Convert to percentage
          cpc: parseInt(result.metrics?.averageCpc || '0') / 1000000,
          cost: cost,
          conversions: parseFloat(result.metrics?.conversions || '0'),
          cost_per_conversion: parseFloat(result.metrics?.costPerConversion || '0') / 1000000,
        });
      }
    }

    console.log(`Got ${records.length} Google Ads records`);

    // Create fields if they don't exist
    const fieldKeys = ['date', 'campaign_name', 'campaign_id', 'impressions', 'clicks', 'ctr', 'cpc', 'cost', 'conversions', 'cost_per_conversion'];
    const fieldNames = ['תאריך', 'שם הקמפיין', 'מזהה קמפיין', 'חשיפות', 'קליקים', 'אחוז קליקים', 'עלות לקליק', 'הוצאה', 'המרות', 'עלות להמרה'];
    const fieldTypes = ['date', 'text', 'text', 'number', 'number', 'number', 'number', 'number', 'number', 'number'];
    
    for (let i = 0; i < fieldKeys.length; i++) {
      const { data: existingField } = await supabase
        .from('crm_fields')
        .select('id')
        .eq('table_id', table_id)
        .eq('key', fieldKeys[i])
        .single();
      
      if (!existingField) {
        await supabase.from('crm_fields').insert({
          table_id,
          key: fieldKeys[i],
          name: fieldNames[i],
          type: fieldTypes[i],
          position: i,
        });
      }
    }

    // Delete existing records and insert new ones
    await supabase
      .from('crm_records')
      .delete()
      .eq('table_id', table_id)
      .eq('tenant_id', tableTenantId);

    // Insert new records
    for (const record of records) {
      await supabase.from('crm_records').insert({
        table_id,
        tenant_id: tableTenantId,
        created_by: user.id,
        data: record,
      });
    }

    // Update last_sync_at
    await supabase
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
      records_synced: records.length,
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
