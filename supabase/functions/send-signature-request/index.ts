import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';
import { corsHeaders } from '../_shared/cors.ts';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const DEFAULT_FROM_EMAIL = Deno.env.get('RESEND_FROM_EMAIL') ?? 'noreply@aios.co.il';
const DEFAULT_FROM_NAME = Deno.env.get('RESEND_FROM_NAME') ?? 'AIOS';

interface SendSignatureRequest {
  documentId: string;
  baseUrl?: string;
}

function safeOrigin(baseUrl?: string): string {
  const fallback = 'https://aios.co.il';
  if (!baseUrl) return fallback;
  try {
    return new URL(baseUrl).origin;
  } catch {
    return baseUrl.split('/').slice(0, 3).join('/');
  }
}

function buildSigningEmailHtml(opts: {
  recipientName: string;
  documentTitle: string;
  signingUrl: string;
  senderName?: string;
}): string {
  const { recipientName, documentTitle, signingUrl, senderName } = opts;
  return `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: Arial, sans-serif; background-color: #f5f5f5; margin: 0; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
    <div style="background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); padding: 28px; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 22px;">✍️ בקשה לחתימה דיגיטלית</h1>
    </div>
    <div style="padding: 28px;">
      <p style="font-size: 17px; color: #333;">שלום ${recipientName},</p>
      <p style="font-size: 15px; color: #555; line-height: 1.6;">
        ${senderName ? `${senderName} שלח/ה לך` : 'נשלח לך'} מסמך לחתימה דיגיטלית:
        <strong>${documentTitle}</strong>
      </p>
      <div style="text-align: center; margin: 28px 0;">
        <a href="${signingUrl}" style="display: inline-block; background: #2563eb; color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: bold;">
          לחץ כאן לחתימה
        </a>
      </div>
      <p style="font-size: 13px; color: #888; word-break: break-all;">או העתק את הקישור: ${signingUrl}</p>
    </div>
  </div>
</body>
</html>`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: corsHeaders });
    }

    const { documentId, baseUrl }: SendSignatureRequest = await req.json();
    if (!documentId) {
      return new Response(JSON.stringify({ error: 'missing_document_id' }), { status: 400, headers: corsHeaders });
    }

    const { data: tenantId } = await supabase.rpc('get_user_tenant_id', { _user_id: user.id });
    if (!tenantId) {
      return new Response(JSON.stringify({ error: 'no_tenant' }), { status: 403, headers: corsHeaders });
    }

    const { data: doc, error: docError } = await supabase
      .from('signature_documents')
      .select('id, title, status, tenant_id, created_by')
      .eq('id', documentId)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (docError || !doc) {
      return new Response(JSON.stringify({ error: 'document_not_found' }), { status: 404, headers: corsHeaders });
    }

    const { data: recipients, error: recError } = await supabase
      .from('signature_recipients')
      .select('id, name, email, sign_token, status')
      .eq('document_id', documentId)
      .order('sign_order');

    if (recError) throw recError;
    if (!recipients?.length) {
      return new Response(JSON.stringify({ error: 'no_recipients' }), { status: 400, headers: corsHeaders });
    }

    const { error: statusError } = await supabase
      .from('signature_documents')
      .update({ status: 'pending', updated_at: new Date().toISOString() })
      .eq('id', documentId);
    if (statusError) throw statusError;

    const origin = safeOrigin(baseUrl);
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    let senderName: string | undefined;
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .maybeSingle();
    senderName = profile?.full_name || undefined;

    const emailResults: Array<{ email: string; ok: boolean; error?: string }> = [];

    for (const recipient of recipients) {
      const signingUrl = `${origin}/sign/${recipient.sign_token}`;

      await serviceClient.rpc('log_signature_event', {
        _document_id: documentId,
        _recipient_id: recipient.id,
        _event_type: 'sent',
        _ip: null,
        _metadata: { email: recipient.email, channel: 'email' },
      });

      if (!RESEND_API_KEY) {
        emailResults.push({ email: recipient.email, ok: false, error: 'resend_not_configured' });
        continue;
      }

      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: `${DEFAULT_FROM_NAME} <${DEFAULT_FROM_EMAIL}>`,
          to: [recipient.email],
          subject: `בקשה לחתימה: ${doc.title}`,
          html: buildSigningEmailHtml({
            recipientName: recipient.name,
            documentTitle: doc.title,
            signingUrl,
            senderName,
          }),
        }),
      });

      const json = await res.json().catch(() => ({}));
      emailResults.push({
        email: recipient.email,
        ok: res.ok,
        error: res.ok ? undefined : JSON.stringify(json),
      });
    }

    const allFailed = emailResults.every((r) => !r.ok);
    const anySent = emailResults.some((r) => r.ok);

    return new Response(
      JSON.stringify({
        success: !allFailed,
        partial: anySent && !emailResults.every((r) => r.ok),
        emails: emailResults,
        signingLinks: recipients.map((r) => ({
          name: r.name,
          email: r.email,
          url: `${origin}/sign/${r.sign_token}`,
        })),
      }),
      { status: 200, headers: corsHeaders },
    );
  } catch (e: unknown) {
    console.error('[send-signature-request]', e);
    const message = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: corsHeaders });
  }
});
