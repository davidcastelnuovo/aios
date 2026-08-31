import type { Location } from "react-router-dom";

export type SystemFixViewportMode = "desktop" | "mobile";

export interface SystemFixContextPayload {
  source: "command_center_sidebar";
  kind: "system_fix_context";
  pathname: string;
  search: string;
  href: string;
  tenant_slug: string | null;
  route_segments: string[];
  selected_agency_id: string | null;
  client_id: string | null;
  task_id: string | null;
  viewport_mode: SystemFixViewportMode;
  captured_at: string;
}

const CLIENT_SEGMENT_HINTS = new Set([
  "clients",
  "marketing",
  "tasks",
  "leads",
  "dashboard",
  "dynamic-tables",
  "recordings",
  "visual-workspace",
]);

function readSearchParam(search: string, key: string): string | null {
  try {
    const value = new URLSearchParams(search).get(key);
    return value && value.trim() ? value.trim() : null;
  } catch {
    return null;
  }
}

function inferClientId(pathname: string, search: string): string | null {
  const fromQuery = readSearchParam(search, "client") || readSearchParam(search, "clientId");
  if (fromQuery) return fromQuery;

  const parts = pathname.split("/").filter(Boolean);
  const tenantIdx = parts.indexOf("t");
  if (tenantIdx < 0) return null;

  const module = parts[tenantIdx + 2];
  const maybeId = parts[tenantIdx + 3];
  if (!module || !maybeId) return null;
  if (!CLIENT_SEGMENT_HINTS.has(module)) return null;
  if (/^[0-9a-f-]{36}$/i.test(maybeId)) return maybeId;
  return null;
}

function inferTaskId(pathname: string, search: string): string | null {
  const fromQuery = readSearchParam(search, "task") || readSearchParam(search, "taskId");
  if (fromQuery) return fromQuery;

  const parts = pathname.split("/").filter(Boolean);
  const tasksIdx = parts.indexOf("tasks");
  if (tasksIdx >= 0 && parts[tasksIdx + 1] && /^[0-9a-f-]{36}$/i.test(parts[tasksIdx + 1]!)) {
    return parts[tasksIdx + 1]!;
  }
  return null;
}

export function collectSystemFixContext(args: {
  location: Location;
  tenantSlug: string | null;
  selectedAgencyId: string | null;
  viewportMode: SystemFixViewportMode;
}): SystemFixContextPayload {
  const { location, tenantSlug, selectedAgencyId, viewportMode } = args;
  const parts = location.pathname.split("/").filter(Boolean);

  return {
    source: "command_center_sidebar",
    kind: "system_fix_context",
    pathname: location.pathname,
    search: location.search,
    href: typeof window !== "undefined" ? window.location.href : location.pathname + location.search,
    tenant_slug: tenantSlug,
    route_segments: parts.slice(parts.indexOf("t") >= 0 ? parts.indexOf("t") + 2 : 0),
    selected_agency_id: selectedAgencyId && selectedAgencyId !== "all" ? selectedAgencyId : null,
    client_id: inferClientId(location.pathname, location.search),
    task_id: inferTaskId(location.pathname, location.search),
    viewport_mode: viewportMode,
    captured_at: new Date().toISOString(),
  };
}

export function formatSystemFixContextLabel(ctx: SystemFixContextPayload): string {
  const route = ctx.route_segments.length ? `/${ctx.route_segments.join("/")}` : "/";
  const bits = [route];
  if (ctx.client_id) bits.push(`client=${ctx.client_id.slice(0, 8)}…`);
  if (ctx.task_id) bits.push(`task=${ctx.task_id.slice(0, 8)}…`);
  if (ctx.selected_agency_id) bits.push(`agency=${ctx.selected_agency_id.slice(0, 8)}…`);
  return bits.join(" · ");
}

export function buildSystemFixPromptAddon(ctx: SystemFixContextPayload): string {
  return [
    "מקור: command_center_sidebar / system_fix_context",
    "המשתמש רואה את המסך הזה ב-AIOS ומתאר תיקון/שינוי/באג בהקשר הנvisible.",
    `נתיב: ${ctx.pathname}${ctx.search}`,
    ctx.client_id ? `client_id: ${ctx.client_id}` : null,
    ctx.task_id ? `task_id: ${ctx.task_id}` : null,
    ctx.selected_agency_id ? `selected_agency_id: ${ctx.selected_agency_id}` : null,
    `viewport: ${ctx.viewport_mode}`,
    `נלכד ב: ${ctx.captured_at}`,
  ].filter(Boolean).join("\n");
}
