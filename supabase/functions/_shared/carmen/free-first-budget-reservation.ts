/** Atomic paid-inference budget boundary. Data access stays in its own adapter. */
export type BudgetLease = {
  reservationId: string;
  tenantId: string;
  requestId: string;
  modelId: string;
  reservedUsd: number;
};

export type BudgetReserveResult =
  | { ok: true; lease: BudgetLease }
  | { ok: false; reason: "not_approved" | "insufficient_budget" | "already_reserved" | "unknown_cost" };

export type AtomicBudgetStore = {
  /** Must use a single database transaction/row lock keyed by tenant and request. */
  reserve(input: { tenantId: string; requestId: string; modelId: string; estimateUsd: number }): Promise<BudgetReserveResult>;
  /** Must settle once, atomically; unused reservation is refunded on success/failure. */
  settle(input: { reservationId: string; actualCostUsd: number }): Promise<void>;
};

/** Do not call the provider when atomic reservation fails or pricing is unknown. */
export async function withReservedBudget<T>(
  store: AtomicBudgetStore,
  args: { tenantId: string; requestId: string; modelId: string; estimateUsd: number | null },
  perform: () => Promise<{ result: T; actualCostUsd: number }>,
): Promise<{ ok: true; value: T } | { ok: false; reason: "budget_denied" | "invalid_cost" }> {
  if (args.estimateUsd === null || !Number.isFinite(args.estimateUsd) || args.estimateUsd < 0) {
    return { ok: false, reason: "invalid_cost" };
  }
  const reserved = await store.reserve({ ...args, estimateUsd: args.estimateUsd });
  if (!reserved.ok) return { ok: false, reason: "budget_denied" };
  // On transport ambiguity the full reserved sum is charged until an operator
  // or usage reconciliation confirms the actual provider cost.
  try {
    const outcome = await perform();
    if (!Number.isFinite(outcome.actualCostUsd) || outcome.actualCostUsd < 0) {
      await store.settle({ reservationId: reserved.lease.reservationId, actualCostUsd: reserved.lease.reservedUsd });
      return { ok: false, reason: "invalid_cost" };
    }
    await store.settle({
      reservationId: reserved.lease.reservationId,
      actualCostUsd: outcome.actualCostUsd,
    });
    return { ok: true, value: outcome.result };
  } catch (error) {
    await store.settle({ reservationId: reserved.lease.reservationId, actualCostUsd: reserved.lease.reservedUsd });
    throw error;
  }
}
