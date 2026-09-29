/** Public base for landing-studio (one Vercel project). Set WEB_DESIGN_PUBLIC_BASE_URL in edge secrets. */
export function webDesignPublicUrl(tenantSlug: string, projectSlug: string): string {
  const base = (Deno.env.get("WEB_DESIGN_PUBLIC_BASE_URL") || "").replace(/\/+$/, "");
  if (!base) return "";
  return `${base}/${encodeURIComponent(tenantSlug)}/${encodeURIComponent(projectSlug)}/`;
}
