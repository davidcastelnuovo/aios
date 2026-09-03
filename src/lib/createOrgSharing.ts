import { supabase } from "@/integrations/supabase/client";
import { CLIENT_CHANNELS } from "@/config/clientChannels";

export type ShareableResourceKind =
  | "integration"
  | "social_page"
  | "wordpress_site"
  | "crm_table"
  | "automation";

export interface ShareableResource {
  id: string;
  kind: ShareableResourceKind;
  label: string;
  subtitle?: string;
  clientRelated: boolean;
}

export interface CreateOrgShareSelection {
  integration_ids: string[];
  social_page_ids: string[];
  wordpress_site_ids: string[];
  crm_table_ids: string[];
  automation_ids: string[];
}

const INTEGRATION_LABELS: Record<string, string> = {
  facebook_lead_ads: "Facebook Lead Ads",
  facebook_insights: "Facebook Insights",
  facebook_ecommerce: "Facebook Ecommerce",
  google_ads: "Google Ads",
  google_analytics: "Google Analytics",
  google_search_console: "Search Console",
  meta_whatsapp: "WhatsApp (Meta)",
  green_api: "WhatsApp (Green API)",
  manus_wa: "WhatsApp (Manus)",
  ahrefs: "Ahrefs",
  llm: "מפתח AI (LLM)",
  zoom: "Zoom",
  tiktok: "TikTok",
  telegram: "Telegram",
  paycall: "Paycall",
};

function integrationLabel(type: string, displayName?: string | null) {
  return displayName || INTEGRATION_LABELS[type] || type;
}

function automationReferencesClient(configuration: unknown, clientId: string): boolean {
  if (!configuration || typeof configuration !== "object") return false;
  const cfg = configuration as Record<string, unknown>;
  if (cfg.client_id === clientId) return true;
  const steps = cfg.steps ?? cfg.nodes;
  if (!Array.isArray(steps)) return false;
  return steps.some((step) => {
    if (!step || typeof step !== "object") return false;
    const conf = (step as { configuration?: Record<string, unknown> }).configuration;
    return conf?.client_id === clientId;
  });
}

function integrationTypesForClient(client: Record<string, unknown>): Set<string> {
  const types = new Set<string>();
  for (const channel of CLIENT_CHANNELS) {
    for (const table of channel.tables) {
      const fieldValue = client[table.requiresField];
      if (fieldValue) types.add(table.integrationType);
    }
    if (channel.showFacebookPages) types.add("facebook_lead_ads");
  }
  if (client.meta_ads_account_id) {
    types.add("facebook_lead_ads");
    types.add("facebook_insights");
  }
  if (client.google_ads_account_id) types.add("google_ads");
  if (client.ga_property_id) types.add("google_analytics");
  if (client.gsc_site_url) types.add("google_search_console");
  if (client.ahrefs_domain) types.add("ahrefs");
  return types;
}

export async function loadShareableResourcesForClient(
  clientId: string,
  tenantId: string,
): Promise<ShareableResource[]> {
  const { data: client, error: clientErr } = await supabase
    .from("clients")
    .select(
      "id, name, meta_ads_account_id, google_ads_account_id, ga_property_id, gsc_site_url, ahrefs_domain, website, services",
    )
    .eq("id", clientId)
    .maybeSingle();

  if (clientErr || !client) throw clientErr || new Error("Client not found");

  const clientTypes = integrationTypesForClient(client as Record<string, unknown>);

  const [
    integrationsRes,
    pagesRes,
    sitesRes,
    tablesRes,
    automationsRes,
    flowStepsRes,
  ] = await Promise.all([
    supabase
      .from("tenant_integrations")
      .select("id, integration_type, display_name, is_active, user_id, connection_visibility")
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .is("shared_from_integration_id", null),
    supabase
      .from("social_pages")
      .select("id, page_name, platform, client_id")
      .eq("tenant_id", tenantId),
    supabase
      .from("social_media_wordpress_sites")
      .select("id, site_name, site_url, client_id")
      .eq("tenant_id", tenantId),
    supabase
      .from("crm_tables")
      .select("id, name, integration_type, client_id")
      .eq("tenant_id", tenantId),
    supabase
      .from("automations")
      .select("id, name, configuration, is_flow, active")
      .eq("tenant_id", tenantId)
      .eq("active", true),
    supabase
      .from("automation_flow_steps")
      .select("automation_id, configuration")
      .eq("tenant_id", tenantId),
  ]);

  const flowStepsByAutomation = new Map<string, Array<Record<string, unknown>>>();
  for (const step of flowStepsRes.data || []) {
    const list = flowStepsByAutomation.get(step.automation_id) || [];
    list.push((step.configuration || {}) as Record<string, unknown>);
    flowStepsByAutomation.set(step.automation_id, list);
  }

  const clientAutomationIds = new Set<string>();
  const clientIntegrationIds = new Set<string>();

  for (const aut of automationsRes.data || []) {
    const flowSteps = flowStepsByAutomation.get(aut.id) || [];
    const related =
      automationReferencesClient(aut.configuration, clientId) ||
      flowSteps.some((step) => step.client_id === clientId);
    if (related) clientAutomationIds.add(aut.id);
  }

  for (const aut of automationsRes.data || []) {
    if (!clientAutomationIds.has(aut.id)) continue;
    const cfg = (aut.configuration || {}) as Record<string, unknown>;
    if (typeof cfg.integration_id === "string") clientIntegrationIds.add(cfg.integration_id);
    for (const step of flowStepsByAutomation.get(aut.id) || []) {
      if (typeof step.integration_id === "string") clientIntegrationIds.add(step.integration_id);
    }
  }

  const clientTableTypes = new Set(
    (tablesRes.data || [])
      .filter((t) => t.client_id === clientId && t.integration_type)
      .map((t) => t.integration_type as string),
  );

  const resources: ShareableResource[] = [];

  for (const integ of integrationsRes.data || []) {
    if (integ.integration_type === "llm") continue;
    const clientRelated =
      clientTypes.has(integ.integration_type) ||
      clientTableTypes.has(integ.integration_type) ||
      clientIntegrationIds.has(integ.id);
    resources.push({
      id: integ.id,
      kind: "integration",
      label: integrationLabel(integ.integration_type, integ.display_name),
      subtitle: integ.user_id ? "חיבור אישי" : "חיבור ארגוני",
      clientRelated,
    });
  }

  for (const page of pagesRes.data || []) {
    resources.push({
      id: page.id,
      kind: "social_page",
      label: page.page_name || page.platform || "עמוד",
      subtitle: page.platform,
      clientRelated: page.client_id === clientId,
    });
  }

  for (const site of sitesRes.data || []) {
    resources.push({
      id: site.id,
      kind: "wordpress_site",
      label: site.site_name || site.site_url,
      subtitle: site.site_url,
      clientRelated: site.client_id === clientId,
    });
  }

  for (const table of tablesRes.data || []) {
    resources.push({
      id: table.id,
      kind: "crm_table",
      label: table.name,
      subtitle: table.integration_type || undefined,
      clientRelated: table.client_id === clientId,
    });
  }

  for (const aut of automationsRes.data || []) {
    resources.push({
      id: aut.id,
      kind: "automation",
      label: aut.name,
      subtitle: aut.is_flow ? "זרימה" : "אוטומציה",
      clientRelated: clientAutomationIds.has(aut.id),
    });
  }

  return resources;
}

export function defaultSelectionFromResources(resources: ShareableResource[]): CreateOrgShareSelection {
  const pick = (kind: ShareableResourceKind) =>
    resources.filter((r) => r.kind === kind && r.clientRelated).map((r) => r.id);

  return {
    integration_ids: pick("integration"),
    social_page_ids: pick("social_page"),
    wordpress_site_ids: pick("wordpress_site"),
    crm_table_ids: pick("crm_table"),
    automation_ids: pick("automation"),
  };
}

export function countSelection(selection: CreateOrgShareSelection) {
  return (
    selection.integration_ids.length +
    selection.social_page_ids.length +
    selection.wordpress_site_ids.length +
    selection.crm_table_ids.length +
    selection.automation_ids.length
  );
}
