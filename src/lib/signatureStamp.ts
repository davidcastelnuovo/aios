import type { DocumentField } from "@/components/signatures/signatureFieldTypes";

export const STAMP_NAME_KEY = "__stamp_name";
export const STAMP_ID_KEY = "__stamp_company_id";

export function getSignatureStamp(fields: DocumentField[], values: Record<string, string>,
  fallback: { name?: string | null; company_id?: string | null } = {}) {
  const filled = (type: string) => fields.filter((field) => field.type === type)
    .map((field) => values[field.id]?.trim()).find(Boolean);
  return {
    name: filled("company_name") || values[STAMP_NAME_KEY]?.trim() || fallback.name?.trim() || "",
    companyId: filled("id_number") || values[STAMP_ID_KEY]?.trim() || fallback.company_id?.trim() || "",
  };
}

export function applySignatureStamp(fields: DocumentField[], values: Record<string, string>, name: string, companyId: string) {
  const next = { ...values, [STAMP_NAME_KEY]: name.trim(), [STAMP_ID_KEY]: companyId.trim() };
  for (const field of fields) {
    if (field.type === "company_name") next[field.id] = name.trim();
    if (field.type === "id_number") next[field.id] = companyId.trim();
  }
  return next;
}
