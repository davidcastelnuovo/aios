// Helpers for generating readable, URL-safe slugs for share links.

const HEBREW_TO_LATIN: Record<string, string> = {
  'א': 'a', 'ב': 'b', 'ג': 'g', 'ד': 'd', 'ה': 'h', 'ו': 'v', 'ז': 'z',
  'ח': 'ch', 'ט': 't', 'י': 'y', 'כ': 'k', 'ך': 'k', 'ל': 'l', 'מ': 'm',
  'ם': 'm', 'נ': 'n', 'ן': 'n', 'ס': 's', 'ע': 'a', 'פ': 'p', 'ף': 'f',
  'צ': 'ts', 'ץ': 'ts', 'ק': 'k', 'ר': 'r', 'ש': 'sh', 'ת': 't',
};

export const SLUG_REGEX = /^[a-zA-Z0-9_-]{3,64}$/;

function transliterate(input: string): string {
  return input
    .split('')
    .map(ch => HEBREW_TO_LATIN[ch] ?? ch)
    .join('');
}

function shortSuffix(): string {
  return Math.random().toString(36).slice(2, 6);
}

/**
 * Extract a readable base slug from a website URL.
 * Strips protocol, "www.", path, and the TLD, keeping the main domain segment.
 * Examples:
 *   https://www.acme-shop.co.il/about  -> "acme-shop"
 *   acme.com                           -> "acme"
 *   sub.example.org                    -> "example"
 */
export function slugFromWebsite(website?: string | null): string | null {
  if (!website) return null;
  try {
    let raw = website.trim();
    if (!raw) return null;
    if (!/^https?:\/\//i.test(raw)) raw = `https://${raw}`;
    const url = new URL(raw);
    let host = url.hostname.toLowerCase().replace(/^www\./, '');
    if (!host) return null;
    // Drop TLD(s): keep the leftmost non-trivial label.
    const parts = host.split('.').filter(Boolean);
    // For "acme.co.il" -> ["acme","co","il"]; for "acme.com" -> ["acme","com"].
    const base = parts[0] || host;
    const cleaned = base.replace(/[^a-z0-9-]/g, '').slice(0, 32);
    return cleaned.length >= 3 ? cleaned : null;
  } catch {
    return null;
  }
}

/**
 * Build a default share token. Prefers the client website; falls back to the
 * given fallback name (e.g. table or dashboard name). Always appends a short
 * random suffix for uniqueness.
 */
export function buildDefaultShareToken(opts: {
  website?: string | null;
  fallbackName?: string | null;
  defaultPrefix?: string;
}): string {
  const { website, fallbackName, defaultPrefix = 'report' } = opts;
  const fromSite = slugFromWebsite(website);
  if (fromSite) return `${fromSite}-${shortSuffix()}`;

  const firstWord = (fallbackName ?? '').trim().split(/\s+/)[0] || defaultPrefix;
  const transliterated = transliterate(firstWord)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 8);
  const base = transliterated || defaultPrefix;
  return `${base}-${shortSuffix()}`;
}
