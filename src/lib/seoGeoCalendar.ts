/** Spread content items across calendar days (weekdays only) within a horizon. */
export function spreadContentDates(
  itemCount: number,
  startIso: string,
  horizonMonths: number,
): string[] {
  if (itemCount <= 0) return [];
  const start = new Date(`${startIso.slice(0, 10)}T12:00:00Z`);
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + Math.max(1, horizonMonths));
  const days: Date[] = [];
  for (
    let cursor = new Date(start);
    cursor <= end;
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  ) {
    const dow = cursor.getUTCDay();
    if (dow !== 5 && dow !== 6) days.push(new Date(cursor));
  }
  if (days.length === 0) return [];
  const step = Math.max(1, Math.floor(days.length / itemCount));
  return Array.from({ length: itemCount }, (_, index) => {
    const day = days[Math.min(index * step, days.length - 1)];
    return day.toISOString().slice(0, 10);
  });
}

export function isEntryApproved(status: string) {
  return status === "approved" || status === "auto_approved";
}
