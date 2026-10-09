export const STRATEGY_LABELS: Record<string, string> = {
  objective: "מטרה",
  audience: "קהל יעד",
  market: "שוק",
  currentState: "מצב נוכחי",
  opportunity: "הזדמנות",
};

export const CONTENT_TYPE_LABELS: Record<string, string> = {
  pillar: "עמוד מרכזי",
  article: "מאמר",
  comparison: "השוואה",
  landing: "דף נחיתה",
  faq: "שאלות ותשובות",
  case_study: "סיפור לקוח",
};

export const PRIORITY_LABELS: Record<string, string> = {
  high: "גבוהה",
  medium: "בינונית",
  low: "נמוכה",
};

export const GENERATION_LABELS: Record<string, string> = {
  planned: "ממתין לכתיבה",
  generating: "נכתב עכשיו",
  draft: "טיוטה",
  published: "פורסם",
  failed: "נכשל",
};

export const SOURCE_LABELS: Record<string, string> = {
  plan: "מהתוכנית",
  tracked: "מעקב דירוג",
  ahrefs: "Ahrefs",
};

export function hePriority(value?: string | null) {
  return PRIORITY_LABELS[value ?? ""] ?? "בינונית";
}

export function heContentType(value?: string | null) {
  return CONTENT_TYPE_LABELS[value ?? ""] ?? "מאמר";
}

export function heIntent(value?: string | null) {
  const labels: Record<string, string> = {
    informational: "מידע",
    commercial: "מסחרי",
    transactional: "פעולה",
    navigational: "ניווט",
  };
  return String(value ?? "")
    .split("|")
    .map((part) => labels[part.trim()] ?? part.trim())
    .filter(Boolean)
    .join(" · ");
}
