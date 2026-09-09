import { supabase } from "@/integrations/supabase/client";

const BUCKET = "signature-documents";
const SIGNED_TTL_SECONDS = 60 * 60 * 4;

const STORAGE_PATTERNS = [
  /\/storage\/v1\/object\/public\/signature-documents\/([^?]+)/,
  /\/storage\/v1\/object\/sign\/signature-documents\/([^?]+)/,
  /\/storage\/v1\/object\/authenticated\/signature-documents\/([^?]+)/,
];

/** Extract object path inside signature-documents bucket from a stored path or legacy public URL. */
export function extractSignatureDocumentPath(fileUrlOrPath: string | null | undefined): string | null {
  if (!fileUrlOrPath?.trim()) return null;
  const value = fileUrlOrPath.trim();
  if (!value.startsWith("http")) return value;

  for (const pattern of STORAGE_PATTERNS) {
    const match = value.match(pattern);
    if (match?.[1]) {
      try {
        return decodeURIComponent(match[1]);
      } catch {
        return match[1];
      }
    }
  }
  return null;
}

/** Resolve a private signature-documents file to a browser-loadable signed URL. */
export async function resolveSignatureDocumentUrl(
  fileUrlOrPath: string | null | undefined,
): Promise<string | null> {
  if (!fileUrlOrPath?.trim()) return null;
  const value = fileUrlOrPath.trim();

  if (value.startsWith("blob:") || value.startsWith("data:")) return value;

  const path = extractSignatureDocumentPath(value);
  if (!path) {
    // External URL (user pasted link tab) — use as-is
    return value.startsWith("http") ? value : null;
  }

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, SIGNED_TTL_SECONDS);

  if (error || !data?.signedUrl) {
    console.warn("[resolveSignatureDocumentUrl]", error?.message ?? "no signed url");
    return value.startsWith("http") ? value : null;
  }
  return data.signedUrl;
}

/** Storage path to persist in DB (not a public URL). */
export function signatureDocumentStoragePath(tenantId: string, fileName: string): string {
  return `${tenantId}/${Date.now()}_${fileName}`;
}
