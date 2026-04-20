import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Resolves the full "scope" for SEO data of a given client, regardless of
 * which tenant the user is currently viewing the system from.
 *
 * Why this exists:
 *   YTS (and other shared-agency clients) live in tenant DMM, but their
 *   SEO/Ahrefs/GSC/GA tables and integrations were created under tenant
 *   MarketingCaptain. A naive "filter by current tenant" loses all the data.
 *
 *   The right notion of access is "this client + agencies the current tenant
 *   can access via agency_tenant_access". RLS on the underlying tables already
 *   enforces what the user can read, so we just need to STOP narrowing the
 *   query to the active tenant.
 */
export interface SeoScope {
  clientId: string;
  /** The client's "home" tenant (clients.tenant_id) */
  clientTenantId: string | null;
  /** The client's agency_id */
  agencyId: string | null;
  /**
   * All tenant_ids that may legitimately host SEO artifacts for this client.
   * Includes the client's home tenant + every tenant that shares the agency
   * via agency_tenant_access (both directions).
   */
  accessibleTenantIds: string[];
  /** The SEO/Ahrefs crm_table for this client, looked up across all accessible tenants. */
  seoTable: any | null;
  /** GA crm_tables for this client, across all accessible tenants. */
  gaTables: any[];
  /** GSC crm_tables for this client, across all accessible tenants. */
  gscTables: any[];
}

export function useSeoScope(clientId: string | undefined) {
  return useQuery<SeoScope>({
    queryKey: ["seo-scope", clientId],
    enabled: !!clientId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      if (!clientId) {
        return {
          clientId: "",
          clientTenantId: null,
          agencyId: null,
          accessibleTenantIds: [],
          seoTable: null,
          gaTables: [],
          gscTables: [],
        };
      }

      // 1. Load the client itself
      const { data: client } = await supabase
        .from("clients")
        .select("id, tenant_id, agency_id")
        .eq("id", clientId)
        .maybeSingle();

      const clientTenantId = client?.tenant_id ?? null;
      const agencyId = client?.agency_id ?? null;

      // 2. Build the set of accessible tenant_ids via agency_tenant_access
      const tenantSet = new Set<string>();
      if (clientTenantId) tenantSet.add(clientTenantId);

      if (agencyId) {
        const { data: accessRows } = await supabase
          .from("agency_tenant_access")
          .select("accessing_tenant_id, source_tenant_id")
          .eq("agency_id", agencyId);

        for (const row of accessRows || []) {
          if (row.accessing_tenant_id) tenantSet.add(row.accessing_tenant_id);
          if (row.source_tenant_id) tenantSet.add(row.source_tenant_id);
        }
      }

      const accessibleTenantIds = Array.from(tenantSet);

      // 3. Find the SEO/Ahrefs table for this client across ALL accessible tenants.
      //    Filter by client_id is the strongest signal; fall back to legacy
      //    integration_settings.clientId match for older tables that lack the FK.
      let seoTable: any = null;
      let gaTables: any[] = [];
      let gscTables: any[] = [];

      if (accessibleTenantIds.length > 0) {
        const { data: seoCandidates } = await supabase
          .from("crm_tables")
          .select("id, tenant_id, name, slug, integration_type, integration_settings, client_id, agency_id")
          .in("tenant_id", accessibleTenantIds)
          .eq("integration_type", "ahrefs")
          .limit(200);

        seoTable =
          (seoCandidates || []).find((t) => t.client_id === clientId) ||
          (seoCandidates || []).find(
            (t) => (t.integration_settings as any)?.clientId === clientId
          ) ||
          null;

        const { data: relatedTables } = await supabase
          .from("crm_tables")
          .select("id, tenant_id, name, slug, integration_type, integration_settings, client_id, agency_id")
          .in("tenant_id", accessibleTenantIds)
          .in("integration_type", ["google_search_console", "google_analytics"]);

        const all = relatedTables || [];
        gaTables = all.filter((t) => t.integration_type === "google_analytics");
        gscTables = all.filter((t) => t.integration_type === "google_search_console");
      }

      return {
        clientId,
        clientTenantId,
        agencyId,
        accessibleTenantIds,
        seoTable,
        gaTables,
        gscTables,
      };
    },
  });
}
