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

async function prepareDirectClientSide(
  opts: SendSignatureOptions & { tenantId: string },
): Promise<SendSignatureResult> {
  const { documentId, tenantId, recipient, contactDetails } = opts;
  const origin = window.location.origin;

  const { data: doc, error: docError } = await supabase
    .from("signature_documents")
    .select("id, document_fields, status")
    .eq("id", documentId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (docError || !doc) throw new Error("מסמך לא נמצא");

  const { data: existing } = await supabase
    .from("signature_recipients")
    .select("id, name, email, sign_token")
    .eq("document_id", documentId);

  if (!existing?.length) {
    const fields = Array.isArray(doc.document_fields) ? doc.document_fields : [];
    const sigField = fields.find((f: { type?: string }) => f.type === "signature") as { position?: unknown } | undefined;
    const { error: insertError } = await supabase.from("signature_recipients").insert({
      document_id: documentId,
      tenant_id: tenantId,
      name: recipient.name.trim(),
      email: recipient.email.trim(),
      sign_order: 1,
      signature_position: sigField?.position ?? null,
      role: "signer",
    });
    if (insertError) throw insertError;
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
  if (!error && !data?.error) {
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
    throw new Error(data?.error || error?.message || "שגיאה בשליחה — נדרש deploy של send-signature-from-template");
  }

  const { data: tenantData } = await supabase.auth.getUser();
  const tenantId =
    opts.tenantId ??
    (await supabase.rpc("get_user_tenant_id", { _user_id: tenantData.user?.id ?? "" })).data as string | null;
  if (!tenantId) throw new Error(data?.error || error?.message || "שגיאה בשליחה");

  const prepared = await prepareDirectClientSide({ ...opts, tenantId });
  if (sendEmail) {
    const { data: emailData, error: emailError } = await supabase.functions.invoke("send-signature-request", {
      body: { documentId: prepared.documentId, baseUrl: window.location.origin, sendEmail: true },
    });
    if (!emailError && !emailData?.error) {
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
