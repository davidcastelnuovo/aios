import type { SignaturePosition } from "./SignatureFieldPlacer";

export type SignatureFieldType =
  | "signature"
  | "first_name"
  | "last_name"
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
  { type: "signature", label: "חתימה", width: 25, height: 8 },
  { type: "first_name", label: "שם", width: 18, height: 4 },
  { type: "last_name", label: "שם משפחה", width: 18, height: 4 },
  { type: "phone", label: "טלפון", width: 20, height: 4 },
  { type: "address", label: "כתובת", width: 30, height: 5 },
  { type: "date", label: "תאריך", width: 14, height: 4 },
  { type: "id_number", label: "ח.פ / ת.ז", width: 18, height: 4 },
];

export function getFieldLabel(type: SignatureFieldType): string {
  return SIGNATURE_FIELD_OPTIONS.find((o) => o.type === type)?.label ?? type;
}

export function getDefaultFieldSize(type: SignatureFieldType) {
  const opt = SIGNATURE_FIELD_OPTIONS.find((o) => o.type === type);
  return { width: opt?.width ?? 20, height: opt?.height ?? 4 };
}

export function createDocumentField(
  type: SignatureFieldType,
  position: SignaturePosition,
  recipientIndex = 0,
): DocumentField {
  return {
    id: crypto.randomUUID(),
    type,
    label: getFieldLabel(type),
    position,
    required: true,
    recipient_index: recipientIndex,
  };
}

export function parseDocumentFields(raw: unknown): DocumentField[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((f) => f && typeof f === "object" && f.type && f.position) as DocumentField[];
}
