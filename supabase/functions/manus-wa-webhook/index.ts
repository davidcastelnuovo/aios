// redeploy trigger: rebundle _shared/carmen.ts keyword-aware routing (retry — esm.sh 522 aborted prior deploy)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { findCarmenSessionAutomation, handleCarmenMessage } from '../_shared/carmen.ts';
import { aiTranscribe, aiCleanTranscript } from '../_shared/ai.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-wa-gateway-instance, x-wa-gateway-secret, x-webhook-secret, x-manus-secret, x-webhook-signature',
};

// Last 9 digits — matches existing lead/client matching policy
function normalizePhone(p: string): string {
  return (p || '').replace(/\D/g, '').slice(-9);
}

// ── Incoming voice notes → transcript (OpenAI Whisper) ────────────────
// Graceful: any failure falls back to the '[מדיה]' placeholder, so behaviour
// never regresses for non-audio media or when transcription is unavailable.
const _AUDIO_URL_FIELDS = ['media_url', 'mediaUrl', 'url', 'fileUrl', 'file_url', 'downloadUrl', 'downloadURL'];
function pickAudioUrl(payload: any, msgContainer: any): string | null {
  for (const f of _AUDIO_URL_FIELDS) {
    const v = payload?.[f];
    if (typeof v === 'string' && /^https?:\/\//.test(v)) return v;
  }
  const u = msgContainer?.audioMessage?.url;
  return typeof u === 'string' && /^https?:\/\//.test(u) ? u : null;
}
function looksAudio(payload: any, msgContainer: any, url: string | null): boolean {
  if (msgContainer?.audioMessage) return true;
  const mime = (payload?.mimeType || payload?.mime_type || msgContainer?.audioMessage?.mimetype || '').toString().toLowerCase();
  if (/audio|ogg|opus|voice|ptt|mpeg/.test(mime)) return true;
  return !!url && /\.(ogg|opus|mp3|m4a|wav|aac|amr)(\?|$)/i.test(url);
}
async function resolveMessageText(payload: any, msgContainer: any): Promise<string> {
  if (payload?.body && String(payload.body).trim()) return String(payload.body);
  if (!payload?.hasMedia) return '';
  try {
    const url = pickAudioUrl(payload, msgContainer);
    if (url && looksAudio(payload, msgContainer, url)) {
      const r = await fetch(url);
      if (r.ok) {
        const blob = await r.blob();
        if (blob.size > 0 && blob.size <= 25 * 1024 * 1024) {
          const t = await aiTranscribe(blob, { language: 'he', filename: 'voice.ogg' });
          if (t && t.trim()) return (await aiCleanTranscript(t)).trim();
        }
      }
    }
  } catch (_) { /* fall through to placeholder */ }
  return '[מדיה]';
}

function ok(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const url = new URL(req.url);
    const rawPayload = await req.json();

    // Diagnostic: log top-level shape so we can see exactly what Manus sends
    try {
      console.log('[manus-wa] raw keys=', Object.keys(rawPayload || {}).join(','), 'preview=', JSON.stringify(rawPayload).slice(0, 800));
    } catch {}

    // Normalize Manus WA Gateway payload — it may be flat, or wrapped in
    // { data }, { message }, { payload }, { event, data: {...} }, etc.
    function pickObj(...candidates: unknown[]): Record<string, any> | null {
      for (const c of candidates) {
        if (c && typeof c === 'object' && !Array.isArray(c)) return c as Record<string, any>;
      }
      return null;
    }
    const outer = rawPayload as Record<string, any>;
    const inner = pickObj(outer.data, outer.message, outer.payload, outer.body) || {};
    const key = pickObj(inner.key, outer.key) || {};
    const msgContainer = pickObj(inner.message, outer.message) || {};

    // Only treat as 'message' when there is actual message content (from/body/key).
    // Otherwise keep the raw event (or 'ping' / 'unknown') so we don't falsely trigger Carmen.
    const rawEventField =
      outer.event ?? inner.event ?? outer.type ?? inner.type ?? outer.messageType ?? inner.messageType ?? null;
    const looksLikeMessage =
      !!(outer.from || inner.from || inner.chatId || outer.chatId || outer.body || inner.body || inner.text || outer.text ||
         (pickObj(inner.message, outer.message)));
    const normalizedEvent =
      (rawEventField === 'chat' || rawEventField === 'text' || rawEventField === 'message') && looksLikeMessage
        ? 'message'
        : rawEventField ?? (looksLikeMessage ? 'message' : 'ping');
    const fromField =
      outer.from ?? inner.from ?? inner.chatId ?? outer.chatId ?? key.remoteJid ?? inner.remoteJid ?? '';
    const toField =
      outer.to ?? inner.to ?? inner.recipientId ?? outer.recipientId ?? '';
    const bodyField =
      outer.body ?? inner.body ?? inner.text ?? outer.text ?? inner.content ?? outer.content ??
      msgContainer.conversation ?? msgContainer.text ?? msgContainer.body ?? '';
    const fromMeField =
      outer.fromMe ?? inner.fromMe ?? key.fromMe ?? (outer.direction === 'outgoing' || inner.direction === 'outgoing');
    const directionField = outer.direction ?? inner.direction;
    const idField = outer.id ?? inner.id ?? outer.messageId ?? inner.messageId ?? key.id;
    const senderNameField = outer.senderName ?? inner.senderName ?? outer.fromName ?? inner.fromName ?? outer.pushName ?? inner.pushName ?? null;
    const authorField = outer.author ?? inner.author ?? outer.participant ?? inner.participant ?? key.participant ?? null;
    const hasMediaField = outer.hasMedia ?? inner.hasMedia ?? !!(msgContainer.imageMessage || msgContainer.audioMessage || msgContainer.videoMessage || msgContainer.documentMessage);

    // Build a unified payload object that the rest of the code uses
    const payload: Record<string, any> = {
      ...outer,
      ...inner,
      event: normalizedEvent,
      from: fromField,
      to: toField,
      body: typeof bodyField === 'string' ? bodyField : (bodyField?.text ?? ''),
      fromMe: fromMeField,
      direction: directionField,
      id: idField,
      messageId: outer.messageId ?? inner.messageId ?? idField,
      senderName: senderNameField,
      author: authorField,
      hasMedia: hasMediaField,
    };

    // Collect every possible secret source Manus may use
    const headerSecret =
      req.headers.get('x-wa-gateway-secret') ||
      req.headers.get('x-webhook-secret') ||
      req.headers.get('x-manus-secret') ||
      req.headers.get('x-webhook-signature') ||
      url.searchParams.get('secret') ||
      (outer?.secret as string | undefined) ||
      (inner?.secret as string | undefined) ||
      '';

    const headerInstanceId = req.headers.get('x-wa-gateway-instance') || '';
    const instanceId =
      outer.instanceId || inner.instanceId || outer.instance_id || inner.instance_id ||
      headerInstanceId || url.searchParams.get('instanceId') || '';

    if (!instanceId) {
      console.error('Missing instanceId. Headers:', JSON.stringify(Object.fromEntries(req.headers)));
      return ok({ error: 'Missing instanceId' }, 400);
    }

    // Find integration by instance ID
    const { data: integrations } = await supabase
      .from('tenant_integrations')
      .select('id, tenant_id, user_id, settings, api_key')
      .eq('integration_type', 'manus_wa')
      .eq('is_active', true)
      .filter('settings->>instance_id', 'eq', String(instanceId))
      .order('created_at', { ascending: false })
      .limit(1);

    const integ = integrations?.[0];
    if (!integ) {
      console.error('No active manus_wa integration for instance', instanceId);
      return ok({ error: 'No active integration' }, 404);
    }

    const settings = (integ.settings as any) || {};
    const expectedSecret: string = settings.webhook_secret || '';

    // Auto-heal: if DB has no secret yet, accept the first webhook secret we see and persist it.
    if (!expectedSecret && headerSecret) {
      const merged = { ...settings, webhook_secret: headerSecret };
      await supabase.from('tenant_integrations').update({ settings: merged }).eq('id', integ.id);
      console.log('Auto-healed webhook_secret for instance', instanceId);
    } else if (expectedSecret && expectedSecret !== headerSecret) {
      // Log diagnostic info so we can see exactly what Manus sends, then ACK 200 so Manus doesn't disable the webhook.
      console.error(
        'Webhook secret mismatch for instance', instanceId,
        '— received headers:', JSON.stringify(Object.fromEntries(req.headers)),
        'received secret:', headerSecret ? `${headerSecret.slice(0, 6)}…` : '(none)'
      );
      return ok({ received: true, ignored: 'secret_mismatch' }, 200);
    }

    const tenantId = integ.tenant_id;
    const connectionUserId = integ.user_id;
    const event = payload.event;

    // ===== Message ACK (delivery receipt) =====
    if (event === 'message_ack') {
      const messageId = payload.messageId;
      const ack = Number(payload.ack);
      if (!messageId) return ok({ received: true });

      const { data: msg } = await supabase
        .from('chat_messages')
        .select('id, read_at')
        .eq('tenant_id', tenantId)
        .eq('provider', 'manus_wa')
        .eq('raw_provider_data->>messageId', String(messageId))
        .maybeSingle();

      if (msg) {
        const update: Record<string, unknown> = {};
        if (ack >= 3 && !msg.read_at) update.read_at = new Date().toISOString();
        if (Object.keys(update).length > 0) {
          await supabase.from('chat_messages').update(update).eq('id', msg.id);
        }
      }

      return ok({ received: true });
    }

    // ===== Incoming message =====
    console.log('[manus-wa] event=', event, 'instance=', instanceId, 'from=', payload.from, 'to=', payload.to, 'fromMe=', payload.fromMe, 'direction=', payload.direction, 'bodyPreview=', String(payload.body || '').slice(0, 80));
    if (event !== 'message') return ok({ received: true, ignored: event });

    const fromRaw = String(payload.from || '');
    const toRaw = String(payload.to || '');
    const chatIdRaw = String(payload.chatId || '');
    const senderLidRaw = String(payload.senderLid || '');
    const isGroup = fromRaw.endsWith('@g.us') || toRaw.endsWith('@g.us') || chatIdRaw.endsWith('@g.us');

    // LID detection: Manus often delivers `from` as bare digits but flags the chat as
    // `@lid` via `chatId` (or includes a `senderLid`). Treat any of these as LID so the
    // pairing/resolution blocks below actually fire.
    const isLidEvent =
      fromRaw.endsWith('@lid') ||
      chatIdRaw.endsWith('@lid') ||
      (!!senderLidRaw && senderLidRaw.replace(/\D/g, '') === fromRaw.replace(/\D/g, ''));

    // Outbound detection: prefer explicit flags from Manus, then fall back to phone comparison
    const myPhone = (settings.phone_number || '').toString().replace(/\D/g, '');
    const fromDigits = fromRaw.split('@')[0].replace(/\D/g, '');
    const fromMeFlag = payload.fromMe === true || payload.fromMe === 'true' ||
                       payload.direction === 'outgoing' || payload.direction === 'outbound';
    let isOutgoingFromPhone = fromMeFlag || (!!myPhone && fromDigits === myPhone);
    let sourcePhoneNumber = isOutgoingFromPhone ? fromDigits : myPhone;

    let counterpartRaw = isOutgoingFromPhone ? toRaw : fromRaw;
    let counterpartPhone = counterpartRaw.split('@')[0];
    let normalized = normalizePhone(counterpartPhone);
    const messageText = await resolveMessageText(payload, msgContainer);
    const messageId = String(payload.id || '');

    // ===== ATOMIC DEDUP =====
    // Manus occasionally delivers the same webhook twice. Without this guard
    // Carmen would run twice and reply twice (esp. in groups, which had no
    // chat_messages-based dedup). We atomically claim the messageId here,
    // BEFORE any branching (group vs private), so duplicates exit immediately.
    if (messageId) {
      const { error: claimErr } = await supabase
        .from('processed_webhook_messages')
        .insert({
          provider: 'manus_wa',
          tenant_id: tenantId,
          external_message_id: messageId,
        });
      if (claimErr) {
        // 23505 = unique_violation → another invocation already processing this msg
        if ((claimErr as any).code === '23505') {
          console.log('[manus-wa] duplicate webhook dropped', { messageId, bodyPreview: String(messageText).slice(0, 60) });
          return ok({ received: true, duplicate: true });
        }
        // Any other error: log but continue (don't lose messages on transient DB issues)
        console.error('[manus-wa] dedup insert failed (continuing):', claimErr);
      }
    }


    // ECHO GUARD: Manus mirrors EVERY message (in and out) as inbound @lid events.
    // If we just sent this exact text via Manus or Green API in the last 2 minutes, drop it.
    if (!isOutgoingFromPhone && isLidEvent && messageText.trim()) {
      const { data: ownOutbound } = await supabase
        .from('chat_messages')
        .select('id, provider, created_at')
        .eq('tenant_id', tenantId)
        .eq('direction', 'outbound')
        .in('provider', ['manus_wa', 'green_api'])
        .eq('message_text', messageText)
        .gte('created_at', new Date(Date.now() - 2 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false })
        .limit(1);
      if (ownOutbound && ownOutbound.length > 0) {
        const allowGreenApiCarmenKickoff =
          ownOutbound[0].provider === 'green_api' && /כרמן|carmen/i.test(messageText);
        if (!allowGreenApiCarmenKickoff) {
          console.log('[manus-wa] echo dropped — matches our own outbound', { provider: ownOutbound[0].provider, messageId, bodyPreview: messageText.slice(0, 60) });
          return ok({ received: true, ignored: 'self_echo' });
        }
        console.log('[manus-wa] keeping Green API Carmen kickoff mirrored by Manus', { messageId, bodyPreview: messageText.slice(0, 60) });
      }
    }

    // Manus sometimes reports manual outgoing phone messages as inbound @lid events.
    // If Green API receives the same WhatsApp message as outbound moments later, use it
    // as the direction/contact source AND route Carmen replies through Green API
    // (so the reply comes from the same WhatsApp number the operator actually used).
    let pairedFromGreenApi = false;
    if (!isOutgoingFromPhone && !isGroup && isLidEvent && messageText.trim()) {
      await new Promise((resolve) => setTimeout(resolve, 2600));
      const { data: greenMatches } = await supabase
        .from('chat_messages')
        .select('sender_phone, raw_provider_data, created_at, connection_user_id')
        .eq('tenant_id', tenantId)
        .eq('provider', 'green_api')
        .eq('direction', 'outbound')
        .eq('message_text', messageText)
        .gte('created_at', new Date(Date.now() - 2 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false })
        .limit(5);
      const pairedOutgoing = (greenMatches || []).find((m: any) =>
        !messageId || String(m.raw_provider_data?.idMessage || '') === messageId
      ) || greenMatches?.[0];
      if (pairedOutgoing?.sender_phone) {
        isOutgoingFromPhone = true;
        counterpartPhone = String(pairedOutgoing.sender_phone);
        counterpartRaw = `${counterpartPhone}@c.us`;
        normalized = normalizePhone(counterpartPhone);
        sourcePhoneNumber = String(
          pairedOutgoing.raw_provider_data?.senderData?.sender ||
          pairedOutgoing.raw_provider_data?.instanceData?.wid ||
          ''
        ).split('@')[0].replace(/[^0-9]/g, '');
        pairedFromGreenApi = true;
        console.log('[manus-wa] paired LID event with Green API outbound', { messageId, counterpartPhone, sourcePhoneNumber });
      }
    }

    // Manus can emit phone-app messages as opaque @lid IDs instead of the real phone.
    // For a direct Carmen flow pinned to this Manus integration and scoped to exactly
    // one phone, resolve the LID to that configured phone so the Carmen trigger/session
    // can match instead of being blocked by the random LID number.
    if (!isGroup && !pairedFromGreenApi && isLidEvent) {
      try {
        const carmenAutomation = await findCarmenSessionAutomation(supabase, tenantId, integ.id, {
          isGroup: false,
          chatId: `${counterpartPhone}@c.us`,
          phoneNumber: counterpartPhone,
        });
        const cfg = carmenAutomation?.configuration || {};
        const scopeMode = cfg.carmen_scope_mode || 'all';
        const allowedPhones = Array.isArray(cfg.carmen_allowed_phones)
          ? [...new Set(cfg.carmen_allowed_phones.map((p: any) => String(p).replace(/\D/g, '')).filter(Boolean))]
          : [];
        const idleMin = Number(cfg.session_timeout_minutes) > 0 ? Number(cfg.session_timeout_minutes) : 5;
        const since = new Date(Date.now() - idleMin * 60 * 1000).toISOString();

        // Resolution priority for LID events on private Carmen flows:
        // 1) Explicit allowed phones (specific_phone scope) — pick fresh session phone, else single allowed phone.
        // 2) Otherwise (scope=all or no allowed list) — pick the unique fresh active Carmen session
        //    on this connection. This is what enables continuation messages without re-saying "כרמן".
        let aliasPhone: string | null = null;
        let aliasReason = '';

        if (scopeMode === 'specific_phone' && allowedPhones.length >= 1) {
          if (allowedPhones.length === 1) {
            aliasPhone = allowedPhones[0] as string;
            aliasReason = 'single_allowed_phone';
          } else {
            const { data: recentSessions } = await supabase
              .from('carmen_whatsapp_sessions')
              .select('phone, last_message_at, created_at')
              .eq('tenant_id', tenantId)
              .eq('status', 'active')
              .eq('connection_user_id', connectionUserId)
              .in('phone', allowedPhones)
              .gte('last_message_at', since)
              .order('last_message_at', { ascending: false })
              .limit(1);
            if (recentSessions && recentSessions.length > 0) {
              aliasPhone = String(recentSessions[0].phone);
              aliasReason = 'fresh_session_within_allowed';
            }
          }
        }

        // Generic resolver: even without specific_phone scope, if exactly one fresh
        // active Carmen session exists on this connection, attribute the @lid event
        // to it. This makes continuation messages work in "כרמן ישיר" flows.
        if (!aliasPhone) {
          const { data: freshSessions } = await supabase
            .from('carmen_whatsapp_sessions')
            .select('phone, last_message_at, created_at, automation_id')
            .eq('tenant_id', tenantId)
            .eq('status', 'active')
            .eq('connection_user_id', connectionUserId)
            .gte('last_message_at', since)
            .order('last_message_at', { ascending: false })
            .limit(2);
          if (freshSessions && freshSessions.length === 1) {
            aliasPhone = String(freshSessions[0].phone);
            aliasReason = 'unique_fresh_session';
          } else if (freshSessions && freshSessions.length > 1 && carmenAutomation?.id) {
            // Prefer a session bound to the same Carmen automation we matched.
            const preferred = freshSessions.find((s: any) => s.automation_id === carmenAutomation.id);
            if (preferred) {
              aliasPhone = String(preferred.phone);
              aliasReason = 'fresh_session_matching_automation';
            } else {
              console.log('[manus-wa] LID resolution skipped — multiple fresh sessions, no clear owner', {
                count: freshSessions.length,
                preview: messageText.slice(0, 60),
              });
            }
          }
        }

        if (aliasPhone) {
          const aliasChatId = `${aliasPhone}@c.us`;
          const { data: activeAliasSession } = await supabase
            .from('carmen_whatsapp_sessions')
            .select('id, last_message_at, created_at')
            .eq('tenant_id', tenantId)
            .eq('status', 'active')
            .eq('connection_user_id', connectionUserId)
            .eq('chat_id', aliasChatId)
            .eq('phone', aliasPhone)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          const lastActivity = activeAliasSession
            ? new Date(activeAliasSession.last_message_at || activeAliasSession.created_at).getTime()
            : 0;
          const hasFreshAliasSession = !!activeAliasSession && (Date.now() - lastActivity) <= idleMin * 60 * 1000;
          // Support multiple configured wake-words + Whisper spelling variants of "כרמן".
          const triggerKeywords = (Array.isArray(cfg.trigger_keywords) && cfg.trigger_keywords.length
            ? cfg.trigger_keywords
            : [cfg.trigger_keyword || 'כרמן']).map((k: any) => String(k || '').toLowerCase()).filter(Boolean);
          const lowerMsg = String(messageText || '').toLowerCase();
          const hasTriggerKeyword = triggerKeywords.some((k: string) => lowerMsg.includes(k)) || /[כק]א?רמן/.test(lowerMsg);

          counterpartPhone = aliasPhone;
          counterpartRaw = aliasChatId;
          normalized = normalizePhone(aliasPhone);

          if (hasFreshAliasSession || hasTriggerKeyword) {
            isOutgoingFromPhone = true;
            sourcePhoneNumber = aliasPhone;
          }

          console.log('[manus-wa] resolved LID for Carmen direct flow', {
            fromRaw,
            aliasPhone,
            aliasReason,
            scopeMode,
            manualLike: isOutgoingFromPhone,
            hasFreshAliasSession,
            hasTriggerKeyword,
          });
        }
      } catch (err) {
        console.error('[manus-wa] LID Carmen resolution failed:', err);
      }
    }

    // FALLBACK LID RESOLUTION: when an inbound @lid event arrives and the counterpart
    // phone is unresolvable (empty OR equals the raw LID number which is NOT a real
    // phone), but there is an ACTIVE Carmen session on this connection within the
    // idle window, attribute the message to that session's phone. Without this,
    // mid-conversation replies (which Manus often delivers as pure LID events) get
    // dropped by scope filtering and Carmen goes silent until the user types "כרמן" again.
    const counterpartLooksLikeLid =
      !counterpartPhone ||
      counterpartPhone.replace(/\D/g, '') === fromDigits ||
      counterpartPhone.replace(/\D/g, '').length > 14; // real phones ≤ 15 digits, LIDs are typically 15+
    if (!isGroup && isLidEvent && counterpartLooksLikeLid && messageText.trim()) {
      try {
        const { data: freshSessions } = await supabase
          .from('carmen_whatsapp_sessions')
          .select('phone, chat_id, last_message_at, automation_id')
          .eq('tenant_id', tenantId)
          .eq('status', 'active')
          .eq('connection_user_id', connectionUserId)
          .gte('last_message_at', new Date(Date.now() - 5 * 60 * 1000).toISOString())
          .order('last_message_at', { ascending: false })
          .limit(2);
        if (freshSessions && freshSessions.length === 1) {
          const aliasPhone = String(freshSessions[0].phone);
          counterpartPhone = aliasPhone;
          counterpartRaw = `${aliasPhone}@c.us`;
          normalized = normalizePhone(aliasPhone);
          isOutgoingFromPhone = true;
          sourcePhoneNumber = aliasPhone;
          console.log('[manus-wa] LID fallback → resolved via active Carmen session', {
            aliasPhone, body: messageText.slice(0, 60),
          });
        } else if (freshSessions && freshSessions.length > 1) {
          console.log('[manus-wa] LID fallback skipped — multiple fresh sessions', {
            count: freshSessions.length,
            preview: messageText.slice(0, 60),
          });
        } else {
          console.log('[manus-wa] LID fallback found no active Carmen session', {
            counterpartPhone, fromDigits, preview: messageText.slice(0, 60),
          });
        }
      } catch (err) {
        console.error('[manus-wa] LID fallback resolution failed:', err);
      }
    }

    // Group messages: skip client/lead matching & chat_messages insert, but still let Carmen respond in-group.
    if (isGroup) {
      // Prefer explicit group fields. `from` is often the sender's personal phone in groups,
      // and `to` may be empty — in which case we must fall back to chatId/groupId from the payload.
      const groupIdRaw = String((payload as any).groupId || '');
      const groupChatId = (
        fromRaw.endsWith('@g.us') ? fromRaw :
        toRaw.endsWith('@g.us') ? toRaw :
        chatIdRaw.endsWith('@g.us') ? chatIdRaw :
        groupIdRaw.endsWith('@g.us') ? groupIdRaw :
        (chatIdRaw || groupIdRaw || toRaw)
      );

      // Per-group tenant routing (shared bot): a single WhatsApp bot may sit in groups
      // that belong to DIFFERENT organizations. Resolve the owning tenant from the
      // group's chat id so Carmen answers for the right org (and scopes to its clients).
      // Falls back to the bot's own tenant when the group isn't registered.
      let groupTenantId = tenantId;
      try {
        const { data: wgRow } = await supabase
          .from('whatsapp_groups')
          .select('tenant_id')
          .eq('group_chat_id', groupChatId)
          .limit(1)
          .maybeSingle();
        if (wgRow?.tenant_id) groupTenantId = wgRow.tenant_id as string;
      } catch (_e) { /* fall back to bot tenant */ }
      if (groupTenantId !== tenantId) {
        console.log('[manus-wa group] routed by group → tenant', { groupChatId, botTenant: tenantId, groupTenant: groupTenantId });
      }

      const messageText = await resolveMessageText(payload, msgContainer);
      const senderName = (payload.senderName || payload.fromName || payload.authorName || null) as string | null;

      // Extract the REAL sender phone from author/participant fields.
      // Falling back to fromRaw inside a group gives the group id (120363...@g.us) which is useless.
      const authorCandidates = [
        payload.author, payload.participant, key.participant,
        (msgContainer as any)?.participant, (msgContainer as any)?.author,
      ].filter((v: any) => typeof v === 'string' && v.includes('@')) as string[];
      const authorRaw = authorCandidates[0] || '';
      const authorPhone = authorRaw ? authorRaw.split('@')[0].replace(/\D/g, '') : '';

      // ECHO / OUTBOUND GUARD for groups: Manus mirrors our own outbound back as inbound.
      // If author's digits match our connected phone, OR if the body matches an outbound we
      // just sent to this same group within the last 2 minutes, drop it.
      const myDigits = (settings.phone_number || '').toString().replace(/\D/g, '');
      const looksLikeOurOwn = !!authorPhone && !!myDigits && (authorPhone === myDigits || authorPhone.endsWith(myDigits) || myDigits.endsWith(authorPhone));
      if (looksLikeOurOwn || isOutgoingFromPhone) {
        console.log('[manus-wa group] dropping own outbound mirror', { groupChatId, authorPhone, myDigits, isOutgoingFromPhone });
        return ok({ received: true, ignored: 'group_self_echo' });
      }
      if (messageText && messageText.trim()) {
        const { data: recentOwn } = await supabase
          .from('chat_messages')
          .select('id, created_at')
          .eq('tenant_id', tenantId)
          .eq('direction', 'outbound')
          .eq('group_id', null as any)
          .in('provider', ['manus_wa', 'green_api'])
          .eq('message_text', messageText)
          .gte('created_at', new Date(Date.now() - 2 * 60 * 1000).toISOString())
          .limit(1);
        if (recentOwn && recentOwn.length > 0) {
          console.log('[manus-wa group] dropping echoed body of our own outbound', { groupChatId, bodyPreview: messageText.slice(0, 60) });
          return ok({ received: true, ignored: 'group_body_echo' });
        }
      }

      let carmenOutcome: string | null = null;
      try {
        const result = await handleCarmenMessage({
          supabase,
          tenantId: groupTenantId,
          integrationId: integ.id,
          connectionUserId,
          chatId: groupChatId,
          phoneNumber: authorPhone || '',
          senderName,
          messageText,
          isIncoming: !isOutgoingFromPhone,
          isManualOutgoing: isOutgoingFromPhone,
          isGroup: true,
          sendMessage: async (_chatId: string, message: string) => {
            const settingsAny = (integ.settings as any) || {};
            const baseUrl = settingsAny.gateway_url || 'https://whatsappgw-pzpyrrww.manus.space';
            const instanceId = settingsAny.instance_id;
            const apiKey = integ.api_key;
            if (!instanceId || !apiKey) return false;
            // IMPORTANT: bound the gateway call with a timeout. Without it, a stalled Manus
            // connection hangs this whole function and the WhatsApp message is stuck on "sending".
            // No retry on abort: the message may already have been delivered, so a retry risks a duplicate.
            const FETCH_TIMEOUT_MS = 60000;
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
            const started = Date.now();
            try {
              const res = await fetch(`${baseUrl}/api/v1/instances/${instanceId}/send/group`, {
                method: 'POST',
                headers: { 'X-Api-Key': apiKey, 'Content-Type': 'application/json' },
                body: JSON.stringify({ groupId: groupChatId, body: message }),
                signal: controller.signal,
              });
              clearTimeout(timer);
              console.log('[manus-wa Carmen group send]', { groupChatId, status: res.status, ok: res.ok, elapsedMs: Date.now() - started });
              return res.ok;
            } catch (err: any) {
              clearTimeout(timer);
              const isAbort = err?.name === 'AbortError';
              console.error('manus-wa Carmen group sendMessage error:', isAbort
                ? `aborted after ${Date.now() - started}ms (gateway timeout) — not retried to avoid duplicate delivery`
                : err);
              return false;
            }
          },
        });
        if (result.handled) carmenOutcome = result.outcome;
        console.log('[carmen-group]', { groupChatId, authorPhone, isOutgoingFromPhone, handled: result.handled, outcome: (result as any).outcome, reason: (result as any).reason, body: String(messageText).slice(0, 60) });
      } catch (err) {
        console.error('manus-wa Carmen group handler error:', err);
      }

      return ok({ received: true, group: true, carmen: carmenOutcome });
    }

    // Dedup by message id
    if (messageId) {
      const { data: existing } = await supabase
        .from('chat_messages')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('provider', 'manus_wa')
        .eq('raw_provider_data->>id', messageId)
        .maybeSingle();
      if (existing) return ok({ received: true, duplicate: true });
    }

    // Look up client/lead by phone (last 9 digits)
    let clientId: string | null = null;
    let leadId: string | null = null;

    const { data: client } = await supabase
      .from('clients')
      .select('id')
      .eq('tenant_id', tenantId)
      .or(`phone.ilike.%${normalized}%,phone.ilike.%${counterpartPhone}%`)
      .maybeSingle();
    if (client) clientId = client.id;

    if (!clientId) {
      const { data: lead } = await supabase
        .from('leads')
        .select('id')
        .eq('tenant_id', tenantId)
        .or(`phone.ilike.%${normalized}%,phone.ilike.%${counterpartPhone}%`)
        .maybeSingle();
      if (lead) leadId = lead.id;
    }

    const { error: insertError } = await supabase.from('chat_messages').insert({
      client_id: clientId,
      lead_id: leadId,
      tenant_id: tenantId,
      connection_user_id: connectionUserId,
      message_text: messageText,
      direction: isOutgoingFromPhone ? 'outbound' : 'inbound',
      channel: 'whatsapp',
      provider: 'manus_wa',
      sender_phone: counterpartPhone,
      raw_provider_data: payload,
    });

    if (insertError) {
      console.error('Failed to insert chat_messages:', insertError);
      throw insertError;
    }

    // ===== Carmen WhatsApp session handling =====
    // If this came from the operator's personal phone (paired via Green API),
    // Carmen should reply BACK to the operator's phone — NOT to the device itself.
    const carmenTargetPhone = pairedFromGreenApi && sourcePhoneNumber
      ? sourcePhoneNumber
      : counterpartPhone;
    const chatIdForCarmen = `${carmenTargetPhone}@c.us`;
    const senderName = (payload.senderName || payload.fromName || null) as string | null;

    let carmenOutcome: string | null = null;
    try {
      const result = await handleCarmenMessage({
        supabase,
        tenantId,
        integrationId: integ.id,
        connectionUserId,
        chatId: chatIdForCarmen,
        phoneNumber: carmenTargetPhone,
          sourcePhoneNumber,
        senderName,
        messageText,
        isIncoming: !isOutgoingFromPhone,
        isManualOutgoing: isOutgoingFromPhone,
        isGroup: false,
        sendMessage: async (_chatId: string, message: string) => {
          try {
            const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
            const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
            console.log('[carmen->manus] sending', { integrationId: integ.id, tenantId, phoneNumber: carmenTargetPhone, connectionUserId, messageLen: message.length });
            const res = await fetch(`${supabaseUrl}/functions/v1/send-manus-wa-message`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${serviceKey}`,
              },
              body: JSON.stringify({
                integrationId: integ.id,
                tenantId,
                phoneNumber: carmenTargetPhone,
                senderUserId: connectionUserId,
                message,
              }),
            });
            const txt = await res.text();
            console.log('[carmen->manus] result', { status: res.status, body: txt.slice(0, 500) });
            return res.ok;
          } catch (err) {
            console.error('manus-wa Carmen sendMessage error:', err);
            return false;
          }
        },
      });
      if (result.handled) carmenOutcome = result.outcome;
      console.log('[carmen-private]', { chatId: chatIdForCarmen, carmenTargetPhone, counterpartPhone, sourcePhoneNumber, pairedFromGreenApi, isOutgoingFromPhone, handled: result.handled, outcome: (result as any).outcome, reason: (result as any).reason, body: String(messageText).slice(0, 60) });
    } catch (err) {
      console.error('manus-wa Carmen handler error:', err);
    }

    return ok({
      success: true,
      direction: isOutgoingFromPhone ? 'outbound' : 'inbound',
      contactType: clientId ? 'client' : leadId ? 'lead' : 'unknown',
      contactId: clientId || leadId || null,
      carmen: carmenOutcome,
    });

  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    console.error('manus-wa-webhook error:', msg);
    return ok({ error: msg }, 500);
  }
});
