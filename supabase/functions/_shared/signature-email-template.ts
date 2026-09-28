export interface SignatureEmailColors {
  headerColor: string;
  headerText: string;
  buttonColor: string;
  buttonText: string;
  pageBackground: string;
  cardBackground: string;
  textColor: string;
}

export const DEFAULT_SIGNATURE_EMAIL_COLORS: SignatureEmailColors = {
  headerColor: "#1d4ed8",
  headerText: "#ffffff",
  buttonColor: "#2563eb",
  buttonText: "#ffffff",
  pageBackground: "#f5f5f5",
  cardBackground: "#ffffff",
  textColor: "#333333",
};

export interface SignatureEmailSettings extends Partial<SignatureEmailColors> {
  logoUrl?: string | null;
  subject?: string | null;
  body?: string | null;
}

export function safeHexColor(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  const six = /^#([0-9a-fA-F]{6})$/.exec(trimmed);
  if (six) return `#${six[1].toLowerCase()}`;
  const three = /^#([0-9a-fA-F]{3})$/.exec(trimmed);
  if (three) {
    const [r, g, b] = three[1].split("");
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return fallback;
}

export function resolveSignatureEmailColors(
  settings?: Partial<SignatureEmailColors> | null,
): SignatureEmailColors {
  const defaults = DEFAULT_SIGNATURE_EMAIL_COLORS;
  return {
    headerColor: safeHexColor(settings?.headerColor, defaults.headerColor),
    headerText: safeHexColor(settings?.headerText, defaults.headerText),
    buttonColor: safeHexColor(settings?.buttonColor, defaults.buttonColor),
    buttonText: safeHexColor(settings?.buttonText, defaults.buttonText),
    pageBackground: safeHexColor(settings?.pageBackground, defaults.pageBackground),
    cardBackground: safeHexColor(settings?.cardBackground, defaults.cardBackground),
    textColor: safeHexColor(settings?.textColor, defaults.textColor),
  };
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
