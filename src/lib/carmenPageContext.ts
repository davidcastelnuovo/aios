import type { Params } from "react-router-dom";

/** Serializable UI context attached to Carmen sidecar / contextual chat sends. */
export type CarmenUiContext = {
  pathname: string;
  page_title: string;
  module: string | null;
  tenant_slug: string | null;
  command_center_view: string | null;
  route_params: Record<string, string>;
  search: string;
  captured_at: string;
};

const MODULE_LABELS: Record<string, string> = {
  clients: "לקוחות",
  leads: "לידים",
  tasks: "משימות",
  "command-center": "מרכז בקרה",
  automations: "אוטומציות",
  finance: "כספים",
  dashboard: "דשבורד",
};

function moduleFromPath(pathname: string): string | null {
  const m = pathname.match(/\/t\/[^/]+\/([^/?]+)/);
  if (!m) return null;
  return MODULE_LABELS[m[1]] ? m[1] : m[1];
}

export function moduleLabel(module: string | null): string {
  if (!module) return "מערכת";
  return MODULE_LABELS[module] ?? module;
}

export function collectCarmenUiContext(args: {
  pathname: string;
  search?: string;
  params?: Params<string>;
  commandCenterView?: string | null;
}): CarmenUiContext {
  const params = args.params ?? {};
  const routeParams: Record<string, string> = {};
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== "") routeParams[k] = v;
  }

  return {
    pathname: args.pathname,
    page_title: typeof document !== "undefined" ? document.title : "",
    module: moduleFromPath(args.pathname),
    tenant_slug: routeParams.tenantSlug ?? null,
    command_center_view: args.commandCenterView ?? null,
    route_params: routeParams,
    search: args.search ?? "",
    captured_at: new Date().toISOString(),
  };
}

export function formatUiContextForPrompt(ctx: CarmenUiContext): string {
  const lines = [
    `מסלול: ${ctx.pathname}`,
    `מודול: ${moduleLabel(ctx.module)}`,
    ctx.page_title ? `כותרת: ${ctx.page_title}` : null,
    ctx.command_center_view ? `מצב מרכז בקרה: ${ctx.command_center_view}` : null,
  ];
  const ids = Object.entries(ctx.route_params).filter(([k]) => !["tenantSlug"].includes(k));
  if (ids.length) {
    lines.push(`מזהים מהנתיב: ${ids.map(([k, v]) => `${k}=${v}`).join(", ")}`);
  }
  if (ctx.search) lines.push(`query: ${ctx.search}`);
  return lines.filter(Boolean).join("\n");
}
