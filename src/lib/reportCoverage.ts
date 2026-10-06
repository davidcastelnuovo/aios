/**
 * A report can only show the days its sync actually stored. When the selected window
 * reaches further back than the earliest stored row, a longer preset silently returns
 * the same totals as a shorter one (e.g. "70 יום אחרונים" matching "30 יום אחרונים"),
 * which reads as a broken filter rather than missing history.
 *
 * `getReportCoverageGap` reports that shortfall so the UI can name it.
 */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export type ReportCoverageGap = {
  /** Earliest day the report actually has data for. */
  earliestAvailable: string;
  /** Days between the selected window start and the first stored day. */
  uncoveredDays: number;
};

/** Ignore the day or two of lag between a provider's last closed day and today. */
const DEFAULT_MIN_UNCOVERED_DAYS = 3;

function normalizeDate(value: string | null | undefined): string | null {
  const date = typeof value === 'string' ? value.slice(0, 10) : '';
  return ISO_DATE.test(date) ? date : null;
}

export function getReportCoverageGap(
  windowStart: string | null | undefined,
  recordDates: Iterable<string | null | undefined>,
  minUncoveredDays: number = DEFAULT_MIN_UNCOVERED_DAYS,
): ReportCoverageGap | null {
  const start = normalizeDate(windowStart);
  if (!start) return null;

  let earliest: string | null = null;
  for (const raw of recordDates) {
    const date = normalizeDate(raw);
    if (!date) continue;
    if (!earliest || date < earliest) earliest = date;
  }
  if (!earliest || earliest <= start) return null;

  const uncoveredDays = Math.round((Date.parse(earliest) - Date.parse(start)) / 86_400_000);
  if (uncoveredDays < minUncoveredDays) return null;

  return { earliestAvailable: earliest, uncoveredDays };
}

/** `yyyy-mm-dd` as the `dd/MM/yyyy` the reports display. */
export function formatReportDate(date: string): string {
  const [year, month, day] = date.split('-');
  return `${day}/${month}/${year}`;
}
