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
      .select('tenant_id, user_id, settings, instance_id, api_key')
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
      // Try to transcribe voice messages
      const downloadUrl = messageData.fileMessageData?.downloadUrl;
      let transcription = '';
      
      if (downloadUrl && isIncoming) {
        try {
          console.log('🎤 Attempting to transcribe voice message from:', downloadUrl);
          
          // Download the audio file
          const audioResponse = await fetch(downloadUrl);
          if (audioResponse.ok) {
            const audioBlob = await audioResponse.blob();
            
            // Send to OpenAI Whisper for transcription
            const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
            if (openaiApiKey) {
              const formData = new FormData();
              formData.append('file', audioBlob, 'audio.ogg');
              formData.append('model', 'whisper-1');
              formData.append('language', 'he');
              
              const transcribeResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${openaiApiKey}`,
                },
                body: formData,
              });
              
              if (transcribeResponse.ok) {
                const result = await transcribeResponse.json();
                transcription = result.text || '';
                console.log('✅ Transcription successful:', transcription.substring(0, 100));
              } else {
                console.error('❌ Transcription failed:', await transcribeResponse.text());
              }
            }
          }
        } catch (transcribeError) {
          console.error('❌ Error transcribing voice message:', transcribeError);
        }
      }
      
      messageText = transcription ? `🎤 ${transcription}` : '[הודעת קול]';
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
    } else if (messageType === 'contactMessage') {
      // Handle contact card (vCard)
      const contactData = messageData.contactMessageData;
      if (contactData) {
        const displayName = contactData.displayName || 'איש קשר';
        const vcard = contactData.vcard || '';
        // Extract phone number from vCard if available
        const phoneMatch = vcard.match(/TEL[^:]*:([+\d\s-]+)/i);
        const phoneFromVcard = phoneMatch ? phoneMatch[1].replace(/\s/g, '') : '';
        messageText = `[איש קשר: ${displayName}${phoneFromVcard ? ` - ${phoneFromVcard}` : ''}]`;
      } else {
        messageText = '[איש קשר]';
      }
    } else if (messageType === 'contactsArrayMessage') {
      // Handle multiple contacts
      const contacts = messageData.contactsArrayMessageData?.contacts || [];
      const contactNames = contacts.map((c: any) => c.displayName || 'איש קשר').join(', ');
      messageText = `[אנשי קשר: ${contactNames || 'מספר אנשי קשר'}]`;
    } else if (messageType === 'locationMessage') {
      const locData = messageData.locationMessageData;
      messageText = `[מיקום${locData?.nameLocation ? ': ' + locData.nameLocation : ''}]`;
    } else if (messageType === 'stickerMessage') {
      messageText = '[סטיקר]';
    } else if (messageType === 'reactionMessage') {
      const reaction = messageData.reactionMessage?.reaction || messageData.extendedTextMessageData?.text || '👍';
      messageText = `[תגובה: ${reaction}]`;
    } else {
      messageText = `[${messageType}]`;
    }

    console.log('📱 Processing message from:', isGroup ? 'Group ' + phoneNumber : phoneNumber);

    // Handle group messages differently
    if (isGroup) {
      const groupChatId = senderData.chatId;
      
      console.log('👥 Group message detected. ChatId:', groupChatId, 
        'chatName from API (unreliable):', senderData.chatName,
        'Direction:', isOutgoing ? 'outgoing' : 'incoming');

      // Check if group exists, if not create it
      const { data: existingGroup } = await supabaseClient
        .from('whatsapp_groups')
        .select('id, is_blocked, group_name')
        .eq('tenant_id', tenantId)
        .eq('group_chat_id', groupChatId)
        .maybeSingle();

      let groupId = existingGroup?.id;
      let groupIsBlocked = existingGroup?.is_blocked || false;

      // Helper function to fetch REAL group name from Green API
      async function fetchRealGroupName(chatId: string): Promise<string | null> {
        try {
          const apiToken = integration?.api_key;
          if (!instanceId || !apiToken) {
            console.log('⚠️ Missing credentials for Green API call');
            return null;
          }
          
          console.log('🔍 Fetching real group name from Green API for:', chatId);
          
          const response = await fetch(
            `https://api.green-api.com/waInstance${instanceId}/getContactInfo/${apiToken}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ chatId })
            }
          );
          
          if (response.ok) {
            const contactInfo = await response.json();
            console.log('📋 Green API getContactInfo response:', JSON.stringify(contactInfo));
            // For groups, the name is in 'name' field
            const realName = contactInfo.name || contactInfo.chatName || null;
            console.log('✅ Real group name from API:', realName);
            return realName;
          } else {
            console.error('❌ Failed to fetch group info:', response.status, await response.text());
            return null;
          }
        } catch (e) {
          console.error('❌ Error fetching group name:', e);
          return null;
        }
      }

      if (!groupId) {
        // Create new group - fetch real name from Green API
        let realGroupName = await fetchRealGroupName(groupChatId);
        const newGroupName = realGroupName || `קבוצה ${groupChatId.split('@')[0].slice(-4)}`;
        
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
        console.log('✅ Created new group with real name:', newGroupName);
      } else if (existingGroup) {
        // Check if name looks like a placeholder or sender name (not a real group name)
        // Indicators: name starts with "קבוצה" OR contains emoji (likely sender name) OR doesn't look like group name
        const currentName = existingGroup.group_name || '';
        const looksLikePlaceholder = currentName.startsWith('קבוצה ');
        const looksLikeSenderName = /🌴|📱|👤/.test(currentName) || currentName.split(' ').length <= 2;
        
        if (looksLikePlaceholder || looksLikeSenderName) {
          console.log('🔄 Current group name might be incorrect, fetching real name...');
          const realGroupName = await fetchRealGroupName(groupChatId);
          
          if (realGroupName && realGroupName !== currentName) {
            await supabaseClient
              .from('whatsapp_groups')
              .update({ group_name: realGroupName })
              .eq('id', groupId);
            console.log('📝 Updated group name from:', currentName, 'to:', realGroupName);
          }
        }
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

      // Auto-unhide: if incoming message and group is hidden, remove from hidden_chats
      if (isIncoming) {
        await supabaseClient
          .from('hidden_chats')
          .delete()
          .eq('tenant_id', tenantId)
          .eq('group_id', groupId);
        console.log('👁️ Auto-unhiding group chat if hidden');
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
    
    // For outgoing messages, search by phone only (no provider check)
    // For incoming messages, require active_chat_provider = 'green_api'
    // Search for client with matching phone in THIS tenant only
    let clientQuery = supabaseClient
      .from('clients')
      .select('id')
      .eq('tenant_id', tenantId)
      .ilike('phone', `%${phoneNumber}%`);
    
    // Only filter by provider for incoming messages
    if (isIncoming) {
      clientQuery = clientQuery.eq('active_chat_provider', 'green_api');
    }
    
    const { data: client } = await clientQuery.maybeSingle();

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
      let leadQuery = supabaseClient
        .from('leads')
        .select('id')
        .eq('tenant_id', tenantId)
        .ilike('phone', `%${phoneNumber}%`);
      
      // Only filter by provider for incoming messages
      if (isIncoming) {
        leadQuery = leadQuery.eq('active_chat_provider', 'green_api');
      }
      
      const { data: lead } = await leadQuery.maybeSingle();

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
        console.log(`⚠️ No contact found in tenant ${tenantId} for phone ${phoneNumber}`);
      }
    }

    // Auto-unhide: if incoming message and contact is hidden, remove from hidden_chats
    if (isIncoming) {
      if (clientId) {
        await supabaseClient
          .from('hidden_chats')
          .delete()
          .eq('tenant_id', tenantId)
          .eq('client_id', clientId);
        console.log('👁️ Auto-unhiding client chat if hidden');
      } else if (leadId) {
        await supabaseClient
          .from('hidden_chats')
          .delete()
          .eq('tenant_id', tenantId)
          .eq('lead_id', leadId);
        console.log('👁️ Auto-unhiding lead chat if hidden');
      } else {
        // Unknown contact - unhide by phone
        await supabaseClient
          .from('hidden_chats')
          .delete()
          .eq('tenant_id', tenantId)
          .eq('sender_phone', phoneNumber);
        console.log('👁️ Auto-unhiding unknown chat if hidden');
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