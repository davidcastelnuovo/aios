/** Discrete priority bar colors: blue → green → yellow → orange → red. */
export function priorityBarColor(priority: number): string {
  const n = Math.min(10, Math.max(1, Math.round(Number(priority) || 1)));
  if (n <= 2) return "#3b82f6";
  if (n <= 4) return "#22c55e";
  if (n <= 6) return "#eab308";
  if (n <= 8) return "#f97316";
  return "#ef4444";
}

export const PRIORITY_BAR_LABELS = ["נמוכה", "בינונית", "גבוהה", "דחופה"] as const;
