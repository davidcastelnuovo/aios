import { supabase } from "@/integrations/supabase/client";
import { buildWhatsAppSignUrl, copySigningUrl } from "@/lib/signatureShare";

export interface SigningLinkResult {
  name: string;
  email: string;
  url: string;
  phone?: string;
}

export interface SendSignatureOptions {
  documentId: string;
  documentTitle: string;
  isTemplate?: boolean;
  mode?: "direct" | "template";
  sendEmail: boolean;
  recipient: { name: string; email: string; phone?: string };
  contactDetails?: {
    firstName?: string;
    lastName?: string;
    phone?: string;
    address?: string;
    idNumber?: string;
  };
  leadId?: string;
  clientId?: string;
  documentTitleOverride?: string;
}

export interface SendSignatureResult {
  documentId: string;
  signingLinks: SigningLinkResult[];
  emailSent: boolean;
  partial?: boolean;
}

type SignatureDocRow = {
  id: string;
  tenant_id: string;
  status: string;
  document_fields?: unknown;
};

async function fetchSignatureDocument(docId: string): Promise<SignatureDocRow> {
  let result = await supabase
    .from("signature_documents")
    .select("id, tenant_id, status, document_fields")
    .eq("id", docId)
    .maybeSingle();

  if (result.error?.message?.includes("document_fields")) {
    result = await supabase
      .from("signature_documents")
      .select("id, tenant_id, status")
      .eq("id", docId)
      .maybeSingle();
    if (result.data) {
      return { ...result.data, document_fields: [] };
    }
  }

  if (result.error) throw new Error(result.error.message);
  if (!result.data) throw new Error("מסמך לא נמצא");
  return result.data as SignatureDocRow;
}

async function insertRecipientWithFallback(
  row: Record<string, unknown>,
): Promise<void> {
  let { error } = await supabase.from("signature_recipients").insert(row);
  if (error?.message?.includes("field_values")) {
    const { field_values: _fv, ...withoutFieldValues } = row;
    error = (await supabase.from("signature_recipients").insert(withoutFieldValues)).error;
  }
  if (error?.message?.includes("signature_position")) {
    const { signature_position: _sp, field_values: _fv, ...minimal } = row;
    error = (await supabase.from("signature_recipients").insert(minimal)).error;
  }
  if (error) throw error;
}

async function prepareDirectClientSide(
  opts: SendSignatureOptions,
): Promise<SendSignatureResult> {
  const { documentId, recipient, contactDetails } = opts;
  const origin = window.location.origin;

  const doc = await fetchSignatureDocument(documentId);
  const tenantId = doc.tenant_id;

  const { data: existing } = await supabase
    .from("signature_recipients")
    .select("id, name, email, sign_token")
    .eq("document_id", documentId);

  if (!existing?.length) {
    const fields = Array.isArray(doc.document_fields) ? doc.document_fields : [];
    const sigField = fields.find((f: { type?: string }) => f.type === "signature") as { position?: unknown } | undefined;
    await insertRecipientWithFallback({
      document_id: documentId,
      tenant_id: tenantId,
      name: recipient.name.trim(),
      email: recipient.email.trim(),
      sign_order: 1,
      signature_position: sigField?.position ?? null,
      role: "signer",
    });
  }

  if (doc.status === "draft") {
    await supabase
      .from("signature_documents")
      .update({ status: "pending", updated_at: new Date().toISOString() })
      .eq("id", documentId);
  }

  const { data: recipients, error: fetchError } = await supabase
    .from("signature_recipients")
    .select("name, email, sign_token")
    .eq("document_id", documentId)
    .order("sign_order");
  if (fetchError) throw fetchError;
  if (!recipients?.length) throw new Error("אין חותמים במסמך");

  const phone = recipient.phone ?? contactDetails?.phone;
  return {
    documentId,
    signingLinks: recipients.map((r) => ({
      name: r.name,
      email: r.email,
      url: `${origin}/sign/${r.sign_token}`,
      phone,
    })),
    emailSent: false,
  };
}

function parseInvokeError(data: unknown, error: Error | null): string | null {
  if (data && typeof data === "object" && "error" in data && data.error) {
    return String(data.error);
  }
  return error?.message ?? null;
}

/** Prepare signing links without sending email/WhatsApp. */
export async function prepareSigningLinks(
  opts: SendSignatureOptions & { tenantId?: string },
): Promise<SendSignatureResult> {
  return sendSignatureDocument({ ...opts, sendEmail: false });
}

export async function sendSignatureDocument(
  opts: SendSignatureOptions & { tenantId?: string },
): Promise<SendSignatureResult> {
  const {
    documentId,
    mode = opts.isTemplate ? "template" : "direct",
    sendEmail,
    recipient,
    contactDetails,
    leadId,
    clientId,
    documentTitleOverride,
  } = opts;

  const functionName = mode === "template" ? "send-signature-from-template" : "send-signature-request";
  const body =
    mode === "template"
      ? {
          templateDocumentId: documentId,
          recipientName: recipient.name.trim(),
          recipientEmail: recipient.email.trim(),
          documentTitle: documentTitleOverride,
          baseUrl: window.location.origin,
          sendEmail,
          contactDetails,
          leadId,
          clientId,
        }
      : {
          documentId,
          baseUrl: window.location.origin,
          sendEmail,
          recipient,
          contactDetails,
          leadId,
          clientId,
        };

  const { data, error } = await supabase.functions.invoke(functionName, { body });
  const invokeError = parseInvokeError(data, error);
  if (!invokeError) {
    return {
      documentId: data.documentId ?? documentId,
      signingLinks: (data.signingLinks ?? []).map((l: SigningLinkResult) => ({
        ...l,
        phone: l.phone ?? recipient.phone ?? contactDetails?.phone,
      })),
      emailSent: !!data.emailSent,
      partial: data.partial,
    };
  }

  if (mode === "template") {
    throw new Error(invokeError || "שגיאה בשליחה — נדרש deploy של send-signature-from-template");
  }

  const prepared = await prepareDirectClientSide(opts);
  if (sendEmail) {
    const { data: emailData, error: emailError } = await supabase.functions.invoke("send-signature-request", {
      body: { documentId: prepared.documentId, baseUrl: window.location.origin, sendEmail: true },
    });
    const emailInvokeError = parseInvokeError(emailData, emailError);
    if (!emailInvokeError) {
      return {
        ...prepared,
        emailSent: !!emailData.emailSent,
        partial: emailData.partial,
      };
    }
  }
  return prepared;
}

export function openWhatsAppForLinks(
  links: SigningLinkResult[],
  documentTitle?: string,
): { opened: number; skipped: number } {
  let opened = 0;
  let skipped = 0;
  for (const link of links) {
    const waUrl = buildWhatsAppSignUrl({
      phone: link.phone,
      signingUrl: link.url,
      recipientName: link.name,
      documentTitle,
    });
    if (waUrl) {
      window.open(waUrl, "_blank", "noopener,noreferrer");
      opened++;
    } else {
      skipped++;
    }
  }
  return { opened, skipped };
}

export async function copyFirstSigningLink(links: SigningLinkResult[]): Promise<boolean> {
  if (!links[0]?.url) return false;
  await copySigningUrl(links[0].url);
  return true;
}
