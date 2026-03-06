import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper function to normalize phone number - extract last 9 digits
function normalizePhone(phone: string): string {
  const digitsOnly = phone.replace(/\D/g, '');
  return digitsOnly.slice(-9);
}

// Helper function to fetch WhatsApp avatar using Green API's getAvatar (works for contacts and groups)
async function fetchWhatsAppAvatar(
  instanceId: string,
  apiToken: string,
  chatId: string
): Promise<string | null> {
  try {
    console.log('📸 Fetching WhatsApp avatar for:', chatId);
    
    // Use getAvatar endpoint which works for both contacts and groups
    const response = await fetch(
      `https://api.green-api.com/waInstance${instanceId}/getAvatar/${apiToken}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId })
      }
    );
    
    if (response.ok) {
      const data = await response.json();
      const avatarUrl = data.urlAvatar || data.avatar || null;
      console.log('✅ Avatar URL:', avatarUrl ? 'Found' : 'Not found');
      return avatarUrl;
    } else {
      console.error('❌ Failed to fetch avatar:', response.status);
      return null;
    }
  } catch (e) {
    console.error('❌ Error fetching avatar:', e);
    return null;
  }
}

// Helper function to fetch contact name from WhatsApp using Green API
async function fetchContactName(
  instanceId: string,
  apiToken: string,
  chatId: string
): Promise<string | null> {
  try {
    console.log('📇 Fetching contact name for:', chatId);
    
    const response = await fetch(
      `https://api.green-api.com/waInstance${instanceId}/getContactInfo/${apiToken}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId })
      }
    );
    
    if (response.ok) {
      const data = await response.json();
      const contactName = data.name || data.pushname || null;
      console.log('✅ Contact name from API:', contactName);
      return contactName;
    }
    console.log('⚠️ Could not fetch contact name, status:', response.status);
    return null;
  } catch (e) {
    console.error('❌ Error fetching contact name:', e);
    return null;
  }
}

// Helper function to fetch message content using Green API's getMessage
async function fetchMessageContent(
  instanceId: string,
  apiToken: string,
  chatId: string,
  idMessage: string
): Promise<any | null> {
  try {
    console.log('📩 Fetching message content for idMessage:', idMessage);
    
    const response = await fetch(
      `https://api.green-api.com/waInstance${instanceId}/getMessage/${apiToken}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId, idMessage })
      }
    );
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Message content fetched:', JSON.stringify(data).substring(0, 200));
      return data;
    } else {
      console.error('❌ Failed to fetch message content:', response.status, await response.text());
      return null;
    }
  } catch (e) {
    console.error('❌ Error fetching message content:', e);
    return null;
  }
}

// Helper function to extract message text from various message types
function extractMessageText(messageData: any, typeMessage: string): string {
  if (typeMessage === 'textMessage') {
    return messageData?.textMessageData?.textMessage || messageData?.textMessage || '';
  } else if (typeMessage === 'extendedTextMessage') {
    return messageData?.extendedTextMessageData?.text || messageData?.extendedTextMessage?.text || '';
  } else if (typeMessage === 'imageMessage') {
    return messageData?.fileMessageData?.caption || messageData?.caption || '[תמונה]';
  } else if (typeMessage === 'videoMessage') {
    return messageData?.fileMessageData?.caption || messageData?.caption || '[וידאו]';
  } else if (typeMessage === 'audioMessage') {
    return '[הודעת קול]';
  } else if (typeMessage === 'documentMessage') {
    return messageData?.fileMessageData?.caption || `[מסמך: ${messageData?.fileMessageData?.fileName || messageData?.fileName || 'קובץ'}]`;
  } else if (typeMessage === 'templateMessage') {
    const templateData = messageData?.templateMessage;
    return templateData?.contentText || templateData?.titleText || '[הודעת תבנית]';
  } else if (typeMessage === 'buttonsMessage') {
    return messageData?.buttonsMessage?.contentText || '[הודעת כפתורים]';
  } else if (typeMessage === 'listMessage') {
    return messageData?.listMessage?.description || messageData?.listMessage?.title || '[הודעת רשימה]';
  } else if (typeMessage === 'contactMessage') {
    const contactData = messageData?.contactMessageData;
    if (contactData) {
      const displayName = contactData.displayName || 'איש קשר';
      const vcard = contactData.vcard || '';
      const phoneMatch = vcard.match(/TEL[^:]*:([+\d\s-]+)/i);
      const phoneFromVcard = phoneMatch ? phoneMatch[1].replace(/\s/g, '') : '';
      return `[איש קשר: ${displayName}${phoneFromVcard ? ` - ${phoneFromVcard}` : ''}]`;
    }
    return '[איש קשר]';
  } else if (typeMessage === 'contactsArrayMessage') {
    const contacts = messageData?.contactsArrayMessageData?.contacts || [];
    const contactNames = contacts.map((c: any) => c.displayName || 'איש קשר').join(', ');
    return `[אנשי קשר: ${contactNames || 'מספר אנשי קשר'}]`;
  } else if (typeMessage === 'locationMessage') {
    const locData = messageData?.locationMessageData;
    return `[מיקום${locData?.nameLocation ? ': ' + locData.nameLocation : ''}]`;
  } else if (typeMessage === 'stickerMessage') {
    return '[סטיקר]';
  } else if (typeMessage === 'reactionMessage') {
    const reaction = messageData?.reactionMessage?.reaction || messageData?.extendedTextMessageData?.text || '👍';
    return `[תגובה: ${reaction}]`;
  } else {
    return `[${typeMessage}]`;
  }
}

// Helper function to forward a message to linked team channels
async function forwardToTeamChannels(
  supabaseClient: any,
  tenantId: string,
  connectionUserId: string,
  chatId: string,
  senderName: string | null,
  messageText: string,
  messageData: any,
  whatsappGroupId?: string | null
) {
  try {
    // Find linked team channels - by whatsapp_group_id or whatsapp_chat_id
    let query = supabaseClient
      .from('team_channel_whatsapp_links')
      .select('channel_id, forward_files, display_name')
      .eq('tenant_id', tenantId);

    if (whatsappGroupId) {
      query = query.eq('whatsapp_group_id', whatsappGroupId);
    } else {
      query = query.eq('whatsapp_chat_id', chatId);
    }

    const { data: links, error } = await query;

    if (error || !links?.length) return;

    console.log(`📨 Forwarding to ${links.length} linked team channel(s)`);

    // Extract file attachments from message data
    const attachments: any[] = [];
    const fileData = messageData?.fileMessageData;
    if (fileData?.downloadUrl) {
      const isImage = messageData?.typeMessage === 'imageMessage';
      attachments.push({
        name: fileData.fileName || (isImage ? 'image.jpg' : 'file'),
        url: fileData.downloadUrl,
        type: isImage ? 'image' : 'file',
      });
    }

    for (const link of links) {
      const prefix = `📱 *וואטסאפ* | ${senderName || chatId.split('@')[0]}`;
      const content = `${prefix}\n${messageText}`;

      const insertData: any = {
        channel_id: link.channel_id,
        tenant_id: tenantId,
        sender_id: connectionUserId,
        content,
        is_edited: false,
      };

      if (link.forward_files && attachments.length > 0) {
        insertData.attachments = attachments;
      }

      const { error: insertErr } = await supabaseClient
        .from('team_messages')
        .insert(insertData);

      if (insertErr) {
        console.error('❌ Failed to forward to team channel:', insertErr.message);
      } else {
        console.log('✅ Forwarded to team channel:', link.channel_id);
      }
    }
  } catch (e) {
    console.error('❌ Error forwarding to team channels:', e);
  }
}

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
    // Use limit(1) and order by created_at desc to get the most recent if duplicates exist
    const { data: integrations, error: integrationError } = await supabaseClient
      .from('tenant_integrations')
      .select('tenant_id, user_id, settings, instance_id, api_key')
      .eq('integration_type', 'green_api')
      .eq('is_active', true)
      .eq('instance_id', instanceId)
      .order('created_at', { ascending: false })
      .limit(1);
    
    const integration = integrations?.[0] ?? null;

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
    const apiToken = integration.api_key;
    console.log('✅ Identified tenant:', tenantId);
    console.log('✅ Connection owner (user_id):', connectionUserId);

    // Green API sends different types of webhooks
    const typeWebhook = webhookData.typeWebhook;
    const isIncoming = typeWebhook === 'incomingMessageReceived';
    const isOutgoing = typeWebhook === 'outgoingMessageReceived' || 
                       typeWebhook === 'outgoingAPIMessageReceived';
    const isOutgoingStatus = typeWebhook === 'outgoingMessageStatus';
    
    // Handle outgoingMessageStatus for messages sent from WhatsApp directly
    if (isOutgoingStatus) {
      const sendByApi = webhookData.sendByApi;
      const idMessage = webhookData.idMessage;
      const chatId = webhookData.chatId;
      
      console.log('📤 Outgoing message status - sendByApi:', sendByApi, 'idMessage:', idMessage);
      
      // Only process if NOT sent by API (i.e., sent directly from WhatsApp)
      if (sendByApi === true) {
        console.log('⏭️ Message was sent via API, already processed');
        return new Response(JSON.stringify({ received: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      if (!idMessage || !chatId) {
        console.log('⏭️ Missing idMessage or chatId in status webhook');
        return new Response(JSON.stringify({ received: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      // Check if we already have this message (prevent duplicates from multiple status updates)
      const { data: existingMessage } = await supabaseClient
        .from('chat_messages')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('connection_user_id', connectionUserId)
        .eq('raw_provider_data->>idMessage', idMessage)
        .maybeSingle();
      
      if (existingMessage) {
        console.log('⏭️ Message already exists, skipping duplicate');
        return new Response(JSON.stringify({ received: true, duplicate: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      // Fetch the actual message content using getMessage API
      if (!apiToken) {
        console.error('❌ No API token available to fetch message content');
        return new Response(JSON.stringify({ error: 'No API token' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500
        });
      }
      
      const messageContent = await fetchMessageContent(instanceId, apiToken, chatId, idMessage);
      
      if (!messageContent) {
        console.log('⚠️ Could not fetch message content, saving with minimal info');
        // Still save the message with minimal info
      }
      
      // Extract message text from fetched content
      const typeMessage = messageContent?.typeMessage || 'unknown';
      const messageText = messageContent 
        ? extractMessageText(messageContent, typeMessage)
        : '[הודעה]';
      
      // Extract phone number and normalize
      const phoneNumber = chatId.split('@')[0];
      const normalizedPhone = normalizePhone(phoneNumber);
      const isGroup = chatId.endsWith('@g.us');
      
      console.log('📱 Processing WhatsApp-sent message to:', phoneNumber, '(normalized:', normalizedPhone, ')');
      
      // Store combined webhook data
      const combinedRawData = {
        ...webhookData,
        fetchedMessageContent: messageContent,
        idMessage: idMessage,
      };
      
      // Handle group messages
      if (isGroup) {
        const groupChatId = chatId;
        
        const { data: existingGroup } = await supabaseClient
          .from('whatsapp_groups')
          .select('id, is_blocked')
          .eq('tenant_id', tenantId)
          .eq('group_chat_id', groupChatId)
          .maybeSingle();
        
        let groupId = existingGroup?.id;
        
        // If group doesn't exist, create it with a temporary name
        if (!groupId) {
          console.log('📝 Group not found, creating new group record for:', groupChatId);
          
          // Fetch real group name from Green API
          let realGroupName: string | null = null;
          try {
            if (instanceId && apiToken) {
              const response = await fetch(
                `https://api.green-api.com/waInstance${instanceId}/getGroupData/${apiToken}`,
                {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ groupId: groupChatId })
                }
              );
              if (response.ok) {
                const groupData = await response.json();
                realGroupName = groupData.subject || null;
                console.log('✅ Fetched real group name:', realGroupName);
              }
            }
          } catch (e) {
            console.log('⚠️ Could not fetch group name:', e);
          }
          
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
          console.log('✅ Created new group:', newGroupName, 'with ID:', groupId);
        }
        
        // Check if blocked
        const { data: blockedContact } = await supabaseClient
          .from('blocked_contacts')
          .select('id')
          .eq('tenant_id', tenantId)
          .eq('connection_user_id', connectionUserId)
          .eq('group_id', groupId)
          .maybeSingle();
        
        if (blockedContact || existingGroup?.is_blocked) {
          console.log('🚫 Group is blocked, ignoring');
          return new Response(JSON.stringify({ success: true, blocked: true }), {
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
            direction: 'outbound',
            channel: 'whatsapp',
            provider: 'green_api',
            sender_phone: phoneNumber,
            is_blocked: false,
            raw_provider_data: combinedRawData,
          });
        
        if (insertError) {
          console.error('❌ Failed to save group message from WhatsApp:', insertError);
          throw insertError;
        }
        
        console.log('✅ WhatsApp-sent group message saved successfully');
        // Forward to linked team channels
        await forwardToTeamChannels(supabaseClient, tenantId, connectionUserId, chatId, null, messageText, messageContent, groupId);
        return new Response(JSON.stringify({ success: true, contactType: 'group' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      // For individual messages - find contact using normalized phone
      let clientId: string | null = null;
      let leadId: string | null = null;
      
      // Search for client with normalized phone
      const { data: client } = await supabaseClient
        .from('clients')
        .select('id')
        .eq('tenant_id', tenantId)
        .or(`phone.ilike.%${normalizedPhone}%,phone.ilike.%${phoneNumber}%`)
        .maybeSingle();
      
      if (client) {
        clientId = client.id;
        console.log(`✅ Found client ${clientId} by normalized phone`);
        
        // Check if blocked
        const { data: blockedClient } = await supabaseClient
          .from('blocked_contacts')
          .select('id')
          .eq('tenant_id', tenantId)
          .eq('connection_user_id', connectionUserId)
          .eq('client_id', clientId)
          .maybeSingle();
        
        if (blockedClient) {
          console.log('🚫 Client is blocked, ignoring');
          return new Response(JSON.stringify({ success: true, blocked: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      } else {
        // Search for lead with normalized phone
        const { data: lead } = await supabaseClient
          .from('leads')
          .select('id')
          .eq('tenant_id', tenantId)
          .or(`phone.ilike.%${normalizedPhone}%,phone.ilike.%${phoneNumber}%`)
          .maybeSingle();
        
        if (lead) {
          leadId = lead.id;
          console.log(`✅ Found lead ${leadId} by normalized phone`);
          
          // Check if blocked
          const { data: blockedLead } = await supabaseClient
            .from('blocked_contacts')
            .select('id')
            .eq('tenant_id', tenantId)
            .eq('connection_user_id', connectionUserId)
            .eq('lead_id', leadId)
            .maybeSingle();
          
          if (blockedLead) {
            console.log('🚫 Lead is blocked, ignoring');
            return new Response(JSON.stringify({ success: true, blocked: true }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
        } else {
          console.log(`⚠️ No contact found for phone ${phoneNumber} (normalized: ${normalizedPhone}), saving as unknown`);
        }
      }
      
      // Check if unknown phone is blocked
      if (!clientId && !leadId) {
        const { data: blockedByPhone } = await supabaseClient
          .from('blocked_contacts')
          .select('id')
          .eq('tenant_id', tenantId)
          .eq('connection_user_id', connectionUserId)
          .eq('sender_phone', phoneNumber)
          .maybeSingle();
        
        if (blockedByPhone) {
          console.log('🚫 Phone is blocked, ignoring');
          return new Response(JSON.stringify({ success: true, blocked: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }
      
      // Fetch contact name for outgoing messages to unknown contacts
      let contactName: string | null = null;
      if (!clientId && !leadId && apiToken) {
        const chatIdForContact = `${phoneNumber}@c.us`;
        contactName = await fetchContactName(instanceId, apiToken, chatIdForContact);
      }
      
      // Save the message
      const { error: insertError } = await supabaseClient
        .from('chat_messages')
        .insert({
          client_id: clientId,
          lead_id: leadId,
          tenant_id: tenantId,
          message_text: messageText,
          direction: 'outbound',
          channel: 'whatsapp',
          provider: 'green_api',
          sender_phone: phoneNumber,
          sender_name: contactName,
          is_blocked: false,
          connection_user_id: connectionUserId,
          raw_provider_data: combinedRawData,
        });
      
      if (insertError) {
        console.error('❌ Failed to save WhatsApp-sent message:', insertError);
        throw insertError;
      }
      
      console.log('✅ WhatsApp-sent message saved successfully');
      return new Response(JSON.stringify({ 
        success: true,
        contactType: clientId ? 'client' : (leadId ? 'lead' : 'unknown'),
        contactId: clientId || leadId || null,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // Handle incomingMessageStatus - sync read status from WhatsApp phone/web
    const isIncomingStatus = typeWebhook === 'incomingMessageStatus';
    
    if (isIncomingStatus) {
      const status = webhookData.status;
      const chatId = webhookData.chatId;
      
      console.log('📖 Incoming message status:', status, 'for chat:', chatId);
      
      // Only process 'read' status
      if (status === 'read' && chatId) {
        const phoneNumber = chatId.split('@')[0];
        const normalizedPhone = normalizePhone(phoneNumber);
        const isGroup = chatId.endsWith('@g.us');
        
        console.log('✅ Syncing read status from WhatsApp for:', phoneNumber);
        
        if (isGroup) {
          // Find the group and mark messages as read
          const { data: group } = await supabaseClient
            .from('whatsapp_groups')
            .select('id')
            .eq('tenant_id', tenantId)
            .eq('group_chat_id', chatId)
            .maybeSingle();
          
          if (group) {
            const { error } = await supabaseClient
              .from('chat_messages')
              .update({ read_at: new Date().toISOString() })
              .eq('tenant_id', tenantId)
              .eq('connection_user_id', connectionUserId)
              .eq('group_id', group.id)
              .eq('direction', 'inbound')
              .is('read_at', null);
            
            if (error) {
              console.error('❌ Error updating group read status:', error);
            } else {
              console.log('✅ Group messages marked as read');
            }
          }
        } else {
          // For individual chats - find client or lead
          const { data: client } = await supabaseClient
            .from('clients')
            .select('id')
            .eq('tenant_id', tenantId)
            .or(`phone.ilike.%${normalizedPhone}%,phone.ilike.%${phoneNumber}%`)
            .maybeSingle();
          
          if (client) {
            const { error } = await supabaseClient
              .from('chat_messages')
              .update({ read_at: new Date().toISOString() })
              .eq('tenant_id', tenantId)
              .eq('connection_user_id', connectionUserId)
              .eq('client_id', client.id)
              .eq('direction', 'inbound')
              .is('read_at', null);
            
            if (error) {
              console.error('❌ Error updating client read status:', error);
            } else {
              console.log('✅ Client messages marked as read');
            }
          } else {
            // Try lead
            const { data: lead } = await supabaseClient
              .from('leads')
              .select('id')
              .eq('tenant_id', tenantId)
              .or(`phone.ilike.%${normalizedPhone}%,phone.ilike.%${phoneNumber}%`)
              .maybeSingle();
            
            if (lead) {
              const { error } = await supabaseClient
                .from('chat_messages')
                .update({ read_at: new Date().toISOString() })
                .eq('tenant_id', tenantId)
                .eq('connection_user_id', connectionUserId)
                .eq('lead_id', lead.id)
                .eq('direction', 'inbound')
                .is('read_at', null);
              
              if (error) {
                console.error('❌ Error updating lead read status:', error);
              } else {
                console.log('✅ Lead messages marked as read');
              }
            } else {
              // Try unknown contact by phone
              const { error } = await supabaseClient
                .from('chat_messages')
                .update({ read_at: new Date().toISOString() })
                .eq('tenant_id', tenantId)
                .eq('connection_user_id', connectionUserId)
                .eq('sender_phone', phoneNumber)
                .is('client_id', null)
                .is('lead_id', null)
                .is('group_id', null)
                .eq('direction', 'inbound')
                .is('read_at', null);
              
              if (error) {
                console.error('❌ Error updating unknown contact read status:', error);
              } else {
                console.log('✅ Unknown contact messages marked as read');
              }
            }
          }
        }
        
        return new Response(JSON.stringify({ success: true, readSynced: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      // Ignore other statuses
      return new Response(JSON.stringify({ received: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // For non-message webhooks, ignore
    if (!isIncoming && !isOutgoing) {
      console.log('⏭️ Ignoring non-message webhook:', typeWebhook);
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
    const normalizedPhone = normalizePhone(phoneNumber);
    
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
      const templateData = messageData.templateMessage;
      messageText = templateData?.contentText || templateData?.titleText || '[הודעת תבנית]';
    } else if (messageType === 'buttonsMessage') {
      messageText = messageData.buttonsMessage?.contentText || '[הודעת כפתורים]';
    } else if (messageType === 'listMessage') {
      messageText = messageData.listMessage?.description || messageData.listMessage?.title || '[הודעת רשימה]';
    } else if (messageType === 'contactMessage') {
      const contactData = messageData.contactMessageData;
      if (contactData) {
        const displayName = contactData.displayName || 'איש קשר';
        const vcard = contactData.vcard || '';
        const phoneMatch = vcard.match(/TEL[^:]*:([+\d\s-]+)/i);
        const phoneFromVcard = phoneMatch ? phoneMatch[1].replace(/\s/g, '') : '';
        messageText = `[איש קשר: ${displayName}${phoneFromVcard ? ` - ${phoneFromVcard}` : ''}]`;
      } else {
        messageText = '[איש קשר]';
      }
    } else if (messageType === 'contactsArrayMessage') {
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

    console.log('📱 Processing message from:', isGroup ? 'Group ' + phoneNumber : phoneNumber, '(normalized:', normalizedPhone, ')');

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

      // Helper function to fetch REAL group name from Green API using getGroupData
      async function fetchRealGroupName(groupChatId: string): Promise<string | null> {
        try {
          if (!instanceId || !apiToken) {
            console.log('⚠️ Missing credentials for Green API call');
            return null;
          }
          
          console.log('🔍 Fetching real group name using getGroupData for:', groupChatId);
          
          const response = await fetch(
            `https://api.green-api.com/waInstance${instanceId}/getGroupData/${apiToken}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ groupId: groupChatId })
            }
          );
          
          if (response.ok) {
            const groupData = await response.json();
            console.log('📋 Green API getGroupData response:', JSON.stringify(groupData));
            const realName = groupData.subject || null;
            console.log('✅ Real group name from API (subject):', realName);
            return realName;
          } else {
            console.error('❌ Failed to fetch group data:', response.status, await response.text());
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

      // Fetch and update group avatar if not already set
      const { data: groupData } = await supabaseClient
        .from('whatsapp_groups')
        .select('whatsapp_avatar_url')
        .eq('id', groupId)
        .single();
      
      if (!groupData?.whatsapp_avatar_url && apiToken) {
        const groupAvatarUrl = await fetchWhatsAppAvatar(instanceId, apiToken, groupChatId);
        if (groupAvatarUrl) {
          await supabaseClient
            .from('whatsapp_groups')
            .update({ whatsapp_avatar_url: groupAvatarUrl })
            .eq('id', groupId);
          console.log('📸 Updated group avatar');
        }
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

      // Forward to linked team channels
      await forwardToTeamChannels(supabaseClient, tenantId, connectionUserId, senderData.chatId, senderData.senderName, messageText, messageData, groupId);

      // For incoming group messages, add "unread" tag automatically
      if (isIncoming) {
        console.log('🏷️ Adding unread tag for incoming group message...');
        
        // Find the "unread" tag by name patterns
        const { data: unreadTag } = await supabaseClient
          .from('chat_tags')
          .select('id')
          .eq('tenant_id', tenantId)
          .or('name.ilike.%לא נקרא%,name.ilike.%unread%')
          .maybeSingle();
        
        if (unreadTag) {
          const tagData = {
            tag_id: unreadTag.id,
            user_id: connectionUserId,
            tenant_id: tenantId,
            group_id: groupId,
          };
          
          // Upsert to avoid duplicates
          const { error: tagError } = await supabaseClient
            .from('chat_contact_tags')
            .upsert(tagData, { 
              onConflict: 'tag_id,user_id,client_id,lead_id,group_id,sender_phone',
              ignoreDuplicates: true 
            });
          
          if (tagError) {
            console.log('⚠️ Could not add unread tag to group (may already exist):', tagError.message);
          } else {
            console.log('✅ Unread tag added to group successfully');
          }
        } else {
          console.log('ℹ️ No unread tag found in tenant');
        }
      }

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

    // Search for client or lead in THIS tenant only using normalized phone
    console.log('👤 Individual message, searching for contact in tenant:', tenantId, 'with normalized phone:', normalizedPhone);
    
    let clientId: string | null = null;
    let leadId: string | null = null;
    
    // Search for client with normalized phone (matches both 05... and 972...)
    let clientQuery = supabaseClient
      .from('clients')
      .select('id')
      .eq('tenant_id', tenantId)
      .or(`phone.ilike.%${normalizedPhone}%,phone.ilike.%${phoneNumber}%`);
    
    // Only filter by provider for incoming messages
    if (isIncoming) {
      clientQuery = clientQuery.eq('active_chat_provider', 'green_api');
    }
    
    const { data: client } = await clientQuery.maybeSingle();

    if (client) {
      clientId = client.id;
      console.log(`✅ Found client ${clientId} in tenant ${tenantId} by normalized phone`);
      
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
      
      // Fetch and update avatar if not already set
      const { data: clientData } = await supabaseClient
        .from('clients')
        .select('whatsapp_avatar_url')
        .eq('id', clientId)
        .single();
      
      if (!clientData?.whatsapp_avatar_url && apiToken) {
        const avatarUrl = await fetchWhatsAppAvatar(instanceId, apiToken, senderData.chatId);
        if (avatarUrl) {
          await supabaseClient
            .from('clients')
            .update({ whatsapp_avatar_url: avatarUrl })
            .eq('id', clientId);
          console.log('📸 Updated client avatar');
        }
      }
    } else {
      // Search for lead with normalized phone
      let leadQuery = supabaseClient
        .from('leads')
        .select('id')
        .eq('tenant_id', tenantId)
        .or(`phone.ilike.%${normalizedPhone}%,phone.ilike.%${phoneNumber}%`);
      
      // Only filter by provider for incoming messages
      if (isIncoming) {
        leadQuery = leadQuery.eq('active_chat_provider', 'green_api');
      }
      
      const { data: lead } = await leadQuery.maybeSingle();

      if (lead) {
        leadId = lead.id;
        console.log(`✅ Found lead ${leadId} in tenant ${tenantId} by normalized phone`);
        
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
        
        // Fetch and update avatar if not already set
        const { data: leadData } = await supabaseClient
          .from('leads')
          .select('whatsapp_avatar_url')
          .eq('id', leadId)
          .single();
        
        if (!leadData?.whatsapp_avatar_url && apiToken) {
          const avatarUrl = await fetchWhatsAppAvatar(instanceId, apiToken, senderData.chatId);
          if (avatarUrl) {
            await supabaseClient
              .from('leads')
              .update({ whatsapp_avatar_url: avatarUrl })
              .eq('id', leadId);
            console.log('📸 Updated lead avatar');
          }
        }
      } else {
        console.log(`⚠️ No contact found in tenant ${tenantId} for phone ${phoneNumber} (normalized: ${normalizedPhone})`);
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

    // For unknown contacts, fetch and store avatar in raw_provider_data
    let senderProfileImage: string | null = null;
    if (!clientId && !leadId && apiToken) {
      senderProfileImage = await fetchWhatsAppAvatar(instanceId, apiToken, senderData.chatId);
      if (senderProfileImage) {
        console.log('📸 Fetched avatar for unknown contact');
      }
    }

    console.log('💾 Saving message...');

    // Save the message to THIS tenant only
    const rawDataWithAvatar = senderProfileImage 
      ? { ...webhookData, senderProfileImage } 
      : webhookData;
      
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
        raw_provider_data: rawDataWithAvatar,
      });

    if (insertError) {
      console.error('❌ Failed to save message:', insertError);
      throw insertError;
    }

    console.log('✅ Message saved successfully');

    // Forward to linked team channels (individual chats)
    await forwardToTeamChannels(supabaseClient, tenantId, connectionUserId, senderData.chatId, senderData.senderName, messageText, messageData);

    // For incoming messages, add "unread" tag automatically
    if (!isOutgoing) {
      console.log('🏷️ Adding unread tag for incoming message...');
      
      // Find the "unread" tag by name patterns
      const { data: unreadTag } = await supabaseClient
        .from('chat_tags')
        .select('id')
        .eq('tenant_id', tenantId)
        .or('name.ilike.%לא נקרא%,name.ilike.%unread%')
        .maybeSingle();
      
      if (unreadTag) {
        // Prepare the tag association data
        const tagData: any = {
          tag_id: unreadTag.id,
          user_id: connectionUserId,
          tenant_id: tenantId,
        };
        
        if (clientId) {
          tagData.client_id = clientId;
        } else if (leadId) {
          tagData.lead_id = leadId;
        } else {
          tagData.sender_phone = phoneNumber;
        }
        
        // Upsert to avoid duplicates
        const { error: tagError } = await supabaseClient
          .from('chat_contact_tags')
          .upsert(tagData, { 
            onConflict: 'tag_id,user_id,client_id,lead_id,group_id,sender_phone',
            ignoreDuplicates: true 
          });
        
        if (tagError) {
          console.log('⚠️ Could not add unread tag (may already exist):', tagError.message);
        } else {
          console.log('✅ Unread tag added successfully');
        }
      } else {
        console.log('ℹ️ No unread tag found in tenant');
      }
    }

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
