/** Resolve magazine image URLs for public PBN pages without widening storage policies. */

export const ENTITY_ATTACHMENTS_BUCKET = "entity-attachments";
/** Longer than publishing-feed / magazine CDN caches (≤5m) so signed URLs survive edge TTL. */
export const MAGAZINE_SIGNED_URL_TTL_SECONDS = 60 * 60 * 24;

export type SignedUrlFactory = (
  bucket: string,
  path: string,
  expiresIn: number,
) => Promise<string | null>;

export function isAbsoluteHttpUrl(value: string | null | undefined): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/** Extract object path from a public/sign entity-attachments URL, or a bare storage path. */
export function extractEntityAttachmentPath(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const bare = trimmed.match(
    /^(?:entity-attachments\/)?([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/publishing\/.+)$/i,
  );
  if (bare) return bare[1];

  try {
    const url = new URL(trimmed);
    const match = url.pathname.match(
      /\/storage\/v1\/object\/(?:public|sign)\/entity-attachments\/(.+)$/,
    );
    if (!match?.[1]) return null;
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
}

/**
 * Public magazine pages may only emit absolute http(s) URLs.
 * Private entity-attachments objects are rewritten to short-lived signed URLs.
 * Relative / missing / unsignable values become null so templates omit <img>.
 */
export async function resolveMagazineImageUrl(
  raw: string | null | undefined,
  createSignedUrl: SignedUrlFactory,
  options: { ttlSeconds?: number } = {},
): Promise<string | null> {
  const ttl = options.ttlSeconds ?? MAGAZINE_SIGNED_URL_TTL_SECONDS;
  const value = typeof raw === "string" ? raw.trim() : "";

  if (!value) return null;
  if (!isAbsoluteHttpUrl(value)) return null;

  const path = extractEntityAttachmentPath(value);
  if (!path) return value;

  return await createSignedUrl(ENTITY_ATTACHMENTS_BUCKET, path, ttl);
}

export async function resolveArticleImageFields<T extends {
  hero_image_url?: string | null;
  inline_image_url?: string | null;
}>(
  article: T,
  createSignedUrl: SignedUrlFactory,
  options?: { ttlSeconds?: number },
): Promise<T> {
  const [hero_image_url, inline_image_url] = await Promise.all([
    resolveMagazineImageUrl(article.hero_image_url, createSignedUrl, options),
    resolveMagazineImageUrl(article.inline_image_url, createSignedUrl, options),
  ]);
  return { ...article, hero_image_url, inline_image_url };
}
