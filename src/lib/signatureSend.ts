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
  /** Public https URL. null omits the logo. */
  logoUrl?: string | null;
  emailSubject?: string;
  emailBody?: string;
  emailColors?: {
    headerColor?: string;
    headerText?: string;
    buttonColor?: string;
    buttonText?: string;
    pageBackground?: string;
    cardBackground?: string;
    textColor?: string;
  };
  fieldMap?: Record<string, string>;
  fieldRequired?: Record<string, boolean>;
}

export interface SendSignatureResult {
  documentId: string;
  signingLinks: SigningLinkResult[];
  emailSent: boolean;
  partial?: boolean;
}

const SIGNATURE_ERROR_MESSAGES: Record<string, string> = {
  signature_access_denied: "אין גישה למסמך — רענן את העמוד או החלף ארגון ונסה שוב",
  document_not_signable: "המסמך לא זמין לשליחה (כבר נשלח, הושלם או בוטל)",
  missing_fields: "חסרים שם או אימייל לחותם",
  missing_document_id: "לא נמצא מסמך לשליחה",
  unauthorized: "יש להתחבר מחדש ולנסות שוב",
};

function humanizeSignatureError(raw: string | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (SIGNATURE_ERROR_MESSAGES[trimmed]) return SIGNATURE_ERROR_MESSAGES[trimmed];
  if (trimmed.includes("row-level security") || trimmed.includes("violates row-level security")) {
    return "אין הרשאה לשמור או לשלוח מסמך בארגון הנוכחי — רענן את העמוד ונסה שוב";
  }
  if (trimmed.includes("new row violates")) {
    return "שמירת המסמך נכשלה — בדוק שאתה בארגון הנכון ונסה שוב";
  }
  return trimmed;
}

function parseInvokeError(data: unknown, error: Error | null): string | null {
  if (data && typeof data === "object" && "error" in data && data.error) {
    return humanizeSignatureError(String(data.error));
  }
  return humanizeSignatureError(error?.message ?? null);
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
    logoUrl,
    emailSubject,
    emailBody,
    emailColors,
    fieldMap,
    fieldRequired,
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
          logoUrl,
          emailSubject,
          emailBody,
          emailColors,
          fieldMap,
          fieldRequired,
        }
      : {
          documentId,
          baseUrl: window.location.origin,
          sendEmail,
          recipient,
          contactDetails,
          leadId,
          clientId,
          logoUrl,
          emailSubject,
          emailBody,
          emailColors,
          fieldMap,
          fieldRequired,
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
