/**
 * Child rows on a client (contacts, credentials, …) must use the client's owning
 * tenant_id, not necessarily the viewer's active tenant (cross-agency access).
 */
export function resolveClientChildTenantId(
  client: { tenant_id?: string | null } | null | undefined,
  fallbackTenantId?: string | null,
): string {
  const tenantId = client?.tenant_id ?? fallbackTenantId ?? null;
  if (!tenantId) {
    throw new Error("חסר מזהה ארגון ללקוח");
  }
  return tenantId;
}
