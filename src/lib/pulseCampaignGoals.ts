// One deterministic classifier is shared by the dashboard and the Edge snapshot.
// The implementation is plain ESM so Deno and Vite execute identical rules.
import {
  buildPulseCampaignRows as buildRows,
  classifyPulseCampaignGoal as classifyGoal,
  classificationDataFromStoredRow as classificationDataFromRow,
  campaignDeliveryStatusLabel as deliveryStatusLabel,
  dedupePulseCampaignRows as dedupeRows,
  integrationTypeToGoal as tableIntegrationGoal,
  isEcommerceReportTable as isEcommerceTable,
  pulseCampaignOutcome as campaignOutcome,
  pulseTrendWindows as trendWindows,
  resolveCampaignDeliveryStatus as resolveDeliveryStatus,
  tableReportGoal as reportTableGoal,
} from "../../supabase/functions/_shared/pulse-campaign-goals.mjs";

export const campaignDeliveryStatusLabel = deliveryStatusLabel as (status: string) => string;
export const resolveCampaignDeliveryStatus = resolveDeliveryStatus as (
  data?: Record<string, unknown>,
  integrationSettings?: Record<string, unknown>,
) => "active" | "paused" | "removed" | "other" | "unknown";

export type PulseCampaignGoal = "leads" | "engagement" | "ecommerce" | "unknown";

export type PulseCampaignGoalRow = {
  campaign_key: string;
  campaign_id: string | null;
  campaign_name: string;
  client_id: string;
  table_id: string;
  platform: "meta" | "google";
  goal: PulseCampaignGoal;
  delivery_status?: "active" | "paused" | "removed" | "other" | "unknown";
  classification_source: "explicit_mapping" | "platform_goal" | "table_report_type" | "unclassified";
  campaign_objective?: string | null;
  optimization_goal?: string | null;
  campaign_type_hint?: string | null;
  result_kind?: string | null;
  outcome_kind: string | null;
  status: "healthy" | "warning" | "critical" | "no_data";
  status_tier: "normal" | "watch" | "exception" | "missing_data" | "needs_classification";
  status_reason: string;
  alert_eligible: boolean;
  target_value: number | null;
  target_kind: string | null;
  spend_3d: number;
  outcomes_3d: number | null;
  efficiency_3d: number | null;
  spend_7d: number;
  outcomes_7d: number | null;
  revenue_7d: number;
  efficiency_7d: number | null;
  baseline_efficiency_3d: number | null;
  baseline_efficiency_7d: number | null;
  trend_3d_pct: number | null;
  trend_7d_pct: number | null;
  impressions_7d: number;
  reach_7d: number;
  frequency_7d: number | null;
  spend_today: number;
  outcomes_today: number | null;
  revenue_today: number;
  efficiency_today: number | null;
  data_fresh_through: string | null;
  last_change_at: string | null;
  last_sync_at: string | null;
  partial_today_excluded: boolean;
  today_partial_included: boolean;
};

export const dedupePulseCampaignRows = dedupeRows as (
  rows: PulseCampaignGoalRow[],
) => PulseCampaignGoalRow[];

export const buildPulseCampaignRows = buildRows as (input: {
  records: Array<{ table_id: string; data?: Record<string, unknown> | null }>;
  tables: Array<{
    id: string;
    client_id: string;
    integration_type?: string | null;
    category?: string | null;
    integration_settings?: Record<string, unknown> | null;
  }>;
  nowYmd: string;
}) => PulseCampaignGoalRow[];

export const classifyPulseCampaignGoal = classifyGoal as (
  data?: Record<string, unknown>,
  integrationSettings?: Record<string, unknown>,
) => { goal: PulseCampaignGoal; source: PulseCampaignGoalRow["classification_source"] };

export const pulseCampaignOutcome = campaignOutcome;
export const pulseTrendWindows = trendWindows;

export const isEcommerceReportTable = isEcommerceTable as (table: {
  integration_type?: string | null;
  category?: string | null;
  integration_settings?: { campaign_type?: string | null } | null;
}) => boolean;

export const integrationTypeToGoal = tableIntegrationGoal as (
  integrationType: string | null | undefined,
  table?: {
    integration_type?: string | null;
    category?: string | null;
    integration_settings?: { campaign_type?: string | null } | null;
  } | null,
) => "leads" | "ecommerce" | null;

export const classificationDataFromStoredRow = classificationDataFromRow as (
  row?: Record<string, unknown>,
) => Record<string, unknown>;

export const tableReportGoal = reportTableGoal;
