import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface InsightRecord {
  campaign_id: string;
  campaign_name: string;
  campaign_status?: string;
  impressions: number;
  clicks: number;
  cpm: number;
  ctr: number;
  leads: number;
  cost_per_lead: number;
  spend: number;
  date_start: string;
  date_stop: string;
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

    // Get table with integration settings
    const { data: table, error: tableError } = await supabase
      .from('crm_tables')
      .select('*')
      .eq('id', table_id)
      .eq('tenant_id', tenantId)
      .single();

    if (tableError || !table) {
      return new Response(JSON.stringify({ error: 'Table not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

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

    // Get Facebook access token
    const { data: integration } = await supabase
      .from('tenant_integrations')
      .select('api_key')
      .eq('tenant_id', tenantId)
      .eq('integration_type', 'facebook')
      .eq('is_active', true)
      .single();

    if (!integration?.api_key) {
      return new Response(JSON.stringify({ error: 'Facebook not configured' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const accessToken = integration.api_key;

    // Calculate date range
    const now = new Date();
    let since: Date;
    let until = new Date(now);
    
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
        since = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
        break;
      case 'last_14_days':
        since = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 14);
        break;
      case 'this_month':
        since = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'last_30_days':
      default:
        since = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30);
    }

    const sinceStr = since.toISOString().split('T')[0];
    const untilStr = until.toISOString().split('T')[0];

    console.log(`Syncing insights for ${adAccountId} from ${sinceStr} to ${untilStr}`);

    // Fetch insights from Facebook
    const insightsUrl = `https://graph.facebook.com/v21.0/${adAccountId}/insights?level=campaign&fields=campaign_id,campaign_name,impressions,clicks,cpm,ctr,actions,cost_per_action_type,spend&time_range={"since":"${sinceStr}","until":"${untilStr}"}&limit=500&access_token=${accessToken}`;
    
    const response = await fetch(insightsUrl);
    const data = await response.json();

    if (data.error) {
      console.error('Facebook API error:', data.error);
      return new Response(JSON.stringify({ 
        error: 'Facebook API error',
        details: data.error.message
      }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const insights: InsightRecord[] = (data.data || []).map((insight: any) => {
      // Extract lead count from actions
      const leadAction = insight.actions?.find((a: any) => a.action_type === 'lead' || a.action_type === 'leadgen_grouped');
      const leads = leadAction ? parseInt(leadAction.value) : 0;
      
      // Extract cost per lead
      const cplAction = insight.cost_per_action_type?.find((a: any) => a.action_type === 'lead' || a.action_type === 'leadgen_grouped');
      const costPerLead = cplAction ? parseFloat(cplAction.value) : 0;

      return {
        campaign_id: insight.campaign_id,
        campaign_name: insight.campaign_name,
        impressions: parseInt(insight.impressions) || 0,
        clicks: parseInt(insight.clicks) || 0,
        cpm: parseFloat(insight.cpm) || 0,
        ctr: parseFloat(insight.ctr) || 0,
        leads,
        cost_per_lead: costPerLead,
        spend: parseFloat(insight.spend) || 0,
        date_start: insight.date_start,
        date_stop: insight.date_stop,
      };
    });

    console.log(`Got ${insights.length} campaign insights`);

    // Make sure fields exist for Facebook Insights table
    const fieldKeys = ['campaign_name', 'campaign_id', 'impressions', 'clicks', 'cpm', 'ctr', 'leads', 'cost_per_lead', 'spend', 'date_start', 'date_stop'];
    const fieldNames = ['שם הקמפיין', 'מזהה קמפיין', 'חשיפות', 'קליקים', 'עלות ל-1000 חשיפות', 'אחוז קליקים', 'לידים', 'עלות לליד', 'הוצאה', 'תאריך התחלה', 'תאריך סיום'];
    
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
          type: i >= 2 && i <= 8 ? 'number' : 'text',
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

    // Insert new records
    for (const insight of insights) {
      await supabase.from('crm_records').insert({
        table_id,
        tenant_id: tenantId,
        created_by: user.id,
        data: insight,
      });
    }

    // Update last_sync_at in integration_settings
    await supabase
      .from('crm_tables')
      .update({
        integration_settings: {
          ...settings,
          last_sync_at: new Date().toISOString(),
        }
      })
      .eq('id', table_id);

    console.log(`Successfully synced ${insights.length} records`);

    return new Response(JSON.stringify({ 
      success: true,
      records_synced: insights.length,
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
