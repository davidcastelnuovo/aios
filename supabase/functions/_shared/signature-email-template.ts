export interface SignatureEmailSettings {
  logoUrl?: string | null;
  subject?: string | null;
  body?: string | null;
}

const DEFAULT_SUBJECT = "בקשה לחתימה: {{title}}";

export interface SignatureEmailVars {
  name?: string;
  title?: string;
  sender?: string;
  first_name?: string;
  last_name?: string;
  company?: string;
  phone?: string;
  email?: string;
  address?: string;
  id_number?: string;
}

export function applySignatureEmailTemplate(template: string, vars: SignatureEmailVars): string {
  return template.replace(/\{\{\s*(name|title|sender|first_name|last_name|company|phone|email|address|id_number)\s*\}\}/g, (_match, key: string) => vars[key as keyof SignatureEmailVars] ?? "");
}

export function signatureRequestSubject(
  settings: SignatureEmailSettings | null | undefined,
  vars: SignatureEmailVars,
  override?: string | null,
): string {
  const raw = (override ?? settings?.subject ?? "").trim() || DEFAULT_SUBJECT;
  return applySignatureEmailTemplate(raw, vars).trim() || applySignatureEmailTemplate(DEFAULT_SUBJECT, vars);
}

export function signatureRequestBody(
  settings: SignatureEmailSettings | null | undefined,
  vars: SignatureEmailVars,
  override?: string | null,
): string | null {
  const raw = override ?? settings?.body ?? "";
  const text = applySignatureEmailTemplate(raw, vars).trim();
  return text || null;
}
