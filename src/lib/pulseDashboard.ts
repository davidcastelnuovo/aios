/**
 * Helpers for the Pulse Check dashboard (דשבורד בדיקת דופק).
 * Maps deterministic campaign_pulse_snapshots into UI rows, and supports
 * calendar period overrides (this week / last week) from crm_records.
 */

export type PulseStatus = "healthy" | "warning" | "critical" | "no_data";

export type PulsePeriod = "last_7_days" | "this_week" | "last_week";

export const PULSE_PERIOD_OPTIONS: { value: PulsePeriod; label: string }[] = [
  { value: "last_7_days", label: "7 ימים אחרונים" },
  { value: "this_week", label: "השבוע" },
  { value: "last_week", label: "שבוע שעבר" },
];

export type PulseSnapshotRow = {
  client_id: string;
  agency_id: string | null;
  status: PulseStatus;
  is_ecommerce: boolean | null;
  spend_7d: number | null;
  leads_7d: number | null;
  cpl_7d: number | null;
  cpl_change_pct: number | null;
  purchases_7d: number | null;
  revenue_7d: number | null;
  roas_7d: number | null;
  flags: string[] | null;
  data_fresh_through: string | null;
  calculated_at: string | null;
  last_meta_change_at: string | null;
  last_meta_change_type: string | null;
  last_meta_change_actor: string | null;
  last_meta_change_object: string | null;
  meta_change_availability: string | null;
};

/** Period metrics reshaped to the same fields the snapshot table uses. */
export type PulsePeriodMetrics = {
  spend_7d: number;
  leads_7d: number;
  cpl_7d: number | null;
  cpl_change_pct: number | null;
  purchases_7d: number;
  revenue_7d: number;
  roas_7d: number | null;
  data_fresh_through: string | null;
  record_count: number;
};

export function pulseStatusToOverall(status: PulseStatus | null | undefined): "green" | "yellow" | "red" {
  if (status === "critical") return "red";
  if (status === "warning" || status === "no_data") return "yellow";
  if (status === "healthy") return "green";
  return "yellow";
}

export function pulseStatusLabel(status: PulseStatus | null | undefined): string {
  switch (status) {
    case "healthy":
      return "🟢 תקין";
    case "warning":
      return "🟡 תשומת לב";
    case "critical":
      return "🔴 קריטי";
    case "no_data":
      return "🟡 אין טבלת קמפיין מחוברת";
    default:
      return "🟡 ממתין לבדיקה";
  }
}

export function clientHasCampaignService(services: string[] | null | undefined): boolean {
  if (!Array.isArray(services)) return false;
  return services.includes("ppc_meta") || services.includes("ppc_google");
}

export function formatPulseMoney(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "—";
  return `₪${Math.round(Number(value) * 100) / 100}`;
}

export function formatPulseOutcomes(row: Pick<PulseSnapshotRow, "is_ecommerce" | "leads_7d" | "purchases_7d">): string {
  if (row.is_ecommerce) {
    return row.purchases_7d === null || row.purchases_7d === undefined ? "—" : String(row.purchases_7d);
  }
  return row.leads_7d === null || row.leads_7d === undefined ? "—" : String(row.leads_7d);
}

export function formatPulseEfficiency(row: Pick<PulseSnapshotRow, "is_ecommerce" | "cpl_7d" | "roas_7d">): string {
  if (row.is_ecommerce) {
    return row.roas_7d === null || row.roas_7d === undefined ? "—" : `ROAS ${row.roas_7d}`;
  }
  return row.cpl_7d === null || row.cpl_7d === undefined ? "—" : `₪${row.cpl_7d}`;
}

export function formatPulseChange(cplChangePct: number | null | undefined): string {
  if (cplChangePct === null || cplChangePct === undefined) return "—";
  const sign = cplChangePct > 0 ? "+" : "";
  return `${sign}${cplChangePct}%`;
}

export function formatMetaChange(row: PulseSnapshotRow): string {
  if (row.last_meta_change_at) {
    const when = new Date(row.last_meta_change_at).toLocaleString("he-IL", {
      timeZone: "Asia/Jerusalem",
      dateStyle: "short",
      timeStyle: "short",
    });
    const type = row.last_meta_change_type || "שינוי";
    const object = row.last_meta_change_object ? ` (${row.last_meta_change_object})` : "";
    return `${when} — ${type}${object}`;
  }
  if (row.meta_change_availability === "no_campaign_change_in_30d") return "לא נמצא ב-30 יום";
  if (row.meta_change_availability === "not_applicable") return "—";
  return "לא זמין";
}

/** Build shareable authenticated pulse dashboard URL for a tenant + optional agency. */
export function buildPulseDashboardUrl(origin: string, tenantSlug: string, agencyId?: string | null): string {
  const base = `${origin.replace(/\/$/, "")}/${tenantSlug}/dmm-dashboard`;
  if (agencyId && agencyId !== "all") {
    return `${base}?agency=${encodeURIComponent(agencyId)}`;
  }
  return base;
}

/** YYYY-MM-DD in Asia/Jerusalem (matches how campaigners read the dashboard). */
export function jerusalemYmd(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jerusalem",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function ymdToUtcDate(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function utcDateToYmd(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export type PulsePeriodBounds = {
  startDate: string;
  endDate: string;
  prevStartDate: string;
  prevEndDate: string;
  label: string;
};

/**
 * Calendar bounds for pulse period filters.
 * Weeks are Sunday–Saturday (same as SharedTable / public-table / DashboardView).
 * Previous period is the equal-length window immediately before `startDate`
 * (mirrors snapshot CPL change: current window vs prior window).
 */
export function getPulsePeriodBounds(period: PulsePeriod, now: Date = new Date()): PulsePeriodBounds {
  const todayStr = jerusalemYmd(now);
  const today = ymdToUtcDate(todayStr);
  const y = today.getUTCFullYear();
  const m = today.getUTCMonth();
  const d = today.getUTCDate();
  const dow = today.getUTCDay(); // 0 = Sunday

  let start: Date;
  let end: Date;

  if (period === "last_7_days") {
    // Align with campaign-pulse-snapshot rolling window (date >= now-7).
    start = new Date(Date.UTC(y, m, d - 7));
    end = today;
  } else if (period === "this_week") {
    start = new Date(Date.UTC(y, m, d - dow));
    end = today;
  } else {
    // last_week: previous Sun–Sat
    start = new Date(Date.UTC(y, m, d - dow - 7));
    end = new Date(Date.UTC(y, m, d - dow - 1));
  }

  const dayCount = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
  const prevEnd = new Date(start.getTime() - 86_400_000);
  const prevStart = new Date(prevEnd.getTime() - (dayCount - 1) * 86_400_000);
  const label = PULSE_PERIOD_OPTIONS.find((o) => o.value === period)?.label ?? period;

  return {
    startDate: utcDateToYmd(start),
    endDate: utcDateToYmd(end),
    prevStartDate: utcDateToYmd(prevStart),
    prevEndDate: utcDateToYmd(prevEnd),
    label,
  };
}

function round(value: number | null, digits = 2): number | null {
  if (value === null || Number.isNaN(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function inRange(date: string | null | undefined, start: string, end: string): boolean {
  if (!date) return false;
  return date >= start && date <= end;
}

type CrmRecordLike = { data?: Record<string, unknown> | null };

/** Field sum matching campaign-pulse-snapshot (spend/cost, leads/conversions, …). */
function sumFields(rows: CrmRecordLike[], fields: string[]): number {
  return rows.reduce((total, row) => {
    const data = row.data || {};
    const field = fields.find((candidate) => data[candidate] !== undefined && data[candidate] !== null);
    return total + (field ? Number(data[field]) || 0 : 0);
  }, 0);
}

/**
 * Aggregate crm_records into pulse-shaped metrics for a calendar period,
 * with CPL change vs the previous equal-length window (same as snapshot).
 */
export function aggregatePulseMetricsFromRecords(
  records: CrmRecordLike[],
  bounds: PulsePeriodBounds,
  _isEcommerce = false,
): PulsePeriodMetrics {
  const current: CrmRecordLike[] = [];
  const previous: CrmRecordLike[] = [];

  for (const row of records) {
    const date = typeof row.data?.date === "string" ? row.data.date : null;
    if (!date) continue;
    if (inRange(date, bounds.startDate, bounds.endDate)) current.push(row);
    else if (inRange(date, bounds.prevStartDate, bounds.prevEndDate)) previous.push(row);
  }

  const spend = sumFields(current, ["spend", "cost"]);
  const leads = sumFields(current, ["leads", "conversions", "all_conversions"]);
  const purchases = sumFields(current, ["purchases"]);
  const revenue = sumFields(current, ["purchase_value", "conversions_value", "revenue"]);
  const cpl = leads > 0 ? spend / leads : null;
  const roas = spend > 0 ? revenue / spend : null;

  const prevSpend = sumFields(previous, ["spend", "cost"]);
  const prevLeads = sumFields(previous, ["leads", "conversions", "all_conversions"]);
  const prevCpl = prevLeads > 0 ? prevSpend / prevLeads : null;
  const changePct =
    cpl !== null && prevCpl !== null && prevCpl > 0
      ? ((cpl - prevCpl) / prevCpl) * 100
      : null;

  const freshestInPeriod = current
    .map((r) => (typeof r.data?.date === "string" ? r.data.date : null))
    .filter((d): d is string => !!d)
    .sort()
    .reverse()[0] ?? null;

  return {
    spend_7d: round(spend) ?? 0,
    leads_7d: round(leads) ?? 0,
    cpl_7d: round(cpl),
    cpl_change_pct: round(changePct, 1),
    purchases_7d: round(purchases) ?? 0,
    revenue_7d: round(revenue) ?? 0,
    roas_7d: round(roas),
    data_fresh_through: freshestInPeriod,
    record_count: current.length,
  };
}

/** Overlay period metrics onto a snapshot row (keeps meta-change + status/flags). */
export function applyPeriodMetricsToSnapshot(
  snapshot: PulseSnapshotRow,
  metrics: PulsePeriodMetrics,
): PulseSnapshotRow {
  return {
    ...snapshot,
    spend_7d: metrics.spend_7d,
    leads_7d: metrics.leads_7d,
    cpl_7d: metrics.cpl_7d,
    cpl_change_pct: metrics.cpl_change_pct,
    purchases_7d: metrics.purchases_7d,
    revenue_7d: metrics.revenue_7d,
    roas_7d: metrics.roas_7d,
    data_fresh_through: metrics.data_fresh_through ?? snapshot.data_fresh_through,
  };
}

export function pulseSpendColumnLabel(period: PulsePeriod): string {
  if (period === "last_week") return "הוצאה שבוע שעבר";
  if (period === "this_week") return "הוצאה השבוע";
  return "הוצאה 7 ימים";
}
