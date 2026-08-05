import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CLIENT_CHANNELS, type ChannelFieldKey } from "@/config/clientChannels";
import { resolveDashboardHomeTenant } from "@/lib/crmDashboards";
import { normalizeSeoDomain } from "@/lib/seoDomain";
import {
  isSeoClient,
  pickGaPropertyForDomain,
  pickGscSiteForDomain,
  shouldCreateDashboardForConnections,
} from "@/lib/clientConnectionProvision";

// Per integration_type: how to build the crm_tables row the existing sync
// functions + viewers expect (matches what the manual "create table" dialogs write).
const TABLE_META: Record<
  string,
  {
    label: string;
    category: string;
    needsIntegrationId: boolean;
    build: (idValue: string, integrationId?: string) => Record<string, any>;
  }
> = {
  google_analytics: {
    label: "Google Analytics",
    category: "analytics",
    needsIntegrationId: true,
    build: (v, iid) => ({ integrationId: iid, propertyId: v, data_source: "direct_api" }),
  },
  google_ads: {
    label: "Google Ads",
    category: "Google Ads",
    needsIntegrationId: false,
    build: (v) => ({
      customer_id: v,
      date_range: "last_30_days",
      sync_frequency: "daily",
      data_source: "direct_api",
      campaign_type: "leads",
      currency: "ILS",
    }),
  },
  facebook_insights: {
    label: "Facebook",
    category: "Facebook Insights",
    needsIntegrationId: false,
    // Graph API requires the act_ prefix on ad account ids; the client field
    // usually holds the bare number.
    build: (v) => ({
      ad_account_id: v.startsWith("act_") ? v : `act_${v}`,
      currency: "ILS",
      date_range: "last_30_days",
      sync_frequency: "daily",
    }),
  },
  ahrefs: {
    label: "Ahrefs",
    category: "seo",
    needsIntegrationId: true,
    build: (v, iid) => ({ integrationId: iid, targetDomain: v, reportType: "site_explorer", isExistingReport: false }),
  },
  google_search_console: {
    label: "Search Console",
    category: "seo",
    needsIntegrationId: true,
    build: (v, iid) => ({ integrationId: iid, siteUrl: v }),
  },
};

function syncFunctionFor(integrationType: string): string | null {
  switch (integrationType) {
    case "facebook_insights":
    case "facebook_ecommerce":
      return "sync-facebook-insights";
    case "google_ads":
      return "sync-google-ads-data";
    default:
      return null;
  }
}

export interface ProvisionOptions {
  /**
   * When false, create/update crm_tables only — skip the unified client dashboard.
   * Defaults to true when more than one connection is filled; callers may override.
   */
  createDashboard?: boolean;
  /** When true (default), SEO clients resolve GA/GSC/Ahrefs from `website`. */
  resolveSeoFromWebsite?: boolean;
}

export interface ProvisionSummary {
  created: string[];
  updated: string[];
  skipped: string[];
  synced: string[];
  resolved: string[];
  dashboardCreated: boolean;
  createDashboard: boolean;
}

async function resolveActiveIntegrationId(
  tenantId: string,
  integrationType: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("tenant_integrations")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("integration_type", integrationType)
    .eq("is_active", true)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as any)?.id ?? null;
}

/**
 * For SEO clients (or when website is set and SEO fields are empty), look up
 * matching Ahrefs domain / GSC site / GA4 property from the website host.
 */
async function resolveSeoAccountsFromWebsite(
  client: Record<string, any>,
  tenantId: string | null,
): Promise<{ updates: Partial<Record<ChannelFieldKey, string>>; resolved: string[] }> {
  const updates: Partial<Record<ChannelFieldKey, string>> = {};
  const resolved: string[] = [];
  const domain = normalizeSeoDomain(client.website);
  if (!domain || !tenantId) return { updates, resolved };

  if (!String(client.ahrefs_domain || "").trim()) {
    updates.ahrefs_domain = domain;
    resolved.push(`Ahrefs ← ${domain}`);
  }

  // Search Console
  if (!String(client.gsc_site_url || "").trim()) {
    try {
      const gscId = await resolveActiveIntegrationId(tenantId, "google_search_console");
      if (gscId) {
        const { data, error } = await supabase.functions.invoke(
          "google-search-console-auth?action=get_sites",
          { body: { integrationId: gscId } },
        );
        if (!error) {
          const sites = Array.isArray(data?.sites) ? data.sites : [];
          const siteUrl = pickGscSiteForDomain(sites, domain);
          if (siteUrl) {
            updates.gsc_site_url = siteUrl;
            resolved.push(`Search Console ← ${siteUrl}`);
          }
        }
      }
    } catch {
      // non-fatal — user can fill manually
    }
  }

  // Google Analytics — match property display name to the domain
  if (!String(client.ga_property_id || "").trim()) {
    try {
      const gaId = await resolveActiveIntegrationId(tenantId, "google_analytics");
      if (gaId) {
        const { data, error } = await supabase.functions.invoke(
          "google-analytics-auth?action=get_properties",
          { body: { integrationId: gaId } },
        );
        if (!error) {
          const properties = Array.isArray(data?.properties) ? data.properties : [];
          const propertyId = pickGaPropertyForDomain(properties, domain);
          if (propertyId) {
            updates.ga_property_id = propertyId;
            resolved.push(`Analytics ← ${propertyId}`);
          }
        }
      }
    } catch {
      // non-fatal
    }
  }

  return { updates, resolved };
}

export function useProvisionClientChannels() {
  const qc = useQueryClient();
  const [provisioning, setProvisioning] = useState(false);

  const provision = async (
    clientId: string,
    options: ProvisionOptions = {},
  ): Promise<ProvisionSummary> => {
    setProvisioning(true);
    const summary: ProvisionSummary = {
      created: [],
      updated: [],
      skipped: [],
      synced: [],
      resolved: [],
      dashboardCreated: false,
      createDashboard: true,
    };
    const provisioned: Array<{ id: string; integrationType: string; label: string }> = [];
    try {
      const { data: client, error: clientErr } = await supabase
        .from("clients")
        .select(
          "id, name, tenant_id, agency_id, services, website, ga_property_id, google_ads_account_id, meta_ads_account_id, ahrefs_domain, gsc_site_url",
        )
        .eq("id", clientId)
        .single();
      if (clientErr || !client) throw clientErr || new Error("הלקוח לא נמצא");

      const c = { ...(client as Record<string, any>) };
      const services: string[] = Array.isArray(c.services) ? c.services : [];
      const tenantId: string | null = c.tenant_id ?? null;
      const agencyId: string | null = c.agency_id ?? null;

      // SEO clients: auto-resolve GA / GSC / Ahrefs from the website host.
      const wantResolve = options.resolveSeoFromWebsite !== false;
      if (wantResolve && isSeoClient(services) && String(c.website || "").trim()) {
        const { updates, resolved } = await resolveSeoAccountsFromWebsite(c, tenantId);
        if (Object.keys(updates).length > 0) {
          const { error: upErr } = await supabase
            .from("clients")
            .update(updates as never)
            .eq("id", clientId);
          if (!upErr) {
            Object.assign(c, updates);
            summary.resolved.push(...resolved);
          }
        }
      }

      const createDashboard =
        options.createDashboard ??
        shouldCreateDashboardForConnections(
          {
            website: c.website,
            ga_property_id: c.ga_property_id,
            google_ads_account_id: c.google_ads_account_id,
            meta_ads_account_id: c.meta_ads_account_id,
            ahrefs_domain: c.ahrefs_domain,
            gsc_site_url: c.gsc_site_url,
          },
          services,
        );
      summary.createDashboard = createDashboard;

      const integrationIdByType: Record<string, string> = {};
      if (tenantId) {
        const { data: integrations } = await supabase
          .from("tenant_integrations")
          .select("id, integration_type, is_active")
          .eq("tenant_id", tenantId);
        for (const row of (integrations as any[]) ?? []) {
          if (row.is_active && !integrationIdByType[row.integration_type]) {
            integrationIdByType[row.integration_type] = row.id;
          }
        }
      }

      const listRes = await supabase.functions.invoke(
        tenantId ? `crm-tables?tenant_id=${tenantId}` : "crm-tables",
        { method: "GET" },
      );
      if (listRes.error) throw listRes.error;
      const existing = (Array.isArray(listRes.data) ? listRes.data : []).filter(
        (t: any) => t.client_id === clientId,
      );

      // Provision every channel that has a filled identifier — not only those
      // matching clients.services (the Connections tab shows all channels).
      for (const channel of CLIENT_CHANNELS) {
        for (const tbl of channel.tables) {
          const meta = TABLE_META[tbl.integrationType];
          if (!meta) continue;
          const idValue: string = (c[tbl.requiresField as ChannelFieldKey] ?? "").toString().trim();
          if (!idValue) {
            continue;
          }
          const integrationId = integrationIdByType[tbl.integrationType];
          if (meta.needsIntegrationId && !integrationId) {
            summary.skipped.push(`${meta.label}: אין אינטגרציה מחוברת לטננט`);
            continue;
          }
          const settings = meta.build(idValue, integrationId);

          const found = existing.find((t: any) => t.integration_type === tbl.integrationType);
          if (found) {
            const patch = await supabase.functions.invoke("crm-tables", {
              method: "PATCH",
              body: { table_id: found.id, integration_settings: settings },
            });
            if (patch.error) summary.skipped.push(`${meta.label}: ${patch.error.message}`);
            else {
              summary.updated.push(meta.label);
              provisioned.push({ id: found.id, integrationType: tbl.integrationType, label: meta.label });
            }
            continue;
          }

          const slug =
            `${tbl.integrationType.replace(/_/g, "-")}-${clientId.slice(0, 8)}-${Date.now().toString(36)}`;
          const create = await supabase.functions.invoke("crm-tables", {
            method: "POST",
            body: {
              name: `${c.name} - ${meta.label}`,
              slug,
              category: meta.category,
              integration_type: tbl.integrationType,
              integration_settings: settings,
              agency_id: agencyId,
              client_id: clientId,
            },
          });
          if (create.error) summary.skipped.push(`${meta.label}: ${create.error.message}`);
          else {
            summary.created.push(meta.label);
            const newId = (create.data as any)?.id;
            if (newId) provisioned.push({ id: newId, integrationType: tbl.integrationType, label: meta.label });
          }
        }
      }

      for (const p of provisioned) {
        const syncFn = syncFunctionFor(p.integrationType);
        if (!syncFn) continue;
        try {
          const res = await supabase.functions.invoke(syncFn, { body: { table_id: p.id } });
          if (!res.error) summary.synced.push(p.label);
        } catch {
          // ignore — manual sync remains available
        }
      }

      if (createDashboard) {
        const { data: dash } = await supabase
          .from("crm_dashboards")
          .select("id")
          .eq("client_id", clientId)
          .eq("dashboard_type", "client")
          .maybeSingle();
        if (!dash && tenantId) {
          const homeTenantId = await resolveDashboardHomeTenant({
            uiTenantId: tenantId,
            agencyId,
            clientId,
          });
          const { error: dashErr } = await supabase.from("crm_dashboards").insert({
            tenant_id: homeTenantId,
            name: `דשבורד - ${c.name}`,
            agency_id: agencyId,
            client_id: clientId,
            dashboard_type: "client",
            settings: {},
          } as never);
          if (!dashErr) summary.dashboardCreated = true;
        }
      }

      qc.invalidateQueries({ queryKey: ["all-crm-tables", tenantId] });
      qc.invalidateQueries({ queryKey: ["crm-tables", tenantId] });
      qc.invalidateQueries({ queryKey: ["client-dashboards", clientId] });
      qc.invalidateQueries({ queryKey: ["client-connections", clientId] });
      return summary;
    } finally {
      setProvisioning(false);
    }
  };

  return { provision, provisioning };
}
