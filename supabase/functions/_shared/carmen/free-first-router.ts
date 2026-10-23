/**
 * Carmen Free-First routing policy (pure, side-effect-free).
 * This selects a model; it never executes tools, authorizes writes, or retrieves
 * API keys. Callers must enforce their existing per-tenant permissions and
 * approval gates independently of the selected model.
 *
 * Model connection discovery / secret storage is owned by AIO-210 (PR #926).
 */

import type {
  TaskDescriptor,
  ModelCandidate,
  RouterSettings,
  RoutingDecision,
  RoutingStatus,
  BrainTier,
} from "./free-first-types.ts";

/**
 * Uses structured task metadata supplied by the caller. This is a cost/quality
 * decision, NOT an authorization or data-sensitivity classifier.
 */
export function routeCarmenTask(
  task: TaskDescriptor,
  settings: RouterSettings,
  candidates: ModelCandidate[],
): RoutingDecision {
  const approval = task.requiresActionApproval === true;
  const result = (
    status: RoutingStatus,
    reason: RoutingDecision["reason"],
    modelId: string | null = null,
    tier: BrainTier | null = null,
    fallbackIds: string[] = [],
  ): RoutingDecision => ({
    status,
    reason,
    modelId,
    tier,
    fallbackIds,
    requiresActionApproval: approval,
  });

  if (task.kind === "deterministic" && task.deterministicAvailable) {
    return result("no_model_needed", "deterministic");
  }

  const eligible = candidates.filter((m) => {
    if (!m.enabled || !m.healthy || !m.quotaAvailable || !m.id) return false;
    if (task.needsToolCalling && !m.supportsTools) return false;
    if (task.needsVision && !m.supportsVision) return false;
    if (task.containsClientData && !m.approvedForClientData) return false;
    return true;
  });
  const byPriority = (a: ModelCandidate, b: ModelCandidate) =>
    (a.priority ?? 100) - (b.priority ?? 100) || a.id.localeCompare(b.id);
  const free = eligible.filter((m) => m.tier === "free").sort(byPriority);
  const premium = eligible
    .filter((m) => m.tier === "premium")
    .sort(byPriority);

  const override = settings.taskOverrides?.[task.kind] ?? "auto";
  const escalated = (task.qualityFailures ?? 0) >= 2;
  const strictFree = override === "free_only";
  const premiumByNature =
    task.kind === "strategy" ||
    task.kind === "development" ||
    task.complexity === "complex";
  const wantsPremium =
    override === "premium" ||
    ((!strictFree && escalated) ||
      (override === "auto" &&
        ((settings.mode === "quality_first" && task.complexity !== "simple") ||
          (settings.mode !== "free_first" && premiumByNature))));
  const preferPremium = wantsPremium && !strictFree;
  const chosenList = preferPremium ? premium : free;
  const alternative = preferPremium ? free : premium;
  const pick = chosenList[0];

  const paidDecision = (m: ModelCandidate): RoutingDecision => {
    const budget = settings.remainingPremiumBudgetUsd ?? 0;
    const projected = m.estimatedCostUsd;
    if (projected === undefined || projected > budget) {
      return result("approval_required", "premium_budget_exceeded", m.id, "premium");
    }
    if (!settings.allowAutomaticPremium) {
      return result("approval_required", "premium_requires_approval", m.id, "premium");
    }
    return result(
      "ready",
      override === "premium" ? "task_rule" : escalated ? "quality_escalation" : "quality_first",
      m.id,
      "premium",
      premium.filter((c) => c.id !== m.id && (c.estimatedCostUsd ?? Infinity) <= budget).map((c) => c.id),
    );
  };

  if (pick) {
    if (pick.tier === "premium") return paidDecision(pick);
    return result(
      "ready",
      override !== "auto" ? "task_rule" : "free_first",
      pick.id,
      "free",
      free.filter((m) => m.id !== pick.id).map((m) => m.id),
    );
  }

  if (strictFree || override === "premium")
    return result("unavailable", "no_eligible_model");
  if (alternative[0]) {
    if (alternative[0].tier === "premium") return paidDecision(alternative[0]);
    // A premium task can fall back to free only when no premium model exists.
    return result(
      "ready",
      "free_first",
      alternative[0].id,
      "free",
      alternative.slice(1).map((m) => m.id),
    );
  }
  return result("unavailable", "no_eligible_model");
}
