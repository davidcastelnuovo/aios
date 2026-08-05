export const DEFAULT_META_GRAPH_VERSION = "v25.0";

export type MetaWhatsAppSessionInfo = {
  waba_id?: string;
  waba_ids?: string[];
  phone_number_id?: string;
  business_id?: string;
};

export type MetaWhatsAppMessage = Record<string, any> & {
  id?: string;
  from?: string;
  to?: string;
  timestamp?: string;
  type?: string;
};

export function digitsOnly(value: unknown): string {
  return String(value ?? "").replace(/\D/g, "");
}

export function normalizedPhoneCandidates(value: unknown): string[] {
  const digits = digitsOnly(value).replace(/^00/, "");
  if (!digits) return [];
  const candidates = new Set([digits]);
  if (digits.startsWith("972")) candidates.add(`0${digits.slice(3)}`);
  if (digits.startsWith("0")) candidates.add(`972${digits.slice(1)}`);
  if (digits.length >= 9) candidates.add(digits.slice(-9));
  return [...candidates].filter(Boolean);
}

/** Payload/id from a quick-reply / interactive button tap (for opt-in matching). */
export function inboundButtonPayload(message: MetaWhatsAppMessage): string | null {
  const type = String(message.type ?? "");
  if (type === "button") {
    const payload = String(message.button?.payload ?? "").trim();
    if (payload) return payload;
    const text = String(message.button?.text ?? "").trim();
    return text || null;
  }
  if (type === "interactive") {
    const id = String(message.interactive?.button_reply?.id ?? "").trim();
    if (id) return id;
    const title = String(message.interactive?.button_reply?.title ?? "").trim();
    return title || null;
  }
  return null;
}

export const LEAD_OPTIN_BUTTON_PAYLOAD = "LEAD_OPTIN_YES";
export const LEAD_OPTIN_TEMPLATE_NAME = "lead_optin_confirm_he";
export const DEFAULT_LEAD_OPTIN_BODY =
  "היי, לקבלת לידים ועדכונים מהמערכת שלנו, נא לאשר קבלת לידים מהמספר הזה.";
export const DEFAULT_LEAD_OPTIN_BUTTON_TEXT = "אני מאשר/ת קבלת לידים";
export const DEFAULT_LEAD_THANKS_TEXT =
  "תודה שפניתם אלינו. זהו מספר טלפון לשליחת לידים ועדכונים. תודה שאישרתם קבלת לידים.";

export function messageText(message: MetaWhatsAppMessage): string {
  const type = String(message.type ?? "unknown");
  if (type === "text") return String(message.text?.body ?? "");
  if (type === "button") return String(message.button?.text ?? "");
  if (type === "interactive") {
    return String(
      message.interactive?.button_reply?.title ??
        message.interactive?.list_reply?.title ??
        "[הודעה אינטראקטיבית]",
    );
  }
  const caption = message[type]?.caption;
  if (caption) return String(caption);
  const labels: Record<string, string> = {
    audio: "[הודעת קול]",
    image: "[תמונה]",
    video: "[וידאו]",
    document: "[מסמך]",
    sticker: "[מדבקה]",
    location: "[מיקום]",
    contacts: "[איש קשר]",
    reaction: "[תגובה]",
    media_placeholder: "[מדיה מהיסטוריית WhatsApp]",
  };
  return labels[type] ?? `[הודעת WhatsApp מסוג ${type}]`;
}

export function collectWebhookMessages(value: Record<string, any>, field: string) {
  const businessPhone = digitsOnly(value.metadata?.display_phone_number);
  const messages: Array<{
    message: MetaWhatsAppMessage;
    direction: "inbound" | "outbound";
    peerPhone: string;
    source: "live" | "echo" | "history";
  }> = [];

  for (const message of value.messages ?? []) {
    const from = digitsOnly(message.from);
    const historyOutbound = field === "history" && Boolean(businessPhone && from === businessPhone);
    messages.push({
      message,
      direction: historyOutbound ? "outbound" : "inbound",
      peerPhone: historyOutbound ? digitsOnly(message.to) : from,
      source: field === "history" ? "history" : "live",
    });
  }

  for (const message of value.message_echoes ?? []) {
    messages.push({
      message,
      direction: "outbound",
      peerPhone: digitsOnly(message.to),
      source: "echo",
    });
  }

  for (const chunk of value.history ?? []) {
    for (const thread of chunk.threads ?? []) {
      for (const message of thread.messages ?? []) {
        const from = digitsOnly(message.from);
        const outbound = Boolean(businessPhone && from === businessPhone);
        messages.push({
          message,
          direction: outbound ? "outbound" : "inbound",
          peerPhone: outbound ? digitsOnly(message.to ?? thread.id) : from || digitsOnly(thread.id),
          source: "history",
        });
      }
    }
  }

  return messages.filter((item) => item.message.id && item.peerPhone);
}

export function isCoexistenceFinishEvent(event: unknown): boolean {
  return event === "FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING";
}

const PLACEHOLDER_PATTERN = /\{\{[^}]+\}\}/g;

/**
 * Drops the lines of a template parameter whose placeholders resolve to nothing, so a
 * lead that arrives without, say, a company name yields no line at all rather than a
 * dangling "חברה:" label or a literal {{lead_company}} in the delivered message.
 */
export function dropUnresolvedTemplateLines(raw: string, resolve: (line: string) => string): string {
  return String(raw ?? "")
    .split(/\r?\n/)
    .filter((line) => {
      if (!PLACEHOLDER_PATTERN.test(line)) {
        PLACEHOLDER_PATTERN.lastIndex = 0;
        return true;
      }
      PLACEHOLDER_PATTERN.lastIndex = 0;
      const withoutPlaceholders = line.replace(PLACEHOLDER_PATTERN, "").trim();
      const resolved = resolve(line).replace(PLACEHOLDER_PATTERN, "").trim();
      return resolved !== withoutPlaceholders;
    })
    .join("\n");
}

const TEMPLATE_PARAMETER_MAX_LENGTH = 1024;
const EMPTY_TEMPLATE_PARAMETER_PLACEHOLDER = "-";

/**
 * Meta rejects a template body parameter that is empty ((#131008) Required parameter
 * is missing) or that contains newlines, tabs or 4+ consecutive spaces ((#132018)).
 * A lead with no answers to the screening questions is a normal case, so an empty
 * value is replaced with a placeholder rather than failing the whole send.
 */
export function sanitizeTemplateParameter(value: unknown): string {
  const cleaned = String(value ?? "")
    .replace(/[\r\n\t]+/g, " • ")
    .replace(/(?:•\s*){2,}/g, "• ")
    .replace(/\s{2,}/g, " ")
    .replace(/^\s*•\s*/, "")
    .replace(/\s*•\s*$/, "")
    .trim();
  if (!cleaned) return EMPTY_TEMPLATE_PARAMETER_PLACEHOLDER;
  if (cleaned.length <= TEMPLATE_PARAMETER_MAX_LENGTH) return cleaned;
  return `${cleaned.slice(0, TEMPLATE_PARAMETER_MAX_LENGTH - 1)}…`;
}

/**
 * Renders what a template send actually said, so the chat thread shows the message
 * rather than a bare template name. Returns null when the body cannot be resolved.
 */
export async function renderTemplateText(
  wabaId: string,
  templateName: string,
  language: string,
  parameters: string[],
  accessToken: string,
  graphVersion: string,
): Promise<string | null> {
  if (!wabaId || !templateName) return null;
  try {
    const url = new URL(`https://graph.facebook.com/${graphVersion}/${wabaId}/message_templates`);
    url.searchParams.set("name", templateName);
    url.searchParams.set("fields", "name,language,components");
    url.searchParams.set("limit", "20");
    const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!response.ok) return null;
    const payload = await response.json();
    const templates: MetaWhatsAppMessage[] = Array.isArray(payload?.data) ? payload.data : [];
    const template =
      templates.find((item) => item.name === templateName && item.language === language) ??
      templates.find((item) => item.name === templateName);
    const components: MetaWhatsAppMessage[] = Array.isArray(template?.components) ? template.components : [];
    const text = components
      .filter((component) => ["HEADER", "BODY", "FOOTER"].includes(String(component.type ?? "")))
      .map((component) => String(component.text ?? ""))
      .filter(Boolean)
      .join("\n\n")
      .replace(/\{\{(\d+)\}\}/g, (placeholder, position) => parameters[Number(position) - 1] ?? placeholder)
      .trim();
    return text || null;
  } catch {
    return null;
  }
}

export type MetaDeliveryStatus = "sent" | "delivered" | "read" | "failed";

const DELIVERY_STATUS_RANK: Record<string, number> = {
  accepted: 1,
  sent: 2,
  delivered: 3,
  read: 4,
  failed: 5,
};

/**
 * Meta can deliver status webhooks out of order, so only move a message forward
 * along sent → delivered → read. `failed` always wins.
 */
export function shouldApplyDeliveryStatus(previous: unknown, next: unknown): boolean {
  const nextRank = DELIVERY_STATUS_RANK[String(next ?? "")] ?? 0;
  if (!nextRank) return false;
  return nextRank > (DELIVERY_STATUS_RANK[String(previous ?? "")] ?? 0);
}

export type MetaWhatsAppErrorExplanation = {
  code: string | null;
  /** Short Hebrew label for UI badges */
  labelHe: string;
  /** Full Hebrew message to store / show */
  messageHe: string;
  /** What ops should do (Hebrew) */
  opsHintHe: string;
  /** Blind retry usually makes Meta quality worse */
  retryable: boolean;
};

/**
 * Map Meta Cloud API / delivery webhook error codes to Hebrew ops guidance.
 * Codes seen on lead→client alerts: 131049 (engagement), 131042 (payment),
 * 131026 (undeliverable), 131047 (24h window), 200 (permissions).
 */
export function explainMetaWhatsAppError(
  code: unknown,
  fallbackDetail?: string | null,
): MetaWhatsAppErrorExplanation {
  const codeStr = code === null || code === undefined || code === ""
    ? null
    : String(code);
  const detail = String(fallbackDetail ?? "").trim();

  const table: Record<string, Omit<MetaWhatsAppErrorExplanation, "code">> = {
    "131049": {
      labelHe: "מגבלת מעורבות Meta",
      messageHe:
        "Meta חסמה את המסירה (קוד 131049) — מגבלת מעורבות/איכות על הודעות שיווקיות לנמען זה.",
      opsHintHe:
        "לא באג בתור של AIOS. בדקו Quality Rating של מספר ה-WhatsApp ב-Meta Business, הפחיתו נפח תבניות לנמענים שלא מגיבים, וודאו שהנמען לא חסם את המספר. ריצה חוזרת מיידית עלולה להחמיר.",
      retryable: false,
    },
    "131042": {
      labelHe: "בעיית תשלום Meta",
      messageHe:
        "Meta לא שלחה בגלל בעיית תשלום/חיוב בחשבון WhatsApp Business (קוד 131042).",
      opsHintHe:
        "היכנסו ל-Meta Business Suite → WhatsApp Manager → Billing ותקנו אמצעי תשלום / חוב. עד שזה יתוקן כל השליחות ייכשלו.",
      retryable: false,
    },
    "131026": {
      labelHe: "מספר לא ניתן למשלוח",
      messageHe: "Meta דיווחה שההודעה לא ניתנת למשלוח (קוד 131026).",
      opsHintHe:
        "בדקו שמספר הלקוח תקין (כולל קידומת מדינה), שהמספר פעיל ב-WhatsApp, ושאינו חסום.",
      retryable: false,
    },
    "131047": {
      labelHe: "חלון 24 שעות",
      messageHe: "חלון השירות של 24 שעות נסגר. יש לשלוח תבנית WhatsApp מאושרת.",
      opsHintHe: "העבירו את שלב האוטומציה ל-send_mode=template עם תבנית מאושרת.",
      retryable: true,
    },
    "131009": {
      labelHe: "פרמטר לא תקין",
      messageHe: "Meta דחתה פרמטר לא תקין בהודעה (קוד 131009).",
      opsHintHe: "בדקו את מספר הטלפון ומשתני התבנית ב-Make/Webhook (אין ערכי placeholder).",
      retryable: false,
    },
    "131008": {
      labelHe: "חסר פרמטר בתבנית",
      messageHe: "חסר פרמטר חובה בתבנית WhatsApp (קוד 131008).",
      opsHintHe: "ודאו שכל משתני התבנית מגיעים מ-Make (שם לקוח, טלפון ליד וכו').",
      retryable: true,
    },
    "200": {
      labelHe: "אין הרשאה ל-WABA",
      messageHe: "אין הרשאה לשלוח בשם חשבון ה-WhatsApp Business (קוד 200).",
      opsHintHe:
        "חדשו את חיבור Meta WhatsApp ב-AIOS, או בדקו שמשתמש הטוקן עדיין מנהל של ה-WABA.",
      retryable: false,
    },
  };

  const known = codeStr ? table[codeStr] : undefined;
  if (known) {
    return { code: codeStr, ...known };
  }

  return {
    code: codeStr,
    labelHe: codeStr ? `שגיאת Meta ${codeStr}` : "שגיאת Meta",
    messageHe: detail
      ? (codeStr ? `Meta שגיאה (קוד ${codeStr}): ${detail}` : `Meta שגיאה: ${detail}`)
      : (codeStr ? `Meta שגיאה (קוד ${codeStr})` : "Meta WhatsApp send failed"),
    opsHintHe: "בדקו את היסטוריית הריצות ואת סטטוס המספר ב-Meta Business Manager.",
    retryable: false,
  };
}

/** Extract a Meta error code from an automation_logs.error_message string. */
export function extractMetaErrorCodeFromMessage(message: unknown): string | null {
  const text = String(message ?? "");
  const match =
    text.match(/\(קוד\s*(\d+)\)/) ||
    text.match(/\(#(\d+)\)/) ||
    text.match(/\b(1310\d{2}|1320\d{2}|200)\b/);
  return match?.[1] ?? null;
}
