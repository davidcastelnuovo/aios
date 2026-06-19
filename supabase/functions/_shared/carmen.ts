// Shared Carmen WhatsApp session handler used by both green-api-webhook and manus-wa-webhook.
// Encapsulates: trigger keyword detection, session lifecycle, agent invocation, and
// optional filtering by a configured integration (carmen_integration_id).
//
// The transport (Green API vs Manus WA) is abstracted via the `sendMessage` callback.

const CARMEN_SESSION_IDLE_MINUTES_DEFAULT = 5;

// Permissive end-keywords — any of these closes the session, even without "כרמן".
const END_KEYWORD_VARIANTS = [
  'סיימנו', 'תודה סיימנו', 'תודה כרמן', 'תפסיקי', 'די כרמן', 'די תודה',
  'עצרי', 'עצרי כרמן', 'מספיק', 'מספיק כרמן', 'ביי כרמן', 'להתראות כרמן',
  'stop', 'stop carmen', 'end', 'bye carmen', 'thanks carmen',
];

// Short "thanks/acknowledgement" messages that should NOT trigger an AI reply
// inside an active session (prevents Carmen→thanks→Carmen loops).
const ACK_VARIANTS = [
  'תודה', 'תודה רבה', 'מעולה', 'מעולה תודה', 'סבבה', 'סבבה תודה',
  'אוקיי', 'אוקי', 'ok', 'okay', 'thanks', 'thank you', 'great', 'cool', '👍', '🙏',
  // Carmen's own minimal acks — if mirrored back as inbound, never reply
  'כן', 'כן.', 'כאן', 'כאן.', 'אני כאן', 'אני כאן.', 'נראה מצוין', 'נראה מצויין',
  'הבנתי', 'הבנתי.', 'יאללה', 'בסדר', 'בסדר.',
];

function normalize(msg: string): string {
  return (msg || '').trim().toLowerCase().replace(/[.!?,\s]+$/g, '');
}

function messageRequestsEnd(msg: string, configuredEndKeyword?: string | null): boolean {
  const m = normalize(msg);
  if (!m) return false;
  if (configuredEndKeyword && m.includes(String(configuredEndKeyword).toLowerCase())) return true;
  return END_KEYWORD_VARIANTS.some(k => m === k || m.startsWith(k + ' ') || m.endsWith(' ' + k) || m.includes(' ' + k + ' '));
}

function isShortAck(msg: string): boolean {
  const m = normalize(msg);
  if (!m) return false;
  if (m.length > 20) return false;
  return ACK_VARIANTS.some(k => m === k || m === k + ' כרמן');
}

// Detect meta-instruction style messages (long lists of "תעני..." rules) that
// shouldn't be replayed back to the model as a user turn — otherwise the model
// "answers" the instructions instead of the real question.
function looksLikeMetaInstruction(content: string): boolean {
  const c = (content || '').trim();
  if (!c) return false;
  if (c.length > 300 && /(תעני|תשתמשי|חשוב לתת|הנחיות|הוראות)/.test(c)) return true;
  const lines = c.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length >= 3 && /^(תעני|תשתמשי|תזכרי|אל ת|תמיד|חשוב|כללים)/.test(lines[0])) return true;
  return false;
}

// Strip instruction-like content from an assistant reply so we never echo
// "ההנחיות נשמרו / הבנתי את ההוראות" back to the chat.
function looksLikeInstructionReport(content: string): boolean {
  const c = (content || '').trim();
  if (!c) return false;
  return /(ההנחיות|ההוראות|הבנתי את ההנחיות|אפעל לפי ההנחיות|שמרתי הנחיה|הנחיותיך נשמרו|נכנסו לכספת|לכספת שלי|לא משחררת מידע|השומרת הכי|הסלקטורית הכי|מוכנה לפקודת|אני כאן לכל משימה|אני כאן ומחכה לפקודות|דרוכה ומוכנה|בסבלנות של נזירה|בלי דליפות מידע|רשמתי לפניי את עניין)/.test(c);
}

// Pull the last few days of chat history for the current chat (group or 1:1) so Carmen
// can answer questions about prior conversations, not just messages inside the current
// session window.
//
// - Groups: look up whatsapp_groups by (tenant_id, group_chat_id=chatId), then fetch
//   chat_messages WHERE group_id = <uuid>.
// - 1:1: fetch chat_messages WHERE group_id IS NULL AND sender_phone LIKE %last9digits%.
export async function fetchRecentChatContext(
  supabase: any,
  tenantId: string,
  chatId: string,
  isGroup: boolean,
  phoneNumber?: string | null,
  maxMessages = 60,
  dayWindow = 3,
): Promise<Array<{ role: 'user' | 'assistant'; content: string; timestamp: string }>> {
  try {
    const since = new Date(Date.now() - dayWindow * 24 * 60 * 60 * 1000).toISOString();
    let query = supabase
      .from('chat_messages')
      .select('direction, message_text, sender_name, sender_phone, created_at, group_id')
      .eq('tenant_id', tenantId)
      .gte('created_at', since)
      .not('message_text', 'is', null)
      .order('created_at', { ascending: false })
      .limit(maxMessages);

    if (isGroup) {
      const { data: groupRow } = await supabase
        .from('whatsapp_groups')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('group_chat_id', chatId)
        .maybeSingle();
      if (!groupRow?.id) return [];
      query = query.eq('group_id', groupRow.id);
    } else {
      const digits = (phoneNumber || chatId.split('@')[0] || '').replace(/\D/g, '');
      if (!digits) return [];
      const last9 = digits.slice(-9);
      query = query.is('group_id', null).ilike('sender_phone', `%${last9}%`);
    }

    const { data, error } = await query;
    if (error || !Array.isArray(data)) return [];

    return data
      .reverse() // oldest-first
      .map((m: any) => {
        const text = String(m.message_text || '').trim();
        if (!text) return null;
        const who = m.sender_name || m.sender_phone || (m.direction === 'outbound' ? 'צוות' : 'משתמש');
        if (m.direction === 'outbound') {
          return {
            role: 'user' as const,
            content: `[צוות] ${who}: ${text}`,
            timestamp: m.created_at,
          };
        }
        return {
          role: 'user' as const,
          content: isGroup ? `${who}: ${text}` : text,
          timestamp: m.created_at,
        };
      })
      .filter(Boolean) as Array<{ role: 'user' | 'assistant'; content: string; timestamp: string }>;
  } catch (err) {
    console.error('[carmen] fetchRecentChatContext error', String(err));
    return [];
  }
}

// Merge background chat-history context with the in-session conversation history.
// Drops items from the background context that overlap with the session by timestamp,
// and prepends a short note so the model treats them as background, not as a new question.
export function buildCarmenMergedHistory(
  recentContext: Array<{ role: string; content: string; timestamp?: string }>,
  sessionHistory: any[],
  hardCap = 40,
): any[] {
  const sessionTimestamps = new Set(
    (sessionHistory || [])
      .map((m: any) => (m?.timestamp ? String(m.timestamp) : null))
      .filter(Boolean) as string[],
  );
  const oldestSessionTs = sessionHistory && sessionHistory.length
    ? (sessionHistory
        .map((m: any) => m?.timestamp)
        .filter(Boolean)
        .sort()[0] as string | undefined)
    : null;

  const dedupedContext = recentContext.filter((m) => {
    if (!m?.timestamp) return true;
    if (sessionTimestamps.has(m.timestamp)) return false;
    if (oldestSessionTs && m.timestamp >= oldestSessionTs) return false;
    return true;
  });

  const merged: any[] = [];
  if (dedupedContext.length > 0) {
    merged.push({
      role: 'user',
      content:
        '[רקע: להלן היסטוריית הצ׳אט מהימים האחרונים מאותה שיחה. השתמשי בה כדי לענות על שאלות לגבי מה שנאמר או הוחלט קודם. אל תתייחסי להודעות האלה כשאלה חדשה.]',
      timestamp: new Date(0).toISOString(),
    });
    merged.push(...dedupedContext);
  }
  merged.push(...(sessionHistory || []));

  if (merged.length <= hardCap) return merged;
  return [merged[0], ...merged.slice(-(hardCap - 1))];
}

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
// Only flow-based triggers (step_type='trigger', action_type='carmen_whatsapp_session') are
// considered. The legacy `whatsapp_message_received` + `carmen_session_mode=true` form is
// intentionally ignored — every Carmen automation must live in the flow builder so that the
// inbound integration scope and the outbound action step are explicitly defined.
//
// When `integrationId` is provided, we prefer a step whose `carmen_integration_id` matches it.
// Steps pinned to a different integration are excluded. Unpinned steps are used as a fallback
// when no pinned match exists.
export async function findCarmenSessionAutomation(
  supabase: any,
  tenantId: string,
  integrationId?: string | null,
  ctx?: { isGroup?: boolean; chatId?: string | null; phoneNumber?: string | null },
): Promise<any | null> {
  const { data: flowSteps } = await supabase
    .from('automation_flow_steps')
    .select('automation_id, configuration')
    .eq('tenant_id', tenantId)
    .eq('step_type', 'trigger')
    .eq('action_type', 'carmen_whatsapp_session');

  if (!flowSteps || flowSteps.length === 0) return null;

  // Split into pinned-match vs unpinned. Foreign-pinned automations are normally
  // dropped, BUT a `specific_phone` automation is allowed to fire on any inbound
  // channel when the sender appears in its `carmen_allowed_phones` list — this
  // lets allowed phones trigger Carmen via Green API even when the automation is
  // pinned to a Manus integration.
  const ctxIsGroup = !!ctx?.isGroup;
  const ctxPhoneDigits = (ctx?.phoneNumber || '').replace(/\D/g, '');
  const pinnedMatches: any[] = [];
  const unpinned: any[] = [];
  const foreignPhoneAllowed: any[] = [];
  for (const s of flowSteps) {
    const pinned = s.configuration?.carmen_integration_id;
    if (!pinned) {
      unpinned.push(s);
    } else if (integrationId && pinned === integrationId) {
      pinnedMatches.push(s);
    } else if (!ctxIsGroup && ctxPhoneDigits && s.configuration?.carmen_scope_mode === 'specific_phone') {
      const allowed: string[] = Array.isArray(s.configuration?.carmen_allowed_phones)
        ? s.configuration.carmen_allowed_phones.map((p: any) => String(p).replace(/\D/g, '')).filter(Boolean)
        : [];
      const hit = allowed.some((p) => p === ctxPhoneDigits || ctxPhoneDigits.endsWith(p) || p.endsWith(ctxPhoneDigits));
      if (hit) foreignPhoneAllowed.push(s);
    }
  }
  const ranked = [...pinnedMatches, ...unpinned, ...foreignPhoneAllowed];
  if (ranked.length === 0) return null;

  // Channel-aware ranking: when multiple Carmen automations are pinned to the same
  // integration, prefer the one whose scope actually matches the current message
  // (e.g. groups → specific_group automation; 1:1 → specific_phone automation).
  // Without this, the first automation in arbitrary order can block the channel
  // even though a sibling automation explicitly enables it.
  const isGroup = !!ctx?.isGroup;
  const chatId = ctx?.chatId || '';
  const phoneDigits = (ctx?.phoneNumber || '').replace(/\D/g, '');
  const chatIdBare = chatId ? chatId.split('@')[0] : '';
  const scoreStep = (s: any): number => {
    const cfg = s?.configuration || {};
    const mode = cfg.carmen_scope_mode || 'all';
    const allowedGroups: string[] = Array.isArray(cfg.carmen_allowed_group_ids) && cfg.carmen_allowed_group_ids.length > 0
      ? cfg.carmen_allowed_group_ids
      : (cfg.carmen_allowed_group_id ? [cfg.carmen_allowed_group_id]
        : (Array.isArray(cfg.carmen_allowed_groups) ? cfg.carmen_allowed_groups : []));
    const allowedPhones: string[] = Array.isArray(cfg.carmen_allowed_phones)
      ? cfg.carmen_allowed_phones.map((p: any) => String(p).replace(/\D/g, ''))
      : [];

    const groupMatch = allowedGroups.some((g: string) => g === chatId || (chatIdBare && g === chatIdBare));

    if (isGroup) {
      if (mode === 'specific_group' && groupMatch) return 100;
      if (mode === 'specific_group') return 40; // group-mode but this chat isn't listed
      if (mode === 'all') return 20;
      // specific_phone in a group context → unusable
      return -50;
    }
    if (mode === 'specific_phone' && phoneDigits && allowedPhones.some(p => p && (p === phoneDigits || phoneDigits.endsWith(p) || p.endsWith(phoneDigits)))) return 100;
    if (mode === 'specific_phone') return 40;
    if (mode === 'all') return 20;
    // specific_group in a 1:1 context → unusable
    return -50;
  };

  ranked.sort((a, b) => scoreStep(b) - scoreStep(a));

  const automationIds = ranked.map((s: any) => s.automation_id);
  const { data: automations } = await supabase
    .from('automations')
    .select('id, name, configuration')
    .in('id', automationIds)
    .eq('active', true);
  if (!automations || automations.length === 0) return null;

  const activeById = new Map(automations.map((a: any) => [a.id, a]));
  for (const s of ranked) {
    const auto: any = activeById.get(s.automation_id);
    if (!auto) continue;
    auto.configuration = { ...auto.configuration, ...(s.configuration || {}) };
    return auto;
  }
  return null;
}


// Look up the first send action step of a Carmen automation and dispatch the reply through it
// (Manus or Green API), regardless of which webhook received the inbound message.
// Returns true when delivery succeeded via the action step; false if no action step is configured
// or the send failed — callers should fall back to the webhook-supplied sendMessage in that case.
export async function sendCarmenReplyViaActionStep(args: {
  supabase: any;
  automationId: string;
  tenantId: string;
  connectionUserId: string;
  chatId: string;
  phoneNumber: string;
  isGroup: boolean;
  message: string;
}): Promise<boolean> {
  const { supabase, automationId, tenantId, connectionUserId, chatId, phoneNumber, isGroup, message } = args;

  const { data: steps } = await supabase
    .from('automation_flow_steps')
    .select('action_type, configuration, created_at')
    .eq('automation_id', automationId)
    .eq('step_type', 'action')
    .in('action_type', ['send_manus_message', 'send_greenapi_message', 'send_green_api_message'])
    .order('created_at', { ascending: true })
    .limit(1);
  const step = steps?.[0];
  if (!step) return false;

  const cfg = step.configuration || {};
  const integrationId = cfg.green_api_integration_id || cfg.integration_id || null;

  // Resolve group UUID (whatsapp_groups.id) when sending to a group.
  let groupId: string | null = null;
  if (isGroup && chatId) {
    const { data: g } = await supabase
      .from('whatsapp_groups')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('group_chat_id', chatId)
      .maybeSingle();
    groupId = g?.id || null;
    if (!groupId) {
      console.warn('[carmen-route] group_chat_id not found in whatsapp_groups, falling back', { chatId });
      return false;
    }
  }

  const fnName = step.action_type === 'send_manus_message' ? 'send-manus-wa-message' : 'send-green-api-message';
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  const body: any = {
    tenantId,
    senderUserId: connectionUserId,
    message,
  };
  if (integrationId) body.integrationId = integrationId;
  if (groupId) {
    body.groupId = groupId;
  } else {
    body.phoneNumber = phoneNumber;
  }

  try {
    console.log('[carmen-route] dispatch via', fnName, { automationId, integrationId, groupId, phoneNumber, isGroup });
    const res = await fetch(`${supabaseUrl}/functions/v1/${fnName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceKey}`,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      console.error('[carmen-route] action-step send failed', { status: res.status, body: txt.slice(0, 300) });
      return false;
    }
    return true;
  } catch (err) {
    console.error('[carmen-route] action-step send error', String(err));
    return false;
  }
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
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  // Filter meta-instruction noise out of history so the model doesn't "answer" it
  // again on every turn (root cause of Carmen reporting "ההנחיות נשמרו" in a loop).
  // Also drop any assistant turn that itself looks like an instruction-report — if it
  // ever got persisted, replaying it would re-trigger the same noise.
  const cleanHistory = conversationHistory
    .slice(-20)
    .filter((m: any) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .filter((m: any) => !(m.role === 'user' && looksLikeMetaInstruction(m.content)))
    .filter((m: any) => !(m.role === 'assistant' && looksLikeInstructionReport(m.content)))
    .map((m: any) => ({ role: m.role, content: m.content }));

  const body = JSON.stringify({
    agent_id: agentId,
    command_text: userMessage,
    conversation_history: cleanHistory,
    tenant_id: tenantId,
    user_name: senderName || 'WhatsApp',
    lead_data: senderPhone ? { phone: senderPhone } : undefined,
  });

  // Try once; on hard failure (network error, non-2xx, or empty output) retry exactly
  // once after a 1s delay. If the retry also fails, throw — the caller will swallow
  // the error and stay silent rather than send a fake "טכנית" reply to WhatsApp.
  const attempt = async (): Promise<string> => {
    const res = await fetch(`${supabaseUrl}/functions/v1/run-ai-agent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${serviceKey}` },
      body,
    });
    if (!res.ok) {
      throw new Error(`run-ai-agent ${res.status}`);
    }
    const data = await res.json();
    const out = (data?.output || '').toString().trim();
    if (!out) throw new Error('run-ai-agent returned empty output');
    return out;
  };

  try {
    return await attempt();
  } catch (firstErr) {
    console.error('❌ runCarmenAI attempt 1 failed:', firstErr);
    await new Promise(r => setTimeout(r, 1000));
    try {
      return await attempt();
    } catch (secondErr) {
      console.error('❌ runCarmenAI attempt 2 failed:', secondErr);
      throw secondErr;
    }
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
  idleMinutes: number = CARMEN_SESSION_IDLE_MINUTES_DEFAULT,
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
  if (ageMinutes > idleMinutes) {
    console.log(`[CARMEN] Session ${data.id} idle for ${ageMinutes.toFixed(1)} min (limit ${idleMinutes}) — auto-expiring`);
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
  /** Phone of the connected WhatsApp account/sender, when the provider exposes it. */
  sourcePhoneNumber?: string | null;
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
    chatId, phoneNumber, sourcePhoneNumber, senderName, messageText,
    isIncoming, isManualOutgoing, isGroup, sendMessage,
  } = ctx;

  // Groups are supported — Carmen replies in the group chat.
  if (!isIncoming && !isManualOutgoing) return { handled: false, reason: 'not_user_message' };

  const normalizedMsg = (messageText || '').trim().toLowerCase();

  // Read configured timeout (defaults to 5 minutes). We need it both for find-active and start-session paths.
  // Look up the relevant automation up-front to get session_timeout_minutes & end_keyword.
  const earlyAutomation = await findCarmenSessionAutomation(supabase, tenantId, integrationId, { isGroup, chatId, phoneNumber });

  // HARD GUARD: if no flow-based Carmen automation is pinned to this integration,
  // Carmen must stay completely silent on this channel — even if a stale session
  // (from a deleted/legacy automation or a different integration) is still marked active.
  // Auto-end any such stale sessions so they can't keep the channel "warm".
  if (!earlyAutomation) {
    const phoneOnly = chatId.split('@')[0];
    const { data: stale } = await supabase
      .from('carmen_whatsapp_sessions')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('status', 'active')
      .eq('connection_user_id', connectionUserId)
      .eq('chat_id', chatId)
      .eq('phone', phoneOnly)
      .limit(5);
    if (stale && stale.length > 0) {
      const ids = stale.map((s: any) => s.id);
      await supabase
        .from('carmen_whatsapp_sessions')
        .update({ status: 'ended', ended_at: new Date().toISOString() })
        .in('id', ids);
      console.log('[carmen] No automation pinned to integration — ended stale sessions', { integrationId, ids });
    }
    return { handled: false, reason: 'no_automation_for_integration' };
  }

  const cfg = earlyAutomation?.configuration || {};
  const idleMinutes = Number(cfg.session_timeout_minutes) > 0
    ? Number(cfg.session_timeout_minutes)
    : CARMEN_SESSION_IDLE_MINUTES_DEFAULT;

  // 🔁 DUAL-CHANNEL GUARD: if the matched automation is pinned to a DIFFERENT integration
  // than the one currently invoking us (this happens when the operator's own Green API
  // instance receives the same conversation that Carmen's pinned Manus integration is
  // already handling — see foreignPhoneAllowed in findCarmenSessionAutomation), do NOT
  // create or update a parallel session here. The pinned-integration webhook owns this
  // conversation and will reply. Processing on both channels causes split histories,
  // duplicate replies, and silent drops via the mirror/echo guards.
  const pinnedIntegrationId = cfg.carmen_integration_id || null;
  if (pinnedIntegrationId && integrationId && pinnedIntegrationId !== integrationId) {
    console.log('[CARMEN] Dropped: dual-channel duplicate, skipping', {
      tenantId,
      chatId,
      phoneNumber,
      callerIntegrationId: integrationId,
      pinnedIntegrationId,
      isManualOutgoing,
      isIncoming,
    });
    return { handled: true, outcome: 'active' };
  }

  const activeSession = await findActiveCarmenSession(supabase, tenantId, chatId, connectionUserId, idleMinutes);

  // Outbound routing: prefer the automation's configured action step (send_manus_message /
  // send_green_api_message) so the reply goes through the module the user picked, regardless
  // of which webhook received the inbound message. Falls back to the webhook-supplied
  // sendMessage when no action step exists or the dispatch fails.
  const routingAutomationId = activeSession?.automation_id || earlyAutomation?.id || null;
  const routedSend = async (toChatId: string, message: string): Promise<boolean> => {
    if (routingAutomationId) {
      const ok = await sendCarmenReplyViaActionStep({
        supabase,
        automationId: routingAutomationId,
        tenantId,
        connectionUserId,
        chatId: toChatId,
        phoneNumber,
        isGroup,
        message,
      });
      if (ok) return true;
    }
    return sendMessage(toChatId, message);
  };




  if (activeSession) {
    const configuredEnd = activeSession.end_keyword || cfg.end_keyword || 'סיימנו כרמן';
    if (messageRequestsEnd(messageText, configuredEnd)) {
      await supabase
        .from('carmen_whatsapp_sessions')
        .update({ status: 'ended', ended_at: new Date().toISOString() })
        .eq('id', activeSession.id);
      await routedSend(chatId, 'סבבה, סיימנו 🙏');
      return { handled: true, outcome: 'ended' };
    }

    // Short acknowledgement ("תודה" / "מעולה" / "ok") — don't reply, just keep session warm.
    // Prevents Carmen→thanks→Carmen ping-pong loops.
    if (isShortAck(messageText)) {
      console.log('[carmen] Dropping short ack to avoid loop', { session: activeSession.id, body: messageText });
      await supabase
        .from('carmen_whatsapp_sessions')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', activeSession.id);
      return { handled: true, outcome: 'active' };
    }

    // Meta-instruction noise pasted into chat — acknowledge silently, never echo back.
    if (looksLikeMetaInstruction(messageText)) {
      console.log('[carmen] Dropping meta-instruction message', { session: activeSession.id });
      await supabase
        .from('carmen_whatsapp_sessions')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', activeSession.id);
      return { handled: true, outcome: 'active' };
    }


    // 🔁 ECHO/LOOP GUARD: if the incoming text matches Carmen's own last assistant reply
    // (verbatim or as prefix), it's almost certainly a self-echo (provider mirrored our
    // send back as inbound). Ignore it to prevent an infinite reply loop.
    // No minimum length — short replies like "כן." mirror back too and were the main
    // source of "כן/כאן/כן/כאן" loops. We only require an exact equality OR strict
    // prefix match (not just any substring) so legitimate replies starting with the
    // same word still get through.
    const history = activeSession.conversation_history || [];
    const lastAssistant = [...history].reverse().find((m: any) => m?.role === 'assistant');
    if (lastAssistant?.content) {
      const a = String(lastAssistant.content).trim();
      const b = String(messageText || '').trim();
      const lastTs = lastAssistant.timestamp ? new Date(lastAssistant.timestamp).getTime() : 0;
      const ageMs = lastTs ? Date.now() - lastTs : Number.MAX_SAFE_INTEGER;
      // Within a 90-second window after Carmen's reply, drop any inbound that
      // equals or strictly starts-with the assistant text — this is the provider
      // mirror echo. After 90s, only equality counts (so legitimate repeats are
      // still treated as new turns).
      const isExact = a === b;
      const isMirror = ageMs <= 90_000 && (a.startsWith(b) || b.startsWith(a));
      if (isExact || isMirror) {
        console.log('[carmen] Dropping echoed assistant reply for session', activeSession.id, { ageMs, len: b.length });
        await supabase
          .from('carmen_whatsapp_sessions')
          .update({ last_message_at: new Date().toISOString() })
          .eq('id', activeSession.id);
        return { handled: true, outcome: 'active' };
      }
    }

    // Mirror guard: if the same body was sent by our API in the last 60s, this
    // event (whether reported as manual-outgoing on the sender's instance OR as
    // incoming on the recipient's instance) is the provider mirroring our send.
    // Drop it. Inbound symmetry is essential when the operator runs a parallel
    // Green API integration that receives Carmen's Manus replies as inbound.
    if ((isManualOutgoing || isIncoming) && messageText) {
      const since = new Date(Date.now() - 60_000).toISOString();
      const { data: recentApiSends } = await supabase
        .from('chat_messages')
        .select('id, sent_by_user_id, raw_provider_data')
        .eq('tenant_id', tenantId)
        .eq('direction', 'outbound')
        .eq('message_text', messageText)
        .gte('created_at', since)
        .limit(3);
      if (Array.isArray(recentApiSends) && recentApiSends.length > 0) {
        console.log('[carmen] Dropping mirror of recent API send', {
          session: activeSession.id,
          len: messageText.length,
          isManualOutgoing,
          isIncoming,
        });
        await supabase
          .from('carmen_whatsapp_sessions')
          .update({ last_message_at: new Date().toISOString() })
          .eq('id', activeSession.id);
        return { handled: true, outcome: 'active' };
      }
    }

    const updatedHistory = [
      ...history,
      { role: 'user', content: messageText, timestamp: new Date().toISOString() },
    ];

    // IMPORTANT: in groups, every message has a different author. Always prefer the
    // CURRENT sender's phone/name (so Carmen attributes correctly to David vs Daniel),
    // and only fall back to the session's original sender when the current one is missing.
    const effectivePhone = phoneNumber || activeSession.phone;
    const effectiveName = senderName || activeSession.sender_name;

    let carmenResponse: string;
    try {
      const recentContext = await fetchRecentChatContext(
        supabase, tenantId, chatId, isGroup, effectivePhone,
      );
      const mergedHistory = buildCarmenMergedHistory(recentContext, history);
      carmenResponse = await runCarmenAI(
        supabase, activeSession.agent_id, tenantId, messageText, mergedHistory,
        effectivePhone, effectiveName,
      );
    } catch (err) {
      // AI failed twice (with retry). Stay silent — don't send "מצטערת..." to the user.
      // Keep the session warm so the next inbound message gets a fresh attempt.
      console.error('[carmen] AI call failed after retry, staying silent', { session: activeSession.id, err: String(err) });
      await supabase
        .from('carmen_whatsapp_sessions')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', activeSession.id);
      return { handled: true, outcome: 'error' };
    }

    // Output guard: if Carmen is about to "report" instructions, suppress it.
    if (looksLikeInstructionReport(carmenResponse)) {
      console.log('[carmen] Suppressing instruction-report reply', { session: activeSession.id });
      await supabase
        .from('carmen_whatsapp_sessions')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', activeSession.id);
      return { handled: true, outcome: 'active' };
    }

    updatedHistory.push({
      role: 'assistant', content: carmenResponse, timestamp: new Date().toISOString(),
    });

    await supabase
      .from('carmen_whatsapp_sessions')
      .update({ conversation_history: updatedHistory, last_message_at: new Date().toISOString() })
      .eq('id', activeSession.id);
    await routedSend(chatId, carmenResponse);
    await syncCarmenToAIConversation(supabase, activeSession, updatedHistory);
    return { handled: true, outcome: 'active' };
  }

  // No active session — outgoing (operator-typed) messages OR incoming group messages can start a new one.
  // In 1-on-1 chats we still require the owner to type the keyword; in groups, any member can trigger Carmen.
  if (!isManualOutgoing && !isGroup) return { handled: false, reason: 'no_session_inbound' };

  // Don't open a brand-new session from an end-message ("סיימנו כרמן" / "תודה כרמן"),
  // even though it contains the trigger keyword. Same for short acks.
  if (messageRequestsEnd(messageText, cfg.end_keyword)) {
    return { handled: false, reason: 'end_message_no_session' };
  }
  if (isShortAck(messageText)) {
    return { handled: false, reason: 'ack_no_session' };
  }

  const carmenAutomation = earlyAutomation;
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
  // Canonical key is `carmen_allowed_group_ids` (matches the UI in StepConfigPanel
  // and trigger-automation). Fall back to legacy singular key for older configs.
  const cfgForGroups = carmenAutomation.configuration || {};
  const allowedGroups: string[] = Array.isArray(cfgForGroups.carmen_allowed_group_ids) && cfgForGroups.carmen_allowed_group_ids.length > 0
    ? cfgForGroups.carmen_allowed_group_ids
    : (cfgForGroups.carmen_allowed_group_id ? [cfgForGroups.carmen_allowed_group_id]
      : (Array.isArray(cfgForGroups.carmen_allowed_groups) ? cfgForGroups.carmen_allowed_groups : []));
  if (scopeMode === 'specific_phone' && !isGroup) {
    const phoneCandidates = [phoneNumber, sourcePhoneNumber, chatId?.split('@')?.[0]]
      .map((p: string | null | undefined) => (p || '').replace(/[^0-9]/g, ''))
      .filter(Boolean);
    const isPhoneAllowed = allowedPhones.some((p: string) => {
      const a = p.replace(/[^0-9]/g, '');
      return phoneCandidates.some((candidate: string) => candidate.endsWith(a) || a.endsWith(candidate));
    });
    if (!isPhoneAllowed) {
      console.log('[carmen] blocked by scope_phone', { chatId, phoneNumber, sourcePhoneNumber, phoneCandidates });
      return { handled: false, reason: 'scope_phone' };
    }
  } else if (scopeMode === 'specific_group') {
    const groupIdBare = chatId ? chatId.split('@')[0] : null;
    const groupMatches = isGroup && allowedGroups.some((g: string) => g === chatId || (groupIdBare && g === groupIdBare));
    if (!groupMatches) {
      console.log('[carmen] blocked by scope_group', { chatId, isGroup, allowedGroups });
      return { handled: false, reason: 'scope_group' };
    }
  }

  // Default-deny groups: a legacy "all-scope" automation must NOT auto-trigger inside
  // WhatsApp groups. Groups require explicit opt-in via scopeMode === 'specific_group'
  // (and the group listed in allowedGroups) — this way disabling the dedicated groups
  // automation actually silences Carmen in groups.
  if (isGroup && scopeMode !== 'specific_group') {
    return { handled: false, reason: 'group_requires_explicit_scope' };
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
    await routedSend(chatId, 'שלום! זיהיתי שרצית לדבר עם כרמן, אך עדיין לא הוגדר סוכן AI. אנא פנה למנהל המערכת להגדרת סוכן כרמן.');
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
    await routedSend(chatId, 'מצטערת, אירעה שגיאה בהפעלת השיחה. נסה שוב בעוד מספר שניות.');
    return { handled: true, outcome: 'error' };
  }

  const contentAfterKeyword = messageText.replace(new RegExp(triggerKeyword, 'gi'), '').trim();

  // If the user already asked a question after the keyword, answer it directly (single message).
  // Otherwise send a brief greeting only. Either way — save the assistant reply to history
  // so the echo-guard catches the provider mirroring it back.
  if (contentAfterKeyword.length > 2) {
    const recentContext = await fetchRecentChatContext(
      supabase, tenantId, chatId, isGroup, phoneNumber,
    );
    const mergedHistory = buildCarmenMergedHistory(recentContext, []);
    const carmenResponse = await runCarmenAI(
      supabase, agentId, tenantId, contentAfterKeyword, mergedHistory, phoneNumber, senderName,
    );
    const history = [
      { role: 'user', content: contentAfterKeyword, timestamp: new Date().toISOString() },
      { role: 'assistant', content: carmenResponse, timestamp: new Date().toISOString() },
    ];
    await supabase
      .from('carmen_whatsapp_sessions')
      .update({ conversation_history: history, last_message_at: new Date().toISOString() })
      .eq('id', newSession.id);
    await routedSend(chatId, carmenResponse);
    await syncCarmenToAIConversation(supabase, newSession, history);
  } else {
    // Context-aware opener: load recent chat history so Carmen doesn't reintroduce
    // herself on every new session. If there's prior conversation, she picks up
    // naturally; otherwise she sends a normal first-time greeting.
    const recentContext = await fetchRecentChatContext(
      supabase, tenantId, chatId, isGroup, phoneNumber,
    );
    const mergedHistory = buildCarmenMergedHistory(recentContext, []);
    const hasPriorContext = recentContext.length > 0;

    const openerPrompt = hasPriorContext
      ? `המשתמש פתח שיחה חדשה במילת הטריגר "${triggerKeyword}" בלי שאלה ספציפית. כבר היה איתו דיאלוג קודם (ראי בהיסטוריה). הגיבי בקצרה וטבעית בהמשך להקשר — אל תציגי את עצמך מחדש ואל תכתבי "היי, כרמן כאן". אם יש משהו פתוח מהשיחות הקודמות שכדאי לסגור — שאלי עליו ישירות. אחרת שאלי במשפט קצר במה לעזור. אל תזכירי את מילת הסיום אלא אם נשאלת.`
      : `המשתמש פתח שיחה חדשה במילת הטריגר "${triggerKeyword}" בלי שאלה ספציפית. אין היסטוריית שיחה איתו. ברכי אותו במשפט קצר וטבעי ושאלי במה לעזור. ציין את מילת הסיום "${endKeywordConfig}" פעם אחת בלבד.`;

    let opener: string;
    try {
      opener = await runCarmenAI(
        supabase, agentId, tenantId, openerPrompt, mergedHistory, phoneNumber, senderName,
      );
    } catch (err) {
      console.error('[CARMEN] contextual opener failed, falling back:', err);
      opener = hasPriorContext
        ? 'כאן, מה צריך?'
        : `היי, ${agentName} כאן. מה תרצה לבדוק? (לסיום: "${endKeywordConfig}")`;
    }

    const history = [
      { role: 'assistant', content: opener, timestamp: new Date().toISOString() },
    ];
    await supabase
      .from('carmen_whatsapp_sessions')
      .update({ conversation_history: history, last_message_at: new Date().toISOString() })
      .eq('id', newSession.id);
    await routedSend(chatId, opener);
    await syncCarmenToAIConversation(supabase, newSession, history);
  }

  return { handled: true, outcome: 'started' };
}
