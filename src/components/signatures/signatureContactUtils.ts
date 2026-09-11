import type { DocumentField, SignatureFieldType } from "./signatureFieldTypes";

export interface SignatureContactDetails {
  name: string;
  email: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  address?: string;
  idNumber?: string;
  sourceLabel?: string;
}

export function splitContactName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

export function buildFieldPrefill(
  fields: DocumentField[],
  recipientIndex: number,
  contact: Pick<SignatureContactDetails, "name" | "firstName" | "lastName" | "phone" | "address" | "idNumber"> & {
    companyName?: string;
  },
): Record<string, string> {
  const typeToValue: Partial<Record<SignatureFieldType, string | undefined>> = {
    first_name: contact.firstName,
    last_name: contact.lastName,
    full_name: contact.name || [contact.firstName, contact.lastName].filter(Boolean).join(" "),
    company_name: contact.companyName,
    phone: contact.phone,
    address: contact.address,
    id_number: contact.idNumber,
  };

  const prefill: Record<string, string> = {};
  for (const field of fields) {
    if ((field.recipient_index ?? 0) !== recipientIndex) continue;
    if (field.type === "signature" || field.type === "signature_stamp" || field.type === "date" || field.type === "text") {
      continue;
    }
    const val = typeToValue[field.type];
    if (val?.trim()) prefill[field.id] = val.trim();
  }
  return prefill;
}
