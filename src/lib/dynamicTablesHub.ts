export const DYNAMIC_TABLES_HUB_ROUTE = "/dynamic-tables";
export const DYNAMIC_TABLES_CATEGORY_PARAM = "category";
export const DYNAMIC_TABLES_CATEGORY_STORAGE_KEY = "dynamicTables.selectedCategory";

export function appendCategorySearchParam(path: string, category: string): string {
  const [pathname, query = ""] = path.split("?");
  const params = new URLSearchParams(query);
  params.set(DYNAMIC_TABLES_CATEGORY_PARAM, category);
  return `${pathname}?${params.toString()}`;
}

export function stripCategorySearchParam(path: string): string {
  const [pathname, query = ""] = path.split("?");
  const params = new URLSearchParams(query);
  params.delete(DYNAMIC_TABLES_CATEGORY_PARAM);
  const next = params.toString();
  return next ? `${pathname}?${next}` : pathname;
}

export function clearLegacyDynamicTablesCategory(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(DYNAMIC_TABLES_CATEGORY_STORAGE_KEY);
  } catch {
    // Ignore storage failures in private browsing.
  }
}
