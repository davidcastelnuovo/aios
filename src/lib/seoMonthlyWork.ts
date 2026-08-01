/** Structured monthly SEO work log (client-facing report tab). */

export type SeoOnsiteKind = "meta" | "headline" | "content" | "other";

export type SeoOnsiteItem = {
  id: string;
  kind: SeoOnsiteKind;
  /** What was changed (e.g. page / meta description / H1). */
  title: string;
  notes?: string;
  url?: string;
};

export type SeoArticleItem = {
  id: string;
  /** Article headline. */
  title: string;
  /** Topic / focus. */
  topic: string;
  url?: string;
  notes?: string;
};

export type SeoLinkItem = {
  id: string;
  url: string;
  anchor?: string;
  notes?: string;
};

export type SeoMonthlyWork = {
  summary?: string;
  onsite: SeoOnsiteItem[];
  articles: SeoArticleItem[];
  links: SeoLinkItem[];
};

export const ONSITE_KIND_LABELS: Record<SeoOnsiteKind, string> = {
  meta: "מטא / תיאור",
  headline: "כותרת",
  content: "תוכן באתר",
  other: "אחר",
};

export function emptySeoMonthlyWork(): SeoMonthlyWork {
  return { summary: "", onsite: [], articles: [], links: [] };
}

export function parseSeoMonthlyWork(raw: unknown): SeoMonthlyWork {
  const base = emptySeoMonthlyWork();
  if (!raw || typeof raw !== "object") return base;
  const obj = raw as Record<string, unknown>;
  return {
    summary: typeof obj.summary === "string" ? obj.summary : "",
    onsite: Array.isArray(obj.onsite)
      ? obj.onsite
          .map(normalizeOnsite)
          .filter((x): x is SeoOnsiteItem => !!x)
      : [],
    articles: Array.isArray(obj.articles)
      ? obj.articles
          .map(normalizeArticle)
          .filter((x): x is SeoArticleItem => !!x)
      : [],
    links: Array.isArray(obj.links)
      ? obj.links
          .map(normalizeLink)
          .filter((x): x is SeoLinkItem => !!x)
      : [],
  };
}

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function asString(v: unknown): string {
  return String(v ?? "").trim();
}

function normalizeOnsite(row: unknown): SeoOnsiteItem | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  const title = asString(r.title);
  if (!title) return null;
  const kindRaw = asString(r.kind) || "other";
  const kind: SeoOnsiteKind =
    kindRaw === "meta" || kindRaw === "headline" || kindRaw === "content" || kindRaw === "other"
      ? kindRaw
      : "other";
  return {
    id: asString(r.id) || newId(),
    kind,
    title,
    notes: asString(r.notes) || undefined,
    url: asString(r.url) || undefined,
  };
}

function normalizeArticle(row: unknown): SeoArticleItem | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  const title = asString(r.title);
  if (!title) return null;
  return {
    id: asString(r.id) || newId(),
    title,
    topic: asString(r.topic),
    url: asString(r.url) || undefined,
    notes: asString(r.notes) || undefined,
  };
}

function normalizeLink(row: unknown): SeoLinkItem | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  const url = asString(r.url);
  if (!url) return null;
  return {
    id: asString(r.id) || newId(),
    url,
    anchor: asString(r.anchor) || undefined,
    notes: asString(r.notes) || undefined,
  };
}

export function createOnsiteItem(partial?: Partial<SeoOnsiteItem>): SeoOnsiteItem {
  return {
    id: newId(),
    kind: partial?.kind || "meta",
    title: partial?.title || "",
    notes: partial?.notes,
    url: partial?.url,
  };
}

export function createArticleItem(partial?: Partial<SeoArticleItem>): SeoArticleItem {
  return {
    id: newId(),
    title: partial?.title || "",
    topic: partial?.topic || "",
    url: partial?.url,
    notes: partial?.notes,
  };
}

export function createLinkItem(partial?: Partial<SeoLinkItem>): SeoLinkItem {
  return {
    id: newId(),
    url: partial?.url || "",
    anchor: partial?.anchor,
    notes: partial?.notes,
  };
}

/**
 * The tracking sheets write the same line with and without a bullet, so
 * compare on the text itself rather than the raw string.
 */
function dedupeKey(value: string): string {
  return value
    .replace(/^[\s*•\-–—]+/, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.,:;]+$/, "")
    .toLowerCase();
}

function dropDuplicates<T>(rows: T[], key: (row: T) => string): T[] {
  const seen = new Set<string>();
  return rows.filter((row) => {
    const k = key(row);
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** Drop empty draft rows and duplicates before persisting. */
export function sanitizeSeoMonthlyWork(work: SeoMonthlyWork): SeoMonthlyWork {
  return {
    summary: (work.summary || "").trim(),
    onsite: dropDuplicates(
      work.onsite
        .map((r) => ({
          ...r,
          title: r.title.trim(),
          notes: r.notes?.trim() || undefined,
          url: r.url?.trim() || undefined,
        }))
        .filter((r) => r.title),
      (r) => dedupeKey(r.title),
    ),
    articles: dropDuplicates(
      work.articles
        .map((r) => ({
          ...r,
          title: r.title.trim(),
          topic: r.topic.trim(),
          notes: r.notes?.trim() || undefined,
          url: r.url?.trim() || undefined,
        }))
        .filter((r) => r.title),
      (r) => dedupeKey(r.title),
    ),
    links: dropDuplicates(
      work.links
        .map((r) => ({
          ...r,
          url: r.url.trim(),
          anchor: r.anchor?.trim() || undefined,
          notes: r.notes?.trim() || undefined,
        }))
        .filter((r) => r.url),
      (r) => r.url.toLowerCase(),
    ),
  };
}
