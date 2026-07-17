// Carmen Capability Registry — Phase 1 manifest.
//
// IMPORTANT: This file is intentionally inert. It is not imported by the current
// runtime and every capability is disabled by default. It provides a typed,
// reviewable source for the future agent_tools seed and feature-flagged rollout.

export type CarmenCapabilityRisk =
  | "safe_read"
  | "safe_write"
  | "approval_required"
  | "high_risk";

export type CarmenCapabilityHandlerKind = "internal" | "edge" | "mcp";

export interface CarmenCapabilityDefinition {
  name: string;
  displayName: string;
  category: string