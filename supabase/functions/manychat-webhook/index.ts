import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('📥 Webhook received - Method:', req.method);
    console.log('📋 Headers:', JSON.stringify(Object.fromEntries(req.headers.entries())));
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get raw body text first
    const bodyText = await req.text();
    console.log('📄 Raw body:', bodyText);
    
    // Try to parse as JSON
    let payload;
    try {
      payload = JSON.parse(bodyText);
      console.log('✅ Parsed payload:', JSON.stringify(payload, null, 2));
    } catch (parseError) {
      console.error('❌ JSON parse error:', parseError);
      return new Response(
        JSON.stringify({ 
          error: 'Invalid JSON', 
          received: bodyText.substring(0, 100),
          parseError: parseError instanceof Error ? parseError.message : 'Unknown error'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { subscriber, message, channel } = payload;

    if (!subscriber || !subscriber.id) {
      console.error('Invalid payload: missing subscriber.id');
      return new Response(
        JSON.stringify({ error: 'Invalid payload: missing subscriber.id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Find client by manychat_subscriber_id
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id, tenant_id, name')
      .eq('manychat_subscriber_id', subscriber.id)
      .single();

    if (clientError || !client) {
      console.error('Client not found for subscriber:', subscriber.id, clientError);
      return new Response(
        JSON.stringify({ error: 'Client not found for this subscriber', received: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract message text
    let messageText = '';
    if (message && message.text) {
      messageText = message.text;
    } else if (message && message.type) {
      messageText = `[${message.type} message received]`;
    }

    // Save inbound message
    const { error: saveError } = await supabase
      .from('chat_messages')
      .insert({
        client_id: client.id,
        tenant_id: client.tenant_id,
        direction: 'inbound',
        message_text: messageText,
        channel: channel || 'whatsapp',
        raw_provider_data: payload,
      });

    if (saveError) {
      console.error('Error saving message:', saveError);
      return new Response(
        JSON.stringify({ error: 'Failed to save message', details: saveError }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Message saved for client ${client.name} (${client.id})`);

    return new Response(
      JSON.stringify({ received: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('ManyChat webhook error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
