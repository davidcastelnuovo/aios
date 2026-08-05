/**
 * Canonical date-range presets for combined / shared dashboards.
 *
 * Keep UI lists and backend handlers aligned via these exports so "שבוע שעבר"
 * (and other core presets) cannot silently disappear from one surface.
 */

export type DateFilterOption = { value: string; label: string };

/** Must appear on every combined / shared ads dashboard date selector. */
export const REQUIRED_COMBINED_DATE_FILTERS: readonly DateFilterOption[] = [
  { value: "this_week", label: "השבוע" },
  { value: "last_week", label: "שבוע שעבר" },
] as const;

/**
 * Authenticated combined dashboard (DashboardView) — client / agency / org.
 * Includes custom range.
 */
export const COMBINED_DASHBOARD_DATE_FILTERS: DateFilterOption[] = [
  { value: "today", label: "היום" },
  { value: "yesterday", label: "אתמול" },
  { value: "this_week", label: "השבוע" },
  { value: "last_week", label: "שבוע שעבר" },
  { value: "last_7_days", label: "7 ימים אחרונים" },
  { value: "last_14_days", label: "14 יום אחרונים" },
  { value: "last_30_days", label: "30 יום אחרונים" },
  { value: "last_70_days", label: "70 יום אחרונים" },
  { value: "this_month", label: "החודש הנוכחי" },
  { value: "last_month", label: "חודש קודם" },
  { value: "custom", label: "טווח מותאם אישית" },
];

/**
 * Public shared combined dashboard (SharedDashboard).
 * No custom picker — but week presets must match the authenticated view.
 */
export const SHARED_COMBINED_DASHBOARD_DATE_FILTERS: DateFilterOption[] = [
  { value: "today", label: "היום" },
  { value: "yesterday", label: "אתמול" },
  { value: "this_week", label: "השבוע" },
  { value: "last_week", label: "שבוע שעבר" },
  { value: "last_7_days", label: "7 ימים אחרונים" },
  { value: "last_30_days", label: "30 יום אחרונים" },
  { value: "last_70_days", label: "70 יום אחרונים" },
  { value: "this_month", label: "החודש הנוכחי" },
  { value: "last_month", label: "חודש קודם" },
];

/** Public shared single-table view (SharedTable). */
export const SHARED_TABLE_DATE_FILTERS: DateFilterOption[] = [
  { value: "today", label: "היום" },
  { value: "yesterday", label: "אתמול" },
  { value: "this_week", label: "השבוע" },
  { value: "last_week", label: "שבוע שעבר" },
  { value: "last_7_days", label: "7 ימים אחרונים" },
  { value: "last_14_days", label: "14 יום אחרונים" },
  { value: "last_30_days", label: "30 יום אחרונים" },
  { value: "last_70_days", label: "70 יום אחרונים" },
  { value: "last_90_days", label: "90 יום אחרונים" },
  { value: "last_180_days", label: "180 יום אחרונים" },
  { value: "last_365_days", label: "שנה אחרונה" },
  { value: "this_month", label: "החודש הנוכחי" },
  { value: "last_month", label: "חודש קודם" },
  { value: "all", label: "הכל" },
];

/** Meta / Google Ads table-create dialogs. */
export const ADS_TABLE_CREATE_DATE_RANGE_OPTIONS: DateFilterOption[] = [
  { value: "today", label: "היום" },
  { value: "yesterday", label: "אתמול" },
  { value: "this_week", label: "השבוע" },
  { value: "last_week", label: "שבוע שעבר" },
  { value: "last_7_days", label: "7 ימים אחרונים" },
  { value: "last_14_days", label: "14 יום" },
  { value: "last_30_days", label: "30 יום (ברירת מחדל)" },
  { value: "this_month", label: "החודש הנוכחי" },
];

export function dateFilterHasOption(
  options: readonly DateFilterOption[],
  value: string,
  expectedLabel?: string,
): boolean {
  const hit = options.find((o) => o.value === value);
  if (!hit) return false;
  if (expectedLabel !== undefined && hit.label !== expectedLabel) return false;
  return true;
}

/** Throws if a combined/shared preset list dropped required week options. */
export function assertCombinedDateFilters(options: readonly DateFilterOption[], surface: string): void {
  for (const req of REQUIRED_COMBINED_DATE_FILTERS) {
    if (!dateFilterHasOption(options, req.value, req.label)) {
      throw new Error(
        `[${surface}] missing required date filter "${req.value}" with Hebrew label "${req.label}"`,
      );
    }
  }
}

/**
 * Calendar bounds for dashboard date filters (Sunday-start weeks).
 * Uses local calendar day of `now` (matches DynamicTableView / public-table).
 */
export function getDashboardDateRange(
  filter: string,
  now: Date = new Date(),
  customStart?: string | null,
  customEnd?: string | null,
): { startDate: string | null; endDate: string | null } {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const fmt = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };
  const subDays = (base: Date, days: number) => {
    const d = new Date(base.getFullYear(), base.getMonth(), base.getDate());
    d.setDate(d.getDate() - days);
    return d;
  };

  switch (filter) {
    case "all":
      return { startDate: null, endDate: null };
    case "today":
      return { startDate: fmt(today), endDate: fmt(today) };
    case "yesterday": {
      const y = subDays(today, 1);
      return { startDate: fmt(y), endDate: fmt(y) };
    }
    case "this_week": {
      const start = subDays(today, today.getDay());
      return { startDate: fmt(start), endDate: fmt(today) };
    }
    case "last_week": {
      const startOfThisWeek = subDays(today, today.getDay());
      const endLW = subDays(startOfThisWeek, 1);
      const startLW = subDays(endLW, 6);
      return { startDate: fmt(startLW), endDate: fmt(endLW) };
    }
    case "last_7_days":
      return { startDate: fmt(subDays(today, 7)), endDate: fmt(subDays(today, 1)) };
    case "last_14_days":
      return { startDate: fmt(subDays(today, 14)), endDate: fmt(subDays(today, 1)) };
    case "last_30_days":
      return { startDate: fmt(subDays(today, 30)), endDate: fmt(subDays(today, 1)) };
    case "last_70_days":
      return { startDate: fmt(subDays(today, 70)), endDate: fmt(subDays(today, 1)) };
    case "last_90_days":
      return { startDate: fmt(subDays(today, 90)), endDate: fmt(subDays(today, 1)) };
    case "last_180_days":
      return { startDate: fmt(subDays(today, 180)), endDate: fmt(subDays(today, 1)) };
    case "last_365_days":
      return { startDate: fmt(subDays(today, 365)), endDate: fmt(subDays(today, 1)) };
    case "this_month":
      return {
        startDate: fmt(new Date(today.getFullYear(), today.getMonth(), 1)),
        endDate: fmt(today),
      };
    case "last_month":
      return {
        startDate: fmt(new Date(today.getFullYear(), today.getMonth() - 1, 1)),
        endDate: fmt(new Date(today.getFullYear(), today.getMonth(), 0)),
      };
    case "custom":
      if (customStart && customEnd) return { startDate: customStart, endDate: customEnd };
      return { startDate: fmt(subDays(today, 30)), endDate: fmt(subDays(today, 1)) };
    default:
      return { startDate: fmt(subDays(today, 30)), endDate: fmt(subDays(today, 1)) };
  }
}
