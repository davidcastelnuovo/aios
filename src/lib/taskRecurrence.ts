export type RecurrenceFrequency = "daily" | "weekly" | "monthly";

export const WEEKDAY_OPTIONS = [
  { value: 0, label: "יום ראשון" },
  { value: 1, label: "יום שני" },
  { value: 2, label: "יום שלישי" },
  { value: 3, label: "יום רביעי" },
  { value: 4, label: "יום חמישי" },
  { value: 5, label: "יום שישי" },
  { value: 6, label: "יום שבת" },
] as const;

export const RECURRENCE_FREQUENCY_LABELS: Record<RecurrenceFrequency, string> = {
  daily: "כל יום",
  weekly: "כל שבוע",
  monthly: "כל חודש",
};

export function describeRecurrence(options: {
  frequency?: RecurrenceFrequency | null;
  weekday?: number | null;
  monthday?: number | null;
  time?: string | null;
}): string | null {
  if (!options.frequency) return null;
  const parts = [RECURRENCE_FREQUENCY_LABELS[options.frequency]];
  if (options.frequency === "weekly" && options.weekday != null) {
    const weekday = WEEKDAY_OPTIONS.find((item) => item.value === options.weekday);
    if (weekday) parts.push(weekday.label);
  }
  if (options.frequency === "monthly" && options.monthday != null) {
    parts.push(`ביום ${options.monthday}`);
  }
  if (options.time) {
    parts.push(`ב־${options.time.substring(0, 5)}`);
  }
  return parts.join(" · ");
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function addMonthsClamped(date: Date, months: number, monthday: number): Date {
  const next = new Date(date.getFullYear(), date.getMonth() + months, 1);
  const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
  next.setDate(Math.min(monthday, lastDay));
  return next;
}

export function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Next occurrence date (local calendar day) for a recurring task template. */
export function computeNextRecurrenceDate(options: {
  frequency: RecurrenceFrequency;
  interval?: number;
  weekday?: number | null;
  monthday?: number | null;
  fromDate?: Date;
  asOf?: Date;
}): Date {
  const interval = Math.max(1, options.interval ?? 1);
  const asOf = startOfLocalDay(options.asOf ?? new Date());
  let candidate = startOfLocalDay(options.fromDate ?? asOf);

  if (options.frequency === "daily") {
    candidate = addDays(candidate, interval);
    while (candidate <= asOf) {
      candidate = addDays(candidate, interval);
    }
    return candidate;
  }

  if (options.frequency === "weekly") {
    const weekday = options.weekday ?? candidate.getDay();
    candidate = addDays(candidate, 7 * interval);
    const delta = (weekday - candidate.getDay() + 7) % 7;
    candidate = addDays(candidate, delta);
    while (candidate <= asOf) {
      candidate = addDays(candidate, 7 * interval);
    }
    return candidate;
  }

  const monthday = options.monthday ?? candidate.getDate();
  candidate = addMonthsClamped(candidate, interval, monthday);
  while (candidate <= asOf) {
    candidate = addMonthsClamped(candidate, interval, monthday);
  }
  return candidate;
}

/** First occurrence on/after today (or preferredDate), including today when it matches. */
export function computeFirstOccurrenceDate(options: {
  frequency: RecurrenceFrequency;
  weekday?: number | null;
  monthday?: number | null;
  preferredDate?: Date | null;
  asOf?: Date;
}): Date {
  const asOf = startOfLocalDay(options.asOf ?? new Date());
  const preferred = options.preferredDate ? startOfLocalDay(options.preferredDate) : null;
  const from = preferred && preferred >= asOf ? preferred : asOf;

  if (options.frequency === "daily") {
    return from;
  }

  if (options.frequency === "weekly") {
    const weekday = options.weekday ?? from.getDay();
    const delta = (weekday - from.getDay() + 7) % 7;
    return addDays(from, delta);
  }

  const monthday = options.monthday ?? from.getDate();
  const thisMonth = addMonthsClamped(new Date(from.getFullYear(), from.getMonth(), 1), 0, monthday);
  if (thisMonth >= from) return thisMonth;
  return addMonthsClamped(thisMonth, 1, monthday);
}

export function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
