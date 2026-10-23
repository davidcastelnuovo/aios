/**
 * Cost guard and provider health bookkeeping, independent of UI or keys.
 * The caller supplies a server-verified budget ledger; this module never
 * claims to reserve funds or records spend on its own.
 */
export type UsageEvent = {
  tenantId: string;
  requestId: string;
  taskKind: string;
  modelId: string;
  provider: string;
  status: "success" | "error" | "skipped";
  reason: string;
  inputTokens?: number;
  outputTokens?: number;
  latencyMs?: number;
  actualCostUsd?: number;
};

export type BudgetSnapshot = {
  approved: boolean;
  hardLimitUsd: number;
  committedUsd: number;
  spentUsd: number;
  estimatedNextCallUsd: number | null;
};

/**
 * A positive result is *only* a preflight, not a spending authorization.
 * The runtime must atomically reserve the estimated cost against a tenant
 * ledger BEFORE the LLM API request, then reconcile actual usage afterward.
 * Never treat frontend state as a trusted balance.
 */
export function checkPremiumBudget(snapshot: BudgetSnapshot): {
  allowed: boolean;
  reason: "allowed" | "not_approved" | "unknown_cost" | "invalid_budget" | "budget_exceeded";
  remainingUsd: number;
} {
  const n = [snapshot.hardLimitUsd,snapshot.committedUsd,snapshot.spentUsd];
  if (n.some(v => !Number.isFinite(v) || v < 0))
    return {allowed:false,reason:"invalid_budget",remainingUsd:0};
  const remainingUsd = Math.max(0, snapshot.hardLimitUsd - snapshot.spentUsd - snapshot.committedUsd);
  if (!snapshot.approved)
    return {allowed:false,reason:"not_approved",remainingUsd};
  const estimate=snapshot.estimatedNextCallUsd;
  if (estimate===null || !Number.isFinite(estimate) || estimate<0)
    return {allowed:false,reason:"unknown_cost",remainingUsd};
  if (estimate > remainingUsd)
    return {allowed:false,reason:"budget_exceeded",remainingUsd};
  return {allowed:true,reason:"allowed",remainingUsd};
}

/** Trim telemetry to non-sensitive identifiers and numeric metrics. */
export function safeUsageEvent(event: UsageEvent): UsageEvent {
  const finiteNonNegative=(n:number | undefined)=> n===undefined || !Number.isFinite(n) || n<0?undefined:n;
  return {
    tenantId:event.tenantId,
    requestId:event.requestId,
    taskKind:event.taskKind,
    modelId:event.modelId,
    provider:event.provider,
    status:event.status,
    reason:event.reason,
    inputTokens:finiteNonNegative(event.inputTokens),
    outputTokens:finiteNonNegative(event.outputTokens),
    latencyMs:finiteNonNegative(event.latencyMs),
    actualCostUsd:finiteNonNegative(event.actualCostUsd),
  };
}
