import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const DEFAULT_FROM_EMAIL = Deno.env.get('RESEND_FROM_EMAIL') ?? 'noreply@aios.co.il';
const DEFAULT_FROM_NAME = Deno.env.get('RESEND_FROM_NAME') ?? 'AIOS';
const DEFAULT_BASE_URL = Deno.env.get('APP_BASE_URL') ?? 'https://aios.co.il';

export function safeOrigin(baseUrl?: string): string {
  const fallback = DEFAULT_BASE_URL;
  if (!baseUrl) return fallback;
  try {
    return new URL(baseUrl).origin;
  } catch {
    return baseUrl.split('/').slice(0, 3).join('/');
  }
}

export function buildSigningEmailHtml(opts: {
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

export async function resolveTenantOwnerId(supabase: SupabaseClient, tenantId: string): Promise<string> {
  const { data: role } = await supabase
    .from('user_roles')
    .select('user_id')
    .eq('tenant_id', tenantId)
    .in('role', ['owner', 'super_admin', 'agency_owner'])
    .limit(1)
    .maybeSingle();
  if (role?.user_id) return role.user_id;

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('tenant_id', tenantId)
    .limit(1)
    .maybeSingle();
  if (!profile?.id) throw new Error('לא נמצא משתמש ליצירת מסמך חתימה');
  return profile.id;
}

export async function sendSignatureDocumentEmails(
  supabase: SupabaseClient,
  opts: {
    documentId: string;
    tenantId: string;
    baseUrl?: string;
    senderName?: string;
  },
): Promise<{ sent: number; results: Array<{ email: string; ok: boolean; error?: string }> }> {
  const { documentId, tenantId, baseUrl, senderName } = opts;

  const { data: doc, error: docError } = await supabase
    .from('signature_documents')
    .select('id, title, status')
    .eq('id', documentId)
    .eq('tenant_id', tenantId)
    .maybeSingle();
  if (docError || !doc) throw new Error('מסמך חתימה לא נמצא');

  const { data: recipients, error: recError } = await supabase
    .from('signature_recipients')
    .select('id, name, email, sign_token')
    .eq('document_id', documentId)
    .order('sign_order');
  if (recError) throw recError;
  if (!recipients?.length) throw new Error('אין חותמים במסמך');

  if (doc.status === 'draft') {
    const { error: statusError } = await supabase
      .from('signature_documents')
      .update({ status: 'pending', updated_at: new Date().toISOString() })
      .eq('id', documentId);
    if (statusError) throw statusError;
  }

  const origin = safeOrigin(baseUrl);
  const results: Array<{ email: string; ok: boolean; error?: string }> = [];

  for (const recipient of recipients) {
    const signingUrl = `${origin}/sign/${recipient.sign_token}`;

    await supabase.rpc('log_signature_event', {
      _document_id: documentId,
      _recipient_id: recipient.id,
      _event_type: 'sent',
      _ip: null,
      _metadata: { email: recipient.email, channel: 'email' },
    });

    if (!RESEND_API_KEY) {
      results.push({ email: recipient.email, ok: false, error: 'resend_not_configured' });
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
    results.push({
      email: recipient.email,
      ok: res.ok,
      error: res.ok ? undefined : JSON.stringify(json),
    });
  }

  const sent = results.filter((r) => r.ok).length;
  if (sent === 0 && results.length > 0) {
    throw new Error(`שליחת מייל חתימה נכשלה: ${results[0].error || 'unknown'}`);
  }

  return { sent, results };
}

export async function cloneSignatureFromTemplate(
  supabase: SupabaseClient,
  opts: {
    templateDocumentId: string;
    tenantId: string;
    createdBy: string;
    recipientName: string;
    recipientEmail: string;
    documentTitle?: string;
  },
): Promise<string> {
  const { templateDocumentId, tenantId, createdBy, recipientName, recipientEmail, documentTitle } = opts;

  const { data: template, error: templateError } = await supabase
    .from('signature_documents')
    .select('*')
    .eq('id', templateDocumentId)
    .eq('tenant_id', tenantId)
    .eq('is_template', true)
    .maybeSingle();
  if (templateError || !template) throw new Error('תבנית חתימה לא נמצאה');

  const { data: templateRecipients } = await supabase
    .from('signature_recipients')
    .select('signature_position, sign_order, role')
    .eq('document_id', templateDocumentId)
    .order('sign_order');

  const position = templateRecipients?.[0]?.signature_position ?? null;

  const { data: doc, error: docError } = await supabase
    .from('signature_documents')
    .insert({
      tenant_id: tenantId,
      title: documentTitle || template.title,
      content: template.content,
      file_url: template.file_url,
      document_type: template.document_type,
      status: 'draft',
      created_by: createdBy,
      is_template: false,
    })
    .select('id')
    .single();
  if (docError || !doc) throw docError || new Error('יצירת מסמך נכשלה');

  const { error: recError } = await supabase.from('signature_recipients').insert({
    document_id: doc.id,
    tenant_id: tenantId,
    name: recipientName,
    email: recipientEmail,
    sign_order: 1,
    signature_position: position,
    role: templateRecipients?.[0]?.role || 'signer',
  });
  if (recError) throw recError;

  return doc.id;
}
