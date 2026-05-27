// Shared Carmen WhatsApp session handler used by both green-api-webhook and manus-wa-webhook.
// Encapsulates: trigger keyword detection, session lifecycle, agent invocation, and
// optional filtering by a configured integration (carmen_integration_id).
//
// The transport (Green API vs Manus WA) is abstracted via the `sendMessage` callback.

const CARMEN_SESSION_IDLE_MINUTES = 60;

export async function findCarmenAgent(supabase: any, tenantId: string): Promise<any | null> {
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

// Find the Carmen session automation for a tenant.
// If `integrationId` is provided, an automation that pins `carmen_integration_id` to a
// different integration is ignored (so two automations can coexist for different connections).
export async function findCarmenSessionAutomation(
  supabase: any,
  tenantId: string,
  integrationId?: string | null,
): Promise<any | null> {
  // Method 1: Legacy — top-level configuration.carmen_session_mode
  const { data: legacyMatches } = await supabase
    .from('automations')
    .select('id, name, configuration')
    .eq('tenant_id', tenantId)
    .eq('trigger_type', 'whatsapp_message_received')
    .eq('active', true)
    .filter('configuration->>carmen_session_mode', 'eq', 'true')
    .limit(10);

  const legacyMatch = (legacyMatches || []).find((a: any) => {
    const pinned = a.configuration?.carmen_integration_id;
    return !pinned || !integrationId || pinned === integrationId;
  });
  if (legacyMatch) return legacyMatch;

  // Method 2: Flow Builder — trigger step with action_type = carmen_whatsapp_session
  const { data: flowSteps } = await supabase
    .from('automation_flow_steps')
    .select('automation_id, configuration')
    .eq('tenant_id', tenantId)
    .eq('step_type', 'trigger')
    .eq('action_type', 'carmen_whatsapp_session');

  if (!flowSteps || flowSteps.length === 0) return null;

  // Filter out steps pinned to a different integration
  const eligibleSteps = flowSteps.filter((s: any) => {
    const pinned = s.configuration?.carmen_integration_id;
    return !pinned || !integrationId || pinned === integrationId;
  });
  if (eligibleSteps.length === 0) return null;

  const automationIds = eligibleSteps.map((s: any) => s.automation_id);
  const { data: automations } = await supabase
    .from('automations')
    .select('id, name, configuration')
    .in('id', automationIds)
    .eq('active', true)
    .limit(1);
  if (!automations || automations.length === 0) return null;

  const auto = automations[0];
  const stepConfig = eligibleSteps.find((s: any) => s.automation_id === auto.id)?.configuration || {};
  auto.configuration = { ...auto.configuration, ...stepConfig };
  return auto;
}

export async function runCarmenAI(
  supabase: any,
  agentId: string,
  tenantId: string,
  userMessage: string,
  conversationHistory: any[],
  senderPhone?: string | null,
  senderName?: string | null,
): Promise<string> {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    const historyContext = conversationHistory.length > 0
      ? `\n\n=== היסטוריית שיחה ===\n${conversationHistory.slice(-10).map((m: any) => `${m.role === 'user' ? 'משתמש' : 'כרמן'}: ${m.content}`).join('\n')}`
      : '';
    const commandWithHistory = historyContext ? `${userMessage}${historyContext}` : userMessage;

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

export async function syncCarmenToAIConversation(
  supabase: any,
  session: any,
  conversationHistory: any[],
): Promise<string | null> {
  try {
    const userId = session.connection_user_id;
    const tenantId = session.tenant_id;
    if (!userId || !tenantId) return null;

    const messages = conversationHistory.map((msg: any) => ({
      role: msg.role,
      content: msg.content,
    }));

    if (session.ai_conversation_id) {
      await supabase
        .from('ai_conversations')
        .update({ messages, updated_at: new Date().toISOString() })
        .eq('id', session.ai_conversation_id);
      return session.ai_conversation_id;
    }

    const title = `שיחת WhatsApp — ${session.sender_name || session.phone || 'לא ידוע'}`;
    const { data, error } = await supabase
      .from('ai_conversations')
      .insert({ user_id: userId, tenant_id: tenantId, title, messages })
      .select('id')
      .single();

    if (error || !data) {
      console.error('Failed to create ai_conversation:', error);
      return null;
    }

    await supabase
      .from('carmen_whatsapp_sessions')
      .update({ ai_conversation_id: data.id })
      .eq('id', session.id);
    return data.id;
  } catch (e) {
    console.error('syncCarmenToAIConversation error:', e);
    return null;
  }
}

export async function findActiveCarmenSession(
  supabase: any,
  tenantId: string,
  chatId: string,
  connectionUserId: string,
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

  if (!data) return null;

  const lastActivity = new Date(data.last_message_at || data.created_at).getTime();
  const ageMinutes = (Date.now() - lastActivity) / 60000;
  if (ageMinutes > CARMEN_SESSION_IDLE_MINUTES) {
    console.log(`[CARMEN] Session ${data.id} idle for ${ageMinutes.toFixed(1)} min — auto-expiring`);
    await supabase
      .from('carmen_whatsapp_sessions')
      .update({ status: 'expired', ended_at: new Date().toISOString() })
      .eq('id', data.id);
    return null;
  }
  return data;
}

export interface CarmenContext {
  supabase: any;
  tenantId: string;
  /** Row id of the tenant_integrations record that received this message. */
  integrationId: string;
  /** User who owns the integration (used as Carmen session owner). */
  connectionUserId: string;
  /** Provider chat id (e.g. "972501234567@c.us"). */
  chatId: string;
  /** Counterpart phone (digits only or with country code). */
  phoneNumber: string;
  /** Display name of the counterpart, if known. */
  senderName?: string | null;
  messageText: string;
  /** True for inbound messages received from the counterpart. */
  isIncoming: boolean;
  /** True for messages the operator typed in the WhatsApp app (not API sends). */
  isManualOutgoing: boolean;
  isGroup: boolean;
  /** Transport-specific send function. Returns true on success. */
  sendMessage: (chatId: string, message: string) => Promise<boolean>;
}

export type CarmenHandleResult =
  | { handled: false; reason: string }
  | { handled: true; outcome: 'ended' | 'active' | 'started' | 'error' };

// Top-level Carmen message handler. Returns whether the message was consumed by Carmen.
// Callers should NOT trigger other automations for the same message if `handled` is true.
export async function handleCarmenMessage(ctx: CarmenContext): Promise<CarmenHandleResult> {
  const {
    supabase, tenantId, integrationId, connectionUserId,
    chatId, phoneNumber, senderName, messageText,
    isIncoming, isManualOutgoing, isGroup, sendMessage,
  } = ctx;

  // Groups are supported — Carmen replies in the group chat.
  if (!isIncoming && !isManualOutgoing) return { handled: false, reason: 'not_user_message' };

  const normalizedMsg = (messageText || '').trim().toLowerCase();
  const activeSession = await findActiveCarmenSession(supabase, tenantId, chatId, connectionUserId);

  if (activeSession) {
    const endKeyword = (activeSession.end_keyword || 'סיימנו כרמן').toLowerCase();
    if (normalizedMsg.includes(endKeyword)) {
      await supabase
        .from('carmen_whatsapp_sessions')
        .update({ status: 'ended', ended_at: new Date().toISOString() })
        .eq('id', activeSession.id);
      await sendMessage(chatId, 'השיחה עם כרמן הסתיימה. תמיד כאן בשבילך! להתראות!');
      return { handled: true, outcome: 'ended' };
    }

    const history = activeSession.conversation_history || [];
    const updatedHistory = [
      ...history,
      { role: 'user', content: messageText, timestamp: new Date().toISOString() },
    ];

    const carmenResponse = await runCarmenAI(
      supabase, activeSession.agent_id, tenantId, messageText, history,
      activeSession.phone || phoneNumber, activeSession.sender_name || senderName,
    );

    updatedHistory.push({
      role: 'assistant', content: carmenResponse, timestamp: new Date().toISOString(),
    });

    await supabase
      .from('carmen_whatsapp_sessions')
      .update({ conversation_history: updatedHistory, last_message_at: new Date().toISOString() })
      .eq('id', activeSession.id);
    await sendMessage(chatId, carmenResponse);
    await syncCarmenToAIConversation(supabase, activeSession, updatedHistory);
    return { handled: true, outcome: 'active' };
  }

  // No active session — outgoing (operator-typed) messages OR incoming group messages can start a new one.
  // In 1-on-1 chats we still require the owner to type the keyword; in groups, any member can trigger Carmen.
  if (!isManualOutgoing && !isGroup) return { handled: false, reason: 'no_session_inbound' };

  const carmenAutomation = await findCarmenSessionAutomation(supabase, tenantId, integrationId);
  if (!carmenAutomation) return { handled: false, reason: 'no_automation' };

  // Legacy compatibility: filter by connection_user_id if set and integration not pinned.
  const pinnedIntegrationId = carmenAutomation.configuration?.carmen_integration_id;
  const pinnedConnectionUserId = carmenAutomation.configuration?.carmen_connection_user_id;
  if (!pinnedIntegrationId && pinnedConnectionUserId && pinnedConnectionUserId !== connectionUserId) {
    return { handled: false, reason: 'connection_user_filter' };
  }

  // Scope enforcement
  const scopeMode = carmenAutomation.configuration?.carmen_scope_mode || 'all';
  const allowedPhones = carmenAutomation.configuration?.carmen_allowed_phones || [];
  const allowedGroups = carmenAutomation.configuration?.carmen_allowed_groups || [];
  if (scopeMode === 'specific_phone' && !isGroup) {
    const normalizedChatPhone = (phoneNumber || '').replace(/[^0-9]/g, '');
    const isPhoneAllowed = allowedPhones.some((p: string) => {
      const a = p.replace(/[^0-9]/g, '');
      return normalizedChatPhone.endsWith(a) || a.endsWith(normalizedChatPhone);
    });
    if (!isPhoneAllowed) {
      console.log('[carmen] blocked by scope_phone', { chatId, phoneNumber });
      return { handled: false, reason: 'scope_phone' };
    }
  } else if (scopeMode === 'specific_group') {
    if (!isGroup || !allowedGroups.includes(chatId)) {
      console.log('[carmen] blocked by scope_group', { chatId, isGroup, allowedGroups });
      return { handled: false, reason: 'scope_group' };
    }
  }

  const triggerKeyword = (carmenAutomation.configuration?.trigger_keyword || 'כרמן').toLowerCase();
  const endKeywordConfig = carmenAutomation.configuration?.end_keyword || 'סיימנו כרמן';
  if (!normalizedMsg.includes(triggerKeyword)) return { handled: false, reason: 'no_keyword' };

  // Resolve agent
  let agentId = carmenAutomation.configuration?.agent_id || null;
  let agentName = 'כרמן';
  if (!agentId) {
    const carmenAgent = await findCarmenAgent(supabase, tenantId);
    if (carmenAgent) { agentId = carmenAgent.id; agentName = carmenAgent.name; }
  } else {
    const { data: agentRow } = await supabase
      .from('ai_agents').select('name').eq('id', agentId).maybeSingle();
    if (agentRow) agentName = agentRow.name;
  }

  if (!agentId) {
    await sendMessage(chatId, 'שלום! זיהיתי שרצית לדבר עם כרמן, אך עדיין לא הוגדר סוכן AI. אנא פנה למנהל המערכת להגדרת סוכן כרמן.');
    return { handled: true, outcome: 'error' };
  }

  const { data: newSession, error: sessionError } = await supabase
    .from('carmen_whatsapp_sessions')
    .insert({
      tenant_id: tenantId,
      chat_id: chatId,
      phone: phoneNumber,
      sender_name: senderName || null,
      agent_id: agentId,
      connection_user_id: connectionUserId,
      conversation_history: [],
      status: 'active',
      started_by_keyword: messageText,
      end_keyword: endKeywordConfig,
      automation_id: carmenAutomation.id,
    })
    .select()
    .single();

  if (sessionError || !newSession) {
    console.error('Failed to create Carmen session:', sessionError);
    await sendMessage(chatId, 'מצטערת, אירעה שגיאה בהפעלת השיחה. נסה שוב בעוד מספר שניות.');
    return { handled: true, outcome: 'error' };
  }

  const greeting = `שלום! אני ${agentName}, המנהלת ה-AI שלך במערכת. אפשר לשאול אותי כל שאלה ולבצע פעולות במערכת. מה אפשר לעזור לך? (כדי לסיים את השיחה, כתוב "${endKeywordConfig}")`;
  await sendMessage(chatId, greeting);

  const contentAfterKeyword = messageText.replace(new RegExp(triggerKeyword, 'gi'), '').trim();
  if (contentAfterKeyword.length > 2) {
    const carmenResponse = await runCarmenAI(
      supabase, agentId, tenantId, contentAfterKeyword, [], phoneNumber, senderName,
    );
    const history = [
      { role: 'user', content: contentAfterKeyword, timestamp: new Date().toISOString() },
      { role: 'assistant', content: carmenResponse, timestamp: new Date().toISOString() },
    ];
    await supabase
      .from('carmen_whatsapp_sessions')
      .update({ conversation_history: history, last_message_at: new Date().toISOString() })
      .eq('id', newSession.id);
    await sendMessage(chatId, carmenResponse);
    await syncCarmenToAIConversation(supabase, newSession, history);
  } else {
    await syncCarmenToAIConversation(supabase, newSession, []);
  }

  return { handled: true, outcome: 'started' };
}
