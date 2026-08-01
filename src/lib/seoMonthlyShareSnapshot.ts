import { format } from "date-fns";
import { he } from "date-fns/locale";
import {
  ONSITE_KIND_LABELS,
  SeoMonthlyWork,
  sanitizeSeoMonthlyWork,
} from "@/lib/seoMonthlyWork";

export type SeoShareMetric = {
  key: string;
  label: string;
  value: number;
  prevValue?: number;
};

export type SeoShareKeyword = {
  keyword: string;
  position: number | null;
  volume?: number | null;
  prevPosition?: number | null;
  url?: string;
  /** Search Console figures for the report month. */
  clicks?: number | null;
  impressions?: number | null;
  /** Same keyword at the start of the campaign, for the "since we started" column. */
  baseClicks?: number | null;
  baseImpressions?: number | null;
  basePosition?: number | null;
};

/** Search Console totals for one period. */
export type SeoShareSearchTotals = {
  clicks: number;
  impressions: number;
  /** Click-weighted average position, or null when there is no data. */
  position: number | null;
  keywords: number;
  top3: number;
  top10: number;
  top20: number;
};

export type SeoShareSearch = {
  totals: SeoShareSearchTotals;
  prev?: SeoShareSearchTotals;
  /** Totals for the first month of the campaign. */
  base?: SeoShareSearchTotals;
  baseLabel?: string;
};

/** An external link, tagged with the month it was published in. */
export type SeoShareRecentLink = {
  id: string;
  url: string;
  anchor?: string;
  notes?: string;
  month: string;
  monthLabel: string;
};

export type SeoMonthlyShareSnapshot = {
  version: 1;
  clientName: string;
  domain?: string;
  month: string;
  monthLabel: string;
  status: "up" | "stable" | "down";
  work: SeoMonthlyWork;
  metrics: SeoShareMetric[];
  keywords: SeoShareKeyword[];
  /** Search Console performance for the month (absent when GSC isn't connected). */
  search?: SeoShareSearch;
  /** External links from the last three months, newest first. */
  recentLinks?: SeoShareRecentLink[];
  generatedAt: string;
};

export const STATUS_LABELS: Record<SeoMonthlyShareSnapshot["status"], string> = {
  up: "עלייה",
  stable: "יציב",
  down: "ירידה",
};

function getNum(obj: Record<string, unknown>, ...keys: string[]): number | undefined {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  }
  return undefined;
}

function countAtOrBelow(kws: Array<{ position?: number | null }>, maxPos: number): number {
  let n = 0;
  for (const kw of kws) {
    const p = kw.position;
    if (typeof p === "number" && p >= 1 && p <= maxPos) n++;
  }
  return n;
}

export type GscRow = {
  keyword: string;
  clicks?: number;
  impressions?: number;
  position?: number;
  ctr?: number;
};

function toMonthLabel(month: string): string {
  try {
    return format(new Date(`${month}T12:00:00`), "MMMM yyyy", { locale: he });
  } catch {
    return month;
  }
}

function gscTotals(rows: GscRow[]): SeoShareSearchTotals {
  let clicks = 0;
  let impressions = 0;
  let weighted = 0;
  let weight = 0;
  let top3 = 0;
  let top10 = 0;
  let top20 = 0;
  for (const r of rows) {
    const c = Number(r.clicks) || 0;
    const i = Number(r.impressions) || 0;
    clicks += c;
    impressions += i;
    const p = Number(r.position);
    if (Number.isFinite(p) && p > 0) {
      // Impressions-weighted so a long tail of rarely-seen terms can't skew it.
      weighted += p * (i || 1);
      weight += i || 1;
      if (p <= 3) top3++;
      if (p <= 10) top10++;
      if (p <= 20) top20++;
    }
  }
  return {
    clicks,
    impressions,
    position: weight > 0 ? Math.round((weighted / weight) * 10) / 10 : null,
    keywords: rows.length,
    top3,
    top10,
    top20,
  };
}

function normalizeKeywordRow(kw: any): SeoShareKeyword | null {
  const keyword = String(kw?.keyword || "").trim();
  if (!keyword) return null;
  const positionRaw = kw?.position ?? kw?.best_position;
  const position =
    typeof positionRaw === "number" && Number.isFinite(positionRaw) ? positionRaw : null;
  const volumeRaw = kw?.volume ?? kw?.search_volume;
  const volume =
    typeof volumeRaw === "number" && Number.isFinite(volumeRaw) ? volumeRaw : null;
  const prevRaw = kw?.position_prev_month;
  const prevPosition =
    typeof prevRaw === "number" && Number.isFinite(prevRaw) ? prevRaw : null;
  const url = String(kw?.url || kw?.best_position_url || "").trim() || undefined;
  return { keyword, position, volume, prevPosition, url };
}

/** Build a frozen slideshow snapshot from the monthly work + latest Ahrefs report. */
export function buildSeoMonthlyShareSnapshot(opts: {
  clientName: string;
  domain?: string | null;
  month: string;
  status: "up" | "stable" | "down";
  work: SeoMonthlyWork;
  reportData?: Record<string, unknown> | null;
  keywordLimit?: number;
  /** Search Console rows for the month, the month before, and the campaign start. */
  gsc?: {
    current?: GscRow[];
    prev?: GscRow[];
    baseline?: GscRow[];
    baselineMonth?: string | null;
  } | null;
  /** External links from the previous months, so the links slide can span a quarter. */
  recentLinks?: SeoShareRecentLink[];
}): SeoMonthlyShareSnapshot {
  const work = sanitizeSeoMonthlyWork(opts.work);
  const rd = (opts.reportData || {}) as Record<string, unknown>;
  const snapshot = (rd.snapshot && typeof rd.snapshot === "object"
    ? (rd.snapshot as Record<string, unknown>)
    : {}) as Record<string, unknown>;
  const prev = (rd.snapshot_prev_month && typeof rd.snapshot_prev_month === "object"
    ? (rd.snapshot_prev_month as Record<string, unknown>)
    : rd.snapshot_prev && typeof rd.snapshot_prev === "object"
      ? (rd.snapshot_prev as Record<string, unknown>)
      : {}) as Record<string, unknown>;

  const tracked = Array.isArray(rd.tracked_keywords) ? rd.tracked_keywords : [];
  const organic = Array.isArray(rd.organic_keywords) ? rd.organic_keywords : [];
  const byKw = new Map<string, SeoShareKeyword>();
  for (const raw of [...tracked, ...organic]) {
    const row = normalizeKeywordRow(raw);
    if (!row) continue;
    const key = row.keyword.toLowerCase();
    const existing = byKw.get(key);
    if (!existing) {
      byKw.set(key, row);
      continue;
    }
    // Prefer the better (lower) position when merging tracked + organic.
    if (
      row.position != null &&
      (existing.position == null || row.position < existing.position)
    ) {
      byKw.set(key, { ...existing, ...row });
    }
  }
  const allKeywords = Array.from(byKw.values());

  const liveTop3 = countAtOrBelow(allKeywords, 3);
  const liveTop20 = countAtOrBelow(allKeywords, 20);
  const snapTop3 = getNum(snapshot, "org_keywords_top3");

  const metricDefs: Array<{
    key: string;
    label: string;
    keys: string[];
    value?: number;
  }> = [
    { key: "dr", label: "דירוג דומיין (DR)", keys: ["domain_rating", "dr"] },
    { key: "org_traffic", label: "תנועה אורגנית", keys: ["org_traffic"] },
    {
      key: "top3",
      label: "מילות מפתח Top 3",
      keys: ["org_keywords_top3"],
      value: liveTop3 > (snapTop3 ?? 0) ? liveTop3 : snapTop3,
    },
    {
      key: "top20",
      label: "מילות מפתח Top 20",
      keys: ["org_keywords_top20"],
      value: allKeywords.length > 0 ? liveTop20 : getNum(snapshot, "org_keywords_top20"),
    },
    { key: "keywords_total", label: "סה״כ מילות מפתח", keys: ["org_keywords_total"] },
    {
      key: "referring_domains",
      label: "דומיינים מפנים",
      keys: ["referring_domains", "referring_domains_all_time"],
    },
    { key: "backlinks_live", label: "קישורים נכנסים", keys: ["backlinks_live"] },
  ];

  const metrics: SeoShareMetric[] = [];
  for (const def of metricDefs) {
    const value = def.value !== undefined ? def.value : getNum(snapshot, ...def.keys);
    if (value === undefined) continue;
    const prevValue = getNum(prev, ...def.keys);
    metrics.push({
      key: def.key,
      label: def.label,
      value,
      prevValue,
    });
  }

  // ── Search Console ────────────────────────────────────────────────────────
  const gscCurrent = opts.gsc?.current ?? [];
  const gscPrev = opts.gsc?.prev ?? [];
  const gscBase = opts.gsc?.baseline ?? [];
  const hasGsc = gscCurrent.length > 0;

  let search: SeoShareSearch | undefined;
  if (hasGsc) {
    search = {
      totals: gscTotals(gscCurrent),
      prev: gscPrev.length ? gscTotals(gscPrev) : undefined,
      base: gscBase.length ? gscTotals(gscBase) : undefined,
      baseLabel: opts.gsc?.baselineMonth ? toMonthLabel(opts.gsc.baselineMonth) : undefined,
    };

    const baseByKw = new Map(gscBase.map((r) => [r.keyword.toLowerCase(), r]));
    const ahrefsByKw = new Map(allKeywords.map((k) => [k.keyword.toLowerCase(), k]));
    for (const row of gscCurrent) {
      const key = row.keyword.toLowerCase();
      const base = baseByKw.get(key);
      const ahrefs = ahrefsByKw.get(key);
      const position = Number.isFinite(Number(row.position)) ? Number(row.position) : null;
      byKw.set(key, {
        keyword: row.keyword,
        position: position != null ? Math.round(position * 10) / 10 : (ahrefs?.position ?? null),
        volume: ahrefs?.volume ?? null,
        prevPosition: ahrefs?.prevPosition ?? null,
        url: ahrefs?.url,
        clicks: Number(row.clicks) || 0,
        impressions: Number(row.impressions) || 0,
        baseClicks: base ? Number(base.clicks) || 0 : null,
        baseImpressions: base ? Number(base.impressions) || 0 : null,
        basePosition:
          base && Number.isFinite(Number(base.position))
            ? Math.round(Number(base.position) * 10) / 10
            : null,
      });
    }
  }

  const merged = Array.from(byKw.values());
  const limit = opts.keywordLimit ?? 20;
  const keywords = hasGsc
    ? // Impressions first: these are the terms the client is actually seen for.
      merged
        .filter((k) => (k.impressions ?? 0) > 0 || (k.clicks ?? 0) > 0)
        .sort(
          (a, b) =>
            (b.clicks ?? 0) - (a.clicks ?? 0) ||
            (b.impressions ?? 0) - (a.impressions ?? 0) ||
            (a.position ?? 999) - (b.position ?? 999),
        )
        .slice(0, limit)
    : merged
        .filter((k) => k.position != null && k.position >= 1 && k.position <= 30)
        .sort((a, b) => (a.position ?? 999) - (b.position ?? 999))
        .slice(0, limit);

  // Search Console reflects reality better than the Ahrefs snapshot, which is
  // often stale or empty for small sites — prefer it for the headline numbers.
  if (search) {
    const upsert = (key: string, label: string, value: number, prevValue?: number) => {
      const idx = metrics.findIndex((m) => m.key === key);
      const entry: SeoShareMetric = { key, label, value, prevValue };
      if (idx >= 0) metrics[idx] = entry;
      else metrics.push(entry);
    };
    upsert("gsc_clicks", "קליקים מגוגל", search.totals.clicks, search.prev?.clicks);
    upsert("gsc_impressions", "חשיפות בגוגל", search.totals.impressions, search.prev?.impressions);
    upsert("top20", "ביטויים ב-Top 20", search.totals.top20, search.prev?.top20);
    upsert("top3", "ביטויים ב-Top 3", search.totals.top3, search.prev?.top3);
    upsert("keywords_total", "ביטויים עם חשיפות", search.totals.keywords, search.prev?.keywords);

    const order = [
      "gsc_clicks",
      "gsc_impressions",
      "top3",
      "top20",
      "keywords_total",
      "org_traffic",
      "dr",
      "referring_domains",
      "backlinks_live",
    ];
    metrics.sort((a, b) => {
      const ia = order.indexOf(a.key);
      const ib = order.indexOf(b.key);
      return (ia < 0 ? order.length : ia) - (ib < 0 ? order.length : ib);
    });
  }

  return {
    version: 1,
    clientName: opts.clientName.trim() || "לקוח",
    domain: opts.domain?.trim() || undefined,
    month: opts.month,
    monthLabel: toMonthLabel(opts.month),
    status: opts.status,
    work,
    metrics,
    keywords,
    search,
    recentLinks: opts.recentLinks?.length ? opts.recentLinks : undefined,
    generatedAt: new Date().toISOString(),
  };
}

export function onsiteKindLabel(kind: string): string {
  return ONSITE_KIND_LABELS[kind as keyof typeof ONSITE_KIND_LABELS] || kind;
}

export function isSeoMonthlyShareSnapshot(raw: unknown): raw is SeoMonthlyShareSnapshot {
  if (!raw || typeof raw !== "object") return false;
  const o = raw as Record<string, unknown>;
  return o.version === 1 && typeof o.clientName === "string" && typeof o.month === "string";
}
