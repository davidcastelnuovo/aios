/**
 * Sync window rules shared by the ads syncs (Meta insights, Meta ecommerce, Google Ads).
 *
 * Reports read whatever the sync last wrote into `crm_records`, so the sync window —
 * not the date picker — decides how far back a report can actually look. With a
 * 30-day sync window every longer dashboard preset silently returns the same 30
 * days as "30 יום אחרונים".
 *
 * Two rules keep the stored history wide enough:
 *  1. every ads sync pulls at least REPORT_MIN_SYNC_DAYS and always ends today,
 *     regardless of the table's display `date_range`;
 *  2. a sync only clears the days it is about to rewrite, so history older than the
 *     window survives instead of being wiped on every run.
 *
 * Rule 1 mirrors MIN_SYNC_DAYS in `getMainFilterSyncRange` (DynamicTableView), which
 * already protects the Google Analytics / Search Console syncs the same way.
 */

/** Scheduled syncs retain every rolling report preset through 120 days. */
export const REPORT_MIN_SYNC_DAYS = 120;

/**
 * Days a morning run re-fetches so late conversions still move.
 * Older stored rows are left in place.
 */
export const SCHEDULED_REFRESH_DAYS = 14;

/** How far one morning run walks backward into history it has not covered yet. */
export const SCHEDULED_CATCHUP_DAYS = 21;

export type ScheduledSyncPlan = {
  /** Recent days, written on every morning run. */
  refresh: SyncWindow;
  /** Older slice still missing from scheduled coverage, or null once 120 days are covered. */
  catchup: SyncWindow | null;
  /** Oldest day covered after a successful catch-up (or the existing marker when already complete). */
  historyFrom: string;
};

/**
 * Blank or malformed `date` values sort below every real report date, so the prune
 * filter has to sweep them explicitly or they duplicate on every sync.
 */
const EARLIEST_REAL_REPORT_DATE = '1900-01-01';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export type SyncWindow = { startDate: string; endDate: string };

/** Calendar date of `date` in the runtime timezone, as `yyyy-mm-dd`. */
export function toDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function shiftDateString(dateString: string, days: number): string {
  const [year, month, day] = dateString.split('-').map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day));
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return shifted.toISOString().split('T')[0];
}

/**
 * Widen the window a table's `date_range` asks for so it always ends today and
 * reaches back at least `minDays`. A narrower configured range still controls what
 * the table shows by default — it just stops limiting what was ever stored.
 */
export function resolveAdsSyncWindow(
  configured: SyncWindow,
  today: string,
  minDays: number = REPORT_MIN_SYNC_DAYS,
): SyncWindow {
  const endDate = configured.endDate > today ? configured.endDate : today;
  const floor = shiftDateString(today, -minDays);
  const startDate = configured.startDate && configured.startDate < floor ? configured.startDate : floor;
  return { startDate, endDate };
}

/**
 * First day a sync may clear: the window start, pulled back if the provider returned
 * a row dated earlier, so that row replaces its previous version instead of being
 * inserted alongside it.
 */
export function resolvePruneStart(
  window: SyncWindow,
  syncedDates: Iterable<string | null | undefined>,
): string {
  let startDate = window.startDate;
  for (const raw of syncedDates) {
    const date = typeof raw === 'string' ? raw.slice(0, 10) : '';
    if (!ISO_DATE.test(date)) continue;
    if (date < startDate) startDate = date;
  }
  return startDate;
}

/** Calendar date in Asia/Jerusalem, `yyyy-mm-dd`. Morning crons are scheduled in UTC. */
export function jerusalemToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jerusalem',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/**
 * A morning run must finish every account. Re-downloading the full 120-day
 * history for every table timed the cron out after the first batch, so the
 * rest (for example a client synced by hand later) never moved.
 *
 * Each run refreshes the last {@link SCHEDULED_REFRESH_DAYS} and, until
 * `historyFrom` reaches the 120-day floor, also pulls one older slice.
 * Rows outside those slices are not deleted.
 */
export function planScheduledSyncWindows(
  today: string,
  historyFrom: string | null | undefined,
  minHistoryDays: number = REPORT_MIN_SYNC_DAYS,
  refreshDays: number = SCHEDULED_REFRESH_DAYS,
  catchupDays: number = SCHEDULED_CATCHUP_DAYS,
): ScheduledSyncPlan {
  const target = shiftDateString(today, -minHistoryDays);
  const refresh: SyncWindow = {
    startDate: shiftDateString(today, -refreshDays),
    endDate: today,
  };
  const covered = typeof historyFrom === 'string' && ISO_DATE.test(historyFrom.slice(0, 10))
    ? historyFrom.slice(0, 10)
    : null;
  if (covered && covered <= target) {
    return { refresh, catchup: null, historyFrom: covered };
  }

  const frontier = covered && covered < refresh.startDate ? covered : refresh.startDate;
  let chunkStart = shiftDateString(frontier, -catchupDays);
  if (chunkStart < target) chunkStart = target;
  const chunkEnd = shiftDateString(frontier, -1);
  if (chunkEnd < chunkStart) {
    return {
      refresh,
      catchup: null,
      historyFrom: covered && covered < refresh.startDate ? covered : refresh.startDate,
    };
  }
  return {
    refresh,
    catchup: { startDate: chunkStart, endDate: chunkEnd },
    historyFrom: chunkStart,
  };
}

/**
 * PostgREST `or` expression selecting the rows a sync is about to rewrite: everything
 * from `pruneStart` onwards plus rows without a usable date. Rows older than that are
 * real history and are left alone.
 */
export function replacedRecordsFilter(pruneStart: string): string {
  return [
    `data->>date.gte.${pruneStart}`,
    'data->>date.is.null',
    `data->>date.lt.${EARLIEST_REAL_REPORT_DATE}`,
  ].join(',');
}
