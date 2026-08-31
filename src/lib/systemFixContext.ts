/** Context payload for Carmen system-fix chat from the Command Center sidecar. */
export interface SystemFixContextMetadata {
  source: "command_center_sidebar";
  context_type: "system_fix_context";
  path: string;
  search?: string;
  hash?: string;
  tenant_id?: string | null;
  tenant_slug?: string | null;
  agency_id?: string | null;
  client_id?: string | null;
  task_id?: string | null;
  viewport?: { width: number; height: number };
  page_title?: string;
  route_params?: Record<string, string>;
  captured_at: string;
}

export function buildSystemFixContext(args: {
  pathname: string;
  search: string;
  hash: string;
  params: Record<string, string | undefined>;
  tenantId?: string | null;
  tenantSlug?: string | null;
  agencyId?: string | null;
  pageTitle?: string;
}): SystemFixContextMetadata {
  const routeParams = Object.fromEntries(
    Object.entries(args.params).filter(([, v]) => v != null && v !== "") as [string, string][],
  );
  const client_id = routeParams.clientId || routeParams.client_id || undefined;
  const task_id = routeParams.taskId || routeParams.task_id || undefined;

  return {
    source: "command_center_sidebar",
    context_type: "system_fix_context",
    path: args.pathname,
    search: args.search || undefined,
    hash: args.hash || undefined,
    tenant_id: args.tenantId ?? null,
    tenant_slug: args.tenantSlug ?? null,
    agency_id: args.agencyId ?? null,
    client_id: client_id ?? null,
    task_id: task_id ?? null,
    viewport:
      typeof window !== "undefined"
        ? { width: window.innerWidth, height: window.innerHeight }
        : undefined,
    page_title: args.pageTitle || undefined,
    route_params: Object.keys(routeParams).length ? routeParams : undefined,
    captured_at: new Date().toISOString(),
  };
}

export function systemFixPromptAddon(meta: SystemFixContextMetadata): string {
  const lines = [
    "=== הקשר מסך (Command Center sidecar · system fix) ===",
    `source: ${meta.source}`,
    `context: ${meta.context_type}`,
    `path: ${meta.path}${meta.search ?? ""}${meta.hash ?? ""}`,
  ];
  if (meta.tenant_slug) lines.push(`tenant: ${meta.tenant_slug}`);
  if (meta.agency_id) lines.push(`agency_id: ${meta.agency_id}`);
  if (meta.client_id) lines.push(`client_id: ${meta.client_id}`);
  if (meta.task_id) lines.push(`task_id: ${meta.task_id}`);
  if (meta.page_title) lines.push(`page_title: ${meta.page_title}`);
  if (meta.viewport) lines.push(`viewport: ${meta.viewport.width}×${meta.viewport.height}`);
  if (meta.route_params && Object.keys(meta.route_params).length) {
    lines.push(`route_params: ${JSON.stringify(meta.route_params)}`);
  }
  lines.push(
    "",
    "David is viewing this screen and may ask for fixes, corrections, or dev work on what he sees.",
    "Answer normally. Route to Cursor (mcp_Cursor__request_dev_task) ONLY when David explicitly asks — e.g. 'שלחי לפיתוח', 'תריצי דרך קרסר', 'פתחי משימת פיתוח'.",
    "Include this screen context in any dev task you dispatch.",
  );
  return lines.join("\n");
}
