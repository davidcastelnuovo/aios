export interface SignatureEmailSettings {
  logoUrl?: string | null;
  subject?: string | null;
  body?: string | null;
}

const DEFAULT_SUBJECT = "בקשה לחתימה: {{title}}";

export function applySignatureEmailTemplate(
  template: string,
  vars: { name?: string; title?: string; sender?: string },
): string {
  return template.replace(/\{\{\s*(name|title|sender)\s*\}\}/g, (_match, key: string) => vars[key as "name" | "title" | "sender"] ?? "");
}

export function signatureRequestSubject(
  settings: SignatureEmailSettings | null | undefined,
  vars: { name?: string; title?: string; sender?: string },
  override?: string | null,
): string {
  const raw = (override ?? settings?.subject ?? "").trim() || DEFAULT_SUBJECT;
  return applySignatureEmailTemplate(raw, vars).trim() || applySignatureEmailTemplate(DEFAULT_SUBJECT, vars);
}

export function signatureRequestBody(
  settings: SignatureEmailSettings | null | undefined,
  vars: { name?: string; title?: string; sender?: string },
  override?: string | null,
): string | null {
  const raw = override ?? settings?.body ?? "";
  const text = applySignatureEmailTemplate(raw, vars).trim();
  return text || null;
}
