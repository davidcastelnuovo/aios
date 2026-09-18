export type KeywordLike = {
  keyword?: string;
  position?: number | null;
};

export type KeywordCluster<T extends KeywordLike> = {
  key: string;
  label: string;
  keywords: T[];
  avgPosition: number | null;
  bestPosition: number | null;
  shortTail: number;
  longTail: number;
};

const GENERIC_CLUSTER_TOKENS = new Set([
  "טיול",
  "טיולים",
  "מחיר",
  "מחירים",
  "זול",
  "הכי",
  "הטוב",
  "הטובה",
  "מומלץ",
  "אתר",
  "אתרים",
  "שירות",
  "שירותים",
  "חברה",
  "עמוד",
  "דף",
  "בית",
  "best",
  "cheap",
  "tour",
  "tours",
  "trip",
  "travel",
]);

const HE_STOP = new Set([
  "של", "את", "על", "עם", "זה", "זו", "זאת", "או", "גם", "אם", "כי", "יש",
  "אין", "הוא", "היא", "הם", "הן", "אני", "אנחנו", "אתה", "אתם", "כל", "מה",
  "מי", "איך", "למה", "איפה", "כמה", "עוד", "רק", "לא", "כן", "בין", "אחר",
  "אחרי", "לפני", "תוך", "בלי", "עד", "אל", "מן", "ליד", "כמו", "יותר", "פחות",
]);

const EN_STOP = new Set([
  "the", "a", "an", "of", "in", "on", "for", "to", "and", "or", "at", "by",
  "from", "with", "as", "is", "are", "was", "be", "this", "that", "it", "its",
  "near", "how", "what", "where", "when", "who", "why",
]);

function wordCount(phrase: string): number {
  return phrase.trim().split(/\s+/).filter(Boolean).length;
}

function keywordRank(kw: KeywordLike): number | null {
  const rank = kw.position;
  return typeof rank === "number" && Number.isFinite(rank) ? rank : null;
}

export function stemToken(token: string): string {
  if (/[\u0590-\u05FF]/.test(token) && token.length >= 4 && token.endsWith("ים")) {
    return token.slice(0, -2);
  }
  if (/^[a-z]+s$/.test(token) && token.length >= 5) {
    return token.slice(0, -1);
  }
  return token;
}

/** Ordered content stems so "טיול מאורגן לצ'ילה" keeps the bigram טיול מאורגן. */
export function clusterTokens(raw: string): string[] {
  const text = String(raw || "")
    .toLowerCase()
    .replace(/[״"׳']/g, "")
    .replace(/[^\u0590-\u05FFa-z0-9\s-]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return [];

  const tokens: string[] = [];
  for (const part of text.split(/[\s-]+/)) {
    if (!part) continue;
    const isHe = /[\u0590-\u05FF]/.test(part);
    const isEn = /[a-z]/.test(part);
    let token = part;
    if (isHe) {
      if (part.length < 2 || HE_STOP.has(part)) continue;
      if (part.length >= 4 && /^[בל]/.test(part)) {
        const stripped = part.slice(1);
        if (stripped.length >= 2 && !HE_STOP.has(stripped)) token = stripped;
      }
    } else if (isEn) {
      if (part.length < 3 || EN_STOP.has(part)) continue;
    } else if (!(/\d/.test(part) && part.length >= 2)) {
      continue;
    }
    tokens.push(stemToken(token));
  }
  return tokens;
}

function phraseBigrams(stems: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < stems.length - 1; i++) {
    const left = stems[i];
    const right = stems[i + 1];
    if (GENERIC_CLUSTER_TOKENS.has(left) || GENERIC_CLUSTER_TOKENS.has(right)) {
      out.push(`${left} ${right}`);
    }
  }
  return out;
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round((values.reduce((sum, n) => sum + n, 0) / values.length) * 10) / 10;
}

function summarizeCluster<T extends KeywordLike>(key: string, label: string, keywords: T[]): KeywordCluster<T> {
  const ranks = keywords.map(keywordRank).filter((n): n is number => n != null);
  let shortTail = 0;
  let longTail = 0;
  for (const kw of keywords) {
    if (wordCount(String(kw.keyword || "")) <= 2) shortTail += 1;
    else longTail += 1;
  }
  return {
    key,
    label,
    keywords: [...keywords].sort((a, b) => (keywordRank(a) ?? 999) - (keywordRank(b) ?? 999)),
    avgPosition: average(ranks),
    bestPosition: ranks.length ? Math.min(...ranks) : null,
    shortTail,
    longTail,
  };
}

/**
 * Group keywords by shared content tokens / two-word stems.
 * A token that covers too many phrases (e.g. "טיול" at a travel brand) is skipped.
 */
export function clusterKeywords<T extends KeywordLike>(
  keywords: T[],
  opts?: { minSize?: number; maxCoverage?: number },
): KeywordCluster<T>[] {
  const minSize = opts?.minSize ?? 2;
  const maxCoverage = opts?.maxCoverage ?? 0.7;
  const members = new Map<string, T[]>();
  const labels = new Map<string, string>();

  const add = (key: string, label: string, kw: T) => {
    const list = members.get(key) || [];
    list.push(kw);
    members.set(key, list);
    if (!labels.has(key)) labels.set(key, label);
  };

  for (const kw of keywords) {
    const phrase = String(kw.keyword || "").trim();
    if (!phrase) continue;
    const stems = clusterTokens(phrase);
    const keys = [...new Set([...stems, ...phraseBigrams(stems)])];
    for (const key of keys) {
      if (!key || GENERIC_CLUSTER_TOKENS.has(key)) continue;
      if (!key.includes(" ") && key.length < 3 && !/[\u0590-\u05FF]/.test(key)) continue;
      add(key, key, kw);
    }
  }

  const total = Math.max(keywords.length, 1);
  const clusters: KeywordCluster<T>[] = [];
  const assigned = new Set<string>();

  for (const [key, rows] of members) {
    const unique = dedupeKeywords(rows);
    if (unique.length < minSize) continue;
    if (unique.length / total > maxCoverage && !key.includes(" ")) continue;
    clusters.push(summarizeCluster(key, labels.get(key) || key, unique));
    for (const row of unique) assigned.add(String(row.keyword || "").trim().toLowerCase());
  }

  clusters.sort((a, b) => {
    if (b.keywords.length !== a.keywords.length) return b.keywords.length - a.keywords.length;
    return (a.avgPosition ?? 999) - (b.avgPosition ?? 999);
  });

  const leftovers = keywords.filter((kw) => {
    const phrase = String(kw.keyword || "").trim().toLowerCase();
    return phrase && !assigned.has(phrase);
  });
  if (leftovers.length > 0) {
    clusters.push(summarizeCluster("אחר", "אחר", leftovers));
  }
  return clusters;
}

function dedupeKeywords<T extends KeywordLike>(rows: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const row of rows) {
    const key = String(row.keyword || "").trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}
