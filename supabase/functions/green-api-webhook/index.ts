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

    // Extract instance ID from webhook to identify the tenant
    const instanceId = webhookData.instanceData?.idInstance;
    if (!instanceId) {
      console.error('❌ No instance ID in webhook data');
      return new Response(JSON.stringify({ error: 'Missing instance ID' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      });
    }

    console.log('🔑 Instance ID:', instanceId);

    // Find the specific tenant and user for this instance
    const { data: integration, error: integrationError } = await supabaseClient
      .from('tenant_integrations')
      .select('tenant_id, user_id, settings')
      .eq('integration_type', 'green_api')
      .eq('is_active', true)
      .eq('instance_id', instanceId)
      .maybeSingle();

    if (integrationError) {
      console.error('❌ Error fetching integration:', integrationError);
      return new Response(JSON.stringify({ error: 'Integration lookup failed' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      });
    }

    if (!integration) {
      console.error('❌ No active integration found for instance:', instanceId);
      return new Response(JSON.stringify({ error: 'No active integration for this instance' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404
      });
    }

    const tenantId = integration.tenant_id;
    const connectionUserId = integration.user_id;
    console.log('✅ Identified tenant:', tenantId);
    console.log('✅ Connection owner (user_id):', connectionUserId);

    // Green API sends different types of webhooks
    // We're interested in incoming AND outgoing messages
    const isIncoming = webhookData.typeWebhook === 'incomingMessageReceived';
    const isOutgoing = webhookData.typeWebhook === 'outgoingMessageReceived' || 
                       webhookData.typeWebhook === 'outgoingAPIMessageReceived';
    
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
    } else if (messageType === 'templateMessage') {
      // Template messages have content in templateMessage object
      const templateData = messageData.templateMessage;
      messageText = templateData?.contentText || templateData?.titleText || '[הודעת תבנית]';
    } else if (messageType === 'buttonsMessage') {
      messageText = messageData.buttonsMessage?.contentText || '[הודעת כפתורים]';
    } else if (messageType === 'listMessage') {
      messageText = messageData.listMessage?.description || messageData.listMessage?.title || '[הודעת רשימה]';
    } else {
      messageText = `[${messageType}]`;
    }

    console.log('📱 Processing message from:', isGroup ? 'Group ' + phoneNumber : phoneNumber);

    // Handle group messages differently
    if (isGroup) {
      const groupChatId = senderData.chatId;
      // For outgoing messages, chatName is the sender's name, not the group name
      // Only use chatName for group name on INCOMING messages
      const potentialGroupName = isIncoming ? (senderData.chatName || null) : null;
      
      console.log('👥 Group message detected. ChatId:', groupChatId, 'Potential name:', potentialGroupName, 'Direction:', isOutgoing ? 'outgoing' : 'incoming');

      // Check if group exists, if not create it
      const { data: existingGroup } = await supabaseClient
        .from('whatsapp_groups')
        .select('id, is_blocked, group_name')
        .eq('tenant_id', tenantId)
        .eq('group_chat_id', groupChatId)
        .maybeSingle();

      let groupId = existingGroup?.id;
      let groupIsBlocked = existingGroup?.is_blocked || false;

      if (!groupId) {
        // Create new group - only use real group name from incoming message
        const newGroupName = potentialGroupName || `קבוצה ${groupChatId.split('@')[0].slice(-4)}`;
        const { data: newGroup, error: groupError } = await supabaseClient
          .from('whatsapp_groups')
          .insert({
            tenant_id: tenantId,
            group_chat_id: groupChatId,
            group_name: newGroupName,
          })
          .select('id')
          .single();

        if (groupError) {
          console.error('❌ Failed to create group:', groupError);
          throw groupError;
        }

        groupId = newGroup.id;
        console.log('✅ Created new group:', newGroupName);
      } else if (existingGroup && isIncoming && potentialGroupName && existingGroup.group_name !== potentialGroupName) {
        // Update group name only from incoming messages if it has changed
        // This prevents overwriting with sender name from outgoing messages
        await supabaseClient
          .from('whatsapp_groups')
          .update({ group_name: potentialGroupName })
          .eq('id', groupId);
        console.log('📝 Updated group name to:', potentialGroupName);
      }
      
      // Check if group is blocked in blocked_contacts table
      const { data: blockedContact } = await supabaseClient
        .from('blocked_contacts')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('connection_user_id', connectionUserId)
        .eq('group_id', groupId)
        .maybeSingle();

      if (blockedContact || groupIsBlocked) {
        console.log('🚫 Group is blocked, ignoring message');
        return new Response(JSON.stringify({ 
          success: true, 
          blocked: true,
          message: 'Group is blocked' 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Save group message
      const { error: insertError } = await supabaseClient
        .from('chat_messages')
        .insert({
          group_id: groupId,
          tenant_id: tenantId,
          connection_user_id: connectionUserId,
          message_text: messageText,
          direction: isOutgoing ? 'outbound' : 'inbound',
          channel: 'whatsapp',
          provider: 'green_api',
          sender_phone: phoneNumber,
          sender_name: senderData.senderName || null,
          is_blocked: false,
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

    // For individual messages, first check if sender is in blocked_contacts
    console.log('🔍 Checking if sender is blocked:', phoneNumber);
    
    const { data: blockedByPhone } = await supabaseClient
      .from('blocked_contacts')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('connection_user_id', connectionUserId)
      .eq('sender_phone', phoneNumber)
      .maybeSingle();

    if (blockedByPhone) {
      console.log('🚫 Sender phone is blocked, ignoring message');
      return new Response(JSON.stringify({ 
        success: true, 
        blocked: true,
        message: 'Sender is blocked by phone' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Search for client or lead in THIS tenant only
    console.log('👤 Individual message, searching for contact in tenant:', tenantId);
    
    let clientId: string | null = null;
    let leadId: string | null = null;
    
    // Search for client with matching phone in THIS tenant only
    const { data: client } = await supabaseClient
      .from('clients')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('active_chat_provider', 'green_api')
      .ilike('phone', `%${phoneNumber}%`)
      .maybeSingle();

    if (client) {
      clientId = client.id;
      console.log(`✅ Found client ${clientId} in tenant ${tenantId}`);
      
      // Check if client is in blocked_contacts
      const { data: blockedClient } = await supabaseClient
        .from('blocked_contacts')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('connection_user_id', connectionUserId)
        .eq('client_id', clientId)
        .maybeSingle();

      if (blockedClient) {
        console.log('🚫 Client is blocked, ignoring message');
        return new Response(JSON.stringify({ 
          success: true, 
          blocked: true,
          message: 'Client is blocked' 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    } else {
      // Search for lead with matching phone in THIS tenant only
      const { data: lead } = await supabaseClient
        .from('leads')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('active_chat_provider', 'green_api')
        .ilike('phone', `%${phoneNumber}%`)
        .maybeSingle();

      if (lead) {
        leadId = lead.id;
        console.log(`✅ Found lead ${leadId} in tenant ${tenantId}`);
        
        // Check if lead is in blocked_contacts
        const { data: blockedLead } = await supabaseClient
          .from('blocked_contacts')
          .select('id')
          .eq('tenant_id', tenantId)
          .eq('connection_user_id', connectionUserId)
          .eq('lead_id', leadId)
          .maybeSingle();

        if (blockedLead) {
          console.log('🚫 Lead is blocked, ignoring message');
          return new Response(JSON.stringify({ 
            success: true, 
            blocked: true,
            message: 'Lead is blocked' 
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      } else {
        console.log(`⚠️ No contact found with Green API provider in tenant ${tenantId}`);
      }
    }

    console.log('💾 Saving message...');

    // Save the message to THIS tenant only
    const { error: insertError } = await supabaseClient
      .from('chat_messages')
      .insert({
        client_id: clientId,
        lead_id: leadId,
        tenant_id: tenantId,
        message_text: messageText,
        direction: isOutgoing ? 'outbound' : 'inbound',
        channel: 'whatsapp',
        provider: 'green_api',
        sender_phone: phoneNumber,
        sender_name: senderData.senderName || null,
        is_blocked: false,
        connection_user_id: connectionUserId,
        raw_provider_data: webhookData,
      });

    if (insertError) {
      console.error('❌ Failed to save message:', insertError);
      throw insertError;
    }

    console.log('✅ Message saved successfully');

    return new Response(JSON.stringify({ 
      success: true,
      contactType: clientId ? 'client' : (leadId ? 'lead' : 'unknown'),
      contactId: clientId || leadId || null,
      tenantId: tenantId,
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