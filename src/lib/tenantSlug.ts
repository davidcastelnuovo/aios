import { SLUG_REGEX } from "@/lib/share-slug";

export function normalizeTenantSlugInput(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s_-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/_+/g, "_")
    .replace(/-+/g, "-")
    .replace(/^[-_]+|[-_]+$/g, "");
}

export function isValidTenantSlug(slug: string): boolean {
  return SLUG_REGEX.test(slug);
}

export function tenantSlugValidationMessage(slug: string): string | null {
  if (!slug) return "יש להזין סלאג";
  if (!isValidTenantSlug(slug)) {
    return "סלאג חייב להיות 3-64 תווים: אותיות באנגלית, מספרים, מקפים או קווים תחתונים";
  }
  return null;
}
