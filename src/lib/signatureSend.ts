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
    companyName?: string;
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

  throw new Error(invokeError || "לא ניתן להכין קישור לחתימה");
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
  if (!links[0]?.url) throw new Error("לא נוצר קישור לחתימה");
  await copySigningUrl(links[0].url);
  return true;
}
