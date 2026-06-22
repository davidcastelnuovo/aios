import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: req.headers.get('Authorization')! } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { table_id } = await req.json();
    if (!table_id) {
      return new Response(JSON.stringify({ error: 'table_id required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const validTypes = ['meta_ads', 'facebook_insights', 'facebook_ecommerce'];
    if (!validTypes.includes(table.integration_type)) {
      return new Response(JSON.stringify({ error: 'Table is not a Meta Ads / Facebook table' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const settings = table.integration_settings || {};
    const tenantId = table.tenant_id;

    // Get unified connection for Meta Ads
    const { data: integration } = await supabase
      .from('tenant_integrations')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('integration_type', 'unified_ads')
      .eq('is_active', true)
      .maybeSingle();

    if (!integration?.settings?.unified_connection_id) {
      return new Response(JSON.stringify({ error: 'Meta Ads not connected via Unified' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const connectionId = integration.settings.unified_connection_id;
    const unifiedApiKey = Deno.env.get('UNIFIED_API_KEY');
    if (!unifiedApiKey) {
      return new Response(JSON.stringify({ error: 'UNIFIED_API_KEY not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Calculate date range
    const dateRange = settings.date_range || 'last_30_days';
    const now = new Date();
    let startDate: Date;
    const endDate = new Date(now);

    switch (dateRange) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'yesterday':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
        endDate.setDate(endDate.getDate() - 1);
        break;
      case 'last_7_days':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
        break;
      case 'last_14_days':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 14);
        break;
      case 'this_month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'last_90_days':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 90);
        break;
      default: // last_30_days
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30);
    }

    const startStr = startDate.toISOString();
    const endStr = endDate.toISOString();

    // Step 1: Fetch campaigns
    console.log('Fetching Meta Ads campaigns...');
    const campaignsResp = await fetch(
      `https://api.unified.to/ads/${connectionId}/campaign?limit=100`,
      {
        headers: {
          'Authorization': `Bearer ${unifiedApiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );
    const campaigns = await campaignsResp.json();

    if (!campaignsResp.ok) {
      console.error('Failed to fetch campaigns:', campaigns);
      return new Response(JSON.stringify({
        error: 'Failed to fetch campaigns from Meta Ads',
        details: campaigns?.message || campaigns?.error || JSON.stringify(campaigns),
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Step 2: Fetch reports
    console.log('Fetching Meta Ads reports...');
    const reportsParams = new URLSearchParams({
      limit: '200',
      start_gte: startStr,
      end_lt: endStr,
    });

    const reportsResp = await fetch(
      `https://api.unified.to/ads/${connectionId}/report?${reportsParams.toString()}`,
      {
        headers: {
          'Authorization': `Bearer ${unifiedApiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );
    const reports = await reportsResp.json();

    if (!reportsResp.ok) {
      console.error('Failed to fetch reports:', reports);
      return new Response(JSON.stringify({
        error: 'Failed to fetch reports from Meta Ads',
        details: reports?.message || reports?.error || JSON.stringify(reports),
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Build campaign name lookup
    const campaignMap: Record<string, string> = {};
    if (Array.isArray(campaigns)) {
      for (const c of campaigns) {
        if (c.id && c.name) {
          campaignMap[c.id] = c.name;
        }
      }
    }

    // Process reports into records
    interface MetaAdsRecord {
      date: string;
      campaign_name: string;
      campaign_id: string;
      impressions: number;
      clicks: number;
      ctr: number;
      cpc: number;
      cost: number;
      conversions: number;
      cost_per_conversion: number;
      roas: number;
    }

    const records: MetaAdsRecord[] = [];

    if (Array.isArray(reports)) {
      for (const report of reports) {
        const metrics = report.metrics || {};
        const impressions = metrics.impressions || metrics.IMPRESSIONS || 0;
        const clicks = metrics.clicks || metrics.CLICKS || 0;
        const cost = metrics.cost || metrics.COST || metrics.spend || 0;
        const conversions = metrics.conversions || metrics.CONVERSIONS || 0;
        const conversionValue = metrics.conversion_value || metrics.CONVERSION_VALUE || 0;

        const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
        const cpc = clicks > 0 ? cost / clicks : 0;
        const costPerConversion = conversions > 0 ? cost / conversions : 0;
        const roas = cost > 0 ? conversionValue / cost : 0;

        const campaignId = report.campaign_id || report.organization_id || '';
        const campaignName = campaignMap[campaignId] || campaignId || 'Unknown';

        records.push({
          date: report.start_at ? report.start_at.split('T')[0] : '',
          campaign_name: campaignName,
          campaign_id: campaignId,
          impressions,
          clicks,
          ctr: Math.round(ctr * 100) / 100,
          cpc: Math.round(cpc * 100) / 100,
          cost: Math.round(cost * 100) / 100,
          conversions,
          cost_per_conversion: Math.round(costPerConversion * 100) / 100,
          roas: Math.round(roas * 100) / 100,
        });
      }
    }

    // Also add campaign-level data if no reports
    if (records.length === 0 && Array.isArray(campaigns)) {
      for (const c of campaigns) {
        records.push({
          date: c.updated_at ? c.updated_at.split('T')[0] : new Date().toISOString().split('T')[0],
          campaign_name: c.name || 'Unknown',
          campaign_id: c.id || '',
          impressions: 0,
          clicks: 0,
          ctr: 0,
          cpc: 0,
          cost: c.budget || 0,
          conversions: 0,
          cost_per_conversion: 0,
          roas: 0,
        });
      }
    }

    console.log(`Processed ${records.length} Meta Ads records`);

    // Create fields if they don't exist
    const fieldKeys = ['date', 'campaign_name', 'campaign_id', 'impressions', 'clicks', 'ctr', 'cpc', 'cost', 'conversions', 'cost_per_conversion', 'roas'];
    const fieldNames = ['תאריך', 'שם הקמפיין', 'מזהה קמפיין', 'חשיפות', 'קליקים', 'אחוז קליקים', 'עלות לקליק', 'הוצאה', 'המרות', 'עלות להמרה', 'ROAS'];
    const fieldTypes = ['date', 'text', 'text', 'number', 'number', 'number', 'number', 'number', 'number', 'number', 'number'];

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
      .eq('tenant_id', tenantId);

    for (const record of records) {
      await supabase.from('crm_records').insert({
        table_id,
        tenant_id: tenantId,
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
        },
      })
      .eq('id', table_id);

    return new Response(JSON.stringify({
      success: true,
      records_synced: records.length,
      campaigns_found: Array.isArray(campaigns) ? campaigns.length : 0,
      reports_found: Array.isArray(reports) ? reports.length : 0,
      last_sync_at: new Date().toISOString(),
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error in sync-meta-ads-data:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
