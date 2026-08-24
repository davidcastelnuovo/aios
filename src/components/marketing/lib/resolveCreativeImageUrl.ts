import { supabase } from "@/integrations/supabase/client";

const PUBLIC_PATH = /\/storage\/v1\/object\/public\/entity-attachments\/([^?]+)/;
const SIGNED_PATH = /\/storage\/v1\/object\/sign\/entity-attachments\/([^?]+)/;
const SIGNED_TTL_SECONDS = 60 * 60 * 24 * 365;

export function extractEntityAttachmentPath(url: string | null | undefined): string | null {
  if (!url) return null;
  const match = url.match(PUBLIC_PATH) ?? url.match(SIGNED_PATH);
  if (!match?.[1]) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

/** Sign private entity-attachments URLs so the browser can actually load them. */
export async function resolveCreativeImageUrl(url: string | null | undefined): Promise<string | null> {
  if (!url) return null;
  if (url.startsWith("data:") || url.startsWith("blob:")) return url;

  const path = extractEntityAttachmentPath(url);
  if (!path) return url;

  const { data, error } = await supabase.storage
    .from("entity-attachments")
    .createSignedUrl(path, SIGNED_TTL_SECONDS);
  if (error || !data?.signedUrl) return url;
  return data.signedUrl;
}
