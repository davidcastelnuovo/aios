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
 * Resolve where a new dashboard must live — agency home tenant (same rule as
 * `crm-tables` POST), falling back to the client's home tenant, then the UI tenant.
 * Shared agencies like DMM-MC are owned by DMM; creating under MarketingCaptain
 * made those dashboards invisible from the other org and split the fleet.
 */
export async function resolveDashboardHomeTenant(opts: {
  uiTenantId: string;
  agencyId?: string | null;
  clientId?: string | null;
}): Promise<string> {
  const { uiTenantId, agencyId, clientId } = opts;
  if (agencyId) {
    const { data } = await supabase
      .from("agencies")
      .select("tenant_id")
      .eq("id", agencyId)
      .maybeSingle();
    if (data?.tenant_id) return data.tenant_id;
  }
  if (clientId) {
    const { data } = await supabase
      .from("clients")
      .select("tenant_id, agency_id")
      .eq("id", clientId)
      .maybeSingle();
    if (data?.agency_id) {
      const { data: agency } = await supabase
        .from("agencies")
        .select("tenant_id")
        .eq("id", data.agency_id)
        .maybeSingle();
      if (agency?.tenant_id) return agency.tenant_id;
    }
    if (data?.tenant_id) return data.tenant_id;
  }
  return uiTenantId;
}

async function fetchDashboardsByIds(
  select: string,
  tenantId: string,
  agencyIds: string[],
  clientIds: string[],
): Promise<CrmDashboardListRow[]> {
  const rows: CrmDashboardListRow[] = [];

  if (agencyIds.length > 0) {
    const { data, error } = await supabase
      .from("crm_dashboards")
      .select(select)
      .neq("tenant_id", tenantId)
      .in("agency_id", agencyIds)
      .order("created_at", { ascending: false });
    if (error) throw error;
    rows.push(...((data || []) as unknown as CrmDashboardListRow[]));
  }

  const chunkSize = 200;
  for (let i = 0; i < clientIds.length; i += chunkSize) {
    const chunk = clientIds.slice(i, i + chunkSize);
    if (chunk.length === 0) continue;
    const { data, error } = await supabase
      .from("crm_dashboards")
      .select(select)
      .neq("tenant_id", tenantId)
      .in("client_id", chunk)
      .order("created_at", { ascending: false });
    if (error) throw error;
    rows.push(...((data || []) as unknown as CrmDashboardListRow[]));
  }

  return rows;
}

/**
 * Dashboards visible to the current tenant — mirrors `crm-tables` GET:
 * 1) own-tenant rows
 * 2) foreign-tenant rows for agencies we own
 * 3) foreign-tenant rows for agencies shared in via agency_tenant_access
 * 4) client-linked dashboards for clients in those agencies
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

  const [{ data: ownedAgencies, error: ownedAgenciesErr }, { data: sharedAccess, error: sharedErr }] =
    await Promise.all([
      supabase.from("agencies").select("id").eq("tenant_id", tenantId),
      supabase
        .from("agency_tenant_access")
        .select("agency_id")
        .eq("accessing_tenant_id", tenantId),
    ]);
  if (ownedAgenciesErr) throw ownedAgenciesErr;
  if (sharedErr) throw sharedErr;

  const ownedAgencyIds = Array.from(
    new Set((ownedAgencies || []).map((a) => a.id).filter(Boolean)),
  ) as string[];
  const sharedAgencyIds = Array.from(
    new Set((sharedAccess || []).map((r) => r.agency_id).filter(Boolean)),
  ) as string[];
  const accessibleAgencyIds = Array.from(new Set([...ownedAgencyIds, ...sharedAgencyIds]));

  let foreignRows: CrmDashboardListRow[] = [];
  if (accessibleAgencyIds.length > 0) {
    const { data: agencyClients, error: clientsErr } = await supabase
      .from("clients")
      .select("id")
      .in("agency_id", accessibleAgencyIds);
    if (clientsErr) throw clientsErr;
    const clientIds = (agencyClients || []).map((c) => c.id).filter(Boolean);
    foreignRows = await fetchDashboardsByIds(
      select,
      tenantId,
      accessibleAgencyIds,
      clientIds,
    );
  }

  const map = new Map<string, CrmDashboardListRow>();
  for (const row of [
    ...((owned || []) as unknown as CrmDashboardListRow[]),
    ...foreignRows,
  ]) {
    if (row?.id) map.set(row.id, row);
  }

  return Array.from(map.values()).sort((a, b) => {
    const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
    const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
    return tb - ta;
  });
}
