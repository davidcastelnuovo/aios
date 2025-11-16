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
    // We're interested in incoming AND outgoing messages
    const isIncoming = webhookData.typeWebhook === 'incomingMessageReceived';
    const isOutgoing = webhookData.typeWebhook === 'outgoingMessageReceived';
    
    if (!isIncoming && !isOutgoing) {
      console.log('⏭️ Ignoring non-message webhook');
      return new Response(JSON.stringify({ received: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const messageData = webhookData.messageData;
    const senderData = webhookData.senderData;
    
    // Check if this is a group chat (format: 120363416882903532@g.us)
    const isGroup = senderData.chatId.endsWith('@g.us');
    
    // Extract phone number from chatId (format: 972501234567@c.us or group ID)
    const phoneNumber = senderData.chatId.split('@')[0];
    
    // Extract message text based on message type
    let messageText = '';
    const messageType = messageData.typeMessage;
    
    if (messageType === 'textMessage') {
      messageText = messageData.textMessageData?.textMessage || '';
    } else if (messageType === 'extendedTextMessage') {
      messageText = messageData.extendedTextMessageData?.text || '';
    } else if (messageType === 'imageMessage') {
      messageText = messageData.fileMessageData?.caption || '[תמונה]';
    } else if (messageType === 'videoMessage') {
      messageText = messageData.fileMessageData?.caption || '[וידאו]';
    } else if (messageType === 'audioMessage') {
      messageText = '[הודעת קול]';
    } else if (messageType === 'documentMessage') {
      messageText = messageData.fileMessageData?.caption || `[מסמך: ${messageData.fileMessageData?.fileName || 'קובץ'}]`;
    } else {
      messageText = `[${messageType}]`;
    }

    console.log('📱 Processing message from:', isGroup ? 'Group ' + phoneNumber : phoneNumber);

    // Handle group messages differently
    if (isGroup) {
      const groupChatId = senderData.chatId;
      const groupName = senderData.chatName || `קבוצה ${phoneNumber.slice(-4)}`;
      
      console.log('👥 Group message detected:', groupName);
      
      // Find active Green API integrations
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

      const tenantId = activeIntegrations[0].tenant_id;

      // Check if group exists, if not create it
      const { data: existingGroup } = await supabaseClient
        .from('whatsapp_groups')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('group_chat_id', groupChatId)
        .maybeSingle();

      let groupId = existingGroup?.id;

      if (!groupId) {
        // Create new group
        const { data: newGroup, error: groupError } = await supabaseClient
          .from('whatsapp_groups')
          .insert({
            tenant_id: tenantId,
            group_chat_id: groupChatId,
            group_name: groupName,
          })
          .select('id')
          .single();

        if (groupError) {
          console.error('❌ Failed to create group:', groupError);
          throw groupError;
        }

        groupId = newGroup.id;
        console.log('✅ Created new group:', groupName);
      }

      // Save group message
      const { error: insertError } = await supabaseClient
        .from('chat_messages')
        .insert({
          group_id: groupId,
          tenant_id: tenantId,
          message_text: messageText,
          direction: isOutgoing ? 'outbound' : 'inbound',
          channel: 'whatsapp',
          provider: 'green_api',
          sender_phone: phoneNumber,
          sender_name: senderData.senderName || null,
          raw_provider_data: webhookData,
        });

      if (insertError) {
        console.error('❌ Failed to save group message:', insertError);
        throw insertError;
      }

      console.log('✅ Group message saved successfully');

      return new Response(JSON.stringify({ 
        success: true,
        contactType: 'group',
        groupId: groupId,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Find client or lead by phone number for individual contacts
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

    // Use first active tenant if no contact found
    if (!contact && activeIntegrations.length > 0) {
      tenantId = activeIntegrations[0].tenant_id;
      console.log('⚠️ No matching contact found for phone:', phoneNumber, '- saving as unknown contact in tenant:', tenantId);
    } else if (contact) {
      console.log('✅ Found contact:', { contactType, id: contact.id, tenantId });
    }

    // Check if phone is blocked
    if (tenantId) {
      const { data: blockedMessage } = await supabaseClient
        .from('chat_messages')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('sender_phone', phoneNumber)
        .eq('is_blocked', true)
        .limit(1)
        .maybeSingle();

      if (blockedMessage) {
        console.log('🚫 Message from blocked number:', phoneNumber);
        return new Response(JSON.stringify({ received: true, blocked: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Save message to database (with or without contact)
    const { error: insertError } = await supabaseClient
      .from('chat_messages')
      .insert({
        client_id: contact && contactType === 'client' ? contact.id : null,
        lead_id: contact && contactType === 'lead' ? contact.id : null,
        tenant_id: tenantId,
        message_text: messageText,
        direction: isOutgoing ? 'outbound' : 'inbound',
        channel: 'whatsapp',
        provider: 'green_api',
        sender_phone: phoneNumber,
        sender_name: senderData.senderName || null,
        raw_provider_data: webhookData,
      });

    if (insertError) {
      console.error('❌ Failed to save message:', insertError);
      throw insertError;
    }

    console.log('✅ Message saved successfully');

    return new Response(JSON.stringify({ 
      success: true,
      contactType: contact ? contactType : 'unknown',
      contactId: contact?.id || null,
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
