import { supabase } from "@/integrations/supabase/client";
import {
  agenciesFromJoin,
  mergeAgencyLists,
  pickTenantHomeAgencyId,
  type AgencyStamp,
} from "@/lib/resolveTenantAgency";

export async function fetchTenantHomeAgencyId(
  tenantId: string,
): Promise<string | null> {
  const [
    { data: owned, error: ownedError },
    { data: sharedAccess, error: sharedError },
  ] = await Promise.all([
    supabase
      .from("agencies")
      .select("id, tenant_id, is_default, status, created_at, name")
      .eq("tenant_id", tenantId),
    supabase
      .from("agency_tenant_access")
      .select("agency_id, agencies(id, tenant_id, is_default, status, created_at, name)")
      .eq("accessing_tenant_id", tenantId),
  ]);
  if (ownedError) throw ownedError;
  if (sharedError) throw sharedError;
  const shared = (sharedAccess || []).flatMap((row) =>
    agenciesFromJoin((row as { agencies?: unknown }).agencies),
  );
  return pickTenantHomeAgencyId(tenantId, mergeAgencyLists(owned || [], shared));
}

/**
 * If the lead has no agency, stamp the tenant's home / shared agency and
 * return that id. Existing stamps are left alone.
 */
export async function ensureLeadHomeAgency(
  lead: { id: string; agency_id?: string | null; tenant_id?: string | null },
  agencies?: readonly AgencyStamp[] | null,
): Promise<string | null> {
  if (lead.agency_id) return lead.agency_id;
  const tenantId = lead.tenant_id;
  let agencyId = pickTenantHomeAgencyId(tenantId, agencies);
  if (!agencyId && tenantId) {
    agencyId = await fetchTenantHomeAgencyId(tenantId);
  }
  if (!agencyId) return null;
  const { error } = await supabase
    .from("leads")
    .update({ agency_id: agencyId })
    .eq("id", lead.id)
    .is("agency_id", null);
  if (error) {
    console.error("Failed to stamp lead home agency:", error);
  }
  return agencyId;
}
