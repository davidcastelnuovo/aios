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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Only http(s) image URLs are embedded in the signing email. */
export function safeLogoUrl(url?: string | null): string | null {
  if (!url?.trim()) return null;
  try {
    const parsed = new URL(url.trim());
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

export function buildSigningEmailHtml(opts: {
  recipientName: string;
  documentTitle: string;
  signingUrl: string;
  senderName?: string;
  logoUrl?: string | null;
}): string {
  const recipientName = escapeHtml(opts.recipientName);
  const documentTitle = escapeHtml(opts.documentTitle);
  const signingUrl = escapeHtml(opts.signingUrl);
  const senderName = opts.senderName ? escapeHtml(opts.senderName) : '';
  const logoUrl = safeLogoUrl(opts.logoUrl);
  const logo = logoUrl
    ? `<img src="${escapeHtml(logoUrl)}" alt="" width="140" style="display:block;margin:0 auto 16px;max-width:160px;height:auto;border:0;" />`
    : '';
  return `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: Arial, Helvetica, sans-serif; background-color: #f5f5f5; margin: 0; padding: 0;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f5f5;padding:20px 0;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;background-color:#ffffff;">
        <tr>
          <td align="center" bgcolor="#1d4ed8" style="background-color:#1d4ed8;padding:28px 24px;">
            ${logo}
            <h1 style="color:#ffffff;margin:0;font-size:22px;font-family:Arial,Helvetica,sans-serif;font-weight:bold;">בקשה לחתימה דיגיטלית</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 24px;font-family:Arial,Helvetica,sans-serif;" align="right">
            <p style="font-size:17px;color:#333333;margin:0 0 12px;">שלום ${recipientName},</p>
            <p style="font-size:15px;color:#555555;line-height:1.6;margin:0 0 24px;">
              ${senderName ? `${senderName} שלח/ה לך` : 'נשלח לך'} מסמך לחתימה דיגיטלית:
              <strong>${documentTitle}</strong>
            </p>
            <table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:0 auto 24px;">
              <tr>
                <td align="center" bgcolor="#2563eb" style="background-color:#2563eb;border-radius:8px;">
                  <a href="${signingUrl}" style="display:inline-block;padding:14px 32px;color:#ffffff;text-decoration:none;font-size:16px;font-weight:bold;font-family:Arial,Helvetica,sans-serif;">לחץ כאן לחתימה</a>
                </td>
              </tr>
            </table>
            <p style="font-size:13px;color:#888888;word-break:break-all;margin:0;">או העתק את הקישור: ${signingUrl}</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

async function resolveSignatureEmailLogo(
  supabase: SupabaseClient,
  tenantId: string,
  logoUrl?: string | null,
): Promise<string | null> {
  if (logoUrl === null || logoUrl === '') return null;
  if (logoUrl) return safeLogoUrl(logoUrl);
  const { data } = await supabase
    .from('tenant_settings')
    .select('setting_value')
    .eq('tenant_id', tenantId)
    .eq('setting_key', 'branding')
    .maybeSingle();
  const stored = (data?.setting_value as { logoUrl?: string } | null)?.logoUrl;
  return safeLogoUrl(stored);
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
    sendEmail?: boolean;
    requireEmailSuccess?: boolean;
    /** undefined uses the tenant brand logo. null or "" sends no logo. */
    logoUrl?: string | null;
  },
): Promise<{ sent: number; results: Array<{ email: string; ok: boolean; error?: string }> }> {
  const { documentId, tenantId, baseUrl, senderName, sendEmail = true, requireEmailSuccess = true, logoUrl } = opts;

  const { data: doc, error: docError } = await supabase
    .from('signature_documents')
    .select('id, title, status, tenant_id')
    .eq('id', documentId)
    .eq('tenant_id', tenantId)
    .maybeSingle();
  if (docError || !doc) throw new Error('מסמך חתימה לא נמצא');
  if (!['draft', 'pending', 'partially_signed'].includes(doc.status)) throw new Error('document_not_signable');

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
      .eq('id', documentId)
      .eq('status', 'draft');
    if (statusError) throw statusError;
  }

  const origin = safeOrigin(baseUrl);
  const emailLogoUrl = await resolveSignatureEmailLogo(supabase, tenantId, logoUrl);
  const results: Array<{ email: string; ok: boolean; error?: string }> = [];

  for (const recipient of recipients) {
    const signingUrl = `${origin}/sign/${recipient.sign_token}`;

    await supabase.rpc('log_signature_event', {
      _document_id: documentId,
      _recipient_id: recipient.id,
      _event_type: 'sent',
      _ip: null,
      _metadata: { email: recipient.email, channel: sendEmail ? 'email' : 'link' },
    });

    if (!sendEmail) {
      results.push({ email: recipient.email, ok: false, error: 'skipped' });
      continue;
    }

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
          logoUrl: emailLogoUrl,
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
  if (sendEmail && requireEmailSuccess && sent === 0 && results.length > 0) {
    throw new Error(`שליחת מייל חתימה נכשלה: ${results[0].error || 'unknown'}`);
  }

  return { sent, results };
}

export interface SignatureSigningLink {
  name: string;
  email: string;
  url: string;
  phone?: string;
}

export async function prepareSignatureDocumentForSigning(
  supabase: SupabaseClient,
  opts: {
    documentId: string;
    tenantId: string;
    createdBy: string;
    baseUrl?: string;
    recipient?: { name: string; email: string; phone?: string };
    leadId?: string;
    clientId?: string;
    contactDetails?: {
      name?: string;
      companyName?: string;
      firstName?: string;
      lastName?: string;
      phone?: string;
      address?: string;
      idNumber?: string;
    };
  },
): Promise<{ documentId: string; signingLinks: SignatureSigningLink[] }> {
  const { documentId, tenantId, createdBy, baseUrl, recipient, leadId, clientId, contactDetails } = opts;

  const { data: doc, error: docError } = await supabase
    .from('signature_documents')
    .select('*')
    .eq('id', documentId)
    .eq('tenant_id', tenantId)
    .maybeSingle();
  if (docError || !doc) throw new Error('מסמך לא נמצא');
  if (!['draft', 'pending', 'partially_signed'].includes(doc.status)) throw new Error('document_not_signable');
  const effectiveTenantId = doc.tenant_id as string;

  let targetDocId = documentId;

  if (doc.is_template) {
    if (!recipient?.name?.trim() || !recipient?.email?.trim()) {
      throw new Error('יש להזין שם ואימייל לחותם');
    }
    targetDocId = await cloneSignatureFromTemplate(supabase, {
      templateDocumentId: documentId,
      tenantId: effectiveTenantId,
      createdBy,
      recipientName: recipient.name.trim(),
      recipientEmail: recipient.email.trim(),
      leadId,
      clientId,
      contactDetails: contactDetails ?? { phone: recipient.phone },
    });
  } else {
    const { data: existingRecipients, error: recError } = await supabase
      .from('signature_recipients')
      .select('id')
      .eq('document_id', targetDocId);
    if (recError) throw recError;

    if (!existingRecipients?.length) {
      if (!recipient?.name?.trim() || !recipient?.email?.trim()) {
        throw new Error('אין חותמים במסמך — הזן שם ואימייל לחותם');
      }
      const sigField = Array.isArray(doc.document_fields)
        ? doc.document_fields.find((f: { type?: string }) => f.type === 'signature' || f.type === 'signature_stamp')
        : null;
      const position = sigField?.position ?? null;
      const fieldPrefill = buildFieldPrefillFromContact(
        doc.document_fields,
        { ...contactDetails, name: recipient.name, phone: contactDetails?.phone ?? recipient.phone },
        0,
      );

      const recipientRow = {
        document_id: targetDocId,
        tenant_id: effectiveTenantId,
        name: recipient.name.trim(),
        email: recipient.email.trim(),
        sign_order: 1,
        signature_position: position,
        role: 'signer',
        field_values: fieldPrefill,
      };
      let { error: insertError } = await supabase.from('signature_recipients').insert(recipientRow);
      if (insertError?.message?.includes('field_values')) {
        const { field_values: _fv, ...withoutFieldValues } = recipientRow;
        insertError = (await supabase.from('signature_recipients').insert(withoutFieldValues)).error;
      }
      if (insertError?.message?.includes('signature_position')) {
        const { signature_position: _sp, field_values: _fv, ...minimal } = recipientRow;
        insertError = (await supabase.from('signature_recipients').insert(minimal)).error;
      }
      if (insertError) throw insertError;
    }
  }

  await sendSignatureDocumentEmails(supabase, {
    documentId: targetDocId,
    tenantId: effectiveTenantId,
    baseUrl,
    sendEmail: false,
    requireEmailSuccess: false,
  });

  const { data: recipients, error: fetchError } = await supabase
    .from('signature_recipients')
    .select('name, email, sign_token')
    .eq('document_id', targetDocId)
    .order('sign_order');
  if (fetchError) throw fetchError;
  if (!recipients?.length) throw new Error('אין חותמים במסמך');

  const origin = safeOrigin(baseUrl);
  const phone = recipient?.phone ?? contactDetails?.phone;

  return {
    documentId: targetDocId,
    signingLinks: recipients.map((r) => ({
      name: r.name,
      email: r.email,
      url: `${origin}/sign/${r.sign_token}`,
      phone,
    })),
  };
}

function buildFieldPrefillFromContact(
  documentFields: unknown,
  contact: {
    name?: string;
    companyName?: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    address?: string;
    idNumber?: string;
  },
  recipientIndex = 0,
): Record<string, string> {
  if (!Array.isArray(documentFields)) return {};
  const typeToValue: Record<string, string | undefined> = {
    first_name: contact.firstName,
    last_name: contact.lastName,
    full_name: contact.name || [contact.firstName, contact.lastName].filter(Boolean).join(' ') || undefined,
    company_name: contact.companyName,
    phone: contact.phone,
    address: contact.address,
    id_number: contact.idNumber,
  };
  const prefill: Record<string, string> = {};
  for (const field of documentFields) {
    if (!field || typeof field !== 'object') continue;
    const f = field as { id?: string; type?: string; recipient_index?: number };
    if ((f.recipient_index ?? 0) !== recipientIndex) continue;
    if (!f.id || !f.type || f.type === 'signature' || f.type === 'signature_stamp' || f.type === 'date') continue;
    const val = typeToValue[f.type];
    if (val?.trim()) prefill[f.id] = val.trim();
  }
  return prefill;
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
    leadId?: string;
    clientId?: string;
    contactDetails?: {
      name?: string;
      companyName?: string;
      firstName?: string;
      lastName?: string;
      phone?: string;
      address?: string;
      idNumber?: string;
    };
  },
): Promise<string> {
  const {
    templateDocumentId,
    tenantId,
    createdBy,
    recipientName,
    recipientEmail,
    documentTitle,
    leadId,
    clientId,
    contactDetails,
  } = opts;

  const { data: source, error: sourceError } = await supabase
    .from('signature_documents')
    .select('*')
    .eq('id', templateDocumentId)
    .eq('tenant_id', tenantId)
    .maybeSingle();
  if (sourceError || !source) throw new Error('מסמך לא נמצא');
  const effectiveTenantId = (source.tenant_id as string) || tenantId;

  const isReusable = source.is_template === true || source.status === 'draft';
  if (!isReusable) {
    throw new Error('ניתן לשלוח רק מתבנית או מסמך שמור (טיוטה)');
  }
  if (!source.file_url && !source.content) {
    throw new Error('למסמך אין קובץ או תוכן לשליחה');
  }

  const template = source;

  const { data: templateRecipients } = await supabase
    .from('signature_recipients')
    .select('signature_position, sign_order, role')
    .eq('document_id', templateDocumentId)
    .order('sign_order');

  const position = templateRecipients?.[0]?.signature_position
    ?? (Array.isArray(template.document_fields)
      ? template.document_fields.find((f: { type?: string }) => f.type === 'signature' || f.type === 'signature_stamp')?.position
      : null)
    ?? null;

  let businessStampName: string | null = null;
  let businessStampCompanyId: string | null = null;
  if (clientId) {
    const { data: client } = await supabase.from('clients').select('name').eq('id', clientId).maybeSingle();
    businessStampName = client?.name ?? null;
  } else if (leadId) {
    const { data: lead } = await supabase
      .from('leads')
      .select('company_name, contact_name')
      .eq('id', leadId)
      .maybeSingle();
    businessStampName = lead?.company_name || lead?.contact_name || null;
  }
  if (contactDetails?.companyName) businessStampName = contactDetails.companyName;
  if (contactDetails?.idNumber) businessStampCompanyId = contactDetails.idNumber;

  const insertPayload = {
    tenant_id: effectiveTenantId,
    title: documentTitle || template.title,
    content: template.content,
    file_url: template.file_url,
    document_type: template.document_type,
    status: 'draft',
    created_by: createdBy,
    is_template: false,
    document_fields: template.document_fields ?? [],
    lead_id: leadId ?? null,
    client_id: clientId ?? null,
    business_stamp_name: businessStampName,
    business_stamp_company_id: businessStampCompanyId,
  };

  let docResult = await supabase.from('signature_documents').insert(insertPayload).select('id').single();
  if (docResult.error?.message?.includes('document_fields')) {
    const { document_fields: _df, ...withoutFields } = insertPayload;
    docResult = await supabase.from('signature_documents').insert(withoutFields).select('id').single();
  }
  if (
    docResult.error?.message?.includes('lead_id')
    || docResult.error?.message?.includes('client_id')
    || docResult.error?.message?.includes('business_stamp')
  ) {
    const {
      document_fields: _df,
      lead_id: _l,
      client_id: _c,
      business_stamp_name: _bn,
      business_stamp_company_id: _bc,
      ...minimal
    } = insertPayload;
    docResult = await supabase.from('signature_documents').insert(minimal).select('id').single();
  }
  const doc = docResult.data;
  const docError = docResult.error;
  if (docError || !doc) throw docError || new Error('יצירת מסמך נכשלה');

  const fieldPrefill = buildFieldPrefillFromContact(template.document_fields, { ...contactDetails, name: recipientName, companyName: businessStampName ?? undefined }, 0);

  const recipientRow = {
    document_id: doc.id,
    tenant_id: effectiveTenantId,
    name: recipientName,
    email: recipientEmail,
    sign_order: 1,
    signature_position: position,
    role: templateRecipients?.[0]?.role || 'signer',
    field_values: fieldPrefill,
  };
  let { error: recError } = await supabase.from('signature_recipients').insert(recipientRow);
  if (recError?.message?.includes('field_values')) {
    const { field_values: _fv, ...withoutFieldValues } = recipientRow;
    recError = (await supabase.from('signature_recipients').insert(withoutFieldValues)).error;
  }
  if (recError?.message?.includes('signature_position')) {
    const { signature_position: _sp, field_values: _fv, ...minimal } = recipientRow;
    recError = (await supabase.from('signature_recipients').insert(minimal)).error;
  }
  if (recError) throw recError;

  return doc.id;
}

function safeStorageFileName(title: string): string {
  const base = title.replace(/[/\\]/g, '_').replace(/[^a-zA-Z0-9_-]/g, '_').replace(/_+/g, '_').slice(0, 40);
  return (base || 'signed_document') + '.pdf';
}

export async function saveSignedPdfToEntity(
  supabase: SupabaseClient,
  opts: {
    documentId: string;
    tenantId: string;
    signedStoragePath: string;
    title: string;
    leadId?: string | null;
    clientId?: string | null;
  },
): Promise<boolean> {
  const { documentId, tenantId, signedStoragePath, title, leadId, clientId } = opts;
  if (!leadId && !clientId) return false;

  const { data: fileData, error: downloadError } = await supabase.storage
    .from('signature-documents')
    .download(signedStoragePath);
  if (downloadError || !fileData) throw downloadError || new Error('failed_to_download_signed_pdf');

  const entityType = leadId ? 'lead' : 'client';
  const entityId = leadId || clientId!;
  const attachPath = `${tenantId}/${entityType}/${entityId}/${Date.now()}_${safeStorageFileName(title)}`;

  const { error: uploadError } = await supabase.storage
    .from('entity-attachments')
    .upload(attachPath, fileData, { contentType: 'application/pdf', upsert: false });
  if (uploadError) throw uploadError;

  const newAttachment = {
    name: `${title} (חתום).pdf`,
    path: attachPath,
    type: 'application/pdf',
    size: fileData.size,
    uploaded_at: new Date().toISOString(),
  };

  const table = leadId ? 'leads' : 'clients';
  const { data: entity, error: entityError } = await supabase
    .from(table)
    .select('attachments')
    .eq('id', entityId)
    .maybeSingle();
  if (entityError || !entity) throw entityError || new Error('entity_not_found');

  const existing = Array.isArray(entity.attachments) ? entity.attachments : [];
  const { error: updateError } = await supabase
    .from(table)
    .update({
      attachments: [...existing, newAttachment],
      updated_at: new Date().toISOString(),
    })
    .eq('id', entityId);
  if (updateError) throw updateError;

  await supabase
    .from('signature_documents')
    .update({ saved_to_entity_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', documentId);

  return true;
}
