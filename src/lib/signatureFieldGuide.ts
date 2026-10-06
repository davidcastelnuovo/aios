import {
  type DocumentField,
  getFieldLabel,
  getFieldPlacerLabel,
  isSignatureFieldType,
  isStampSignatureType,
} from "../components/signatures/signatureFieldTypes.ts";

const LEGACY_SIGNATURE = "__signature";

export function isFieldRequired(field: Pick<DocumentField, "required">): boolean {
  return field.required === true;
}

export function isFieldFilled(
  field: Pick<DocumentField, "id">,
  values: Record<string, string>,
): boolean {
  return !!values[field.id]?.trim();
}

export function fieldFillLabel(field: DocumentField): string {
  return field.label || getFieldPlacerLabel(field.type) || getFieldLabel(field.type);
}

/** Page, then top-to-bottom, then right-to-left (Hebrew documents). */
export function sortFieldsReadingOrder(fields: DocumentField[]): DocumentField[] {
  return [...fields].sort((a, b) => {
    const pageA = a.position.page ?? 1;
    const pageB = b.position.page ?? 1;
    if (pageA !== pageB) return pageA - pageB;
    if (a.position.y !== b.position.y) return a.position.y - b.position.y;
    return b.position.x - a.position.x;
  });
}

export function nextFieldToFill(
  fields: DocumentField[],
  values: Record<string, string>,
  fromId?: string | null,
): DocumentField | null {
  const ordered = sortFieldsReadingOrder(fields);
  const empty = (field: DocumentField) => !isFieldFilled(field, values);
  const queue = [
    ...ordered.filter((field) => isFieldRequired(field) && empty(field)),
    ...ordered.filter((field) => !isFieldRequired(field) && empty(field)),
  ];
  if (queue.length === 0) return null;
  if (!fromId) return queue[0];
  const index = queue.findIndex((field) => field.id === fromId);
  if (index === -1) return queue[0];
  return queue[(index + 1) % queue.length];
}

export function hasAnySignature(
  fields: DocumentField[],
  values: Record<string, string>,
): boolean {
  if (values[LEGACY_SIGNATURE]?.trim()) return true;
  return fields.some((field) => isSignatureFieldType(field.type) && isFieldFilled(field, values));
}

export function missingRequiredForSubmit(
  fields: DocumentField[],
  values: Record<string, string>,
  stamp: { name: string; companyId: string },
): DocumentField[] {
  const ordered = sortFieldsReadingOrder(fields);
  const missing = ordered.filter((field) => isFieldRequired(field) && !isFieldFilled(field, values));

  if (!hasAnySignature(fields, values)) {
    const firstSignature = ordered.find((field) => isSignatureFieldType(field.type));
    if (firstSignature && !missing.some((field) => field.id === firstSignature.id)) {
      missing.push(firstSignature);
    }
  }

  const signedStamp = ordered.find(
    (field) => isStampSignatureType(field.type) && isFieldFilled(field, values),
  );
  if (signedStamp && (!stamp.name.trim() || !stamp.companyId.trim())) {
    if (!missing.some((field) => field.id === signedStamp.id)) missing.push(signedStamp);
  }

  return missing;
}
