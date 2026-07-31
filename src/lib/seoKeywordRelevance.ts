/**
 * Relevance of organic/GSC keywords relative to the client's tracked (Ahrefs) list.
 * Used to hide noise in Top 10 (e.g. "בנק דיסקונט…" for an architecture client).
 */

const HE_STOP = new Set([
  "של", "את", "על", "עם", "זה", "זו", "זאת", "או", "גם", "אם", "כי", "יש",
  "אין", "הוא", "היא", "הם", "הן", "אני", "אנחנו", "אתה", "אתם", "כל", "מה",
  "מי", "איך", "למה", "איפה", "כמה", "עוד", "רק", "לא", "כן", "בין", "אחר",
  "אחרי", "לפני", "תוך", "בלי", "עד", "אל", "מן", "ליד", "כמו", "יותר", "פחות",
]);

const EN_STOP = new Set([
  "the", "a", "an", "of", "in", "on", "for", "to", "and", "or", "at", "by",
  "from", "with", "as", "is", "are", "was", "be", "this", "that", "it", "its",
  "near", "near", "how", "what", "where", "when", "who", "why",
]);

export function tokenizeKeyword(raw: string): string[] {
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
    if (isHe) {
      if (part.length < 2) continue;
      if (HE_STOP.has(part)) continue;
      tokens.push(part);
      // Light prefix strip for Hebrew prepositions attached to nouns (ב/ל/מ/ו/ה/כ/ש)
      if (part.length >= 4 && /^[בלמוהכש]/.test(part)) {
        const stripped = part.slice(1);
        if (stripped.length >= 2 && !HE_STOP.has(stripped)) tokens.push(stripped);
      }
    } else if (isEn) {
      if (part.length < 3) continue;
      if (EN_STOP.has(part)) continue;
      tokens.push(part);
    } else if (/\d/.test(part) && part.length >= 2) {
      tokens.push(part);
    }
  }
  return Array.from(new Set(tokens));
}

function normalizePhrase(raw: string): string {
  return String(raw || "")
    .toLowerCase()
    .replace(/[״"׳']/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function buildTrackedTokenIndex(trackedKeywords: Array<{ keyword?: string } | string>): {
  phrases: Set<string>;
  tokens: Set<string>;
} {
  const phrases = new Set<string>();
  const tokens = new Set<string>();
  for (const item of trackedKeywords || []) {
    const kw = typeof item === "string" ? item : item?.keyword;
    const phrase = normalizePhrase(String(kw || ""));
    if (!phrase) continue;
    phrases.add(phrase);
    for (const t of tokenizeKeyword(phrase)) tokens.add(t);
  }
  return { phrases, tokens };
}

/**
 * A keyword is relevant when:
 * - it is itself tracked, or
 * - it contains / is contained by a tracked phrase, or
 * - it shares a meaningful token with the tracked set.
 * When there are no tracked keywords, everything is treated as relevant
 * (we have no signal to filter on).
 */
export function isKeywordRelevantToTracked(
  keyword: string,
  trackedIndex: { phrases: Set<string>; tokens: Set<string> },
  opts?: { forceRelevant?: Set<string>; forceIrrelevant?: Set<string> },
): boolean {
  const phrase = normalizePhrase(keyword);
  if (!phrase) return false;

  if (opts?.forceIrrelevant?.has(phrase)) return false;
  if (opts?.forceRelevant?.has(phrase)) return true;

  if (trackedIndex.phrases.size === 0) return true;
  if (trackedIndex.phrases.has(phrase)) return true;

  for (const tracked of trackedIndex.phrases) {
    if (phrase.includes(tracked) || tracked.includes(phrase)) return true;
  }

  const tokens = tokenizeKeyword(phrase);
  if (tokens.length === 0) return false;
  return tokens.some((t) => trackedIndex.tokens.has(t));
}

export function filterRelevantKeywords<T extends { keyword?: string }>(
  keywords: T[],
  trackedKeywords: Array<{ keyword?: string } | string>,
  opts?: {
    enabled?: boolean;
    forceRelevant?: string[];
    forceIrrelevant?: string[];
  },
): { relevant: T[]; irrelevant: T[] } {
  if (opts?.enabled === false) {
    return { relevant: keywords, irrelevant: [] };
  }
  const index = buildTrackedTokenIndex(trackedKeywords);
  const forceRelevant = new Set(
    (opts?.forceRelevant || []).map(normalizePhrase).filter(Boolean),
  );
  const forceIrrelevant = new Set(
    (opts?.forceIrrelevant || []).map(normalizePhrase).filter(Boolean),
  );

  const relevant: T[] = [];
  const irrelevant: T[] = [];
  for (const kw of keywords) {
    if (
      isKeywordRelevantToTracked(String(kw.keyword || ""), index, {
        forceRelevant,
        forceIrrelevant,
      })
    ) {
      relevant.push(kw);
    } else {
      irrelevant.push(kw);
    }
  }
  return { relevant, irrelevant };
}
