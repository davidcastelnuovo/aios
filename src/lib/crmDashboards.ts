import { supabase } from "@/integrations/supabase/client";

export type CrmDashboardListRow = {
  id: string;
  name: string;
  tenant_id: string;
  agency_id: string | null;
  client_id: string | null;
  dashboard_type?: string | null;
  created_at?: string | null;
  settings?: unknown;
  clients?: { name?: string | null; agency_id?: string | null } | null;
  agencies?: { name?: string | null } | null;
  [key: string]: unknown;
};

/**
 * Dashboards visible to the current tenant — mirrors `crm-tables` GET:
 * own-tenant rows + rows for agencies shared in via agency_tenant_access
 * (and client-linked dashboards whose client sits in those agencies).
 *
 * DMM-MC clients/dashboards live under the DMM tenant after the shared-agency
 * home migration; filtering only by the UI tenant (e.g. MarketingCaptain) made
 * almost every DMM-MC dashboard disappear from the list.
 */
export async function fetchAccessibleDashboards(
  tenantId: string,
  options?: { select?: string },
): Promise<CrmDashboardListRow[]> {
  const select =
    options?.select || "*, clients(name, agency_id), agencies(name)";

  const { data: owned, error: ownedErr } = await supabase
    .from("crm_dashboards")
    .select(select)
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });
  if (ownedErr) throw ownedErr;

  const { data: sharedAccess, error: sharedErr } = await supabase
    .from("agency_tenant_access")
    .select("agency_id")
    .eq("accessing_tenant_id", tenantId);
  if (sharedErr) throw sharedErr;

  const sharedAgencyIds = Array.from(
    new Set((sharedAccess || []).map((r) => r.agency_id).filter(Boolean)),
  ) as string[];

  if (sharedAgencyIds.length === 0) {
    return (owned || []) as unknown as CrmDashboardListRow[];
  }

  const { data: byAgency, error: byAgencyErr } = await supabase
    .from("crm_dashboards")
    .select(select)
    .neq("tenant_id", tenantId)
    .in("agency_id", sharedAgencyIds)
    .order("created_at", { ascending: false });
  if (byAgencyErr) throw byAgencyErr;

  // Dashboards that only have client_id (null agency_id) but belong to a
  // shared-agency client — still reachable via RLS user_can_access_client.
  const { data: sharedClients, error: clientsErr } = await supabase
    .from("clients")
    .select("id")
    .in("agency_id", sharedAgencyIds);
  if (clientsErr) throw clientsErr;

  const sharedClientIds = (sharedClients || []).map((c) => c.id).filter(Boolean);
  let byClient: unknown[] = [];
  if (sharedClientIds.length > 0) {
    // PostgREST .in() has practical URL limits; chunk if needed.
    const chunkSize = 200;
    for (let i = 0; i < sharedClientIds.length; i += chunkSize) {
      const chunk = sharedClientIds.slice(i, i + chunkSize);
      const { data, error } = await supabase
        .from("crm_dashboards")
        .select(select)
        .neq("tenant_id", tenantId)
        .in("client_id", chunk)
        .order("created_at", { ascending: false });
      if (error) throw error;
      if (data?.length) byClient = byClient.concat(data);
    }
  }

  const map = new Map<string, CrmDashboardListRow>();
  for (const row of [
    ...((owned || []) as unknown as CrmDashboardListRow[]),
    ...((byAgency || []) as unknown as CrmDashboardListRow[]),
    ...(byClient as CrmDashboardListRow[]),
  ]) {
    if (row?.id) map.set(row.id, row);
  }

  return Array.from(map.values()).sort((a, b) => {
    const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
    const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
    return tb - ta;
  });
}
