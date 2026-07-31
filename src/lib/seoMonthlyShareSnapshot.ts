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

  const limit = opts.keywordLimit ?? 15;
  const keywords = allKeywords
    .filter((k) => k.position != null && k.position >= 1 && k.position <= 30)
    .sort((a, b) => (a.position ?? 999) - (b.position ?? 999))
    .slice(0, limit);

  let monthLabel = opts.month;
  try {
    monthLabel = format(new Date(`${opts.month}T12:00:00`), "MMMM yyyy", { locale: he });
  } catch {
    /* keep raw */
  }

  return {
    version: 1,
    clientName: opts.clientName.trim() || "לקוח",
    domain: opts.domain?.trim() || undefined,
    month: opts.month,
    monthLabel,
    status: opts.status,
    work,
    metrics,
    keywords,
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
