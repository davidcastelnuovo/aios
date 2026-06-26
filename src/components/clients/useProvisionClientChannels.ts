import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CLIENT_CHANNELS, isChannelActive, type ChannelFieldKey } from "@/config/clientChannels";

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
    build: (v) => ({ ad_account_id: v, currency: "ILS", date_range: "last_30_days", sync_frequency: "daily" }),
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

// Mirrors getSyncFunction in ClientReportPanel: only these integrations have a
// sync-to-records function. GA/Ahrefs/Search Console load their data live on
// render, so there is nothing to pre-sync for them.
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

export interface ProvisionSummary {
  created: string[];
  updated: string[];
  skipped: string[];
  synced: string[];
  dashboardCreated: boolean;
}

export function useProvisionClientChannels() {
  const qc = useQueryClient();
  const [provisioning, setProvisioning] = useState(false);

  const provision = async (clientId: string): Promise<ProvisionSummary> => {
    setProvisioning(true);
    const summary: ProvisionSummary = { created: [], updated: [], skipped: [], synced: [], dashboardCreated: false };
    // Tables provisioned this run, to trigger an initial sync for the ones that support it.
    const provisioned: Array<{ id: string; integrationType: string; label: string }> = [];
    try {
      const { data: client, error: clientErr } = await supabase
        .from("clients")
        .select(
          "id, name, tenant_id, agency_id, services, website, ga_property_id, google_ads_account_id, meta_ads_account_id, ahrefs_domain, gsc_site_url"
        )
        .eq("id", clientId)
        .single();
      if (clientErr || !client) throw clientErr || new Error("הלקוח לא נמצא");

      const c = client as Record<string, any>;
      const services: string[] = Array.isArray(c.services) ? c.services : [];
      const tenantId: string | null = c.tenant_id ?? null;
      const agencyId: string | null = c.agency_id ?? null;

      // Resolve the tenant's connected integration row per type (for integrationId).
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

      // Existing tables already linked to this client (idempotency).
      const listRes = await supabase.functions.invoke("crm-tables", { method: "GET" });
      if (listRes.error) throw listRes.error;
      const existing = (Array.isArray(listRes.data) ? listRes.data : []).filter(
        (t: any) => t.client_id === clientId
      );

      const activeChannels = CLIENT_CHANNELS.filter((ch) => isChannelActive(ch, services));
      for (const channel of activeChannels) {
        for (const tbl of channel.tables) {
          const meta = TABLE_META[tbl.integrationType];
          if (!meta) continue;
          const idValue: string = (c[tbl.requiresField as ChannelFieldKey] ?? "").toString().trim();
          if (!idValue) {
            summary.skipped.push(`${meta.label}: חסר מזהה`);
            continue;
          }
          const integrationId = integrationIdByType[tbl.integrationType];
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

      // Best-effort initial sync for integrations that support it (Facebook / Google Ads).
      // Failures here never fail provisioning — the table still exists and can be synced later.
      for (const p of provisioned) {
        const syncFn = syncFunctionFor(p.integrationType);
        if (!syncFn) continue;
        try {
          const res = await supabase.functions.invoke(syncFn, { body: { tableId: p.id, tenantId } });
          if (!res.error) summary.synced.push(p.label);
        } catch {
          // ignore — manual sync remains available in the report panel
        }
      }

      // Ensure a unified client dashboard exists.
      const { data: dash } = await supabase
        .from("crm_dashboards")
        .select("id")
        .eq("client_id", clientId)
        .eq("dashboard_type", "client")
        .maybeSingle();
      if (!dash && tenantId) {
        const { error: dashErr } = await supabase.from("crm_dashboards").insert({
          tenant_id: tenantId,
          name: `דשבורד - ${c.name}`,
          agency_id: agencyId,
          client_id: clientId,
          dashboard_type: "client",
          settings: {},
        } as never);
        if (!dashErr) summary.dashboardCreated = true;
      }

      qc.invalidateQueries({ queryKey: ["all-crm-tables"] });
      qc.invalidateQueries({ queryKey: ["crm-tables"] });
      qc.invalidateQueries({ queryKey: ["client-dashboards", clientId] });
      return summary;
    } finally {
      setProvisioning(false);
    }
  };

  return { provision, provisioning };
}
