// redeploy trigger: rebundle _shared/carmen.ts — specific_phone no longer self-matches the
// operator on outbound messages (stops Carmen replying in the operator's private chats).
// redeploy trigger: session identity is chat JID only — never newest session / speaker phone (2026-08-27)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { findCarmenSessionAutomation, groupMessageInvokesCarmen, handleCarmenMessage } from '../_shared/carmen.ts';
import { aiTranscribe, aiCleanTranscript } from '../_shared/ai.ts';
import {
  VOICE_STATUSES,
  buildVoiceMeta,
  formatVoiceMessageText,
  hasVoiceTranscriptMarker,
  isVoicePlaceholder,
  looksLikeAudioPayload,
  pickAudioUrlFromContainers,
  stripVoiceMarker,
} from '../_shared/wa-voice-resolve.ts';
import {
  outboundThirdPartyGuardDecision,
  pickPrivateCarmenTarget,
  resolveInboundLidToPhone,
  shouldMarkResolvedLidAsOutgoing,
} from '../_shared/carmen-private-routing.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-wa-gateway-instance, x-wa-gateway-secret, x-webhook-secret, x-manus-secret, x-webhook-signature',
};

// Last 9 digits — matches existing lead/client matching policy
function normalizePhone(p: string): string {
  return (p || '').replace(/\D/g, '').slice(-9);
}

function isIsraeliMobileTail(digits: string): boolean {
  const tail = String(digits || '').replace(/\D/g, '').slice(-9);
  return /^[5-9]\d{8}$/.test(tail);
}

/** True when Manus did not give us a usable participant phone for identity checks. */
function isUnresolvedGroupAuthor(
  authorPhone: string,
  authorRaw: string,
  groupChatId: string,
): boolean {
  const groupDigits = groupChatId.split('@')[0].replace(/\D/g, '');
  if (!authorPhone) return true;
  if (authorPhone === groupDigits) return true;
  if (/@lid/i.test(authorRaw)) return true;
  return !isIsraeliMobileTail(authorPhone);
}

// ── Incoming voice notes → transcript (OpenAI Whisper) ────────────────
// Returns structured result: clear 🎤 transcript when available, otherwise an
// explicit status (no_audio_url / transcription_failed / …) — never silent.
type MediaAuth = { apiKey?: string; gateway?: string; supabase?: any; tenantId?: string };
type VoiceResolveResult = {
  messageText: string;
  isVoice: boolean;
  voiceMeta: Record<string, unknown>;
};
// Tracks URL-less Manus payloads that were positively matched to a Green API voice transcript.
// WeakSet keeps the classification request-local without mutating the payload persisted to the database.
const pairedVoicePayloads = new WeakSet<object>();
function pickAudioUrl(payload: any, msgContainer: any): string | null {
  return pickAudioUrlFromContainers([
    payload, payload?.media, payload?.file, payload?.attachment, payload?.audio,
    msgContainer, msgContainer?.audioMessage, msgContainer?.message,
  ]);
}
function looksAudio(payload: any, msgContainer: any, url: string | null): boolean {
  return looksLikeAudioPayload({
    hasAudioMessage: !!msgContainer?.audioMessage,
    type: payload?.type ?? payload?.messageType ?? payload?.mediaType ?? msgContainer?.type,
    mime: payload?.mimeType || payload?.mime_type || payload?.media?.mimetype ||
      msgContainer?.audioMessage?.mimetype,
    url,
  });
}
// Fetch the media bytes. Manus media URLs sometimes require the instance API key
// (X-Api-Key), so retry with it if an anonymous fetch is rejected.
async function fetchMedia(url: string, auth?: MediaAuth): Promise<Blob | null> {
  try {
    const r = await fetch(url);
    if (r.ok) return await r.blob();
  } catch (_) { /* try authed */ }
  if (auth?.apiKey) {
    try {
      const r = await fetch(url, { headers: { 'X-Api-Key': auth.apiKey } });
      if (r.ok) return await r.blob();
    } catch (_) { /* give up */ }
  }
  return null;
}
// The Manus gateway currently emits hasMedia=true for voice notes without a URL,
// MIME type, or media object. The same WhatsApp message is also delivered to the
// connected Green API webhook, which downloads and transcribes it. Reuse that
// transcript by the provider message id — KEEP the 🎤 marker so Carmen knows
// this is a voice transcript (stripping it caused her to deny she can read voice).
async function findPairedGreenTranscript(
  payload: any,
  auth?: MediaAuth,
): Promise<string | null> {
  if (!auth?.supabase || !auth.tenantId) return null;
  const messageId = String(payload?.messageId || payload?.id || '').trim();
  if (!messageId) return null;

  for (let attempt = 0; attempt < 21; attempt++) {
    if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, 1000));
    const { data } = await auth.supabase
      .from('chat_messages')
      .select('message_text')
      .eq('tenant_id', auth.tenantId)
      .eq('provider', 'green_api')
      .eq('raw_provider_data->>idMessage', messageId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    const raw = String(data?.message_text || '').trim();
    const text = stripVoiceMarker(raw);
    if (text && !isVoicePlaceholder(raw) && !isVoicePlaceholder(text)) {
      if (payload && typeof payload === 'object') pairedVoicePayloads.add(payload);
      // Always re-apply 🎤 — Green rows already have it; keep Carmen context consistent.
      return formatVoiceMessageText({ transcript: text, status: VOICE_STATUSES.OK, isVoice: true });
    }
    // Green already wrote an explicit failure — surface it (don't keep waiting forever).
    if (raw && isVoicePlaceholder(raw) && /·/.test(raw) && attempt >= 3) {
      if (payload && typeof payload === 'object') pairedVoicePayloads.add(payload);
      return raw;
    }
  }
  return null;
}
// Diagnostic: when a media message can't be transcribed, persist the payload
// shape so the exact Manus voice-note format can be pinned down. Best-effort.
function logMediaDebug(
  auth: MediaAuth | undefined,
  payload: any,
  msgContainer: any,
  url: string | null,
  isAudio: boolean,
  status: string,
) {
  if (!auth?.supabase) return;
  try {
    auth.supabase.from('error_logs').insert({
      tenant_id: auth.tenantId ?? null,
      source: 'manus-wa-media-debug',
      error_message: `voice/media resolve status=${status}`,
      context: {
        status,
        top_keys: Object.keys(payload || {}),
        hasMedia: payload?.hasMedia ?? null,
        type: payload?.type ?? payload?.messageType ?? payload?.mediaType ?? null,
        mimeType: payload?.mimeType ?? payload?.mime_type ?? null,
        message_id: payload?.messageId ?? payload?.id ?? null,
        picked_url: url,
        looks_audio: isAudio,
        msg_keys: msgContainer ? Object.keys(msgContainer) : null,
        audioMessage_keys: msgContainer?.audioMessage ? Object.keys(msgContainer.audioMessage) : null,
        preview: JSON.stringify(payload ?? {}).slice(0, 1500),
      },
    }).then(() => {}, () => {});
  } catch (_) { /* never let diagnostics break the webhook */ }
}
async function resolveMessageText(
  payload: any,
  msgContainer: any,
  auth?: MediaAuth,
): Promise<VoiceResolveResult> {
  const messageId = String(payload?.messageId || payload?.id || '').trim() || null;
  const body = payload?.body != null ? String(payload.body).trim() : '';
  const urlEarly = pickAudioUrl(payload, msgContainer);
  const audioEarly = looksAudio(payload, msgContainer, urlEarly);

  // Prefer body for plain text and non-voice media captions (images/docs).
  // For voice, ensure the 🎤 marker is present so Carmen knows it's a transcript.
  if (body && (!payload?.hasMedia || !audioEarly)) {
    const isVoice = hasVoiceTranscriptMarker(body);
    const messageText = isVoice
      ? formatVoiceMessageText({ transcript: body, status: VOICE_STATUSES.OK, isVoice: true })
      : body;
    const meta = buildVoiceMeta({
      status: isVoice ? VOICE_STATUSES.OK : VOICE_STATUSES.TEXT,
      transcript: isVoice ? stripVoiceMarker(messageText) : null,
      source: 'body', messageId, isVoice,
    });
    return { messageText, isVoice, voiceMeta: meta };
  }
  if (body && audioEarly) {
    const formatted = formatVoiceMessageText({ transcript: body, status: VOICE_STATUSES.OK, isVoice: true });
    if (payload && typeof payload === 'object') pairedVoicePayloads.add(payload);
    const meta = buildVoiceMeta({
      status: VOICE_STATUSES.OK, transcript: stripVoiceMarker(formatted),
      source: 'body', messageId, audioUrl: urlEarly, isVoice: true,
    });
    return { messageText: formatted, isVoice: true, voiceMeta: meta };
  }

  if (!payload?.hasMedia) {
    const meta = buildVoiceMeta({ status: VOICE_STATUSES.EMPTY, source: 'none', messageId, isVoice: false });
    return { messageText: '', isVoice: false, voiceMeta: meta };
  }

  const url = urlEarly;
  const isAudio = audioEarly;
  let status = isAudio
    ? (url ? VOICE_STATUSES.TRANSCRIPTION_FAILED : VOICE_STATUSES.NO_AUDIO_URL)
    : VOICE_STATUSES.NOT_VOICE_MEDIA;
  let source: string = 'none';
  let transcript: string | null = null;

  if (url && isAudio) {
    try {
      const blob = await fetchMedia(url, auth);
      if (!blob) {
        status = VOICE_STATUSES.DOWNLOAD_FAILED;
      } else if (blob.size <= 0 || blob.size > 25 * 1024 * 1024) {
        status = VOICE_STATUSES.EMPTY_AUDIO;
      } else {
        const t = await aiTranscribe(blob, { language: 'he', filename: 'voice.ogg' });
        if (t && t.trim()) {
          transcript = (await aiCleanTranscript(t)).trim();
          status = VOICE_STATUSES.OK;
          source = 'direct_whisper';
        } else {
          status = VOICE_STATUSES.TRANSCRIPTION_FAILED;
        }
      }
    } catch (_) {
      status = VOICE_STATUSES.TRANSCRIPTION_FAILED;
    }
  }

  // URL-less Manus voice notes: reuse Green API transcript (keeps 🎤).
  if (status !== VOICE_STATUSES.OK) {
    const paired = await findPairedGreenTranscript(payload, auth);
    if (paired) {
      if (isVoicePlaceholder(paired)) {
        const meta = buildVoiceMeta({
          status: VOICE_STATUSES.TRANSCRIPTION_FAILED,
          transcript: null, source: 'green_api_pair', messageId, audioUrl: url, isVoice: true,
        });
        meta.message_text = paired;
        console.log('[manus-wa] voice resolve paired failure', { messageId, status: paired });
        return { messageText: paired, isVoice: true, voiceMeta: meta };
      }
      const meta = buildVoiceMeta({
        status: VOICE_STATUSES.OK, transcript: stripVoiceMarker(paired),
        source: 'green_api_pair', messageId, audioUrl: url, isVoice: true,
      });
      console.log('[manus-wa] voice resolve ok via green_api_pair', { messageId, len: paired.length });
      return { messageText: paired, isVoice: true, voiceMeta: meta };
    }
  }

  const isVoice = isAudio || pairedVoicePayloads.has(payload);
  if (status !== VOICE_STATUSES.OK) {
    logMediaDebug(auth, payload, msgContainer, url, isAudio, status);
  }
  const meta = buildVoiceMeta({
    status, transcript, source: source as any, messageId, audioUrl: url, isVoice,
  });
  const messageText = String(meta.message_text || '');
  console.log('[manus-wa] voice resolve', { messageId, status, isVoice, source, hasTranscript: !!transcript });
  return { messageText, isVoice, voiceMeta: meta };
}

// Was the inbound message a voice note? (drives Carmen's voice-out mirroring)
function messageIsVoice(payload: any, msgContainer: any, resolved?: VoiceResolveResult): boolean {
  if (resolved?.isVoice) return true;
  if (payload && typeof payload === 'object' && pairedVoicePayloads.has(payload)) return true;
  if (!payload?.hasMedia) return false;
  const url = pickAudioUrl(payload, msgContainer);
  return looksAudio(payload, msgContainer, url);
}

// Send Carmen's reply as a voice note too (best-effort, via send-manus-wa-voice)
function makeVoiceSender(tenantId: string): (chatId: string, text: string) => Promise<boolean> {
  return async (toChatId: string, text: string): Promise<boolean> => {
    try {
      const r = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-manus-wa-voice`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        },
        body: JSON.stringify({ tenant_id: tenantId, to: toChatId, text }),
      });
      return r.ok;
    } catch {
      return false;
    }
  };
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

    // Credentials + diagnostics for resolving inbound voice-note media.
    const mediaAuth: MediaAuth = {
      apiKey: integ.api_key as string | undefined,
      gateway: (settings.gateway_url as string) || 'https://whatsappgw-pzpyrrww.manus.space',
      supabase,
      tenantId,
    };

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
    const resolvedMsg = await resolveMessageText(payload, msgContainer, mediaAuth);
    const messageText = resolvedMsg.messageText;
    const voiceMeta = resolvedMsg.voiceMeta;
    const messageId = String(payload.messageId || payload.id || '');

    // AUTO LID RESOLUTION 1/2 — real phone in the payload. Newer Baileys exposes the
    // sender's actual number alongside the LID (senderPn / participantPn); if the
    // gateway forwards any real-phone field that differs from the LID digits, use it
    // directly — no aliases or pairing needed.
    let lidAutoResolved = false;
    if (isLidEvent && !isOutgoingFromPhone && !isGroup) {
      const lidDigits = counterpartPhone.replace(/\D/g, '');
      const candidates = [payload.senderPn, payload.participantPn, payload.senderPhone, payload.senderNumber]
        .map((v: unknown) => String(v || '').split('@')[0].replace(/\D/g, ''))
        .filter((d: string) => d && d.length >= 9 && d.length <= 15 && d !== lidDigits);
      if (candidates.length > 0) {
        counterpartPhone = candidates[0];
        counterpartRaw = `${counterpartPhone}@c.us`;
        normalized = normalizePhone(counterpartPhone);
        lidAutoResolved = true;
        console.log('[manus-wa] LID auto-resolved from payload real-phone field', { lid: lidDigits, phone: counterpartPhone });
        // Persist the mapping so future events resolve even without the payload field.
        supabase.from('wa_lid_map')
          .upsert({ lid: lidDigits, phone: counterpartPhone, connection_user_id: connectionUserId, source: 'payload' }, { onConflict: 'lid' })
          .then(() => {}, () => {});
      } else if (lidDigits) {
        // AUTO LID RESOLUTION 2/2 — learned map. Any previously learned lid→phone pair
        // (from payload fields or Green-API pairing, across all tenants on this system)
        // resolves deterministically with zero configuration.
        const { data: known } = await supabase
          .from('wa_lid_map')
          .select('phone')
          .eq('lid', lidDigits)
          .maybeSingle();
        if (known?.phone) {
          counterpartPhone = String(known.phone);
          counterpartRaw = `${counterpartPhone}@c.us`;
          normalized = normalizePhone(counterpartPhone);
          lidAutoResolved = true;
          console.log('[manus-wa] LID auto-resolved from learned map', { lid: lidDigits, phone: counterpartPhone });
        }
      }
    }

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


    // ACTIVATION HANDSHAKE: an unresolved-LID private message may be the reply to
    // a "you were authorized" activation message (sent by carmen-activate-phone
    // when a phone is added to carmen_allowed_phones). A reply carrying the
    // one-time code — or quoting the activation message — proves the sender owns
    // the allow-listed number, so we learn the LID→phone mapping permanently.
    if (!isGroup && isLidEvent && !isOutgoingFromPhone && !lidAutoResolved && messageText.trim()) {
      try {
        const { data: pendings } = await supabase
          .from('wa_pending_activations')
          .select('id, phone, code, activation_message_id')
          .eq('tenant_id', tenantId)
          .eq('status', 'pending')
          .gte('created_at', new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString())
          .limit(10);
        if (pendings && pendings.length > 0) {
          const quotedId = String(
            (payload as any).quotedMsgId || (payload as any).quotedMessageId ||
            (payload as any)?.quotedMsg?.id || (msgContainer as any)?.contextInfo?.stanzaId || '',
          );
          const hit = pendings.find((p: any) =>
            (p.code && new RegExp(`(^|\\D)${p.code}(\\D|$)`).test(messageText)) ||
            (p.activation_message_id && quotedId && p.activation_message_id === quotedId));
          if (hit) {
            const lidDigits = counterpartPhone.replace(/\D/g, '');
            const realPhone = String(hit.phone).replace(/\D/g, '');
            await supabase.from('wa_lid_map')
              .upsert({ lid: lidDigits, phone: realPhone, connection_user_id: connectionUserId, source: 'activation' }, { onConflict: 'lid' });
            await supabase.from('wa_pending_activations')
              .update({ status: 'completed', completed_at: new Date().toISOString(), completed_lid: lidDigits })
              .eq('id', hit.id);
            await supabase.from('carmen_whatsapp_identities')
              .update({ verified_at: new Date().toISOString(), updated_at: new Date().toISOString() })
              .eq('tenant_id', tenantId)
              .eq('phone', realPhone)
              .eq('status', 'approved');
            console.log('[manus-wa] activation completed — LID mapped', { lid: lidDigits, phone: realPhone });
            // Confirm to the user through the standard send path (to the real phone).
            fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-manus-wa-message`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
              },
              body: JSON.stringify({
                integrationId: integ.id, tenantId, phoneNumber: realPhone,
                senderUserId: connectionUserId,
                message: 'מעולה, זיהיתי אותך ✅ מעכשיו אפשר לדבר איתי — פשוט תתחיל הודעה במילה "כרמן".',
              }),
            }).catch((e) => console.error('[manus-wa] activation confirm send failed:', e?.message));
            return ok({ received: true, activation: 'completed' });
          }
        }
      } catch (e) {
        console.error('[manus-wa] activation check failed (continuing):', String(e));
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
    // When the LID was already deterministically resolved (payload field / learned map),
    // the 2.6s pairing wait is pure latency — skip it. Pairing remains for unresolved LIDs
    // (it both fixes direction for own-outbound mirrors and feeds the learned map).
    if (!isOutgoingFromPhone && !isGroup && isLidEvent && messageText.trim() && !lidAutoResolved) {
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
        // AUTO LID LEARNING — a successful pairing proves lid↔phone; persist it so
        // future events (any tenant on this system) resolve without pairing or config.
        const learnedLid = fromRaw.split('@')[0].replace(/\D/g, '');
        if (learnedLid && learnedLid !== counterpartPhone.replace(/\D/g, '')) {
          supabase.from('wa_lid_map')
            .upsert({ lid: learnedLid, phone: counterpartPhone.replace(/\D/g, ''), connection_user_id: connectionUserId, source: 'green_api_pairing' }, { onConflict: 'lid' })
            .then(() => {}, () => {});
        }
      }
    }

    // Manus can emit phone-app messages as opaque @lid IDs instead of the real phone.
    // Resolve DETERMINISTICALLY only (payload real phone / carmen_lid_aliases /
    // wa_lid_map / single allowed phone). Never attribute an inbound LID to the
    // "freshest Carmen session" when multiple phones are authorized — that hijacked
    // Ana's private DMs into David's chat (reply "היי דוד" on David's thread).
    // fromMeFlag guard: when David sends OUTBOUND to a third party, the to-field is
    // already a real phone — do not overwrite it.
    if (!isGroup && !pairedFromGreenApi && isLidEvent && !fromMeFlag && !lidAutoResolved) {
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
        const lidAliases: Record<string, string> = (cfg.carmen_lid_aliases && typeof cfg.carmen_lid_aliases === 'object')
          ? cfg.carmen_lid_aliases
          : {};
        const lidKey = String(counterpartPhone || '').replace(/\D/g, '');

        let waLidMapPhone: string | null = null;
        if (lidKey) {
          const { data: knownLid } = await supabase
            .from('wa_lid_map')
            .select('phone')
            .eq('lid', lidKey)
            .maybeSingle();
          if (knownLid?.phone) waLidMapPhone = String(knownLid.phone).replace(/\D/g, '');
        }

        const resolved = resolveInboundLidToPhone({
          lidDigits: lidKey,
          lidAliases,
          waLidMapPhone,
          // Only use single-allowed fallback for specific_phone scope; otherwise leave unresolved
          allowedPhones: scopeMode === 'specific_phone' ? allowedPhones : (allowedPhones.length === 1 ? allowedPhones : []),
        });

        if (resolved.phone) {
          const aliasPhone = resolved.phone;
          counterpartPhone = aliasPhone;
          counterpartRaw = `${aliasPhone}@c.us`;
          normalized = normalizePhone(aliasPhone);
          // Inbound LID stays inbound — never flip to "manual outgoing" (that kept
          // replies on the operator/David thread after a wrong session attribution).
          if (shouldMarkResolvedLidAsOutgoing()) {
            isOutgoingFromPhone = true;
            sourcePhoneNumber = aliasPhone;
          }
          if (lidKey && lidKey !== aliasPhone) {
            supabase.from('wa_lid_map')
              .upsert(
                { lid: lidKey, phone: aliasPhone, connection_user_id: connectionUserId, source: resolved.reason },
                { onConflict: 'lid' },
              )
              .then(() => {}, () => {});
          }
          console.log('[manus-wa] resolved LID for Carmen direct flow', {
            fromRaw,
            aliasPhone,
            aliasReason: resolved.reason,
            scopeMode,
            manualLike: isOutgoingFromPhone,
          });
        } else {
          console.log('[manus-wa] LID unresolved (deterministic only — no session hijack)', {
            lid: lidKey,
            reason: resolved.reason,
            allowedCount: allowedPhones.length,
            preview: messageText.slice(0, 60),
          });
        }
      } catch (err) {
        console.error('[manus-wa] LID Carmen resolution failed:', err);
      }
    }

    // FALLBACK: still only deterministic. Session-based attribution removed — with
    // multiple authorized direct phones it routed Ana → David.
    const counterpartLooksLikeLid =
      !counterpartPhone ||
      counterpartPhone.replace(/\D/g, '') === fromDigits ||
      // Real IL mobiles are ~12 digits (9725…); WhatsApp LIDs are often 14+ (Ana's is 14).
      counterpartPhone.replace(/\D/g, '').length >= 14;
    if (!isGroup && isLidEvent && counterpartLooksLikeLid && messageText.trim() && !lidAutoResolved && !pairedFromGreenApi && !fromMeFlag) {
      try {
        const carmenAutomation = await findCarmenSessionAutomation(supabase, tenantId, integ.id, {
          isGroup: false,
          chatId: `${counterpartPhone || fromDigits}@c.us`,
          phoneNumber: counterpartPhone || fromDigits,
        });
        const cfg = carmenAutomation?.configuration || {};
        const allowedPhones = Array.isArray(cfg.carmen_allowed_phones)
          ? [...new Set(cfg.carmen_allowed_phones.map((p: any) => String(p).replace(/\D/g, '')).filter(Boolean))]
          : [];
        const lidAliases: Record<string, string> = (cfg.carmen_lid_aliases && typeof cfg.carmen_lid_aliases === 'object')
          ? cfg.carmen_lid_aliases
          : {};
        const lidKey = String(counterpartPhone || fromDigits || '').replace(/\D/g, '');
        let waLidMapPhone: string | null = null;
        if (lidKey) {
          const { data: knownLid } = await supabase
            .from('wa_lid_map')
            .select('phone')
            .eq('lid', lidKey)
            .maybeSingle();
          if (knownLid?.phone) waLidMapPhone = String(knownLid.phone).replace(/\D/g, '');
        }
        const resolved = resolveInboundLidToPhone({
          lidDigits: lidKey,
          lidAliases,
          waLidMapPhone,
          allowedPhones,
        });
        if (resolved.phone) {
          counterpartPhone = resolved.phone;
          counterpartRaw = `${resolved.phone}@c.us`;
          normalized = normalizePhone(resolved.phone);
          console.log('[manus-wa] LID fallback → deterministic resolve', {
            aliasPhone: resolved.phone, reason: resolved.reason, body: messageText.slice(0, 60),
          });
        } else {
          console.log('[manus-wa] LID fallback left unresolved (no session hijack)', {
            counterpartPhone, fromDigits, reason: resolved.reason, preview: messageText.slice(0, 60),
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
        const { data: wgRows } = await supabase
          .from('whatsapp_groups')
          .select('tenant_id')
          .eq('group_chat_id', groupChatId)
          .limit(10);
        const rows = wgRows || [];
        const ownRegistered = rows.some((r: any) => r.tenant_id === tenantId);
        if (!ownRegistered && rows.length > 0) {
          // The bot's own tenant has no whatsapp_groups claim here. A group is
          // often registered under ANOTHER tenant just because the operator's
          // green_api phone synced it (e.g. "דוד ואנה DMM" under MC) — that must
          // NOT steal events from a Carmen whose own tenant runs in
          // open-member-groups mode, where membership itself is the claim.
          // Route to the registered tenant only in the legacy shared-bot case.
          const { data: ownSteps } = await supabase
            .from('automation_flow_steps')
            .select('configuration')
            .eq('tenant_id', tenantId)
            .eq('step_type', 'trigger')
            .eq('action_type', 'carmen_whatsapp_session')
            .limit(10);
          const ownHasOpenMode = (ownSteps || []).some(
            (s: any) => s?.configuration?.carmen_open_member_groups === true,
          );
          if (!ownHasOpenMode) groupTenantId = rows[0].tenant_id as string;
        }
      } catch (_e) { /* fall back to bot tenant */ }
      if (groupTenantId !== tenantId) {
        console.log('[manus-wa group] routed by group → tenant', { groupChatId, botTenant: tenantId, groupTenant: groupTenantId });
      }

      const resolvedGroupMsg = await resolveMessageText(payload, msgContainer, { ...mediaAuth, tenantId: groupTenantId });
      const messageText = resolvedGroupMsg.messageText;
      const voiceMeta = resolvedGroupMsg.voiceMeta;
      const senderName = (payload.senderName || payload.fromName || payload.authorName || null) as string | null;

      // Extract the REAL sender phone from author/participant fields.
      // Falling back to fromRaw inside a group gives the group id (120363...@g.us) which is useless.
      const authorCandidates = [
        payload.author, payload.participant, payload.senderLid, key.participant,
        (msgContainer as any)?.participant, (msgContainer as any)?.author,
      ].filter((v: any) => typeof v === 'string' && v.includes('@')) as string[];
      // Prefer a real @c.us participant over an anonymous @lid author when both exist.
      const authorRaw =
        authorCandidates.find((c) => c.endsWith('@c.us')) ||
        authorCandidates.find((c) => !/@lid/i.test(c)) ||
        authorCandidates[0] ||
        '';
      let authorPhone = authorRaw ? authorRaw.split('@')[0].replace(/\D/g, '') : '';
      const lidDigitsForMap = /@lid/i.test(authorRaw)
        ? authorRaw.split('@')[0].replace(/\D/g, '')
        : '';

      // GROUP AUTHOR LID RESOLUTION — same layers as the private branch above.
      // The "כרמן" trigger comes from group MEMBERS, and members often arrive as
      // anonymous @lid authors; without resolution Carmen can't tell WHO in the
      // group is speaking. 1) real-phone payload fields → 2) learned wa_lid_map.
      // Payload resolutions are persisted so group traffic keeps teaching the map.
      if (/@lid/i.test(authorRaw) && authorPhone) {
        const lidDigits = authorPhone;
        const realCandidates = [payload.senderPn, payload.participantPn, payload.senderPhone, payload.senderNumber]
          .map((v: unknown) => String(v || '').split('@')[0].replace(/\D/g, ''))
          .filter((d: string) => d && d.length >= 9 && d.length <= 15 && d !== lidDigits);
        if (realCandidates.length > 0) {
          authorPhone = realCandidates[0];
          console.log('[manus-wa group] author LID resolved from payload field', { lid: lidDigits, phone: authorPhone });
          supabase.from('wa_lid_map')
            .upsert({ lid: lidDigits, phone: authorPhone, connection_user_id: connectionUserId, source: 'payload' }, { onConflict: 'lid' })
            .then(() => {}, () => {});
        } else {
          const { data: knownLid } = await supabase
            .from('wa_lid_map')
            .select('phone')
            .eq('lid', lidDigits)
            .maybeSingle();
          if (knownLid?.phone) {
            authorPhone = String(knownLid.phone).replace(/\D/g, '');
            console.log('[manus-wa group] author LID resolved from learned map', { lid: lidDigits, phone: authorPhone });
          }
        }
      }

      // Some Manus group events omit author/participant entirely, or deliver only
      // an unresolved @lid. Green API sees the same WhatsApp message with
      // senderData.sender, so reuse that canonical participant instead of passing
      // the group id (or LID digits) into the authorization layer. Prefer provider
      // message id; fall back to the same body within a short window for gateways
      // that use different ids. Wait briefly — Green API often arrives after Manus.
      if (isUnresolvedGroupAuthor(authorPhone, authorRaw, groupChatId)) {
        await new Promise((resolve) => setTimeout(resolve, 2600));
        try {
          const since = new Date(Date.now() - 2 * 60 * 1000).toISOString();
          const groupDigits = groupChatId.split('@')[0].replace(/\D/g, '');
          const { data: wgRow } = await supabase
            .from('whatsapp_groups')
            .select('id')
            .eq('tenant_id', groupTenantId)
            .eq('group_chat_id', groupChatId)
            .maybeSingle();
          const groupDbId = wgRow?.id as string | undefined;

          const basePairedQuery = () => {
            let q = supabase.from('chat_messages')
              .select('sender_phone, raw_provider_data, created_at')
              .eq('provider', 'green_api')
              .gte('created_at', since)
              .order('created_at', { ascending: false })
              .limit(10);
            if (groupDbId) q = q.eq('group_id', groupDbId);
            return q;
          };

          let pairedQuery = basePairedQuery();
          pairedQuery = messageId
            ? pairedQuery.eq('raw_provider_data->>idMessage', messageId)
            : pairedQuery.eq('message_text', messageText);
          let { data: paired } = await pairedQuery;
          if ((!paired || paired.length === 0) && messageText) {
            const fallback = await basePairedQuery().eq('message_text', messageText);
            paired = fallback.data;
          }
          for (const row of paired || []) {
            const participant = String(
              row?.raw_provider_data?.senderData?.sender || row?.sender_phone || '',
            ).split('@')[0].replace(/\D/g, '');
            if (
              participant &&
              participant !== groupDigits &&
              isIsraeliMobileTail(participant)
            ) {
              if (lidDigitsForMap && lidDigitsForMap !== participant) {
                supabase.from('wa_lid_map')
                  .upsert(
                    {
                      lid: lidDigitsForMap,
                      phone: participant,
                      connection_user_id: connectionUserId,
                      source: 'green_api_pair',
                    },
                    { onConflict: 'lid' },
                  )
                  .then(() => {}, () => {});
              }
              authorPhone = participant;
              console.log('[manus-wa group] author resolved from paired Green API event', {
                messageId, phone: authorPhone, lid: lidDigitsForMap || null,
              });
              break;
            }
          }
        } catch (err) {
          console.error('[manus-wa group] paired author resolution failed:', err);
        }
      }

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

      // Manus may redeliver the same group turn under a different provider id.
      // Claim a short-lived semantic fingerprint before Carmen runs so those
      // retries cannot produce two replies. Include the resolved author (or LID)
      // so two different people asking the same question remain independent.
      if (groupMessageInvokesCarmen(messageText)) {
        const fingerprintInput = [
          groupTenantId,
          groupChatId,
          authorPhone || authorRaw || 'unknown',
          messageText.trim().replace(/\s+/g, ' ').toLowerCase(),
        ].join('|');
        const digestBytes = await crypto.subtle.digest(
          'SHA-256',
          new TextEncoder().encode(fingerprintInput),
        );
        const digest = Array.from(new Uint8Array(digestBytes))
          .map((byte) => byte.toString(16).padStart(2, '0'))
          .join('');
        const minuteBucket = Math.floor(Date.now() / 60_000);
        const currentFingerprint = `${digest}:${minuteBucket}`;
        const previousFingerprint = `${digest}:${minuteBucket - 1}`;

        const { data: previousClaim } = await supabase
          .from('processed_webhook_messages')
          .select('external_message_id')
          .eq('provider', 'carmen_group_turn')
          .eq('tenant_id', groupTenantId)
          .eq('external_message_id', previousFingerprint)
          .maybeSingle();
        if (previousClaim) {
          console.log('[manus-wa group] semantic duplicate dropped', {
            groupChatId,
            authorPhone,
            messageId,
          });
          return ok({ received: true, duplicate: true, dedup: 'group_fingerprint' });
        }

        const { error: fingerprintError } = await supabase
          .from('processed_webhook_messages')
          .insert({
            provider: 'carmen_group_turn',
            tenant_id: groupTenantId,
            external_message_id: currentFingerprint,
          });
        if ((fingerprintError as any)?.code === '23505') {
          console.log('[manus-wa group] semantic duplicate dropped', {
            groupChatId,
            authorPhone,
            messageId,
          });
          return ok({ received: true, duplicate: true, dedup: 'group_fingerprint' });
        }
        if (fingerprintError) {
          console.error('[manus-wa group] semantic dedup claim failed (continuing):', fingerprintError);
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
          sourceChannel: 'own_instance',
          isVoiceMessage: messageIsVoice(payload, msgContainer, resolvedGroupMsg),
          sendVoice: makeVoiceSender(groupTenantId),
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
      raw_provider_data: { ...(payload || {}), _voice: voiceMeta },
    });

    if (insertError) {
      console.error('Failed to insert chat_messages:', insertError);
      throw insertError;
    }

    // ===== Carmen WhatsApp session handling =====
    // Private replies stay in the originating counterpart chat (Ana→Ana, David→David).
    // Paired Green-API operator mirrors reply to the operator phone. Never fall back
    // to a hardcoded David chat when the inbound sender is someone else.
    const privateTarget = pickPrivateCarmenTarget({
      pairedFromGreenApi,
      sourcePhoneNumber,
      counterpartPhone,
      isOutgoingFromPhone,
    });
    const carmenTargetPhone = privateTarget.phone || counterpartPhone;
    const chatIdForCarmen = privateTarget.chatId || `${carmenTargetPhone}@c.us`;
    const senderName = (payload.senderName || payload.fromName || null) as string | null;

    // OUTBOUND-TO-THIRD-PARTY GUARD: David's phone is the Manus gateway, so every
    // outbound message he sends to any contact flows through this webhook. If the
    // message is outbound, has no trigger keyword, and there is no existing Carmen
    // session for this specific chat, Carmen must not respond.
    if (isOutgoingFromPhone && !pairedFromGreenApi && !isGroup) {
      const { data: existingCarmenSession } = await supabase
        .from('carmen_whatsapp_sessions')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('status', 'active')
        .eq('connection_user_id', connectionUserId)
        .eq('chat_id', chatIdForCarmen)
        .maybeSingle();
      const guard = outboundThirdPartyGuardDecision({
        isOutgoingFromPhone,
        pairedFromGreenApi,
        isGroup,
        messageText,
        hasActiveSessionForChat: !!existingCarmenSession,
      });
      if (guard === 'skip') {
        console.log('[manus-wa] outbound-to-third-party: no trigger keyword + no active carmen session → skip', {
          chatIdForCarmen, carmenTargetPhone, bodyPreview: String(messageText).slice(0, 60),
        });
        return ok({ received: true, ignored: 'outbound_third_party' });
      }
    }

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
        sourceChannel: 'own_instance',
        isVoiceMessage: messageIsVoice(payload, msgContainer, resolvedMsg),
        sendVoice: makeVoiceSender(tenantId),
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
