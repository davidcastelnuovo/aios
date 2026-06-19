import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const body = await req.json().catch(() => ({}));
    const {
      tenant_id,
      campaign_id,
      status, // 'PAUSED' | 'ACTIVE'
      level = 'campaign', // 'campaign' | 'adset' | 'ad'
    } = body || {};

    if (!tenant_id || !campaign_id || !status) {
      return new Response(
        JSON.stringify({ error: 'tenant_id, campaign_id, status are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const normalizedStatus = String(status).toUpperCase();
    if (!['PAUSED', 'ACTIVE'].includes(normalizedStatus)) {
      return new Response(
        JSON.stringify({ error: 'status must be PAUSED or ACTIVE' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch FB access token (own + shared)
    let { data: integration } = await supabase
      .from('tenant_integrations')
      .select('api_key, shared_from_integration_id')
      .eq('tenant_id', tenant_id)
      .in('integration_type', ['facebook', 'facebook_lead_ads'])
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();

    if (integration?.shared_from_integration_id && !integration?.api_key) {
      const { data: src } = await supabase
        .from('tenant_integrations')
        .select('api_key')
        .eq('id', integration.shared_from_integration_id)
        .eq('is_active', true)
        .maybeSingle();
      if (src?.api_key) integration = { ...integration, api_key: src.api_key };
    }

    const accessToken = integration?.api_key;
    if (!accessToken) {
      return new Response(
        JSON.stringify({ error: 'Facebook integration not configured for tenant' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const url = `https://graph.facebook.com/v21.0/${campaign_id}`;
    const fbRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ status: normalizedStatus, access_token: accessToken }),
    });
    const fbJson = await fbRes.json().catch(() => ({}));

    if (!fbRes.ok || fbJson?.error) {
      console.error('[toggle-facebook-campaign] FB error', fbJson);
      return new Response(
        JSON.stringify({
          error: 'facebook_api_error',
          fb_error: fbJson?.error || fbJson,
          hint: fbJson?.error?.message?.includes('permission')
            ? 'הטוקן הקיים חסר הרשאת ads_management — יש להתחבר מחדש לפייסבוק עם ההרשאה הזו.'
            : undefined,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, campaign_id, level, status: normalizedStatus, fb: fbJson }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('[toggle-facebook-campaign] error', err);
    return new Response(
      JSON.stringify({ error: String(err?.message || err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
