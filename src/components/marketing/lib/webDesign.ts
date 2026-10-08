export type WebDesignProjectStatus = "draft" | "building" | "preview" | "published" | "failed";
export type WebDesignKind = "landing" | "minisite";

export interface WebDesignProject {
  id: string;
  tenant_id: string;
  client_id: string | null;
  slug: string;
  title: string;
  kind: WebDesignKind;
  status: WebDesignProjectStatus;
  reference_url: string | null;
  copy_source: "manual" | "copy_department";
  copy_work_item_id: string | null;
  copy_snapshot: string | null;
  intake_notes: string | null;
  reference_image_paths: string[] | null;
  build_version: number;
  cursor_session_url: string | null;
  last_build_error: string | null;
  preview_token: string | null;
  public_url: string | null;
  published_at: string | null;
  updated_at: string;
}

const BUCKET = "web-design-sites";

export function slugifyWebProject(title: string): string {
  const cleaned = title
    .trim()
    .toLowerCase()
    .replace(/[^\w\u0590-\u05FF\s-]+/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  const suffix = Date.now().toString(36).slice(-4);
  return `${cleaned || "landing"}-${suffix}`;
}

export function webDesignStoragePath(tenantId: string, projectId: string, fileName: string) {
  return `${tenantId}/web-design/${projectId}/refs/${fileName}`;
}

export function publicWebDesignBucket() {
  return BUCKET;
}

export function previewUrl(publicBase: string, tenantSlug: string, projectSlug: string, previewToken: string) {
  const base = publicBase.replace(/\/+$/, "");
  if (!base) return "";
  return `${base}/${encodeURIComponent(tenantSlug)}/${encodeURIComponent(projectSlug)}/?preview_token=${encodeURIComponent(previewToken)}`;
}

export function publishedUrl(publicBase: string, tenantSlug: string, projectSlug: string) {
  const base = publicBase.replace(/\/+$/, "");
  if (!base) return "";
  return `${base}/${encodeURIComponent(tenantSlug)}/${encodeURIComponent(projectSlug)}/`;
}

/** Direct Supabase edge serve (works before landing-studio domain is configured). */
export function webDesignServeUrl(
  supabaseUrl: string,
  tenantSlug: string,
  projectSlug: string,
  opts?: { previewToken?: string; file?: string },
) {
  const base = supabaseUrl.replace(/\/+$/, "");
  const url = new URL(`${base}/functions/v1/web-design-serve`);
  url.searchParams.set("tenant_slug", tenantSlug);
  url.searchParams.set("project_slug", projectSlug);
  url.searchParams.set("file", opts?.file ?? "index.html");
  if (opts?.previewToken) url.searchParams.set("preview_token", opts.previewToken);
  return url.toString();
}

export function resolveWebDesignPreviewHref(args: {
  publicBase?: string;
  supabaseUrl?: string;
  tenantSlug: string;
  projectSlug: string;
  previewToken: string;
}): string {
  const viaVercel = previewUrl(args.publicBase ?? "", args.tenantSlug, args.projectSlug, args.previewToken);
  if (viaVercel) return viaVercel;
  if (args.supabaseUrl && args.previewToken) {
    return webDesignServeUrl(args.supabaseUrl, args.tenantSlug, args.projectSlug, {
      previewToken: args.previewToken,
    });
  }
  return "";
}

export function resolveWebDesignPublishedHref(args: {
  publicBase?: string;
  supabaseUrl?: string;
  tenantSlug: string;
  projectSlug: string;
  storedPublicUrl?: string | null;
}): string {
  if (args.storedPublicUrl?.trim()) return args.storedPublicUrl.trim();
  const viaVercel = publishedUrl(args.publicBase ?? "", args.tenantSlug, args.projectSlug);
  if (viaVercel) return viaVercel;
  if (args.supabaseUrl) {
    return webDesignServeUrl(args.supabaseUrl, args.tenantSlug, args.projectSlug);
  }
  return "";
}
