/** Pure routing contracts; no API credentials or user payloads. */
export type TaskKind =
  | "deterministic"
  | "lead_triage"
  | "customer_reply"
  | "content_draft"
  | "campaign_report"
  | "campaign_analysis"
  | "strategy"
  | "development"
  | "unknown";
export type BrainTier = "free" | "premium";
export type RoutingMode = "free_first" | "smart_auto" | "quality_first";
export type TaskOverride = "auto" | "free_only" | "prefer_free" | "premium";
export type RoutingStatus =
  | "no_model_needed"
  | "ready"
  | "approval_required"
  | "unavailable";

export type TaskDescriptor = {
  kind: TaskKind;
  complexity?: "simple" | "medium" | "complex";
  /** True only if the caller has an actual deterministic execution path. */
  deterministicAvailable?: boolean;
  needsToolCalling?: boolean;
  needsVision?: boolean;
  containsClientData?: boolean;
  /** A quality evaluator or tool validator signalled a failed attempt. */
  qualityFailures?: number;
  /** An action must be approved in the existing approval system. */
  requiresActionApproval?: boolean;
};

export type ModelCandidate = {
  id: string;
  provider: string;
  tier: BrainTier;
  enabled: boolean;
  healthy: boolean;
  quotaAvailable: boolean;
  supportsTools?: boolean;
  supportsVision?: boolean;
  /** Explicitly approved to receive confidential tenant/client data. */
  approvedForClientData?: boolean;
  /** Lower means preferred within the same tier; not a measured quality score. */
  priority?: number;
  /** Projected cost of this invocation in USD, if known. */
  estimatedCostUsd?: number;
};

export type RouterSettings = {
  mode: RoutingMode;
  taskOverrides?: Partial<Record<TaskKind, TaskOverride>>;
  /** Paid usage must never start silently unless this is explicitly true. */
  allowAutomaticPremium: boolean;
  /** Remaining approved spend; omitted means no automatic paid budget. */
  remainingPremiumBudgetUsd?: number;
};

export type RoutingDecision = {
  status: RoutingStatus;
  modelId: string | null;
  tier: BrainTier | null;
  fallbackIds: string[];
  reason:
    | "deterministic"
    | "task_rule"
    | "quality_escalation"
    | "free_first"
    | "quality_first"
    | "premium_requires_approval"
    | "premium_budget_exceeded"
    | "no_eligible_model";
  /** Advisory only; caller must still apply its existing action approval gate. */
  requiresActionApproval: boolean;
};
