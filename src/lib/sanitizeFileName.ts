/** Safe object key for Supabase Storage (ASCII only, no path separators). */
export function sanitizeFileName(name: string): string {
  const dot = name.lastIndexOf(".");
  const ext = dot > 0 ? name.slice(dot) : "";
  const baseName = dot > 0 ? name.slice(0, dot) : name;
  const sanitized = baseName
    .replace(/[/\\]/g, "_")
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 50);
  const safeBase = sanitized || "file";
  const safeExt = ext.replace(/[^a-zA-Z0-9.]/g, "").toLowerCase();
  return safeBase + safeExt;
}
