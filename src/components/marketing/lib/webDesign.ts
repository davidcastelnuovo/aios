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
