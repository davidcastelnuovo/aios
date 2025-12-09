import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function sha256Hash(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data.toLowerCase().trim());
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { 
      tenant_id,
      event_name, // Lead, Contact, ViewContent, Purchase
      lead_id,
      client_id,
      user_data, // { email, phone, first_name, last_name, city, country }
      custom_data, // { currency, value, content_name, content_category }
      event_source_url,
      test_event_code, // For testing
    } = await req.json();

    console.log('Sending CAPI event:', { tenant_id, event_name, lead_id, client_id });

    if (!tenant_id || !event_name) {
      return new Response(
        JSON.stringify({ error: 'tenant_id and event_name are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get CAPI integration settings
    const { data: integration, error: intError } = await supabase
      .from('tenant_integrations')
      .select('*')
      .eq('tenant_id', tenant_id)
      .eq('integration_type', 'facebook_capi')
      .eq('is_active', true)
      .single();

    if (intError || !integration) {
      console.log('No active CAPI integration found for tenant:', tenant_id);
      return new Response(
        JSON.stringify({ error: 'No active CAPI integration found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const settings = integration.settings as any;
    const pixelId = settings?.pixel_id;
    const accessToken = integration.api_key;

    if (!pixelId || !accessToken) {
      return new Response(
        JSON.stringify({ error: 'Pixel ID or Access Token not configured' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build user data with hashing
    const hashedUserData: Record<string, any> = {};

    if (user_data?.email) {
      hashedUserData.em = [await sha256Hash(user_data.email)];
    }
    if (user_data?.phone) {
      // Remove non-numeric characters and hash
      const cleanPhone = user_data.phone.replace(/\D/g, '');
      hashedUserData.ph = [await sha256Hash(cleanPhone)];
    }
    if (user_data?.first_name) {
      hashedUserData.fn = [await sha256Hash(user_data.first_name)];
    }
    if (user_data?.last_name) {
      hashedUserData.ln = [await sha256Hash(user_data.last_name)];
    }
    if (user_data?.city) {
      hashedUserData.ct = [await sha256Hash(user_data.city)];
    }
    if (user_data?.country) {
      hashedUserData.country = [await sha256Hash(user_data.country)];
    }

    // Build event data
    const eventData: any = {
      event_name,
      event_time: Math.floor(Date.now() / 1000),
      action_source: 'website',
      user_data: hashedUserData,
    };

    if (event_source_url) {
      eventData.event_source_url = event_source_url;
    }

    if (custom_data) {
      eventData.custom_data = custom_data;
    }

    // Add external_id for deduplication if we have lead_id or client_id
    if (lead_id || client_id) {
      hashedUserData.external_id = [await sha256Hash(lead_id || client_id)];
    }

    // Build request body
    const requestBody: any = {
      data: [eventData],
    };

    // Add test_event_code if provided or from settings
    const effectiveTestCode = test_event_code || settings?.test_event_code;
    if (effectiveTestCode) {
      requestBody.test_event_code = effectiveTestCode;
    }

    console.log('Sending to Facebook CAPI:', JSON.stringify(requestBody, null, 2));

    // Send to Facebook Conversions API
    const fbResponse = await fetch(
      `https://graph.facebook.com/v21.0/${pixelId}/events?access_token=${accessToken}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      }
    );

    const fbResult = await fbResponse.json();
    console.log('Facebook CAPI response:', JSON.stringify(fbResult, null, 2));

    if (!fbResponse.ok) {
      console.error('Facebook CAPI error:', fbResult);
      return new Response(
        JSON.stringify({ error: 'Failed to send event to Facebook', details: fbResult }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update last_sync_at
    await supabase
      .from('tenant_integrations')
      .update({ last_sync_at: new Date().toISOString() })
      .eq('id', integration.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        events_received: fbResult.events_received,
        fbtrace_id: fbResult.fbtrace_id,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in facebook-capi-event:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
