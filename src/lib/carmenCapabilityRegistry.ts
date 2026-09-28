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
  category: string;
  description?: string;
  risk: CarmenCapabilityRisk;
  handlerKind: CarmenCapabilityHandlerKind;
  handlerRef?: string;
  inputSchema: Record<string, unknown>;
  requiresApproval: boolean;
  enabled: false;
  metadata?: Record<string, unknown>;
}

// Phase 1 deliberately ships no active capabilities. Entries can be reviewed
// here before a later migration seeds them into agent_tools.
export const CARMEN_CAPABILITY_REGISTRY: readonly CarmenCapabilityDefinition[] = [];
