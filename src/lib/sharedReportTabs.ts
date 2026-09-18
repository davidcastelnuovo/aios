/**
 * Which tabs a client sees in an SEO report share link.
 *
 * Stored on `crm_tables.integration_settings.shared_tabs` as `{ [tab]: boolean }`.
 * Anything missing stays visible, so existing share links keep their current tabs.
 */

export const SHARED_REPORT_TAB_KEYS = ["seo", "gsc", "ga", "maskyoo", "monthly_work"] as const;

export type SharedReportTabKey = (typeof SHARED_REPORT_TAB_KEYS)[number];

export type SharedReportTabVisibility = Record<SharedReportTabKey, boolean>;

export const SHARED_REPORT_TAB_LABELS: Record<SharedReportTabKey, string> = {
  seo: "SEO",
  gsc: "Search Console",
  ga: "Analytics",
  maskyoo: "שיחות מסקיו",
  monthly_work: "דוח עבודה שנעשתה",
};

export const SHARED_REPORT_TAB_HINTS: Record<SharedReportTabKey, string> = {
  seo: "מילות מפתח, מיקומים ותנועה אורגנית",
  gsc: "נתוני Google Search Console",
  ga: "נתוני Google Analytics",
  maskyoo: "שיחות נכנסות ממסקיו",
  monthly_work: "הכפתור הירוק שפותח את דוח העבודה",
};

const LEGACY_KEY_ALIASES: Record<string, SharedReportTabKey> = {
  monthlywork: "monthly_work",
  "monthly-work": "monthly_work",
  searchconsole: "gsc",
  analytics: "ga",
  calls: "maskyoo",
};

function normalizeKey(raw: string): SharedReportTabKey | null {
  const key = raw.trim().toLowerCase();
  if ((SHARED_REPORT_TAB_KEYS as readonly string[]).includes(key)) {
    return key as SharedReportTabKey;
  }
  return LEGACY_KEY_ALIASES[key] || null;
}

function allVisible(): SharedReportTabVisibility {
  return {
    seo: true,
    gsc: true,
    ga: true,
    maskyoo: true,
    monthly_work: true,
  };
}

/**
 * Reads the visibility map out of `integration_settings`. Unknown or malformed
 * input falls back to "show everything", and a map that hides every tab keeps
 * the SEO tab so a share link is never blank.
 */
export function parseSharedReportTabs(settings: unknown): SharedReportTabVisibility {
  const visibility = allVisible();
  const raw = (settings as { shared_tabs?: unknown; sharedTabs?: unknown } | null | undefined);
  const stored = raw?.shared_tabs ?? raw?.sharedTabs;
  if (!stored || typeof stored !== "object" || Array.isArray(stored)) return visibility;

  for (const [rawKey, value] of Object.entries(stored as Record<string, unknown>)) {
    const key = normalizeKey(rawKey);
    if (!key) continue;
    if (typeof value === "boolean") visibility[key] = value;
    else if (value === "false" || value === 0) visibility[key] = false;
    else if (value === "true" || value === 1) visibility[key] = true;
  }

  if (!SHARED_REPORT_TAB_KEYS.some((key) => visibility[key])) visibility.seo = true;
  return visibility;
}

export function isSharedReportTabVisible(settings: unknown, key: SharedReportTabKey): boolean {
  return parseSharedReportTabs(settings)[key];
}

/**
 * Merges a single toggle into the stored map, keeping the rest of
 * `integration_settings` untouched.
 */
export function withSharedReportTab(
  settings: unknown,
  key: SharedReportTabKey,
  visible: boolean,
): Record<string, unknown> {
  const base = (settings && typeof settings === "object" && !Array.isArray(settings)
    ? { ...(settings as Record<string, unknown>) }
    : {}) as Record<string, unknown>;
  const next = { ...parseSharedReportTabs(settings), [key]: visible } as SharedReportTabVisibility;
  if (!SHARED_REPORT_TAB_KEYS.some((tab) => next[tab])) next.seo = true;
  base.shared_tabs = next;
  delete base.sharedTabs;
  return base;
}

/** True when turning this tab off would leave the share link with no tabs. */
export function isLastVisibleSharedReportTab(
  visibility: SharedReportTabVisibility,
  key: SharedReportTabKey,
): boolean {
  if (!visibility[key]) return false;
  return SHARED_REPORT_TAB_KEYS.filter((tab) => visibility[tab]).length === 1;
}
