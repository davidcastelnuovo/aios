/**
 * Client-side mirror of Meta WhatsApp delivery error classification
 * (see supabase/functions/_shared/meta-whatsapp.ts → explainMetaWhatsAppError).
 */

export type MetaWhatsAppErrorInfo = {
  code: string | null;
  labelHe: string;
  opsHintHe: string;
  retryable: boolean;
};

export function extractMetaErrorCodeFromMessage(message: unknown): string | null {
  const text = String(message ?? "");
  const match =
    text.match(/\(קוד\s*(\d+)\)/) ||
    text.match(/\(#(\d+)\)/) ||
    text.match(/\b(1310\d{2}|1320\d{2}|200)\b/);
  return match?.[1] ?? null;
}

export function classifyMetaWhatsAppErrorMessage(message: unknown): MetaWhatsAppErrorInfo | null {
  const code = extractMetaErrorCodeFromMessage(message);
  if (!code && !String(message ?? "").toLowerCase().includes("meta")) return null;

  const table: Record<string, Omit<MetaWhatsAppErrorInfo, "code">> = {
    "131049": {
      labelHe: "מגבלת מעורבות Meta",
      opsHintHe:
        "לא באג בתור AIOS. בדקו Quality Rating של המספר ב-Meta, הפחיתו תבניות לנמענים שלא מגיבים. ריצה חוזרת מיידית עלולה להחמיר.",
      retryable: false,
    },
    "131042": {
      labelHe: "בעיית תשלום Meta",
      opsHintHe: "Meta Business → WhatsApp Manager → Billing — תקנו אמצעי תשלום/חוב.",
      retryable: false,
    },
    "131026": {
      labelHe: "מספר לא ניתן למשלוח",
      opsHintHe: "בדקו שמספר הלקוח תקין ופעיל ב-WhatsApp.",
      retryable: false,
    },
    "131047": {
      labelHe: "חלון 24 שעות",
      opsHintHe: "העבירו את שלב האוטומציה ל-template מאושר.",
      retryable: true,
    },
    "200": {
      labelHe: "אין הרשאה ל-WABA",
      opsHintHe: "חדשו את חיבור Meta WhatsApp ב-AIOS.",
      retryable: false,
    },
  };

  if (code && table[code]) {
    return { code, ...table[code] };
  }

  if (!code) return null;
  return {
    code,
    labelHe: `שגיאת Meta ${code}`,
    opsHintHe: "בדקו את סטטוס המספר ב-Meta Business Manager.",
    retryable: false,
  };
}

/** Summarize failure classes across recent automation_logs for a banner. */
export function summarizeMetaFailureClasses(
  logs: Array<{ success: boolean | null; error_message?: string | null }>,
): { code: string; labelHe: string; count: number; retryable: boolean }[] {
  const counts = new Map<string, { labelHe: string; count: number; retryable: boolean }>();
  for (const log of logs) {
    if (log.success !== false) continue;
    const info = classifyMetaWhatsAppErrorMessage(log.error_message);
    if (!info?.code) continue;
    const prev = counts.get(info.code);
    if (prev) prev.count += 1;
    else counts.set(info.code, { labelHe: info.labelHe, count: 1, retryable: info.retryable });
  }
  return [...counts.entries()]
    .map(([code, v]) => ({ code, ...v }))
    .sort((a, b) => b.count - a.count);
}
