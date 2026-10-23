/**
 * Retry / failover safety planner for Carmen. Pure logic only.
 * An LLM API request can be retried BEFORE tool execution; replaying a
 * completed tool action (send/update/purchase) is never allowed by this layer.
 */
import type { RoutingDecision } from "./free-first-types.ts";

export type FailureKind =
  | "rate_limit"
  | "quota"
  | "timeout"
  | "provider_unavailable"
  | "invalid_request"
  | "authentication"
  | "quality"
  | "tool_execution";

export type AttemptState = {
  completedToolCalls: number;
  /** True when the LLM's current request is known to have no side effects. */
  inferenceOnly: boolean;
  attemptedModelIds: string[];
  nextRound?: number;
  maxRetries?: number;
};

export type FailoverAction =
  | { kind: "retry_model"; modelId: string; reason: FailureKind }
  | { kind: "resume_from_checkpoint"; reason: FailureKind }
  | { kind: "stop"; reason: FailureKind | "no_fallback" | "retry_limit" };

const RETRYABLE = new Set<FailureKind>([
  "rate_limit", "quota", "timeout", "provider_unavailable", "quality",
]);

export function planSafeFailover(
  decision: RoutingDecision,
  failure: FailureKind,
  state: AttemptState,
): FailoverAction {
  if (state.completedToolCalls > 0 || !state.inferenceOnly) {
    return { kind: "resume_from_checkpoint", reason: failure };
  }
  if (failure === "tool_execution")
    return { kind: "stop", reason: failure };
  if (!RETRYABLE.has(failure))
    return { kind: "stop", reason: failure };
  if (state.attemptedModelIds.length >= (state.maxRetries ?? 3) + 1)
    return { kind: "stop", reason: "retry_limit" };
  if (decision.status !== "ready")
    return { kind: "stop", reason: "no_fallback" };
  const next = decision.fallbackIds.find(id =>
    !state.attemptedModelIds.includes(id) && id !== decision.modelId
  );
  return next
    ? { kind: "retry_model", modelId: next, reason: failure }
    : { kind: "stop", reason: "no_fallback" };
}
