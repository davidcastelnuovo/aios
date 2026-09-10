import type { SignaturePosition } from "./SignatureFieldPlacer";

export type SignatureFieldType =
  | "signature"
  | "signature_stamp"
  | "text"
  | "first_name"
  | "last_name"
  | "full_name"
  | "company_name"
  | "phone"
  | "address"
  | "date"
  | "id_number";

export interface DocumentField {
  id: string;
  type: SignatureFieldType;
  label: string;
  position: SignaturePosition;
  required?: boolean;
  recipient_index?: number;
}

export const SIGNATURE_FIELD_OPTIONS: Array<{
  type: SignatureFieldType;
  label: string;
  width: number;
  height: number;
}> = [
  { type: "signature", label: "חתימה", width: 28, height: 10 },
  { type: "signature_stamp", label: "חתימה עם חותמת", width: 30, height: 12 },
  { type: "text", label: "שדה כללי", width: 22, height: 5 },
  { type: "first_name", label: "שם פרטי", width: 18, height: 5 },
  { type: "last_name", label: "שם משפחה", width: 18, height: 5 },
  { type: "full_name", label: "שם מלא", width: 24, height: 5 },
  { type: "company_name", label: "שם העסק/חברה", width: 26, height: 5 },
  { type: "phone", label: "טלפון", width: 20, height: 5 },
  { type: "address", label: "כתובת", width: 30, height: 6 },
  { type: "date", label: "תאריך", width: 14, height: 5 },
  { type: "id_number", label: "ח.פ / ת.ז", width: 18, height: 5 },
];

export function isSignatureFieldType(type: string | undefined | null): boolean {
  return type === "signature" || type === "signature_stamp";
}

export function isStampSignatureType(type: string | undefined | null): boolean {
  return type === "signature_stamp";
}

export function getFieldLabel(type: SignatureFieldType): string {
  return SIGNATURE_FIELD_OPTIONS.find((o) => o.type === type)?.label ?? type;
}

/** Placement UI label — generic fields stay untitled on the signed PDF form. */
export function getFieldPlacerLabel(type: SignatureFieldType): string {
  if (type === "text") return "מילוי";
  return getFieldLabel(type);
}

export function getDefaultFieldSize(type: SignatureFieldType) {
  const opt = SIGNATURE_FIELD_OPTIONS.find((o) => o.type === type);
  return { width: opt?.width ?? 20, height: opt?.height ?? 4 };
}

/** Font size in px scaled to field box height (% of document). */
export function getFieldFontSizePx(position: SignaturePosition, containerHeightPx?: number): number {
  const boxHeightPx = containerHeightPx
    ? (position.height / 100) * containerHeightPx
    : position.height * 8;
  return Math.round(Math.max(6, Math.min(28, boxHeightPx * 0.55)));
}

export function createDocumentField(
  type: SignatureFieldType,
  position: SignaturePosition,
  recipientIndex = 0,
): DocumentField {
  return {
    id: crypto.randomUUID(),
    type,
    // Generic fields have no title — the PDF already shows what to fill.
    label: type === "text" ? "" : getFieldLabel(type),
    position,
    required: type === "text" ? false : true,
    recipient_index: recipientIndex,
  };
}

export function parseDocumentFields(raw: unknown): DocumentField[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((f) => f && typeof f === "object" && f.type && f.position) as DocumentField[];
}
