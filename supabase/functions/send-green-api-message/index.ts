import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('❌ Missing Authorization header');
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { 
        global: { 
          headers: { Authorization: authHeader } 
        },
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        }
      }
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !user) {
      console.error('❌ Authentication failed:', userError);
      console.log('📋 Authorization header:', req.headers.get('Authorization') ? 'Present' : 'Missing');
      return new Response(JSON.stringify({ 
        error: 'Unauthorized',
        details: userError?.message 
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    console.log('✅ User authenticated:', user.id);

    const { clientId, leadId, message, phoneNumber } = await req.json();
    
    if (!message || !phoneNumber) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get tenant_id
    let tenantId: string;
    if (clientId) {
      const { data: client } = await supabaseClient
        .from('clients')
        .select('tenant_id')
        .eq('id', clientId)
        .single();
      tenantId = client?.tenant_id;
    } else {
      const { data: lead } = await supabaseClient
        .from('leads')
        .select('tenant_id')
        .eq('id', leadId)
        .single();
      tenantId = lead?.tenant_id;
    }

    if (!tenantId) {
      return new Response(JSON.stringify({ error: 'Tenant not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get Green API integration
    const { data: integration } = await supabaseClient
      .from('tenant_integrations')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('integration_type', 'green_api')
      .eq('is_active', true)
      .maybeSingle();

    if (!integration?.api_key || !integration?.settings?.instance_id) {
      console.error('Green API integration not configured');
      return new Response(JSON.stringify({ error: 'Green API not configured' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const instanceId = integration.settings.instance_id;
    const apiToken = integration.api_key;

    // Normalize phone to international format suitable for WhatsApp (chatId)
    const originalPhone = String(phoneNumber || '');
    let digits = originalPhone.replace(/[^0-9]/g, '');

    // Handle leading 00 (international prefix)
    if (digits.startsWith('00')) {
      digits = digits.slice(2);
    }

    // Determine country code from integration settings or fallback to IL (972)
    const configuredCc = (integration.settings?.country_code || integration.settings?.default_country_code || '').toString();
    const defaultCountryCode = configuredCc && /^(\d{1,3})$/.test(configuredCc) ? configuredCc : '972';

    let e164Digits = digits;
    // If already starts with country code, keep; else if starts with 0, strip 0 and prefix CC; else prefix CC
    if (e164Digits.startsWith(defaultCountryCode)) {
      // ok
    } else if (e164Digits.startsWith('0')) {
      e164Digits = defaultCountryCode + e164Digits.slice(1);
    } else {
      e164Digits = defaultCountryCode + e164Digits;
    }

    const chatId = `${e164Digits}@c.us`;

    console.log('📤 Sending message via Green API:', { instanceId, chatId, message });

    // Send message via Green API
    const greenApiUrl = `https://api.green-api.com/waInstance${instanceId}/sendMessage/${apiToken}`;
    
    const response = await fetch(greenApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chatId: chatId,
        message: message,
      }),
    });

    const responseData = await response.json();
    console.log('📥 Green API response:', responseData);

    if (!response.ok) {
      throw new Error(`Green API error: ${JSON.stringify(responseData)}`);
    }

    // Save message to database
    const { error: insertError } = await supabaseClient
      .from('chat_messages')
      .insert({
        client_id: clientId || null,
        lead_id: leadId || null,
        tenant_id: tenantId,
        message_text: message,
        direction: 'outbound',
        channel: 'whatsapp',
        provider: 'green_api',
        sent_by_user_id: user.id,
        raw_provider_data: responseData,
      });

    if (insertError) {
      console.error('Failed to save message:', insertError);
    }

    return new Response(JSON.stringify({ 
      success: true, 
      messageId: responseData.idMessage,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in send-green-api-message:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ 
      error: errorMessage 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
