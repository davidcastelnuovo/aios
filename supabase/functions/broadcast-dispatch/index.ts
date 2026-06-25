// broadcast-dispatch — time-bounded, throttled sender for the broadcast module.
// Designed to be called repeatedly (every minute by pg_cron). Each invocation:
//   1. promotes due 'scheduled' broadcasts to 'sending'
//   2. for each 'sending' broadcast, sends a small paced batch of pending recipients
//      (jittered gap between sends = anti-ban), respecting daily_cap
//   3. marks a broadcast 'sent' once no pending recipients remain
//
// Sending strategy:
//   - text  → reuse send-green-api-message / send-manus-wa-message (service role)
//   - image → manus: reuse send-manus-wa-file ; green_api: call Green API sendFileByUrl
//             directly (the green file function requires a real user, not service role)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};

const SB_URL = Deno.env.get('SUPABASE_URL')!;
const SB_SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const MAX_RUN_MS = 90_000; // stay well under the edge function execution limit
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function jitter(minS: number, maxS: number, seed: number): number {
  const lo = Math.max(1, minS || 1);
  const hi = Math.max(lo, maxS || lo);
  // Deterministic-ish jitter without Math.random (varies per recipient via seed)
  const frac = ((seed * 2654435761) % 1000) / 1000;
  return Math.round((lo + frac * (hi - lo)) * 1000);
}

function applyVars(template: string, r: any): string {
  if (!template) return '';
  return template
    .replace(/\{\{\s*contact_name\s*\}\}/g, r.contact_name || '')
    .replace(/\{\{\s*name\s*\}\}/g, r.contact_name || '')
    .replace(/\{\{\s*phone\s*\}\}/g, r.phone || '');
}

async function invokeEdgeFn(name: string, payload: any) {
  const res = await fetch(`${SB_URL}/functions/v1/${name}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SB_SERVICE}`,
      'Content-Type': 'application/json',
      apikey: SB_SERVICE,
    },
    body: JSON.stringify(payload),
  });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, json };
}

// Direct Green API image send (sendFileByUrl) — used because send-green-api-file needs a user token.
async function greenApiSendImage(
  db: any,
  integrationId: string,
  tenantId: string,
  senderUserId: string,
  chatPhone: string,
  imageUrl: string,
  caption: string,
) {
  const { data: integ } = await db
    .from('tenant_integrations')
    .select('api_key, settings')
    .eq('id', integrationId)
    .maybeSingle();
  if (!integ?.api_key || !integ?.settings?.instance_id) {
    return { ok: false, json: { error: 'green_api_not_configured' } };
  }
  const instanceId = integ.settings.instance_id;
  const apiToken = integ.api_key;
  const cc = String(integ.settings.country_code || integ.settings.default_country_code || '972');
  let digits = String(chatPhone).replace(/[^0-9]/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (!digits.startsWith(cc)) digits = digits.startsWith('0') ? cc + digits.slice(1) : cc + digits;
  const chatId = `${digits}@c.us`;

  const url = `https://api.green-api.com/waInstance${instanceId}/sendFileByUrl/${apiToken}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chatId, urlFile: imageUrl, fileName: 'image.jpg', caption }),
  });
  const json = await res.json().catch(() => ({}));
  if (res.ok) {
    await db.from('chat_messages').insert({
      tenant_id: tenantId,
      connection_user_id: senderUserId,
      sent_by_user_id: senderUserId,
      message_text: caption || '[תמונה]',
      direction: 'outbound',
      channel: 'whatsapp',
      provider: 'green_api',
      sender_phone: digits,
      raw_provider_data: json,
    });
  }
  return { ok: res.ok, json };
}

async function sendOne(db: any, b: any, r: any): Promise<{ ok: boolean; messageId?: string; error?: string }> {
  const body = applyVars(b.body_text || '', r);
  const hasMedia = !!b.media_url;
  const senderUserId = b.created_by;

  if (!senderUserId) return { ok: false, error: 'missing_created_by' };
  if (!r.phone) return { ok: false, error: 'missing_phone' };

  try {
    if (b.provider === 'manus_wa') {
      if (hasMedia) {
        const res = await invokeEdgeFn('send-manus-wa-file', {
          phoneNumber: r.phone, imageUrl: b.media_url, caption: body,
          tenantId: b.tenant_id, integrationId: b.integration_id, senderUserId,
        });
        return res.ok ? { ok: true, messageId: res.json?.messageId } : { ok: false, error: JSON.stringify(res.json).slice(0, 300) };
      }
      const res = await invokeEdgeFn('send-manus-wa-message', {
        phoneNumber: r.phone, message: body, tenantId: b.tenant_id,
        integrationId: b.integration_id, senderUserId,
      });
      return res.ok ? { ok: true, messageId: res.json?.messageId } : { ok: false, error: JSON.stringify(res.json).slice(0, 300) };
    }

    // green_api
    if (hasMedia) {
      const res = await greenApiSendImage(db, b.integration_id, b.tenant_id, senderUserId, r.phone, b.media_url, body);
      return res.ok ? { ok: true, messageId: res.json?.idMessage } : { ok: false, error: JSON.stringify(res.json).slice(0, 300) };
    }
    const res = await invokeEdgeFn('send-green-api-message', {
      phoneNumber: r.phone, message: body, tenantId: b.tenant_id, senderUserId,
    });
    return res.ok ? { ok: true, messageId: res.json?.messageId } : { ok: false, error: JSON.stringify(res.json).slice(0, 300) };
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e).slice(0, 300) };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const startedAt = Date.now();
  try {
    const db = createClient(SB_URL, SB_SERVICE, { auth: { persistSession: false } });
    const nowIso = new Date().toISOString();
    const startOfDayIso = nowIso.slice(0, 10) + 'T00:00:00.000Z';

    // 1) Promote due scheduled broadcasts → sending
    await db
      .from('broadcasts')
      .update({ status: 'sending', started_at: nowIso })
      .eq('status', 'scheduled')
      .lte('scheduled_at', nowIso);

    // 2) Pull active sending broadcasts (cap a few per invocation)
    const { data: sending } = await db
      .from('broadcasts')
      .select('*')
      .eq('status', 'sending')
      .order('started_at', { ascending: true })
      .limit(5);

    const summary: any[] = [];

    for (const b of sending || []) {
      if (Date.now() - startedAt > MAX_RUN_MS) break;

      // Daily cap: how many already sent today for this broadcast
      const { count: sentToday } = await db
        .from('broadcast_recipients')
        .select('id', { count: 'exact', head: true })
        .eq('broadcast_id', b.id)
        .gte('sent_at', startOfDayIso);
      let remainingCap = Math.max(0, (b.daily_cap ?? 300) - (sentToday ?? 0));

      // Any pending left at all?
      const { count: pendingCount } = await db
        .from('broadcast_recipients')
        .select('id', { count: 'exact', head: true })
        .eq('broadcast_id', b.id)
        .eq('status', 'pending');

      if ((pendingCount ?? 0) === 0) {
        await db.from('broadcasts').update({ status: 'sent', completed_at: nowIso }).eq('id', b.id);
        summary.push({ id: b.id, done: true });
        continue;
      }
      if (remainingCap <= 0) {
        summary.push({ id: b.id, capped: true });
        continue;
      }

      let sentThisRun = 0;
      let idx = 0;
      while (Date.now() - startedAt < MAX_RUN_MS && remainingCap > 0) {
        const { data: batch } = await db
          .from('broadcast_recipients')
          .select('*')
          .eq('broadcast_id', b.id)
          .eq('status', 'pending')
          .order('created_at', { ascending: true })
          .limit(1);
        const r = (batch || [])[0];
        if (!r) break;

        const result = await sendOne(db, b, r);
        if (result.ok) {
          await db.from('broadcast_recipients').update({
            status: 'sent', sent_at: new Date().toISOString(),
            provider_message_id: result.messageId || null,
            attempts: (r.attempts || 0) + 1,
          }).eq('id', r.id);
          sentThisRun++;
          remainingCap--;
        } else {
          await db.from('broadcast_recipients').update({
            status: 'failed', error: result.error || 'send_failed',
            attempts: (r.attempts || 0) + 1,
          }).eq('id', r.id);
        }

        idx++;
        // Pace the next send (skip the wait after the last allowed one)
        if (remainingCap > 0 && Date.now() - startedAt < MAX_RUN_MS) {
          await sleep(jitter(b.throttle_min_seconds, b.throttle_max_seconds, idx + Math.floor(startedAt / 1000)));
        }
      }

      // Refresh aggregate stats
      const { count: totalCnt } = await db.from('broadcast_recipients').select('id', { count: 'exact', head: true }).eq('broadcast_id', b.id);
      const { count: sentCnt } = await db.from('broadcast_recipients').select('id', { count: 'exact', head: true }).eq('broadcast_id', b.id).in('status', ['sent', 'delivered', 'read']);
      const { count: failCnt } = await db.from('broadcast_recipients').select('id', { count: 'exact', head: true }).eq('broadcast_id', b.id).eq('status', 'failed');
      const { count: stillPending } = await db.from('broadcast_recipients').select('id', { count: 'exact', head: true }).eq('broadcast_id', b.id).eq('status', 'pending');

      const update: any = { stats: { total: totalCnt ?? 0, sent: sentCnt ?? 0, failed: failCnt ?? 0 } };
      if ((stillPending ?? 0) === 0) { update.status = 'sent'; update.completed_at = new Date().toISOString(); }
      await db.from('broadcasts').update(update).eq('id', b.id);

      summary.push({ id: b.id, sentThisRun, remainingPending: stillPending ?? 0 });
    }

    return new Response(JSON.stringify({ success: true, processed: summary.length, summary }), { status: 200, headers: corsHeaders });
  } catch (e: any) {
    console.error('[broadcast-dispatch]', e);
    return new Response(JSON.stringify({ error: String(e?.message || e) }), { status: 500, headers: corsHeaders });
  }
});
