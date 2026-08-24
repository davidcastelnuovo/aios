import { format, isAfter, isBefore, isSameDay, isValid, parseISO, startOfDay } from "date-fns";

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Persist a calendar day as YYYY-MM-DD in the user's local timezone.
 * Never use `date.toISOString().split("T")[0]` — that shifts the day
 * backward for Asia/Jerusalem (and any UTC+ offset).
 */
export function formatTaskDate(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

/**
 * Parse a task `due_date`. A date-only string is local midnight, not UTC.
 * `new Date("2026-08-24")` is UTC midnight and compares as the previous
 * local day in US timezones (and as a different instant in Israel).
 */
export function parseTaskDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) {
    return isValid(value) ? startOfDay(value) : null;
  }
  const trimmed = value.trim();
  if (!trimmed) return null;
  // date-fns parseISO treats YYYY-MM-DD as local midnight (unlike `new Date`).
  if (!DATE_ONLY.test(trimmed) && Number.isNaN(Date.parse(trimmed))) return null;
  const parsed = parseISO(trimmed);
  return isValid(parsed) ? startOfDay(parsed) : null;
}

export function isTaskOnDay(dueDate: string | Date | null | undefined, day: Date): boolean {
  const parsed = parseTaskDate(dueDate);
  return parsed ? isSameDay(parsed, day) : false;
}

export function isTaskDateBefore(dueDate: string | Date | null | undefined, day: Date): boolean {
  const parsed = parseTaskDate(dueDate);
  if (!parsed) return false;
  return isBefore(startOfDay(parsed), startOfDay(day));
}

export function isTaskDateInRange(
  dueDate: string | Date | null | undefined,
  start: Date,
  end: Date,
): boolean {
  const parsed = parseTaskDate(dueDate);
  if (!parsed) return false;
  const day = startOfDay(parsed);
  const rangeStart = startOfDay(start);
  const rangeEnd = startOfDay(end);
  return !isBefore(day, rangeStart) && !isAfter(day, rangeEnd);
}
