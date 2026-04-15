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
      return contactName;
    }
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

    if (error) {
      console.error('❌ Error querying team_channel_whatsapp_links:', error.message);
      return;
    }
    
    if (!links?.length) {
      return;
    }


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
      }
    }
  } catch (e) {
    console.error('❌ Error forwarding to team channels:', e);
  }
}

// ===========================
// CARMEN WHATSAPP SESSION LOGIC
// ===========================

// Sync Carmen WhatsApp session to ai_conversations table (so it appears in AIOS chat UI)
async function syncCarmenToAIConversation(
  supabase: any,
  session: any,
  conversationHistory: any[]
): Promise<string | null> {
  try {
    const userId = session.connection_user_id;
    const tenantId = session.tenant_id;
    if (!userId || !tenantId) return null;

    // Convert carmen history format to ai_conversations messages format
    const messages = conversationHistory.map((msg: any) => ({
      role: msg.role,
      content: msg.content,
    }));

    if (session.ai_conversation_id) {
      // Update existing conversation
      await supabase
        .from('ai_conversations')
        .update({
          messages,
          updated_at: new Date().toISOString(),
        })
        .eq('id', session.ai_conversation_id);
      return session.ai_conversation_id;
    } else {
      // Create new conversation
      const title = `שיחת WhatsApp — ${session.sender_name || session.phone || 'לא ידוע'}`;
      const { data, error } = await supabase
        .from('ai_conversations')
        .insert({
          user_id: userId,
          tenant_id: tenantId,
          title,
          messages,
        })
        .select('id')
        .single();

      if (error || !data) {
        console.error('Failed to create ai_conversation:', error);
        return null;
      }

      // Link back to session
      await supabase
        .from('carmen_whatsapp_sessions')
        .update({ ai_conversation_id: data.id })
        .eq('id', session.id);

      return data.id;
    }
  } catch (e) {
    console.error('syncCarmenToAIConversation error:', e);
    return null;
  }
}

// Send a WhatsApp message via Green API
async function sendGreenApiMessage(
  instanceId: string,
  apiToken: string,
  chatId: string,
  message: string
): Promise<boolean> {
  try {
    const url = `https://api.green-api.com/waInstance${instanceId}/sendMessage/${apiToken}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId, message }),
    });
    return res.ok;
  } catch (e) {
    console.error('❌ sendGreenApiMessage error:', e);
    return false;
  }
}

// Find an active Carmen session for a given chat (strict match: connection + chat_id + phone)
async function findActiveCarmenSession(
  supabase: any,
  tenantId: string,
  chatId: string,
  connectionUserId: string
): Promise<any | null> {
  const phone = chatId.split('@')[0];
  const { data } = await supabase
    .from('carmen_whatsapp_sessions')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('status', 'active')
    .eq('connection_user_id', connectionUserId)
    .eq('chat_id', chatId)
    .eq('phone', phone)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data || null;
}

// Find the Carmen agent for a tenant (looks for agent named כרמן/Carmen)
async function findCarmenAgent(
  supabase: any,
  tenantId: string
): Promise<any | null> {
  const { data } = await supabase
    .from('ai_agents')
    .select('*')
    .eq('tenant_id', tenantId)
    .or('name.ilike.%carmen%,name.ilike.%כרמן%')
    .eq('active', true)
    .limit(1)
    .maybeSingle();
  return data || null;
}

// Check if any automation has a Carmen WhatsApp session trigger configured
async function findCarmenSessionAutomation(
  supabase: any,
  tenantId: string
): Promise<any | null> {
  // Method 1: Legacy — top-level configuration.carmen_session_mode
  const { data: legacyMatch } = await supabase
    .from('automations')
    .select('id, name, configuration')
    .eq('tenant_id', tenantId)
    .eq('trigger_type', 'whatsapp_message_received')
    .eq('active', true)
    .filter('configuration->>carmen_session_mode', 'eq', 'true')
    .limit(1)
    .maybeSingle();
  if (legacyMatch) return legacyMatch;

  // Method 2: Flow Builder — trigger step with action_type = carmen_whatsapp_session
  const { data: flowSteps } = await supabase
    .from('automation_flow_steps')
    .select('automation_id, configuration')
    .eq('tenant_id', tenantId)
    .eq('step_type', 'trigger')
    .eq('action_type', 'carmen_whatsapp_session');

  if (flowSteps && flowSteps.length > 0) {
    const automationIds = flowSteps.map((s: any) => s.automation_id);
    const { data: automations } = await supabase
      .from('automations')
      .select('id, name, configuration')
      .in('id', automationIds)
      .eq('active', true)
      .limit(1);
    if (automations && automations.length > 0) {
      // Merge trigger step config into the automation config for downstream use
      const auto = automations[0];
      const stepConfig = flowSteps.find((s: any) => s.automation_id === auto.id)?.configuration || {};
      auto.configuration = { ...auto.configuration, ...stepConfig };
      return auto;
    }
  }

  return null;
}

// Run Carmen AI and return her response
async function runCarmenAI(
  supabase: any,
  agentId: string,
  tenantId: string,
  userMessage: string,
  conversationHistory: any[],
  senderPhone?: string | null,
  senderName?: string | null
): Promise<string> {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    // Build messages array with history
    const historyContext = conversationHistory.length > 0
      ? `\n\n=== היסטוריית שיחה ===\n${conversationHistory.slice(-10).map((m: any) => `${m.role === 'user' ? 'משתמש' : 'כרמן'}: ${m.content}`).join('\n')}`
      : '';
    
    const commandWithHistory = historyContext
      ? `${userMessage}${historyContext}`
      : userMessage;
    
    const res = await fetch(`${supabaseUrl}/functions/v1/run-ai-agent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        agent_id: agentId,
        command_text: commandWithHistory,
        tenant_id: tenantId,
        user_name: senderName || 'WhatsApp',
        lead_data: senderPhone ? { phone: senderPhone } : undefined,
      }),
    });
    
    if (!res.ok) {
      console.error('❌ run-ai-agent failed:', res.status);
      return 'מצטערת, אירעה שגיאה. נסה שוב.';
    }
    
    const data = await res.json();
    return data.output || 'לא הצלחתי לעבד את הבקשה.';
  } catch (e) {
    console.error('❌ runCarmenAI error:', e);
    return 'מצטערת, אירעה שגיאה טכנית.';
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

    // Quick health check - if DB is under pressure, return early to avoid piling up
    const healthCheck = await Promise.race([
      supabaseClient.from('tenants').select('id').limit(1),
      new Promise((_, reject) => setTimeout(() => reject(new Error('DB timeout')), 5000))
    ]).catch(() => null);

    if (!healthCheck) {
      console.warn('⚠️ DB health check failed, returning early to reduce pressure');
      return new Response(JSON.stringify({ received: true, deferred: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const webhookData = await req.json();

    // Extract instance ID from webhook to identify the tenant
    const instanceId = webhookData.instanceData?.idInstance;
    if (!instanceId) {
      console.error('❌ No instance ID in webhook data');
      return new Response(JSON.stringify({ error: 'Missing instance ID' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      });
    }


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
    const { data: connectionProfile } = await supabaseClient
      .from('profiles')
      .select('full_name')
      .eq('id', connectionUserId)
      .maybeSingle();
    const connectionDisplayName = connectionProfile?.full_name || null;

    // Green API sends different types of webhooks
    const typeWebhook = webhookData.typeWebhook;
    const isIncoming = typeWebhook === 'incomingMessageReceived';
    const isOutgoing = typeWebhook === 'outgoingMessageReceived' || 
                       typeWebhook === 'outgoingAPIMessageReceived';
    // Manual outgoing = sent from WhatsApp app directly (NOT via API/automations)
    const isManualOutgoing = typeWebhook === 'outgoingMessageReceived';
    const isOutgoingStatus = typeWebhook === 'outgoingMessageStatus';
    
    // Handle outgoingMessageStatus for messages sent from WhatsApp directly
    if (isOutgoingStatus) {
      const sendByApi = webhookData.sendByApi;
      const idMessage = webhookData.idMessage;
      const chatId = webhookData.chatId;
      
      
      // Only process if NOT sent by API (i.e., sent directly from WhatsApp)
      if (sendByApi === true) {
        return new Response(JSON.stringify({ received: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      if (!idMessage || !chatId) {
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
          
          // Fetch real group name and invite link from Green API
          let realGroupName: string | null = null;
          let realInviteLink: string | null = null;
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
                realInviteLink = groupData.groupInviteLink || null;
              }
            }
          } catch (e) {
          }
          
          const newGroupName = realGroupName || `קבוצה ${groupChatId.split('@')[0].slice(-4)}`;
          
          const insertData: any = {
            tenant_id: tenantId,
            group_chat_id: groupChatId,
            group_name: newGroupName,
          };
          if (realInviteLink) {
            insertData.invite_link = realInviteLink;
          }

          const { data: newGroup, error: groupError } = await supabaseClient
            .from('whatsapp_groups')
            .insert(insertData)
            .select('id')
            .single();
          
          if (groupError) {
            console.error('❌ Failed to create group:', groupError);
            throw groupError;
          }
          
          groupId = newGroup.id;
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
        
        // Do not forward from outgoingMessageStatus to avoid duplicate forwards.
        // Forwarding is handled by outgoingMessageReceived/incomingMessageReceived flow.
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
        
        // Check if blocked
        const { data: blockedClient } = await supabaseClient
          .from('blocked_contacts')
          .select('id')
          .eq('tenant_id', tenantId)
          .eq('connection_user_id', connectionUserId)
          .eq('client_id', clientId)
          .maybeSingle();
        
        if (blockedClient) {
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
          
          // Check if blocked
          const { data: blockedLead } = await supabaseClient
            .from('blocked_contacts')
            .select('id')
            .eq('tenant_id', tenantId)
            .eq('connection_user_id', connectionUserId)
            .eq('lead_id', leadId)
            .maybeSingle();
          
          if (blockedLead) {
            return new Response(JSON.stringify({ success: true, blocked: true }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
        } else {
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
      
      
      // Only process 'read' status
      if (status === 'read' && chatId) {
        const phoneNumber = chatId.split('@')[0];
        const normalizedPhone = normalizePhone(phoneNumber);
        const isGroup = chatId.endsWith('@g.us');
        
        
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


    // Handle group messages differently
    if (isGroup) {
      const groupChatId = senderData.chatId;
      
      console.log('chatName from API (unreliable):', senderData.chatName,
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

      // Helper function to fetch REAL group data from Green API using getGroupData
      async function fetchGroupDataFromApi(groupChatId: string): Promise<{ name: string | null; inviteLink: string | null }> {
        try {
          if (!instanceId || !apiToken) {
            return { name: null, inviteLink: null };
          }
          
          
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
            return {
              name: groupData.subject || null,
              inviteLink: groupData.groupInviteLink || null,
            };
          } else {
            console.error('❌ Failed to fetch group data:', response.status, await response.text());
            return { name: null, inviteLink: null };
          }
        } catch (e) {
          console.error('❌ Error fetching group data:', e);
          return { name: null, inviteLink: null };
        }
      }

      if (!groupId) {
        // Create new group - fetch real name and invite link from Green API
        const groupApiData = await fetchGroupDataFromApi(groupChatId);
        const newGroupName = groupApiData.name || `קבוצה ${groupChatId.split('@')[0].slice(-4)}`;
        
        const insertData: any = {
          tenant_id: tenantId,
          group_chat_id: groupChatId,
          group_name: newGroupName,
        };
        if (groupApiData.inviteLink) {
          insertData.invite_link = groupApiData.inviteLink;
        }

        const { data: newGroup, error: groupError } = await supabaseClient
          .from('whatsapp_groups')
          .insert(insertData)
          .select('id')
          .single();

        if (groupError) {
          console.error('❌ Failed to create group:', groupError);
          throw groupError;
        }

        groupId = newGroup.id;
      } else if (existingGroup) {
        const currentName = existingGroup.group_name || '';
        const looksLikePlaceholder = currentName.startsWith('קבוצה ');
        const looksLikeSenderName = /🌴|📱|👤/.test(currentName) || currentName.split(' ').length <= 2;
        
        if (looksLikePlaceholder || looksLikeSenderName) {
          const groupApiData = await fetchGroupDataFromApi(groupChatId);
          
          const updateFields: any = {};
          if (groupApiData.name && groupApiData.name !== currentName) {
            updateFields.group_name = groupApiData.name;
          }
          if (groupApiData.inviteLink) {
            updateFields.invite_link = groupApiData.inviteLink;
          }
          
          if (Object.keys(updateFields).length > 0) {
            await supabaseClient
              .from('whatsapp_groups')
              .update(updateFields)
              .eq('id', groupId);
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


      // Forward to linked team channels
      const forwardedSenderName = isOutgoing ? connectionDisplayName : senderData.senderName;
      await forwardToTeamChannels(supabaseClient, tenantId, connectionUserId, senderData.chatId, forwardedSenderName, messageText, messageData, groupId);

      // For incoming group messages, add "unread" tag automatically
      if (isIncoming) {
        
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
          } else {
          }
        } else {
        }
      }

      // Trigger automations for incoming/outgoing group WhatsApp messages
      if (isIncoming || isManualOutgoing) {
        try {
          
          // Fetch group tags
          let groupTags: string[] = [];
          const { data: groupTagsData } = await supabaseClient
            .from('chat_contact_tags')
            .select('tag_id')
            .eq('tenant_id', tenantId)
            .eq('group_id', groupId);
          if (groupTagsData) {
            groupTags = groupTagsData.map((t: any) => t.tag_id);
          }

          // Fetch group name and invite link
          const { data: groupRecord } = await supabaseClient
            .from('whatsapp_groups')
            .select('group_name, group_chat_id, invite_link')
            .eq('id', groupId)
            .single();

          // Try to get invite link: first from DB cache, then from getGroupData, then from getGroupInviteLink
          let groupInviteLink = groupRecord?.invite_link || null;
          if (!groupInviteLink && instanceId && apiToken && groupRecord?.group_chat_id) {
            // Try getGroupData first (returns invite link along with other data)
            try {
              const groupApiData = await fetchGroupDataFromApi(groupRecord.group_chat_id);
              if (groupApiData.inviteLink) {
                groupInviteLink = groupApiData.inviteLink;
              }
            } catch (e) {
            }

            // Fallback: try dedicated getGroupInviteLink endpoint
            if (!groupInviteLink) {
              try {
                const inviteResponse = await fetch(
                  `https://api.green-api.com/waInstance${instanceId}/getGroupInviteLink/${apiToken}`,
                  {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ groupId: groupRecord.group_chat_id })
                  }
                );
                if (inviteResponse.ok) {
                  const inviteData = await inviteResponse.json();
                  groupInviteLink = inviteData.inviteLink || null;
                }
              } catch (e) {
                console.error('⚠️ Could not fetch group invite link:', e);
              }
            }

            // Save to DB if found
            if (groupInviteLink) {
              await supabaseClient
                .from('whatsapp_groups')
                .update({ invite_link: groupInviteLink })
                .eq('id', groupId);
            } else {
            }
          }

          const automationPayload = {
            trigger_type: 'whatsapp_message_received',
            tenant_id: tenantId,
            data: {
              sender_name: senderData.senderName || null,
              sender_phone: phoneNumber,
              message_text: messageText,
              group_id: groupId,
              group_name: groupRecord?.group_name || null,
              group_chat_id: groupRecord?.group_chat_id || null,
              contact_type: 'group',
              contact_id: groupId,
              contact_name: groupRecord?.group_name || null,
              group_invite_link: groupInviteLink || null,
              connection_user_id: connectionUserId,
              tags: groupTags,
            },
          };

          const triggerUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/trigger-automation`;
          fetch(triggerUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
            },
            body: JSON.stringify(automationPayload),
          }).catch(err => console.error('❌ Error triggering group automation:', err));
          
        } catch (automationError) {
          console.error('❌ Error preparing group automation trigger:', automationError);
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
    
    const { data: blockedByPhone } = await supabaseClient
      .from('blocked_contacts')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('connection_user_id', connectionUserId)
      .eq('sender_phone', phoneNumber)
      .maybeSingle();

    if (blockedByPhone) {
      return new Response(JSON.stringify({ 
        success: true, 
        blocked: true,
        message: 'Sender is blocked by phone' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Search for client or lead in THIS tenant only using normalized phone
    
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
      
      // Check if client is in blocked_contacts
      const { data: blockedClient } = await supabaseClient
        .from('blocked_contacts')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('connection_user_id', connectionUserId)
        .eq('client_id', clientId)
        .maybeSingle();

      if (blockedClient) {
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
        
        // Check if lead is in blocked_contacts
        const { data: blockedLead } = await supabaseClient
          .from('blocked_contacts')
          .select('id')
          .eq('tenant_id', tenantId)
          .eq('connection_user_id', connectionUserId)
          .eq('lead_id', leadId)
          .maybeSingle();

        if (blockedLead) {
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
          }
        }
      } else {
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
      } else if (leadId) {
        await supabaseClient
          .from('hidden_chats')
          .delete()
          .eq('tenant_id', tenantId)
          .eq('lead_id', leadId);
      } else {
        // Unknown contact - unhide by phone
        await supabaseClient
          .from('hidden_chats')
          .delete()
          .eq('tenant_id', tenantId)
          .eq('sender_phone', phoneNumber);
      }
    }

    // For unknown contacts, fetch and store avatar in raw_provider_data
    let senderProfileImage: string | null = null;
    if (!clientId && !leadId && apiToken) {
      senderProfileImage = await fetchWhatsAppAvatar(instanceId, apiToken, senderData.chatId);
      if (senderProfileImage) {
      }
    }


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


    // Forward to linked team channels (individual chats)
    await forwardToTeamChannels(supabaseClient, tenantId, connectionUserId, senderData.chatId, senderData.senderName, messageText, messageData);

    // For incoming messages, add "unread" tag automatically
    if (!isOutgoing) {
      
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
        } else {
        }
      } else {
      }
    }

    // ===========================
    // CARMEN WHATSAPP SESSION HANDLER
    // New sessions: only from OUTGOING messages (user sends trigger keyword)
    // Existing sessions: respond to INCOMING messages (other party replies)
    // ===========================
    if (!isGroup && (isIncoming || isManualOutgoing)) {
      const chatId = senderData.chatId;
      const normalizedMsg = messageText.trim().toLowerCase();
      
      // Check for active Carmen session
      const activeSession = await findActiveCarmenSession(supabaseClient, tenantId, chatId, connectionUserId);
      
      if (activeSession) {
        // === SESSION IS ACTIVE: route message to Carmen ===
        
        // Check for end keyword
        const endKeyword = (activeSession.end_keyword || 'סיימנו כרמן').toLowerCase();
        if (normalizedMsg.includes(endKeyword)) {
          // End the session
          await supabaseClient
            .from('carmen_whatsapp_sessions')
            .update({ status: 'ended', ended_at: new Date().toISOString() })
            .eq('id', activeSession.id);
          
          await sendGreenApiMessage(
            instanceId,
            apiToken,
            chatId,
            'השיחה עם כרמן הסתיימה. תמיד כאן בשבילך! להתראות!'
          );
          
          return new Response(JSON.stringify({ success: true, carmen_session: 'ended' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        
        // Continue session - send message to Carmen
        const history = activeSession.conversation_history || [];
        
        // Add user message to history
        const updatedHistory = [
          ...history,
          { role: 'user', content: messageText, timestamp: new Date().toISOString() }
        ];
        
        // Get Carmen's response
        const carmenResponse = await runCarmenAI(
          supabaseClient,
          activeSession.agent_id,
          tenantId,
          messageText,
          history,
          activeSession.phone || phoneNumber,
          activeSession.sender_name || senderData.senderName
        );
        
        // Add Carmen's response to history
        updatedHistory.push({
          role: 'assistant',
          content: carmenResponse,
          timestamp: new Date().toISOString()
        });
        
        // Update session with new history and last_message_at
        await supabaseClient
          .from('carmen_whatsapp_sessions')
          .update({
            conversation_history: updatedHistory,
            last_message_at: new Date().toISOString(),
          })
          .eq('id', activeSession.id);
        
        // Send Carmen's response back via WhatsApp
        await sendGreenApiMessage(instanceId, apiToken, chatId, carmenResponse);
        
        // Sync to ai_conversations so it appears in AIOS chat UI
        await syncCarmenToAIConversation(supabaseClient, activeSession, updatedHistory);
        
        return new Response(JSON.stringify({ success: true, carmen_session: 'active', response_sent: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } else {
        // === NO ACTIVE SESSION: check if message triggers Carmen ===
        // Only OUTGOING messages (sent by the user) can trigger a new session
        if (!isManualOutgoing) {
          // Incoming message but no active session — skip Carmen entirely
        } else {
        // Step 1: Find active Carmen automation for this tenant
        const carmenAutomation = await findCarmenSessionAutomation(supabaseClient, tenantId);
        
        if (!carmenAutomation) {
          // No Carmen automation configured — skip silently
        } else {
          // === SCOPE ENFORCEMENT ===
          const scopeMode = carmenAutomation.configuration?.carmen_scope_mode || 'all';
          const allowedPhones = carmenAutomation.configuration?.carmen_allowed_phones || [];
          
          // Check if this chat is allowed by scope rules
          let scopeAllowed = true;
          if (scopeMode === 'specific_phone') {
            // Only allow specific phone numbers (e.g. private chat with self)
            const normalizedChatPhone = phoneNumber?.replace(/[^0-9]/g, '') || '';
            const isPhoneAllowed = allowedPhones.some((p: string) => {
              const normalizedAllowed = p.replace(/[^0-9]/g, '');
              return normalizedChatPhone.endsWith(normalizedAllowed) || normalizedAllowed.endsWith(normalizedChatPhone);
            });
            if (!isPhoneAllowed) {
              scopeAllowed = false;
              console.log(`[CARMEN SCOPE] Phone ${phoneNumber} not in allowed list [${allowedPhones.join(', ')}]. Skipping session creation.`);
            }
          } else if (scopeMode === 'private_only') {
            // Only private chats (already filtered by !isGroup above)
            scopeAllowed = true;
          } else if (scopeMode === 'specific_group') {
            // Only specific groups — skip for non-group chats
            scopeAllowed = false;
            console.log(`[CARMEN SCOPE] specific_group mode but this is a private chat. Skipping.`);
          }
          
          if (!scopeAllowed) {
            // Scope check failed — do NOT create session
          } else {
          // Get trigger keyword from automation config (default: 'כרמן')
          const triggerKeyword = (carmenAutomation.configuration?.trigger_keyword || 'כרמן').toLowerCase();
          const endKeywordConfig = carmenAutomation.configuration?.end_keyword || 'סיימנו כרמן';
          const hasTriggerKeyword = normalizedMsg.includes(triggerKeyword);
          
          if (hasTriggerKeyword) {
            // Step 2: Get agent — prefer agent_id from automation config, fallback to name search
            let agentId = carmenAutomation.configuration?.agent_id || null;
            let agentName = 'כרמן';
            
            if (!agentId) {
              // Fallback: search by name
              const carmenAgent = await findCarmenAgent(supabaseClient, tenantId);
              if (carmenAgent) {
                agentId = carmenAgent.id;
                agentName = carmenAgent.name;
              }
            } else {
              // Fetch agent name for greeting
              const { data: agentRow } = await supabaseClient
                .from('ai_agents')
                .select('name')
                .eq('id', agentId)
                .maybeSingle();
              if (agentRow) agentName = agentRow.name;
            }
            
            if (!agentId) {
              // No agent found — send a clear error message to the user
              console.error('Carmen keyword detected but no agent configured for tenant:', tenantId);
              await sendGreenApiMessage(
                instanceId, apiToken, chatId,
                'שלום! זיהיתי שרצית לדבר עם כרמן, אך עדיין לא הוגדר סוכן AI. אנא פנה למנהל המערכת להגדרת סוכן כרמן.'
              );
            } else {
              // Step 3: Create new Carmen session
              const { data: newSession, error: sessionError } = await supabaseClient
                .from('carmen_whatsapp_sessions')
                .insert({
                  tenant_id: tenantId,
                  chat_id: chatId,
                  phone: phoneNumber,
                  sender_name: senderData.senderName || null,
                  agent_id: agentId,
                  connection_user_id: connectionUserId,
                  conversation_history: [],
                  status: 'active',
                  started_by_keyword: messageText,
                  end_keyword: endKeywordConfig,
                })
                .select()
                .single();
              
              if (sessionError) {
                console.error('Failed to create Carmen session:', sessionError);
                // Send error to user so they know something went wrong
                await sendGreenApiMessage(
                  instanceId, apiToken, chatId,
                  'מצטערת, אירעה שגיאה בהפעלת השיחה. נסה שוב בעוד מספר שניות.'
                );
              } else {
                // Step 4: Send greeting
                const greeting = `שלום! אני ${agentName}, המנהלת ה-AI שלך במערכת. אפשר לשאול אותי כל שאלה ולבצע פעולות במערכת. מה אפשר לעזור לך? (כדי לסיים את השיחה, כתוב "${endKeywordConfig}")`;
                await sendGreenApiMessage(instanceId, apiToken, chatId, greeting);
                
                // Step 5: If there's additional content after the trigger keyword, process it immediately
                const contentAfterKeyword = messageText.replace(new RegExp(triggerKeyword, 'gi'), '').trim();
                if (contentAfterKeyword.length > 2) {
                  const carmenResponse = await runCarmenAI(
                    supabaseClient, agentId, tenantId, contentAfterKeyword, [],
                    phoneNumber, senderData.senderName
                  );
                  await supabaseClient
                    .from('carmen_whatsapp_sessions')
                    .update({
                      conversation_history: [
                        { role: 'user', content: contentAfterKeyword, timestamp: new Date().toISOString() },
                        { role: 'assistant', content: carmenResponse, timestamp: new Date().toISOString() }
                      ],
                      last_message_at: new Date().toISOString(),
                    })
                    .eq('id', newSession.id);
                  await sendGreenApiMessage(instanceId, apiToken, chatId, carmenResponse);
                  
                  // Sync to ai_conversations
                  await syncCarmenToAIConversation(supabaseClient, newSession, [
                    { role: 'user', content: contentAfterKeyword, timestamp: new Date().toISOString() },
                    { role: 'assistant', content: carmenResponse, timestamp: new Date().toISOString() }
                  ]);
                } else {
                  // No content after keyword — create empty ai_conversation for future messages
                  await syncCarmenToAIConversation(supabaseClient, newSession, []);
                }
                return new Response(JSON.stringify({ success: true, carmen_session: 'started' }), {
                  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                });
              }
            }
          }
        }
        } // end else isManualOutgoing
      }
    }
    // ===========================
    // END CARMEN SESSION HANDLER
    // ===========================

    // Trigger automations for incoming/outgoing WhatsApp messages
    if (isIncoming || isManualOutgoing) {

      try {
        
        // Fetch contact tags for the sender
        let contactTags: string[] = [];
        const tagQuery = supabaseClient
          .from('chat_contact_tags')
          .select('tag_id')
          .eq('tenant_id', tenantId);
        
        if (clientId) {
          tagQuery.eq('client_id', clientId);
        } else if (leadId) {
          tagQuery.eq('lead_id', leadId);
        } else {
          tagQuery.eq('sender_phone', phoneNumber);
        }
        
        const { data: contactTagsData } = await tagQuery;
        if (contactTagsData) {
          contactTags = contactTagsData.map((t: any) => t.tag_id);
        }

        // Determine contact name
        const contactName = clientId
          ? (await supabaseClient.from('clients').select('name').eq('id', clientId).single())?.data?.name
          : leadId
          ? (await supabaseClient.from('leads').select('contact_name').eq('id', leadId).single())?.data?.contact_name
          : senderData.senderName || phoneNumber;

        const automationPayload = {
          trigger_type: 'whatsapp_message_received',
          tenant_id: tenantId,
          data: {
            chat_id: senderData.chatId,
            sender_name: senderData.senderName || null,
            sender_phone: phoneNumber,
            message_text: messageText,
            direction: isOutgoing ? 'outgoing' : 'incoming',
            group_id: null,
            group_name: null,
            group_chat_id: null,
            contact_type: clientId ? 'client' : (leadId ? 'lead' : 'unknown'),
            contact_id: clientId || leadId || null,
            contact_name: contactName || null,
            connection_user_id: connectionUserId,
            tags: contactTags,
          },
        };

        const triggerUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/trigger-automation`;
        fetch(triggerUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          },
          body: JSON.stringify(automationPayload),
        }).catch(err => console.error('❌ Error triggering automation:', err));
        
      } catch (automationError) {
        console.error('❌ Error preparing automation trigger:', automationError);
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
