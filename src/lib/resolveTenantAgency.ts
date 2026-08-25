/** Agency row used to pick a tenant's home / shared stamp. */
export type AgencyStamp = {
  id: string;
  tenant_id?: string | null;
  is_default?: boolean | null;
  status?: string | null;
  created_at?: string | null;
  name?: string | null;
};

export function mergeAgencyLists<T extends AgencyStamp>(
  owned: readonly T[] | null | undefined,
  shared: readonly T[] | null | undefined,
): T[] {
  const unique = new Map<string, T>();
  for (const agency of [...(owned || []), ...(shared || [])]) {
    if (agency?.id && !unique.has(agency.id)) unique.set(agency.id, agency);
  }
  return Array.from(unique.values());
}

export function agenciesFromJoin(value: unknown): AgencyStamp[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.flatMap((item) => agenciesFromJoin(item));
  }
  if (typeof value === "object" && value && "id" in value) {
    const id = (value as { id?: unknown }).id;
    if (typeof id === "string" && id.length > 0) return [value as AgencyStamp];
  }
  return [];
}

/**
 * Home agency for a tenant: owned default → first owned → first agency
 * shared into the tenant via agency_tenant_access.
 */
export function pickTenantHomeAgencyId(
  tenantId: string | null | undefined,
  agencies: readonly AgencyStamp[] | null | undefined,
): string | null {
  if (!tenantId || !agencies?.length) return null;
  const owned = agencies.filter((agency) => agency.tenant_id === tenantId);
  const pool = owned.length > 0 ? owned : [...agencies];
  const defaulted = pool.find((agency) => agency.is_default);
  if (defaulted?.id) return defaulted.id;
  const sorted = [...pool].sort((a, b) =>
    (a.created_at || "").localeCompare(b.created_at || ""),
  );
  return sorted[0]?.id ?? null;
}
