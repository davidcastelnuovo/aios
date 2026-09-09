import type { ModulePermission } from "@/hooks/useUserPermissions";

export type ModuleRouteHandle = {
  permission?: ModulePermission;
  redirectTo?: string;
};

/**
 * Static path → module permission for tenant routes under /t/:slug/*.
 * Longest-prefix match covers dynamic segments (chat/:id, rank-tracking/:id).
 * Exception: `/dashboard/:id` is a client/combined dashboard entity, not the
 * org overview module (`dashboard`). See `isEntityDashboardSubpath`.
 *
 * This is used instead of react-router `useMatches()` / route `handle`, which
 * throw unless the app is on a data router (createBrowserRouter).
 */
const MODULE_ROUTE_PERMISSIONS: Record<string, ModulePermission> = {
  "": "dashboard",
  dashboard: "dashboard",
  agencies: "agencies",
  clients: "clients",
  campaigners: "campaigners",
  suppliers: "suppliers",
  finance: "finance",
  tasks: "tasks",
  "time-tracking": "time_tracking",
  users: "users",
  "sales-dashboard": "sales_dashboard",
  "sales-people": "sales_people",
  leads: "leads",
  "lead-integrations": "lead_integrations",
  tenants: "tenants",
  automations: "automations",
  broadcast: "broadcast",
  products: "leads",
  branding: "branding",
  "accounting-integrations": "accounting_integrations",
  "accounting-settings": "accounting_integrations",
  "menu-management": "menu_management",
  "fields-management": "fields_management",
  "dynamic-tables": "dynamic_tables",
  chat: "chat",
  "chat-integrations": "chat_integrations",
  "manychat-settings": "manychat_settings",
  "green-api-settings": "green_api_settings",
  "manus-wa-settings": "manus_wa_settings",
  "meta-whatsapp-settings": "chat_integrations",
  "llm-settings": "lead_integrations",
  "telegram-settings": "lead_integrations",
  /** Hub — matches menu key `integrations` (not `lead_integrations`). */
  integrations: "integrations",
  "integrations/facebook": "lead_integrations",
  "facebook-settings": "lead_integrations",
  /** Marketing / SEO tools — granted via the integrations hub permission. */
  "google-ads-settings": "integrations",
  "google-analytics-settings": "integrations",
  "google-search-console-settings": "integrations",
  "ahrefs-settings": "integrations",
  "tiktok-settings": "integrations",
  "make-settings": "lead_integrations",
  "site-analytics": "site_analytics",
  "rank-tracking": "rank_tracking",
  "dmm-dashboard": "crm_dashboard",
  "integrations/serpapi": "integrations",
  "zoom-settings": "integrations",
  recordings: "recordings",
  "team-chat": "team_chat",
  signatures: "signatures",
  "manus-settings": "lead_integrations",
  "telephony-settings": "lead_integrations",
  "maskyoo-settings": "lead_integrations",
  "wordpress-settings": "integrations",
  "unified-settings": "lead_integrations",
};

export function permissionHandleForPathname(pathname: string): ModuleRouteHandle | undefined {
  const match = pathname.match(/^\/t\/[^/]+(?:\/(.*))?$/);
  if (!match) return undefined;

  const subpath = (match[1] || "").replace(/\/+$/, "");
  const permission = permissionForSubpath(subpath);
  return permission ? { permission } : undefined;
}

/**
 * `/dashboard` is the org overview module. `/dashboard/:id` is a CRM
 * client/combined dashboard entity — prefix-matching it to `dashboard`
 * sent campaigners to אזור אישי even when they already had client access.
 */
export function isEntityDashboardSubpath(subpath: string): boolean {
  const segments = subpath.split("/").filter(Boolean);
  return segments[0] === "dashboard" && segments.length >= 2;
}

export function permissionForSubpath(subpath: string): ModulePermission | undefined {
  if (Object.prototype.hasOwnProperty.call(MODULE_ROUTE_PERMISSIONS, subpath)) {
    return MODULE_ROUTE_PERMISSIONS[subpath];
  }

  if (isEntityDashboardSubpath(subpath)) {
    return undefined;
  }

  const segments = subpath.split("/").filter(Boolean);
  for (let i = segments.length - 1; i > 0; i--) {
    const prefix = segments.slice(0, i).join("/");
    if (Object.prototype.hasOwnProperty.call(MODULE_ROUTE_PERMISSIONS, prefix)) {
      return MODULE_ROUTE_PERMISSIONS[prefix];
    }
  }

  return undefined;
}
