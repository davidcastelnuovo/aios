/** Connection-pressure thresholds and compute-growth helpers for db-capacity-guard. */

export type PressureLevel = "ok" | "warn" | "critical" | "down";

export const WARN_PCT = 70;
export const CRITICAL_PCT = 85;
export const SCALE_PCT = 92;

export const COMPUTE_LADDER = [
  "ci_nano",
  "ci_micro",
  "ci_small",
  "ci_medium",
  "ci_large",
  "ci_xl",
  "ci_2xl",
  "ci_4xl",
  "ci_8xl",
  "ci_12xl",
  "ci_16xl",
] as const;

export type ComputeVariant = (typeof COMPUTE_LADDER)[number];

export const DEFAULT_MAX_VARIANT: ComputeVariant = "ci_large";

export type ConnectionSnapshot = {
  used: number;
  max: number;
  usable?: number;
  reserved?: number;
  used_pct: number;
  active: number;
  idle: number;
  idle_in_transaction: number;
  waiting?: number;
  oldest_idle_seconds?: number;
};

export function classifyPressure(usedPct: number | null | undefined, reachable = true): PressureLevel {
  if (!reachable) return "down";
  if (usedPct == null || Number.isNaN(usedPct)) return "down";
  if (usedPct >= CRITICAL_PCT) return "critical";
  if (usedPct >= WARN_PCT) return "warn";
  return "ok";
}

export function shouldScale(usedPct: number | null | undefined, reachable = true): boolean {
  return reachable && usedPct != null && usedPct >= SCALE_PCT;
}

export function normalizeComputeVariant(raw: string | null | undefined): ComputeVariant | null {
  if (!raw) return null;
  const trimmed = raw.trim().toLowerCase();
  const prefixed = trimmed.startsWith("ci_") ? trimmed : `ci_${trimmed}`;
  return (COMPUTE_LADDER as readonly string[]).includes(prefixed)
    ? (prefixed as ComputeVariant)
    : null;
}

export function nextComputeVariant(
  current: string | null | undefined,
  maxVariant: string = DEFAULT_MAX_VARIANT,
): ComputeVariant | null {
  const from = normalizeComputeVariant(current) ?? "ci_micro";
  const cap = normalizeComputeVariant(maxVariant) ?? DEFAULT_MAX_VARIANT;
  const fromIdx = COMPUTE_LADDER.indexOf(from);
  const capIdx = COMPUTE_LADDER.indexOf(cap);
  if (fromIdx < 0 || capIdx < 0 || fromIdx >= capIdx) return null;
  return COMPUTE_LADDER[fromIdx + 1];
}

export function extractComputeVariant(payload: unknown): ComputeVariant | null {
  if (!payload || typeof payload !== "object") return null;
  const root = payload as Record<string, unknown>;

  const direct = [
    root.addon_variant,
    root.variant,
    root.infra_compute_size,
    (root.database as Record<string, unknown> | undefined)?.infra_compute_size,
  ];
  for (const value of direct) {
    const normalized = normalizeComputeVariant(typeof value === "string" ? value : null);
    if (normalized) return normalized;
  }

  const lists = [root.addons, root.data];
  for (const list of lists) {
    if (!Array.isArray(list)) continue;
    for (const item of list) {
      if (!item || typeof item !== "object") continue;
      const row = item as Record<string, unknown>;
      const type = String(row.addon_type ?? row.type ?? "");
      if (type && type !== "compute_instance") continue;
      const normalized = normalizeComputeVariant(
        typeof row.addon_variant === "string"
          ? row.addon_variant
          : typeof row.variant === "string"
            ? row.variant
            : null,
      );
      if (normalized) return normalized;
    }
  }
  return null;
}

export function shouldNotify(opts: {
  level: PressureLevel;
  previousLevel?: PressureLevel | null;
  claimed: boolean;
}): boolean {
  if (opts.level === "ok") {
    return opts.previousLevel === "warn" || opts.previousLevel === "critical" || opts.previousLevel === "down";
  }
  return opts.claimed;
}

export function buildCapacityWhatsApp(opts: {
  level: PressureLevel;
  snapshot?: ConnectionSnapshot | null;
  relieved?: number;
  scaledFrom?: string | null;
  scaledTo?: string | null;
  scaleBlockedReason?: string | null;
}): string {
  const snap = opts.snapshot;
  const pct = snap ? `${Number(snap.used_pct).toFixed(0)}%` : "לא ידוע";
  const seats = snap ? `${snap.used}/${snap.max}` : "";

  if (opts.level === "ok") {
    return `חיבורי הדאטאבייס חזרו לנורמה (${pct}${seats ? ` · ${seats}` : ""}).`;
  }

  if (opts.scaledTo) {
    return `העליתי את הדאטאבייס מ-${opts.scaledFrom || "הגודל הקודם"} ל-${opts.scaledTo} כי החיבורים הגיעו ל-${pct}. תהיה השבתה קצרה (עד כשתי דקות).`;
  }

  if (opts.level === "critical") {
    const relief = opts.relieved ? ` שיחררתי ${opts.relieved} חיבורים ישנים.` : "";
    const scaleHint = opts.scaleBlockedReason
      ? ` ${opts.scaleBlockedReason}`
      : "";
    return `עומס חיבורים קריטי: ${pct}${seats ? ` (${seats})` : ""}.${relief}${scaleHint}`;
  }

  return `עומס חיבורים: ${pct}${seats ? ` (${seats})` : ""}. עוד לא קורס — כדאי לפנות חיבורים או להעלות Compute לפני שהמערכת נתקעת.`;
}
