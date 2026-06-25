// resend-webhook — receives Resend (Svix-signed) email events and updates the
// matching broadcast_recipients row by provider_message_id (= Resend email id),
// then recomputes the broadcast's aggregate stats.
//
// Events handled: email.sent, email.delivered, email.opened, email.clicked,
//                 email.bounced, email.complained (spam → opt-out).
//
// Deploy WITHOUT JWT verification (Resend calls it directly):
//   supabase functions deploy resend-webhook --no-verify-jwt
// Set RESEND_WEBHOOK_SECRET (whsec_...) to enable signature verification.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const SB_URL = Deno.env.get('SUPABASE_URL')!;
const SB_SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const WEBHOOK_SECRET = Deno.env.get('RESEND_WEBHOOK_SECRET') ?? '';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

// Svix signature verification (Resend uses Svix). Signed content: `${id}.${ts}.${body}`.
async function verifySvix(secret: string, id: string, ts: string, body: string, sigHeader: string): Promise<boolean> {
  try {
    const key = secret.startsWith('whsec_') ? secret.slice(6) : secret;
    const keyBytes = Uint8Array.from(atob(key), (c) => c.charCodeAt(0));
    const cryptoKey = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const sig = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(`${id}.${ts}.${body}`));
    const expected = btoa(String.fromCharCode(...new Uint8Array(sig)));
    // Header is space-separated list of "v1,<base64sig>"
    return sigHeader.split(' ').some((p) => (p.includes(',') ? p.split(',')[1] : p) === expected);
  } catch {
    return false;
  }
}

async function recomputeStats(db: any, broadcastId: string) {
  const c = async (apply: (q: any) => any) => {
    let q = db.from('broadcast_recipients').select('id', { count: 'exact', head: true }).eq('broadcast_id', broadcastId);
    q = apply(q);
    const { count } = await q;
    return count ?? 0;
  };
  const [total, sent, delivered, failed, opened, clicked] = await Promise.all([
    c((q: any) => q),
    c((q: any) => q.not('sent_at', 'is', null)),
    c((q: any) => q.not('delivered_at', 'is', null)),
    c((q: any) => q.eq('status', 'failed')),
    c((q: any) => q.not('opened_at', 'is', null)),
    c((q: any) => q.not('clicked_at', 'is', null)),
  ]);
  await db.from('broadcasts').update({ stats: { total, sent, delivered, failed, opened, clicked } }).eq('id', broadcastId);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok');
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  try {
    const raw = await req.text();

    if (WEBHOOK_SECRET) {
      const id = req.headers.get('svix-id') || '';
      const ts = req.headers.get('svix-timestamp') || '';
      const sig = req.headers.get('svix-signature') || '';
      if (!id || !ts || !sig || !(await verifySvix(WEBHOOK_SECRET, id, ts, raw, sig))) {
        return json({ error: 'invalid_signature' }, 401);
      }
    }

    const event = JSON.parse(raw);
    const type: string = event?.type || '';
    const emailId: string | undefined = event?.data?.email_id || event?.data?.id;
    const at = event?.created_at || new Date().toISOString();
    if (!emailId) return json({ ok: true, skipped: 'no_email_id' });

    const db = createClient(SB_URL, SB_SERVICE, { auth: { persistSession: false } });
    const { data: r } = await db
      .from('broadcast_recipients')
      .select('id, broadcast_id, tenant_id, email, status')
      .eq('provider_message_id', emailId)
      .maybeSingle();
    if (!r) return json({ ok: true, skipped: 'recipient_not_found' });

    const patch: any = {};
    switch (type) {
      case 'email.sent':       if (!r.status || r.status === 'pending') patch.status = 'sent'; patch.sent_at = at; break;
      case 'email.delivered':  patch.delivered_at = at; patch.status = 'delivered'; break;
      case 'email.opened':     patch.opened_at = at; break;
      case 'email.clicked':    patch.clicked_at = at; if (!('opened_at' in patch)) patch.opened_at = at; break;
      case 'email.bounced':    patch.status = 'failed'; patch.error = 'bounced'; break;
      case 'email.complained':
        patch.status = 'opted_out';
        if (r.email) {
          await db.from('broadcast_opt_outs').upsert(
            { tenant_id: r.tenant_id, email: r.email, channel: 'email', source: 'spam_complaint' },
            { onConflict: 'tenant_id,email,channel', ignoreDuplicates: true },
          );
        }
        break;
      default: return json({ ok: true, skipped: type });
    }

    await db.from('broadcast_recipients').update(patch).eq('id', r.id);
    await recomputeStats(db, r.broadcast_id);
    return json({ ok: true, type });
  } catch (e: any) {
    console.error('[resend-webhook]', e);
    return json({ error: String(e?.message || e) }, 500);
  }
});
