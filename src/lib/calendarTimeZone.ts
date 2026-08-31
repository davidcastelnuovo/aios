/** Asia/Jerusalem calendar helpers — align WooCommerce with WC admin + crm-records. */

export const APP_TIME_ZONE = "Asia/Jerusalem";

export function jerusalemYmd(date: Date = new Date(), timeZone = APP_TIME_ZONE): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function jerusalemWeekdayIndex(date: Date = new Date(), timeZone = APP_TIME_ZONE): number {
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" }).format(date);
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return map[weekday] ?? 0;
}

export function shiftYmd(dateYmd: string, days: number): string {
  const [year, month, day] = dateYmd.split("-").map(Number);
  const utcDate = new Date(Date.UTC(year, month - 1, day));
  utcDate.setUTCDate(utcDate.getUTCDate() + days);
  return utcDate.toISOString().slice(0, 10);
}

function timeZoneOffsetMs(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value || 0);
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second"),
  );
  return asUtc - date.getTime();
}

/** UTC ISO instant for 00:00:00.000 on a Jerusalem calendar day. */
export function jerusalemDayStartIso(dateYmd: string, timeZone = APP_TIME_ZONE): string {
  const [y, m, d] = dateYmd.split("-").map(Number);
  const noonUtc = new Date(Date.UTC(y, m - 1, d, 12, 0, 0, 0));
  const offset = timeZoneOffsetMs(noonUtc, timeZone);
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0) - offset).toISOString();
}

/** UTC ISO instant for 23:59:59.999 on a Jerusalem calendar day. */
export function jerusalemDayEndIso(dateYmd: string, timeZone = APP_TIME_ZONE): string {
  const [y, m, d] = dateYmd.split("-").map(Number);
  const noonUtc = new Date(Date.UTC(y, m - 1, d, 12, 0, 0, 0));
  const offset = timeZoneOffsetMs(noonUtc, timeZone);
  return new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999) - offset).toISOString();
}

export function jerusalemDateRangeToIso(
  startDate: string,
  endDate: string,
  timeZone = APP_TIME_ZONE,
): { start: string; end: string } {
  return {
    start: jerusalemDayStartIso(startDate, timeZone),
    end: jerusalemDayEndIso(endDate, timeZone),
  };
}

/**
 * Dashboard presets on the Jerusalem calendar (Sunday-start weeks).
 * Mirrors supabase/functions/crm-records date filtering.
 */
export function getJerusalemDashboardDateRange(
  filter: string,
  now: Date = new Date(),
  customStart?: string | null,
  customEnd?: string | null,
): { startDate: string | null; endDate: string | null } {
  const today = jerusalemYmd(now);
  const dayOfWeek = jerusalemWeekdayIndex(now);

  switch (filter) {
    case "all":
      return { startDate: null, endDate: null };
    case "today":
      return { startDate: today, endDate: today };
    case "yesterday": {
      const y = shiftYmd(today, -1);
      return { startDate: y, endDate: y };
    }
    case "this_week":
      return { startDate: shiftYmd(today, -dayOfWeek), endDate: today };
    case "last_week": {
      const endOfLastWeek = shiftYmd(today, -(dayOfWeek + 1));
      const startOfLastWeek = shiftYmd(endOfLastWeek, -6);
      return { startDate: startOfLastWeek, endDate: endOfLastWeek };
    }
    case "last_7_days":
      return { startDate: shiftYmd(today, -7), endDate: shiftYmd(today, -1) };
    case "last_14_days":
      return { startDate: shiftYmd(today, -14), endDate: shiftYmd(today, -1) };
    case "last_30_days":
      return { startDate: shiftYmd(today, -30), endDate: shiftYmd(today, -1) };
    case "last_70_days":
      return { startDate: shiftYmd(today, -70), endDate: shiftYmd(today, -1) };
    case "last_90_days":
      return { startDate: shiftYmd(today, -90), endDate: shiftYmd(today, -1) };
    case "last_180_days":
      return { startDate: shiftYmd(today, -180), endDate: shiftYmd(today, -1) };
    case "last_365_days":
      return { startDate: shiftYmd(today, -365), endDate: shiftYmd(today, -1) };
    case "this_month":
      return { startDate: `${today.slice(0, 7)}-01`, endDate: today };
    case "last_month": {
      const endOfLastMonth = shiftYmd(`${today.slice(0, 7)}-01`, -1);
      return { startDate: `${endOfLastMonth.slice(0, 7)}-01`, endDate: endOfLastMonth };
    }
    case "custom":
      if (customStart && customEnd) return { startDate: customStart, endDate: customEnd };
      return { startDate: shiftYmd(today, -30), endDate: shiftYmd(today, -1) };
    default:
      return { startDate: shiftYmd(today, -30), endDate: shiftYmd(today, -1) };
  }
}
