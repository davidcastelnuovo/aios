import { EmailRecipient } from "@/components/automations/EmailRecipientsListEditor";

const TEMPLATE_VAR_RE = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

export function extractTemplateVariables(template: string | undefined | null): string[] {
  if (!template) return [];
  const keys = new Set<string>();
  for (const match of template.matchAll(TEMPLATE_VAR_RE)) {
    const key = match[1]?.trim();
    if (key) keys.add(key);
  }
  return Array.from(keys);
}

export type EmailFieldUsage = "subject" | "body" | "recipient";

export type EmailMappedField = {
  key: string;
  label: string;
  usedIn: EmailFieldUsage[];
};

const SAMPLE_VALUES: Record<string, string> = {
  contact_name: "ישראל ישראלי",
  company_name: "חברה לדוגמה",
  phone: "0501234567",
  email: "user@example.com",
  notes: "הערות לדוגמה",
  title: "כותרת לדוגמה",
  status: "new",
  source: "webhook",
  client_name: "לקוח לדוגמה",
  client_phone: "0507654321",
  client_email: "client@example.com",
  external_id: "evt-123",
  form_qa_summary: "שאלה: תשובה",
  message_text: "טקסט לדוגמה",
  sender_name: "שולח לדוגמה",
  sender_phone: "0501112233",
};

function sampleValueForKey(key: string): string {
  if (SAMPLE_VALUES[key]) return SAMPLE_VALUES[key];
  if (key.includes("email") || key.includes("mail")) return "user@example.com";
  if (key.includes("phone") || key.includes("mobile")) return "0501234567";
  if (key.includes("name")) return "ישראל ישראלי";
  return `ערך_${key}`;
}

export function collectEmailMappedFields(
  configuration: Record<string, any>,
  availableFields: { key: string; label: string }[],
): EmailMappedField[] {
  const labelByKey = new Map(availableFields.map((f) => [f.key, f.label]));
  const usage = new Map<string, Set<EmailFieldUsage>>();

  const mark = (key: string, where: EmailFieldUsage) => {
    if (!key || key === "agent_output") return;
    if (!usage.has(key)) usage.set(key, new Set());
    usage.get(key)!.add(where);
  };

  extractTemplateVariables(configuration?.subject_template).forEach((k) => mark(k, "subject"));
  extractTemplateVariables(configuration?.body_template).forEach((k) => mark(k, "body"));

  const recipients = Array.isArray(configuration?.email_recipients) ? configuration.email_recipients : [];
  for (const recipient of recipients as EmailRecipient[]) {
    if (recipient?.type === "email_field" && recipient.field) {
      mark(recipient.field, "recipient");
    }
  }

  return Array.from(usage.entries())
    .map(([key, usedInSet]) => ({
      key,
      label: labelByKey.get(key) || key,
      usedIn: Array.from(usedInSet),
    }))
    .sort((a, b) => a.key.localeCompare(b.key));
}

export function buildSampleWebhookJsonFromAvailableFields(
  availableFields: { key: string; label: string }[],
): Record<string, string> {
  const payload: Record<string, string> = {};
  for (const field of availableFields) {
    payload[field.key] = sampleValueForKey(field.key);
  }
  return payload;
}

export function buildSampleWebhookJson(fields: EmailMappedField[]): Record<string, string> {
  const payload: Record<string, string> = {};
  for (const field of fields) {
    payload[field.key] = sampleValueForKey(field.key);
  }
  return payload;
}

export function usageLabel(usedIn: EmailFieldUsage[]): string {
  const parts: string[] = [];
  if (usedIn.includes("subject")) parts.push("נושא");
  if (usedIn.includes("body")) parts.push("גוף");
  if (usedIn.includes("recipient")) parts.push("נמען");
  return parts.join(" · ");
}
