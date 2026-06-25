// send-resend-email — sends a single email via the Resend API.
// Pure sender: builds no audience and writes no rows; callers (broadcast-dispatch
// or a test invocation) own status tracking. Requires the RESEND_API_KEY secret.
//
// Body: { to, subject, html?, text?, fromEmail?, fromName?, replyTo?,
//         headers?: Record<string,string>, tags?: {name,value}[] }
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
// Verified sending domain is aios.co.il — override per-call or via RESEND_FROM_EMAIL.
const DEFAULT_FROM_EMAIL = Deno.env.get('RESEND_FROM_EMAIL') ?? 'noreply@aios.co.il';
const DEFAULT_FROM_NAME = Deno.env.get('RESEND_FROM_NAME') ?? 'AfterLead';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    if (!req.headers.get('Authorization')) {
      return new Response(JSON.stringify({ error: 'missing_authorization' }), { status: 401, headers: corsHeaders });
    }
    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: 'resend_not_configured', details: 'RESEND_API_KEY secret is missing' }), { status: 400, headers: corsHeaders });
    }

    const { to, subject, html, text, fromEmail, fromName, replyTo, headers, tags } = await req.json();
    if (!to || !subject || (!html && !text)) {
      return new Response(JSON.stringify({ error: 'missing_fields', details: 'to, subject and html|text are required' }), { status: 400, headers: corsHeaders });
    }

    const from = `${fromName || DEFAULT_FROM_NAME} <${fromEmail || DEFAULT_FROM_EMAIL}>`;
    const payload: any = { from, to: Array.isArray(to) ? to : [to], subject };
    if (html) payload.html = html;
    if (text) payload.text = text;
    if (replyTo) payload.reply_to = replyTo;
    if (headers && typeof headers === 'object') payload.headers = headers;
    if (Array.isArray(tags)) payload.tags = tags;

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      return new Response(JSON.stringify({ error: 'resend_error', details: json }), { status: 502, headers: corsHeaders });
    }
    return new Response(JSON.stringify({ success: true, id: json?.id }), { status: 200, headers: corsHeaders });
  } catch (e: any) {
    console.error('[send-resend-email]', e);
    return new Response(JSON.stringify({ error: String(e?.message || e) }), { status: 500, headers: corsHeaders });
  }
});
