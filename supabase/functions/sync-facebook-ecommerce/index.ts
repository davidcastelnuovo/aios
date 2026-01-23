import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface EcommerceRecord {
  date: string;
  campaign_id: string;
  campaign_name: string;
  impressions: number;
  clicks: number;
  spend: number;
  purchases: number;
  purchase_value: number;
  add_to_cart: number;
  add_to_cart_value: number;
  initiate_checkout: number;
  initiate_checkout_value: number;
  roas: number;
  cpm: number;
  ctr: number;
  cost_per_purchase: number;
  effective_status?: string;
  configured_status?: string;
}

interface CampaignStatus {
  id: string;
  name: string;
  effective_status: string;
  configured_status: string;
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

    console.log(`Syncing ecommerce insights for ${adAccountId} from ${sinceStr} to ${untilStr}`);

    // Fetch campaign statuses
    const campaignsUrl = `https://graph.facebook.com/v21.0/${adAccountId}/campaigns?fields=id,name,effective_status,configured_status&limit=500&access_token=${accessToken}`;
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
        };
      }
      console.log(`Fetched statuses for ${Object.keys(campaignStatuses).length} campaigns`);
    }

    // Fetch insights with actions and action_values for ecommerce data
    const insightsUrl = `https://graph.facebook.com/v21.0/${adAccountId}/insights?level=campaign&fields=campaign_id,campaign_name,impressions,clicks,cpm,ctr,actions,action_values,spend&time_range={"since":"${sinceStr}","until":"${untilStr}"}&time_increment=1&limit=500&access_token=${accessToken}`;
    
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

    // Ecommerce action types
    const purchaseActionTypes = ['purchase', 'omni_purchase', 'offsite_conversion.fb_pixel_purchase'];
    const addToCartActionTypes = ['add_to_cart', 'offsite_conversion.fb_pixel_add_to_cart'];
    const initiateCheckoutActionTypes = ['initiate_checkout', 'offsite_conversion.fb_pixel_initiate_checkout'];

    const insights: EcommerceRecord[] = (data.data || []).map((insight: any) => {
      const actions = insight.actions ?? [];
      const actionValues = insight.action_values ?? [];

      // Helper to extract count from actions
      const getActionCount = (actionTypes: string[]) => {
        return actions
          .filter((a: any) => actionTypes.includes(a.action_type))
          .reduce((sum: number, a: any) => sum + (parseInt(a.value) || 0), 0);
      };

      // Helper to extract value from action_values
      const getActionValue = (actionTypes: string[]) => {
        return actionValues
          .filter((a: any) => actionTypes.includes(a.action_type))
          .reduce((sum: number, a: any) => sum + (parseFloat(a.value) || 0), 0);
      };

      // Extract ecommerce metrics
      const purchases = getActionCount(purchaseActionTypes);
      const purchaseValue = getActionValue(purchaseActionTypes);
      const addToCart = getActionCount(addToCartActionTypes);
      const addToCartValue = getActionValue(addToCartActionTypes);
      const initiateCheckout = getActionCount(initiateCheckoutActionTypes);
      const initiateCheckoutValue = getActionValue(initiateCheckoutActionTypes);

      const spend = parseFloat(insight.spend) || 0;
      const impressions = parseInt(insight.impressions) || 0;
      const clicks = parseInt(insight.clicks) || 0;

      // Calculate ROAS (Return on Ad Spend)
      const roas = spend > 0 ? purchaseValue / spend : 0;
      
      // Calculate cost per purchase
      const costPerPurchase = purchases > 0 ? spend / purchases : 0;

      // Get campaign status
      const campaignStatus = campaignStatuses[insight.campaign_id];

      return {
        date: insight.date_start,
        campaign_id: insight.campaign_id,
        campaign_name: insight.campaign_name,
        impressions,
        clicks,
        spend,
        purchases,
        purchase_value: purchaseValue,
        add_to_cart: addToCart,
        add_to_cart_value: addToCartValue,
        initiate_checkout: initiateCheckout,
        initiate_checkout_value: initiateCheckoutValue,
        roas: Math.round(roas * 100) / 100, // Round to 2 decimals
        cpm: parseFloat(insight.cpm) || 0,
        ctr: parseFloat(insight.ctr) || 0,
        cost_per_purchase: Math.round(costPerPurchase * 100) / 100,
        effective_status: campaignStatus?.effective_status || null,
        configured_status: campaignStatus?.configured_status || null,
      };
    });

    console.log(`Got ${insights.length} daily ecommerce insights`);

    // Define fields for Facebook Ecommerce table
    const fieldKeys = [
      'date', 'campaign_name', 'campaign_id', 'impressions', 'clicks', 'spend',
      'purchases', 'purchase_value', 'add_to_cart', 'add_to_cart_value',
      'initiate_checkout', 'initiate_checkout_value', 'roas', 'cost_per_purchase',
      'cpm', 'ctr', 'effective_status', 'configured_status'
    ];
    const fieldNames = [
      'תאריך', 'שם הקמפיין', 'מזהה קמפיין', 'חשיפות', 'קליקים', 'הוצאה',
      'רכישות', 'ערך רכישות', 'הוספות לעגלה', 'ערך הוספות לעגלה',
      'התחלות Checkout', 'ערך Checkout', 'ROAS', 'עלות לרכישה',
      'CPM', 'CTR', 'סטטוס בפועל', 'סטטוס מוגדר'
    ];
    const fieldTypes = [
      'date', 'text', 'text', 'number', 'number', 'number',
      'number', 'number', 'number', 'number',
      'number', 'number', 'number', 'number',
      'number', 'number', 'text', 'text'
    ];
    
    // Create/update fields
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
    for (const insight of insights) {
      await supabase.from('crm_records').insert({
        table_id,
        tenant_id: tableTenantId,
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

    console.log(`Successfully synced ${insights.length} ecommerce records`);

    return new Response(JSON.stringify({ 
      success: true,
      records_synced: insights.length,
      last_sync_at: new Date().toISOString()
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
