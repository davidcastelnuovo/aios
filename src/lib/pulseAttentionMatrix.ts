import type { PulseCampaignGoal, PulseCampaignGoalRow } from "@/lib/pulseCampaignGoals";
import {
  buildPlatformTargetPatch as buildPatch,
  buildPulseAttentionRows as buildRows,
  evaluateEfficiencyIssue as evaluateEfficiency,
  platformTargetFieldKey as targetFieldKey,
  readApprovedPlatformTarget as readApproved,
  resolvePlatformTarget as resolveTarget,
} from "../../supabase/functions/_shared/pulse-attention-matrix.mjs";

export type PulseAttentionIssueLevel = "ok" | "watch" | "alert";

export type PulseAttentionIssue = {
  level: PulseAttentionIssueLevel;
  label: string;
};

export type PulsePlatformTarget = {
  value: number;
  kind: "cpl" | "roas" | "cpa" | "cost_per_result";
  direction: "minimum" | "maximum";
  source: "approved" | "baseline_30d";
};

export type PulseAttentionClientContext = {
  clientId: string;
  clientName: string;
  campaignerName: string;
  moodStatus: string | null;
  lastClientCallAt: string | null;
  daysSinceLastCommunication: number | null;
  recentCommunicationStatus: "normal" | "sensitive" | "complaint" | null;
  hasRecentComplaintUpdate: boolean;
};

export type PulseAttentionRow = {
  clientId: string;
  clientName: string;
  campaignerName: string;
  platform: "meta" | "google";
  tableId: string | null;
  primaryGoal: PulseCampaignGoal;
  target: PulsePlatformTarget | null;
  currentEfficiency: number | null;
  spend7d: number;
  issues: {
    campaignTouch: PulseAttentionIssue | null;
    efficiency: PulseAttentionIssue | null;
    lastCommunication: PulseAttentionIssue | null;
    complaintUpdate: PulseAttentionIssue | null;
    satisfaction: PulseAttentionIssue | null;
  };
  hasAnyIssue: boolean;
};

type PlatformTable = {
  id: string;
  client_id: string;
  integration_type: string | null;
  integration_settings?: Record<string, unknown> | null;
};

export const readApprovedPlatformTarget = readApproved as (
  settings?: Record<string, unknown>,
  goal?: PulseCampaignGoal,
) => PulsePlatformTarget | null;

export const resolvePlatformTarget = resolveTarget as (
  settings: Record<string, unknown> | null | undefined,
  goal: PulseCampaignGoal,
  baselineEfficiency7d: number | null,
) => PulsePlatformTarget | null;

export const evaluateEfficiencyIssue = evaluateEfficiency as (input: {
  goal: PulseCampaignGoal;
  currentEfficiency: number | null;
  trend7dPct: number | null;
  target: PulsePlatformTarget | null;
}) => PulseAttentionIssue | null;

export const buildPulseAttentionRows = buildRows as (input: {
  campaignRows: PulseCampaignGoalRow[];
  tables: PlatformTable[];
  clients: PulseAttentionClientContext[];
}) => PulseAttentionRow[];

export const platformTargetFieldKey = targetFieldKey as (
  goal: PulseCampaignGoal,
) => "cpl" | "roas" | "cost_per_result";

export const buildPlatformTargetPatch = buildPatch as (
  existingSettings: Record<string, unknown>,
  goal: PulseCampaignGoal,
  value: number | null,
) => Record<string, unknown>;
