import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BASE_URL = 'https://whatsappgw-pzpyrrww.manus.space';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization') || '';
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } }
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: claims } = await supabase.auth.getClaims(token);
    if (!claims?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { instanceId, apiKey, integrationId } = await req.json();
    let realInstanceId = instanceId;
    let realApiKey = apiKey;

    if (!realApiKey && integrationId) {
      const { data: integ } = await supabase
        .from('tenant_integrations')
        .select('api_key, settings')
        .eq('id', integrationId)
        .maybeSingle();
      if (integ) {
        realApiKey = integ.api_key;
        realInstanceId = (integ.settings as any)?.instance_id || realInstanceId;
      }
    }

    if (!realInstanceId || !realApiKey) {
      return new Response(JSON.stringify({ error: 'Missing instanceId or apiKey' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const res = await fetch(`${BASE_URL}/api/v1/instances/${realInstanceId}/status`, {
      method: 'GET',
      headers: { 'X-Api-Key': realApiKey },
    });

    const text = await res.text();
    let data: any;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }

    if (!res.ok) {
      return new Response(JSON.stringify({ error: 'Gateway error', status: res.status, details: data }), {
        status: res.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Persist status + phone_number to settings if integrationId provided
    if (integrationId && data?.success) {
      const supabaseSvc = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );
      const { data: cur } = await supabaseSvc
        .from('tenant_integrations')
        .select('settings')
        .eq('id', integrationId)
        .maybeSingle();
      const merged = { ...(cur?.settings as any || {}), status: data.status, phone_number: data.phoneNumber };
      await supabaseSvc.from('tenant_integrations')
        .update({ settings: merged })
        .eq('id', integrationId);
    }

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    console.error('manus-wa-status error:', msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
