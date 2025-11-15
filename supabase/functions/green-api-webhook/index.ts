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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const webhookData = await req.json();
    console.log('📨 Received Green API webhook:', JSON.stringify(webhookData, null, 2));

    // Green API sends different types of webhooks
    // We're interested in incoming messages
    if (webhookData.typeWebhook !== 'incomingMessageReceived') {
      console.log('⏭️ Ignoring non-message webhook');
      return new Response(JSON.stringify({ received: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const messageData = webhookData.messageData;
    const senderData = webhookData.senderData;
    
    // Extract phone number from chatId (format: 972501234567@c.us)
    const phoneNumber = senderData.chatId.split('@')[0];
    const messageText = messageData.textMessageData?.textMessage || '';

    console.log('📱 Processing message from:', phoneNumber);

    // Find client or lead by phone number
    // We need to get all tenants that have Green API active and search in them
    const { data: activeIntegrations } = await supabaseClient
      .from('tenant_integrations')
      .select('tenant_id')
      .eq('integration_type', 'green_api')
      .eq('is_active', true);

    if (!activeIntegrations || activeIntegrations.length === 0) {
      console.log('⚠️ No active Green API integrations found');
      return new Response(JSON.stringify({ received: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Search for client or lead with this phone number
    let contact = null;
    let contactType = null;
    let tenantId = null;

    for (const integration of activeIntegrations) {
      // Try to find client
      const { data: client } = await supabaseClient
        .from('clients')
        .select('id, tenant_id')
        .eq('tenant_id', integration.tenant_id)
        .ilike('phone', `%${phoneNumber}%`)
        .maybeSingle();

      if (client) {
        contact = client;
        contactType = 'client';
        tenantId = client.tenant_id;
        break;
      }

      // Try to find lead
      const { data: lead } = await supabaseClient
        .from('leads')
        .select('id, tenant_id')
        .eq('tenant_id', integration.tenant_id)
        .ilike('phone', `%${phoneNumber}%`)
        .maybeSingle();

      if (lead) {
        contact = lead;
        contactType = 'lead';
        tenantId = lead.tenant_id;
        break;
      }
    }

    if (!contact) {
      console.log('⚠️ No matching contact found for phone:', phoneNumber);
      return new Response(JSON.stringify({ received: true, warning: 'No contact found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('✅ Found contact:', { contactType, id: contact.id, tenantId });

    // Save message to database
    const { error: insertError } = await supabaseClient
      .from('chat_messages')
      .insert({
        client_id: contactType === 'client' ? contact.id : null,
        lead_id: contactType === 'lead' ? contact.id : null,
        tenant_id: tenantId,
        message_text: messageText,
        direction: 'inbound',
        channel: 'whatsapp',
        raw_provider_data: webhookData,
      });

    if (insertError) {
      console.error('❌ Failed to save message:', insertError);
      throw insertError;
    }

    console.log('✅ Message saved successfully');

    return new Response(JSON.stringify({ 
      success: true,
      contactType,
      contactId: contact.id,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Error in green-api-webhook:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ 
      error: errorMessage 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
