import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { handleCarmenMessage } from '../_shared/carmen.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-wa-gateway-instance, x-wa-gateway-secret, x-webhook-secret, x-manus-secret, x-webhook-signature',
};

// Last 9 digits — matches existing lead/client matching policy
function normalizePhone(p: string): string {
  return (p || '').replace(/\D/g, '').slice(-9);
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

    const normalizedEvent =
      outer.event ?? inner.event ?? outer.type ?? inner.type ?? outer.messageType ?? inner.messageType ?? 'message';
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
    const isGroup = fromRaw.endsWith('@g.us') || toRaw.endsWith('@g.us');

    // Outbound detection: prefer explicit flags from Manus, then fall back to phone comparison
    const myPhone = (settings.phone_number || '').toString().replace(/\D/g, '');
    const fromDigits = fromRaw.split('@')[0].replace(/\D/g, '');
    const fromMeFlag = payload.fromMe === true || payload.fromMe === 'true' ||
                       payload.direction === 'outgoing' || payload.direction === 'outbound';
    const isOutgoingFromPhone = fromMeFlag || (!!myPhone && fromDigits === myPhone);

    const counterpartRaw = isOutgoingFromPhone ? toRaw : fromRaw;
    const counterpartPhone = counterpartRaw.split('@')[0];
    const normalized = normalizePhone(counterpartPhone);

    // Group messages: skip client/lead matching & chat_messages insert, but still let Carmen respond in-group.
    if (isGroup) {
      const groupChatId = fromRaw.endsWith('@g.us') ? fromRaw : toRaw;
      const messageText = payload.body || (payload.hasMedia ? '[מדיה]' : '');
      const senderName = (payload.senderName || payload.fromName || payload.authorName || null) as string | null;
      // For groups, the sender's own phone is in `author` (e.g. "972501234567@c.us"); fall back to fromRaw.
      const authorRaw = String(payload.author || payload.participant || fromRaw);
      const authorPhone = authorRaw.split('@')[0];

      let carmenOutcome: string | null = null;
      try {
        const result = await handleCarmenMessage({
          supabase,
          tenantId,
          integrationId: integ.id,
          connectionUserId,
          chatId: groupChatId,
          phoneNumber: authorPhone,
          senderName,
          messageText,
          isIncoming: !isOutgoingFromPhone,
          isManualOutgoing: isOutgoingFromPhone,
          isGroup: true,
          sendMessage: async (_chatId: string, message: string) => {
            try {
              const baseUrl = 'https://whatsappgw-pzpyrrww.manus.space';
              const settingsAny = (integ.settings as any) || {};
              const instanceId = settingsAny.instance_id;
              const apiKey = integ.api_key;
              if (!instanceId || !apiKey) return false;
              const res = await fetch(`${baseUrl}/api/v1/instances/${instanceId}/send/group`, {
                method: 'POST',
                headers: { 'X-Api-Key': apiKey, 'Content-Type': 'application/json' },
                body: JSON.stringify({ groupId: groupChatId, body: message }),
              });
              return res.ok;
            } catch (err) {
              console.error('manus-wa Carmen group sendMessage error:', err);
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
    const messageId = String(payload.id || '');
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

    const messageText = payload.body || (payload.hasMedia ? '[מדיה]' : '');

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
    // Build a chat_id compatible with Carmen session lookup (matches "<phone>@c.us" convention).
    const chatIdForCarmen = `${counterpartPhone}@c.us`;
    const senderName = (payload.senderName || payload.fromName || null) as string | null;

    let carmenOutcome: string | null = null;
    try {
      const result = await handleCarmenMessage({
        supabase,
        tenantId,
        integrationId: integ.id,
        connectionUserId,
        chatId: chatIdForCarmen,
        phoneNumber: counterpartPhone,
        senderName,
        messageText,
        isIncoming: !isOutgoingFromPhone,
        isManualOutgoing: isOutgoingFromPhone,
        isGroup: false,
        sendMessage: async (_chatId: string, message: string) => {
          try {
            const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
            const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
            const res = await fetch(`${supabaseUrl}/functions/v1/send-manus-wa-message`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${serviceKey}`,
              },
              body: JSON.stringify({
                integration_id: integ.id,
                tenant_id: tenantId,
                phone: counterpartPhone,
                message,
              }),
            });
            return res.ok;
          } catch (err) {
            console.error('manus-wa Carmen sendMessage error:', err);
            return false;
          }
        },
      });
      if (result.handled) carmenOutcome = result.outcome;
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
