export const MARKETING_DEPARTMENT_IDS = ["copy", "creative", "seo", "campaigns", "analytics"] as const;

export type MarketingDepartmentId = (typeof MARKETING_DEPARTMENT_IDS)[number];

const DEPARTMENT_ID_SET = new Set<string>(MARKETING_DEPARTMENT_IDS);

export function isMarketingDepartmentId(value: string | undefined): value is MarketingDepartmentId {
  return !!value && DEPARTMENT_ID_SET.has(value);
}

/** Legacy `/marketing/:clientId` paths that are really department slugs, not client ids. */
export function isLegacyDepartmentClientSlug(clientId: string | undefined): clientId is MarketingDepartmentId {
  return isMarketingDepartmentId(clientId);
}

export function copyDepartmentItemStorageKey(tenantId: string) {
  return `copy-dept-item:${tenantId}`;
}

export function marketingDepartmentPath(
  tenantSlug: string,
  department: MarketingDepartmentId,
  searchParams?: URLSearchParams | string,
) {
  const query = searchParams instanceof URLSearchParams
    ? searchParams.toString()
    : (searchParams ?? "");
  return `/t/${tenantSlug}/marketing/department/${department}${query ? `?${query}` : ""}`;
}
