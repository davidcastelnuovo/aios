import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

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
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { table_id, date_preset } = await req.json();
    if (!table_id) {
      return new Response(JSON.stringify({ error: 'table_id required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { data: table } = await supabaseAdmin
      .from('crm_tables').select('*').eq('id', table_id).maybeSingle();
    if (!table) {
      return new Response(JSON.stringify({ error: 'Table not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const settings = table.integration_settings || {};
    const adAccountId = settings.ad_account_id;
    if (!adAccountId) {
      return new Response(JSON.stringify({ error: 'No ad account configured' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { data: integration } = await supabaseAdmin
      .from('tenant_integrations')
      .select('api_key, shared_from_integration_id')
      .eq('tenant_id', table.tenant_id)
      .in('integration_type', ['facebook', 'facebook_lead_ads'])
      .eq('is_active', true)
      .limit(1).maybeSingle();

    let accessToken = integration?.api_key;
    if (!accessToken && integration?.shared_from_integration_id) {
      const { data: src } = await supabaseAdmin
        .from('tenant_integrations').select('api_key')
        .eq('id', integration.shared_from_integration_id).maybeSingle();
      accessToken = src?.api_key;
    }
    if (!accessToken) {
      return new Response(JSON.stringify({ error: 'Facebook not configured' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Default to today
    const today = new Date().toISOString().split('T')[0];
    const since = date_preset === 'yesterday'
      ? new Date(Date.now() - 86400000).toISOString().split('T')[0]
      : today;
    const until = today;

    // Fetch with NO attribution window restriction + NO unified — to see ALL action types
    const url = `https://graph.facebook.com/v21.0/${adAccountId}/insights?level=campaign&fields=campaign_id,campaign_name,impressions,clicks,spend,actions,action_values&time_range={"since":"${since}","until":"${until}"}&limit=10&access_token=${accessToken}`;

    const res = await fetch(url);
    const data = await res.json();

    // Also fetch with 7d_click attribution for comparison
    const url7d = `${url}&action_attribution_windows=["7d_click"]`;
    const res7d = await fetch(url7d);
    const data7d = await res7d.json();

    // Also fetch with default (1d_view+7d_click) attribution
    const urlDefault = `https://graph.facebook.com/v21.0/${adAccountId}/insights?level=campaign&fields=campaign_id,campaign_name,impressions,clicks,spend,actions,action_values&time_range={"since":"${since}","until":"${until}"}&action_attribution_windows=["1d_click"]&limit=10&access_token=${accessToken}`;
    const resDefault = await fetch(urlDefault);
    const dataDefault = await resDefault.json();

    return new Response(JSON.stringify({
      success: true,
      ad_account: adAccountId,
      date_range: { since, until },
      no_attribution_window: data,
      with_7d_click: data7d,
      with_1d_click: dataDefault,
    }, null, 2), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    console.error('Error in debug-facebook-ecommerce:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
