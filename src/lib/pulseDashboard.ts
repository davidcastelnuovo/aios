import { supabase } from "@/integrations/supabase/client";
import { shouldIncludeInAdsDashboardAggregate } from "@/lib/adsEntityLevel";
import {
  classificationDataFromStoredRow,
  classifyPulseCampaignGoal,
  integrationTypeToGoal,
  isEcommerceReportTable,
  dedupePulseCampaignRows,
  resolveCampaignDeliveryStatus,
  type PulseCampaignGoalRow,
} from "@/lib/pulseCampaignGoals";

/**
 * Helpers for the Pulse Check dashboard (דשבורד בדיקת דופק).
 * Maps deterministic campaign_pulse_snapshots into UI rows, and supports
 * calendar period overrides (this week / last week) from crm_records.
 */

export type PulseStatus = "healthy" | "warning" | "critical" | "no_data";

export type PulsePeriod = "last_7_days" | "this_week" | "last_week";

export const PULSE_PERIOD_OPTIONS: { value: PulsePeriod; label: string }[] = [
  { value: "last_7_days", label: "7 ימים אחרונים" },
  { value: "this_week", label: "השבוע" },
  { value: "last_week", label: "שבוע שעבר" },
];

export type PulseSnapshotRow = {
  client_id: string;
  agency_id: string | null;
  status: PulseStatus;
  campaign_goal_mode?: CampaignGoalMode | null;
  is_ecommerce: boolean | null;
  spend_7d: number | null;
  lead_spend_7d?: number | null;
  ecommerce_spend_7d?: number | null;
  leads_7d: number | null;
  cpl_7d: number | null;
  cpl_change_pct: number | null;
  purchases_7d: number | null;
  revenue_7d: number | null;
  roas_7d: number | null;
  roas_change_pct?: number | null;
  lead_goal_status?: PulseStatus | null;
  ecommerce_goal_status?: PulseStatus | null;
  campaign_breakdown?: PulseCampaignGoalRow[] | null;
  flags: string[] | null;
  data_fresh_through: string | null;
  calculated_at: string | null;
  last_meta_change_at: string | null;
  last_meta_change_type: string | null;
  last_meta_change_actor: string | null;
  last_meta_change_object: string | null;
  meta_change_availability: string | null;
  last_client_call_at: string | null;
  last_client_call_by: string | null;
};

export type CampaignGoal = "leads" | "engagement" | "ecommerce";
export type CampaignGoalMode = CampaignGoal | "hybrid";

export type PulseGoalDisplayRow = {
  rowKey: string;
  client_id: string;
  goal: CampaignGoal;
  campaign_goal_mode: CampaignGoalMode;
  status: PulseStatus;
  spend_7d: number;
  outcomes_7d: number;
  efficiency: number | null;
  change_pct: number | null;
  efficiency_kind: "cpl" | "roas";
  flags: string[];
  data_fresh_through: string | null;
  calculated_at: string | null;
  last_meta_change_at: string | null;
  last_meta_change_type: string | null;
  last_meta_change_actor: string | null;
  last_meta_change_object: string | null;
  meta_change_availability: string | null;
};

/** Period metrics reshaped to the same fields the snapshot table uses. */
export type PulsePeriodMetrics = {
  spend_7d: number;
  leads_7d: number;
  cpl_7d: number | null;
  cpl_change_pct: number | null;
  purchases_7d: number;
  revenue_7d: number;
  roas_7d: number | null;
  data_fresh_through: string | null;
  record_count: number;
};

export function pulseStatusToOverall(status: PulseStatus | null | undefined): "green" | "yellow" | "red" {
  if (status === "critical") return "red";
  if (status === "warning" || status === "no_data") return "yellow";
  if (status === "healthy") return "green";
  return "yellow";
}

export function overallStatusLabel(status: "green" | "yellow" | "red"): string {
  if (status === "green") return "🟢 תקין";
  if (status === "red") return "🔴 דורש טיפול";
  return "🟡 לתשומת לב";
}

export type PulseOverrideRow = {
  id: string;
  client_id: string;
  tenant_id: string;
  algorithm_status: string;
  override_status: "green" | "yellow" | "red";
  reason: string;
  algorithm_flags: string[] | null;
  algorithm_metrics: Record<string, unknown> | null;
  snapshot_calculated_at: string | null;
  created_by: string | null;
  created_at: string;
  cleared_at: string | null;
};

export function buildPulseAlgorithmMetrics(pulse: PulseSnapshotRow | null): Record<string, unknown> {
  if (!pulse) return {};
  return {
    status: pulse.status,
    spend_7d: pulse.spend_7d,
    leads_7d: pulse.leads_7d,
    purchases_7d: pulse.purchases_7d,
    cpl_7d: pulse.cpl_7d,
    cpl_change_pct: pulse.cpl_change_pct,
    roas_7d: pulse.roas_7d,
    data_fresh_through: pulse.data_fresh_through,
    calculated_at: pulse.calculated_at,
  };
}

export function pulseStatusLabel(status: PulseStatus | null | undefined): string {
  switch (status) {
    case "healthy":
      return "🟢 תקין";
    case "warning":
      return "🟡 תשומת לב";
    case "critical":
      return "🔴 קריטי";
    case "no_data":
      return "🟡 אין טבלת קמפיין מחוברת";
    default:
      return "🟡 ממתין לבדיקה";
  }
}

export function clientHasCampaignService(services: string[] | null | undefined): boolean {
  if (!Array.isArray(services)) return false;
  return services.includes("ppc_meta") || services.includes("ppc_google");
}

export function clientHasConnectedCampaignTables(tables: PulseCampaignTable[] | null | undefined): boolean {
  if (!Array.isArray(tables) || !tables.length) return false;
  return tables.some((table) => pulsePlatformKey(table.integration_type) !== null);
}

export function clientHasCampaignCoverage(
  services: string[] | null | undefined,
  tables: PulseCampaignTable[] | null | undefined,
): boolean {
  return clientHasCampaignService(services) || clientHasConnectedCampaignTables(tables);
}

export function formatPulseMoney(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "—";
  return `₪${Math.round(Number(value) * 100) / 100}`;
}

export function goalLabel(goal: CampaignGoal): string {
  if (goal === "ecommerce") return "איקומרס";
  if (goal === "engagement") return "אינגייג׳מנט";
  return "לידים";
}

/** Precomputed per-campaign rows persisted on campaign_pulse_snapshots. */
export function collectCampaignBreakdownFromSnapshots(
  snapshots: PulseSnapshotRow[],
): PulseCampaignGoalRow[] {
  const rows: PulseCampaignGoalRow[] = [];
  for (const snapshot of snapshots) {
    if (!Array.isArray(snapshot.campaign_breakdown)) continue;
    rows.push(...snapshot.campaign_breakdown);
  }
  return rows;
}

/** Clients with campaign tables but no stored campaign_breakdown on snapshot. */
export function pulseClientsNeedingRecordBuild(input: {
  snapshots: PulseSnapshotRow[];
  tables: PulseCampaignTable[];
}): string[] {
  const clientsWithTables = new Set(input.tables.map((table) => table.client_id));
  const snapshotByClient = new Map(input.snapshots.map((row) => [row.client_id, row]));
  const needsBuild: string[] = [];
  for (const clientId of clientsWithTables) {
    const snapshot = snapshotByClient.get(clientId);
    if (!snapshot || !Array.isArray(snapshot.campaign_breakdown)) {
      needsBuild.push(clientId);
    }
  }
  return needsBuild;
}

function tableClassificationContext(table: PulseCampaignTable): Record<string, unknown> {
  return {
    integration_type: table.integration_type,
    integration_settings: table.integration_settings || {},
    category: table.category,
  };
}

/** Pulse dashboard only tracks campaigns that spent in the current window. */
export function filterPulseCampaignRowsWithSpend(rows: PulseCampaignGoalRow[]): PulseCampaignGoalRow[] {
  return rows.filter((row) => (row.spend_7d || 0) > 0);
}

function rowConfirmsLeadObjective(row: PulseCampaignGoalRow): boolean {
  const objective = String(row.campaign_objective || "").trim().toUpperCase();
  return objective.includes("OUTCOME_LEADS") || objective.includes("LEAD_GENERATION");
}

/** Ecommerce report rows stored as leads without a confirmed lead objective. */
export function pulseClientsWithMisclassifiedEcommerceReports(
  breakdownRows: PulseCampaignGoalRow[],
  tables: PulseCampaignTable[],
): string[] {
  const tableById = new Map(tables.map((table) => [table.id, table]));
  const stale = new Set<string>();
  for (const row of breakdownRows) {
    const table = tableById.get(row.table_id);
    if (!table || !isEcommerceReportTable(table)) continue;
    if (row.goal === "leads" && !rowConfirmsLeadObjective(row)) {
      stale.add(row.client_id);
    }
  }
  return Array.from(stale);
}

function applyFreshCampaignGoalClassification(
  row: PulseCampaignGoalRow,
  table: PulseCampaignTable | undefined,
): PulseCampaignGoalRow {
  if (!table) return row;
  const classification = classifyPulseCampaignGoal(
    classificationDataFromStoredRow(row),
    tableClassificationContext(table),
  );
  if (classification.goal === "unknown" || classification.goal === row.goal) return row;
  return {
    ...row,
    goal: classification.goal,
    classification_source: classification.source,
  };
}

/** Clients whose stored breakdown goal no longer matches objective/report rules. */
export function pulseClientsWithStaleCampaignGoals(
  breakdownRows: PulseCampaignGoalRow[],
  tables: PulseCampaignTable[],
): string[] {
  const tableById = new Map(tables.map((table) => [table.id, table]));
  const stale = new Set<string>();
  for (const row of breakdownRows) {
    const table = tableById.get(row.table_id);
    if (!table) continue;
    const fresh = classifyPulseCampaignGoal(
      classificationDataFromStoredRow(row),
      tableClassificationContext(table),
    );
    if (fresh.goal !== "unknown" && fresh.goal !== row.goal) {
      stale.add(row.client_id);
    }
  }
  return Array.from(stale);
}

export type PulseCampaignDeliveryHint = {
  table_id: string;
  campaign_id: string;
  effective_status: string | null;
  date: string;
};

const PAUSED_ROW_PATCH = {
  status: "healthy" as const,
  status_tier: "normal" as const,
  status_reason: "קמפיין מושהה — אין הוצאה פעילה שדורשת טיפול",
  alert_eligible: false,
};

/** Apply delivery status + paused/removed criteria without a full crm_records rebuild. */
export function rehydrateCampaignBreakdownRows(
  rows: PulseCampaignGoalRow[],
  tables: PulseCampaignTable[],
  hints: PulseCampaignDeliveryHint[] = [],
): PulseCampaignGoalRow[] {
  const tableById = new Map(tables.map((table) => [table.id, table]));
  const settingsByTable = new Map(
    tables.map((table) => [table.id, table.integration_settings || {}]),
  );
  const hintByKey = new Map<string, PulseCampaignDeliveryHint>();
  for (const hint of hints) {
    const key = `${hint.table_id}:${hint.campaign_id}`;
    const prev = hintByKey.get(key);
    if (!prev || hint.date > prev.date) hintByKey.set(key, hint);
  }

  return dedupePulseCampaignRows(rows.map((row) => {
    const settings = settingsByTable.get(row.table_id) || {};
    const hint = row.campaign_id ? hintByKey.get(`${row.table_id}:${row.campaign_id}`) : undefined;
    const delivery_status = row.delivery_status && row.delivery_status !== "unknown"
      ? row.delivery_status
      : resolveCampaignDeliveryStatus(
        {
          campaign_id: row.campaign_id,
          effective_status: hint?.effective_status,
          configured_status: hint?.effective_status,
        },
        settings,
      );
    const table = tableById.get(row.table_id);
    let next: PulseCampaignGoalRow = { ...row, delivery_status };
    if (delivery_status === "paused") {
      next = { ...next, ...PAUSED_ROW_PATCH };
    } else if (delivery_status === "removed") {
      next = {
        ...next,
        status: "healthy",
        status_tier: "normal",
        status_reason: "קמפיין הוסר/לא פעיל",
        alert_eligible: false,
      };
    }
    return applyFreshCampaignGoalClassification(next, table);
  }));
}

export function pulseMetaTablesNeedingDeliveryHints(
  rows: PulseCampaignGoalRow[],
  tables: PulseCampaignTable[],
): string[] {
  const metaTableIds = new Set(
    tables
      .filter((table) => table.integration_type === "facebook_insights" || table.integration_type === "facebook_ecommerce")
      .map((table) => table.id),
  );
  const needsHint = new Set<string>();
  for (const row of rows) {
    if (!metaTableIds.has(row.table_id)) continue;
    if (row.delivery_status && row.delivery_status !== "unknown") continue;
    needsHint.add(row.table_id);
  }
  return Array.from(needsHint);
}

const DELIVERY_HINT_PAGE = 1000;
const DELIVERY_HINT_MAX = 8000;
const DELIVERY_HINT_TABLE_CHUNK = 15;

/** Latest effective_status per campaign — 7-day window only (not full pulse trend). */
export async function fetchPulseCampaignDeliveryHints(
  tableIds: string[],
  lookbackStart: string,
): Promise<PulseCampaignDeliveryHint[]> {
  if (!tableIds.length) return [];
  const hints: PulseCampaignDeliveryHint[] = [];
  for (let offset = 0; offset < tableIds.length; offset += DELIVERY_HINT_TABLE_CHUNK) {
    const chunk = tableIds.slice(offset, offset + DELIVERY_HINT_TABLE_CHUNK);
    for (let from = 0; from < DELIVERY_HINT_MAX; from += DELIVERY_HINT_PAGE) {
      const to = from + DELIVERY_HINT_PAGE - 1;
      const { data, error } = await supabase
        .from("crm_records")
        .select("table_id, data")
        .in("table_id", chunk)
        .filter("data->>date", "gte", lookbackStart)
        .range(from, to);
      if (error) throw error;
      if (!data?.length) break;
      for (const record of data) {
        const dataRow = record.data || {};
        const campaignId = dataRow.campaign_id || dataRow.campaignId;
        const date = typeof dataRow.date === "string" ? dataRow.date : null;
        if (!campaignId || !date) continue;
        if (String(dataRow.entity_level || "campaign").toLowerCase() !== "campaign") continue;
        hints.push({
          table_id: record.table_id,
          campaign_id: String(campaignId),
          effective_status: dataRow.effective_status ? String(dataRow.effective_status) : null,
          date,
        });
      }
      if (data.length < DELIVERY_HINT_PAGE) break;
    }
  }
  const latest = new Map<string, PulseCampaignDeliveryHint>();
  for (const hint of hints) {
    const key = `${hint.table_id}:${hint.campaign_id}`;
    const prev = latest.get(key);
    if (!prev || hint.date > prev.date) latest.set(key, hint);
  }
  return Array.from(latest.values());
}

export function pulseFallbackTableIds(
  tables: PulseCampaignTable[],
  clientIds: string[],
): string[] {
  const pending = new Set(clientIds);
  return tables.filter((table) => pending.has(table.client_id)).map((table) => table.id);
}

export type PulseClientGoalRollup = {
  rowKey: string;
  client_id: string;
  platform: PulsePlatform;
  platformLabel: string;
  goal: CampaignGoal;
  status: PulseStatus;
  status_reason: string;
  spend_7d: number;
  outcomes_7d: number | null;
  revenue_7d: number;
  efficiency: number | null;
  change_pct: number | null;
  efficiency_kind: "cpl" | "roas" | "cost_per_result";
  flags: string[];
  data_fresh_through: string | null;
  calculated_at: string | null;
  last_meta_change_at: string | null;
  last_meta_change_type: string | null;
  last_meta_change_actor: string | null;
  last_meta_change_object: string | null;
  meta_change_availability: string | null;
  last_client_call_at: string | null;
  last_client_call_by: string | null;
  last_campaign_change_at: string | null;
  campaigns: PulseCampaignGoalRow[];
};

const PULSE_STATUS_RANK: Record<PulseStatus, number> = {
  critical: 0,
  warning: 1,
  no_data: 2,
  healthy: 3,
};

function worstPulseStatusFromList(statuses: PulseStatus[]): PulseStatus {
  if (!statuses.length) return "no_data";
  return statuses.reduce((worst, status) =>
    PULSE_STATUS_RANK[status] < PULSE_STATUS_RANK[worst] ? status : worst,
  );
}

type CampaignRowWithDelivery = PulseCampaignGoalRow & {
  delivery_status?: string | null;
};

function isUnknownDelivery(status: string | null | undefined): boolean {
  return !status || status === "unknown" || status === "other";
}

/** Rollup status reflects confirmed-active campaigns only — never flash red on unknown/paused. */
export function rollupStatusFromCampaigns(
  campaigns: CampaignRowWithDelivery[],
  options: { deliveryHintsPending?: boolean } = {},
): {
  status: PulseStatus;
  status_reason: string;
} {
  const active = campaigns.filter((row) => row.delivery_status === "active");
  const pausedOrRemoved = campaigns.filter(
    (row) => row.delivery_status === "paused" || row.delivery_status === "removed",
  );
  const unknown = campaigns.filter((row) => isUnknownDelivery(row.delivery_status));

  if (active.length) {
    const status = worstPulseStatusFromList(active.map((row) => row.status));
    const statusReason =
      active.find((row) => row.status === status)?.status_reason ||
      active[0]?.status_reason ||
      "";
    if (unknown.length && options.deliveryHintsPending && status !== "critical") {
      return {
        status: "warning",
        status_reason: "מאמתים סטטוס קמפיין לפני סיכום סופי",
      };
    }
    return { status, status_reason: statusReason };
  }

  if (pausedOrRemoved.length) {
    return {
      status: "healthy",
      status_reason: unknown.length && options.deliveryHintsPending
        ? "מאמתים סטטוס — הקמפיינים הפעילים מושהים"
        : "כל הקמפיינים מושהים — אין הוצאה פעילה שדורשת טיפול",
    };
  }

  if (unknown.length) {
    if (options.deliveryHintsPending) {
      return {
        status: "warning",
        status_reason: "ממתין לאימות סטטוס פעיל/מושהה — לא מסומן אדום עד שמאשרים",
      };
    }
    const worst = worstPulseStatusFromList(unknown.map((row) => row.status));
    if (worst === "critical") {
      return {
        status: "warning",
        status_reason: "נדרש אימות סטטוס קמפיין לפני התראה",
      };
    }
    return {
      status: worst,
      status_reason:
        unknown.find((row) => row.status === worst)?.status_reason ||
        unknown[0]?.status_reason ||
        "",
    };
  }

  return {
    status: "no_data",
    status_reason: "אין קמפיינים פעילים בקטגוריה",
  };
}

export function rollupNeedsDeliveryHints(
  campaigns: CampaignRowWithDelivery[],
  metaTableIds: Set<string>,
): boolean {
  return campaigns.some(
    (row) => metaTableIds.has(row.table_id) && isUnknownDelivery(row.delivery_status),
  );
}

function rollupEfficiency(
  goal: CampaignGoal,
  spend: number,
  outcomes: number | null,
  revenue: number,
): number | null {
  if (goal === "ecommerce") {
    return spend > 0 ? roundMetric(revenue / spend) : null;
  }
  if (outcomes === null || outcomes <= 0) return null;
  return roundMetric(spend / outcomes);
}

/** One dashboard row per client × platform × goal (not per individual campaign). */
export function rollupCampaignRowsByClientGoal(input: {
  campaignRows: PulseCampaignGoalRow[];
  snapshotsByClient: Map<string, PulseSnapshotRow>;
  deliveryHintsPending?: boolean;
  metaTableIds?: Set<string>;
}): PulseClientGoalRollup[] {
  const groups = new Map<string, PulseCampaignGoalRow[]>();
  for (const row of input.campaignRows) {
    if (row.goal === "unknown") continue;
    const key = `${row.client_id}:${row.platform}:${row.goal}`;
    const list = groups.get(key) || [];
    list.push(row);
    groups.set(key, list);
  }

  const rollups: PulseClientGoalRollup[] = [];
  for (const [key, campaigns] of groups) {
    const parts = key.split(":");
    const client_id = parts[0];
    const platform = parts[1] as PulsePlatform;
    const goal = parts[2] as CampaignGoal;
    const snapshot = input.snapshotsByClient.get(client_id) ?? null;
    const spend_7d = campaigns.reduce((total, row) => total + (row.spend_7d || 0), 0);
    const outcomeValues = campaigns.map((row) => row.outcomes_7d);
    const hasAnyOutcome = outcomeValues.some((value) => value !== null);
    const outcomes_7d = hasAnyOutcome
      ? outcomeValues.reduce((total, value) => total + (value ?? 0), 0)
      : null;
    const revenue_7d = campaigns.reduce((total, row) => total + (row.revenue_7d || 0), 0);
    const efficiency_kind =
      goal === "ecommerce" ? "roas" : goal === "engagement" ? "cost_per_result" : "cpl";
    const efficiency = rollupEfficiency(goal, spend_7d, outcomes_7d, revenue_7d);
    const hintsPending = Boolean(
      input.deliveryHintsPending
      && input.metaTableIds
      && rollupNeedsDeliveryHints(campaigns, input.metaTableIds),
    );
    const { status, status_reason: statusReason } = rollupStatusFromCampaigns(campaigns, {
      deliveryHintsPending: hintsPending,
    });
    const flags = Array.from(new Set(campaigns.flatMap((row) =>
      row.status !== "healthy" && row.status_reason ? [row.status_reason] : [],
    )));
    const campaignTouches = campaigns
      .map((row) => row.last_change_at)
      .filter((value): value is string => !!value);
    let last_campaign_change_at = campaignTouches.sort().at(-1) ?? null;
    if (platform === "meta" && snapshot?.last_meta_change_at) {
      if (!last_campaign_change_at || snapshot.last_meta_change_at > last_campaign_change_at) {
        last_campaign_change_at = snapshot.last_meta_change_at;
      }
    }
    const trendWeighted = campaigns.reduce(
      (acc, row) => {
        if (row.trend_7d_pct === null || !row.spend_7d) return acc;
        acc.weighted += row.trend_7d_pct * row.spend_7d;
        acc.spend += row.spend_7d;
        return acc;
      },
      { weighted: 0, spend: 0 },
    );
    const change_pct =
      trendWeighted.spend > 0 ? roundMetric(trendWeighted.weighted / trendWeighted.spend, 1) : null;
    const freshestDates = campaigns
      .map((row) => row.data_fresh_through)
      .filter((value): value is string => !!value)
      .sort();
    rollups.push({
      rowKey: key,
      client_id,
      platform,
      platformLabel: pulsePlatformLabel(platform),
      goal,
      status,
      status_reason: statusReason,
      spend_7d,
      outcomes_7d,
      revenue_7d,
      efficiency,
      change_pct,
      efficiency_kind,
      flags,
      data_fresh_through: freshestDates.at(-1) ?? snapshot?.data_fresh_through ?? null,
      calculated_at: snapshot?.calculated_at ?? null,
      last_meta_change_at: platform === "meta" ? snapshot?.last_meta_change_at ?? null : null,
      last_meta_change_type: platform === "meta" ? snapshot?.last_meta_change_type ?? null : null,
      last_meta_change_actor: platform === "meta" ? snapshot?.last_meta_change_actor ?? null : null,
      last_meta_change_object: platform === "meta" ? snapshot?.last_meta_change_object ?? null : null,
      meta_change_availability:
        platform === "meta"
          ? snapshot?.meta_change_availability ?? null
          : last_campaign_change_at
            ? "available"
            : "not_applicable",
      last_client_call_at: snapshot?.last_client_call_at ?? null,
      last_client_call_by: snapshot?.last_client_call_by ?? null,
      last_campaign_change_at,
      campaigns: campaigns.sort((a, b) => a.campaign_name.localeCompare(b.campaign_name, "he")),
    });
  }

  return rollups.sort((a, b) =>
    PULSE_STATUS_RANK[a.status] - PULSE_STATUS_RANK[b.status]
    || a.client_id.localeCompare(b.client_id)
    || a.platform.localeCompare(b.platform)
    || a.goal.localeCompare(b.goal),
  );
}

export function formatCampaignTouchSummary(rollup: Pick<
  PulseClientGoalRollup,
  | "last_campaign_change_at"
  | "last_meta_change_at"
  | "meta_change_availability"
>): string {
  const at = rollup.last_campaign_change_at || rollup.last_meta_change_at;
  if (!at) {
    if (rollup.meta_change_availability === "no_campaign_change_in_30d") return "לא נמצא";
    return "לא זמין";
  }
  return new Date(at).toLocaleDateString("he-IL", {
    timeZone: "Asia/Jerusalem",
    day: "numeric",
    month: "numeric",
    year: "numeric",
  });
}

export function formatCampaignTouchDetails(rollup: PulseClientGoalRollup): string {
  const at = rollup.last_campaign_change_at || rollup.last_meta_change_at;
  if (!at) {
    if (rollup.meta_change_availability === "no_campaign_change_in_30d") {
      return "לא נמצא שינוי בקמפיין ב-30 הימים האחרונים";
    }
    return "לא זמין";
  }
  const when = new Date(at).toLocaleString("he-IL", {
    timeZone: "Asia/Jerusalem",
    dateStyle: "short",
    timeStyle: "short",
  });
  const lines = [`תאריך: ${when}`];
  if (rollup.last_meta_change_type) lines.push(`סוג: ${rollup.last_meta_change_type}`);
  if (rollup.last_meta_change_object) lines.push(`אובייקט: ${rollup.last_meta_change_object}`);
  if (rollup.last_meta_change_actor) lines.push(`מי ביצע: ${rollup.last_meta_change_actor}`);
  if (rollup.campaigns.length > 1) {
    lines.push(`קמפיינים בקבוצה: ${rollup.campaigns.map((row) => row.campaign_name).join(", ")}`);
  }
  return lines.join("\n");
}

export function formatRollupEfficiency(row: Pick<
  PulseClientGoalRollup,
  "efficiency_kind" | "efficiency"
>): string {
  if (row.efficiency === null || row.efficiency === undefined) return "—";
  if (row.efficiency_kind === "roas") return `ROAS ${row.efficiency}`;
  return `₪${row.efficiency}`;
}

export function formatRollupOutcomes(row: Pick<PulseClientGoalRollup, "goal" | "outcomes_7d">): string {
  if (row.outcomes_7d === null) return "—";
  return String(row.outcomes_7d);
}

export type PulseCampaignAlertAck = {
  client_id?: string;
  campaign_id: string;
  campaign_name: string | null;
  acknowledged_at: string | null;
  created_at: string;
  alert_type: string;
};

export function resolveCampaignOperatorTouch(
  campaign: Pick<PulseCampaignGoalRow, "campaign_id" | "campaign_name" | "last_change_at" | "delivery_status">,
  alerts: PulseCampaignAlertAck[],
): { at: string | null; label: string } {
  const matches = alerts.filter((alert) =>
    alert.campaign_id && campaign.campaign_id && alert.campaign_id === campaign.campaign_id,
  );
  const latestAck = matches
    .filter((alert) => alert.acknowledged_at)
    .sort((a, b) => String(b.acknowledged_at).localeCompare(String(a.acknowledged_at)))[0];
  if (latestAck?.acknowledged_at) {
    return { at: latestAck.acknowledged_at, label: "אושרה התראה" };
  }
  if (campaign.delivery_status === "paused" && campaign.last_change_at) {
    return { at: campaign.last_change_at, label: "הושהה בפלטפורמה" };
  }
  if (campaign.last_change_at) {
    return { at: campaign.last_change_at, label: "שינוי אחרון" };
  }
  return { at: null, label: "לא תועד" };
}

export function formatOperatorTouch(at: string | null): string {
  if (!at) return "לא תועד";
  return new Date(at).toLocaleString("he-IL", {
    timeZone: "Asia/Jerusalem",
    dateStyle: "short",
    timeStyle: "short",
  });
}

export type PulsePlatform = "meta" | "google";

export type PulseCampaignTable = {
  id: string;
  client_id: string;
  integration_type: string | null;
  category?: string | null;
  campaign_active?: boolean | null;
  last_sync_at?: string | null;
  integration_settings?: Record<string, unknown> | null;
};

export type PulseCrmRecord = {
  table_id: string;
  data?: Record<string, unknown> | null;
};

export type PulsePlatformDisplayRow = PulseGoalDisplayRow & {
  platform: PulsePlatform;
  platformLabel: string;
};

const STALE_SYNC_MS = 30 * 60 * 60 * 1000;

export function pulsePlatformLabel(platform: PulsePlatform): string {
  return platform === "google" ? "Google" : "Meta";
}

export function pulsePlatformKey(integrationType: string | null | undefined): PulsePlatform | null {
  if (integrationType === "google_ads") return "google";
  if (integrationType === "facebook_insights" || integrationType === "facebook_ecommerce") return "meta";
  return null;
}

function clientCampaignServices(services: string[] | null | undefined): Set<string> {
  return new Set(
    (Array.isArray(services) ? services : []).filter((service) => service === "ppc_meta" || service === "ppc_google"),
  );
}

function tableMatchesServices(table: PulseCampaignTable, services: Set<string>): boolean {
  if (table.integration_type === "google_ads") return services.has("ppc_google");
  if (table.integration_type === "facebook_insights" || table.integration_type === "facebook_ecommerce") {
    return services.has("ppc_meta");
  }
  return false;
}

function resolveLastSyncAt(table: PulseCampaignTable): string | null {
  const settings = table.integration_settings || {};
  const candidates = [table.last_sync_at, settings.last_sync_at]
    .map((value) => (typeof value === "string" && value.trim() ? value : null))
    .filter((value): value is string => !!value);
  if (!candidates.length) return null;
  return candidates.sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];
}

function isSyncStale(table: PulseCampaignTable, nowMs = Date.now()): boolean {
  const lastSync = resolveLastSyncAt(table);
  if (!lastSync) return true;
  const ts = new Date(lastSync).getTime();
  if (Number.isNaN(ts)) return true;
  return nowMs - ts > STALE_SYNC_MS;
}

/** One active table per platform — freshest sync wins. */
export function pickFreshestTablePerPlatform(tables: PulseCampaignTable[]): PulseCampaignTable[] {
  const best = new Map<PulsePlatform, PulseCampaignTable>();
  for (const table of tables) {
    if (table.campaign_active === false) continue;
    const key = pulsePlatformKey(table.integration_type);
    if (!key) continue;
    const prev = best.get(key);
    if (!prev) {
      best.set(key, table);
      continue;
    }
    const prevTs = resolveLastSyncAt(prev);
    const nextTs = resolveLastSyncAt(table);
    if (!prevTs && nextTs) {
      best.set(key, table);
      continue;
    }
    if (prevTs && nextTs && new Date(nextTs).getTime() > new Date(prevTs).getTime()) {
      best.set(key, table);
    }
  }
  return Array.from(best.values());
}

export type GoalMetricBundle = {
  spend: number;
  outcomes: number;
  revenue: number;
  efficiency: number | null;
  changePct: number | null;
};

/** Aggregate metrics for one goal within a calendar / rolling window. */
export function computeGoalMetricsForBounds(
  records: PulseCrmRecord[],
  goal: CampaignGoal,
  bounds: PulsePeriodBounds,
): GoalMetricBundle {
  const current: PulseCrmRecord[] = [];
  const previous: PulseCrmRecord[] = [];

  for (const row of records) {
    if (!shouldIncludeInAdsDashboardAggregate(row.data)) continue;
    const date = typeof row.data?.date === "string" ? row.data.date : null;
    if (!date) continue;
    if (date >= bounds.startDate && date <= bounds.endDate) current.push(row);
    else if (date >= bounds.prevStartDate && date <= bounds.prevEndDate) previous.push(row);
  }

  const sumFields = (rows: PulseCrmRecord[], fields: string[]) =>
    rows.reduce((total, record) => {
      const data = record.data || {};
      const field = fields.find((candidate) => data[candidate] !== undefined && data[candidate] !== null);
      return total + (field ? Number(data[field]) || 0 : 0);
    }, 0);

  const spend = sumFields(current, ["spend", "cost"]);
  const prevSpend = sumFields(previous, ["spend", "cost"]);

  if (goal === "ecommerce") {
    const purchases = sumFields(current, ["purchases"]);
    const revenue = sumFields(current, ["purchase_value", "conversions_value", "revenue"]);
    const prevRevenue = sumFields(previous, ["purchase_value", "conversions_value", "revenue"]);
    const roas = spend > 0 ? revenue / spend : null;
    const prevRoas = prevSpend > 0 ? prevRevenue / prevSpend : null;
    const changePct =
      roas !== null && prevRoas !== null && prevRoas > 0 ? ((roas - prevRoas) / prevRoas) * 100 : null;
    return {
      spend: roundMetric(spend) ?? 0,
      outcomes: roundMetric(purchases) ?? 0,
      revenue: roundMetric(revenue) ?? 0,
      efficiency: roundMetric(roas),
      changePct: roundMetric(changePct, 1),
    };
  }

  const leads = sumFields(current, ["leads", "conversions", "all_conversions"]);
  const prevLeads = sumFields(previous, ["leads", "conversions", "all_conversions"]);
  const cpl = leads > 0 ? spend / leads : null;
  const prevCpl = prevLeads > 0 ? prevSpend / prevLeads : null;
  const changePct =
    cpl !== null && prevCpl !== null && prevCpl > 0 ? ((cpl - prevCpl) / prevCpl) * 100 : null;
  return {
    spend: roundMetric(spend) ?? 0,
    outcomes: roundMetric(leads) ?? 0,
    revenue: 0,
    efficiency: roundMetric(cpl),
    changePct: roundMetric(changePct, 1),
  };
}

function roundMetric(value: number | null, digits = 2): number | null {
  if (value === null || Number.isNaN(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function classifyPlatformGoalStatus(input: {
  platform: PulsePlatform;
  activeTables: PulseCampaignTable[];
  configuredTables: PulseCampaignTable[];
  goal: CampaignGoal;
  metrics: GoalMetricBundle;
  recentRecordCount: number;
  snapshotFlags: string[];
  lastClientCallAt?: string | null;
}): { status: PulseStatus; flags: string[] } {
  const flags: string[] = [];
  const platformName = pulsePlatformLabel(input.platform);

  if (!input.configuredTables.length || !input.activeTables.length) {
    flags.push("אין טבלת קמפיין מחוברת");
    return { status: "no_data", flags };
  }

  const stale = pickFreshestTablePerPlatform(input.activeTables)
    .filter((table) => isSyncStale(table))
    .map((table) => pulsePlatformLabel(pulsePlatformKey(table.integration_type) || "meta"));
  if (stale.length) {
    flags.push(`סנכרון ישן או חסר: ${stale.join(", ")}`);
  }

  if (input.recentRecordCount === 0) {
    flags.push(`סנכרון ישן או חסר — אין נתונים ב-30 הימים האחרונים (${platformName})`);
    return { status: "warning", flags };
  }

  let status: PulseStatus = "healthy";
  if (input.goal === "ecommerce") {
    if (input.metrics.spend > 0 && input.metrics.outcomes === 0) {
      status = "critical";
      flags.push("הוצאה ללא רכישות");
    } else if (input.metrics.efficiency !== null && input.metrics.efficiency < 1) {
      status = "critical";
      flags.push("ROAS נמוך מ-1");
    } else if (input.metrics.efficiency !== null && input.metrics.efficiency < 1.5) {
      status = "warning";
      flags.push("ROAS נמוך");
    }
  } else if (input.metrics.spend > 0 && input.metrics.outcomes === 0) {
    status = "critical";
    flags.push("הוצאה ללא לידים");
  } else if (input.metrics.changePct !== null && input.metrics.changePct > 25) {
    status = "warning";
    flags.push(`CPL עלה ב-${Math.round(input.metrics.changePct * 10) / 10}%`);
  }

  const platformFlags = input.snapshotFlags.filter((flag) => {
    if (flag.includes(platformName)) return true;
    if (platformName === "Meta" && /מטה|Meta|Facebook|פייסבוק/i.test(flag)) return true;
    if (platformName === "Google" && /Google|גוגל/i.test(flag)) return true;
    return !/(Meta|Google|מטה|Facebook|פייסבוק|גוגל)/i.test(flag);
  });
  flags.push(...platformFlags.filter((flag) => !flags.includes(flag)));

  const fromFlags = inferPulseStatusFromFlags(flags);
  if (fromFlags !== null) status = fromFlags;

  return { status, flags: Array.from(new Set(flags)) };
}

function goalsForPlatform(tables: PulseCampaignTable[], platform: PulsePlatform): CampaignGoal[] {
  const goals = new Set<CampaignGoal>();
  for (const table of tables) {
    if (pulsePlatformKey(table.integration_type) !== platform) continue;
    const goal = integrationTypeToGoal(table.integration_type, table);
    if (goal) goals.add(goal);
  }
  return goals.size ? Array.from(goals) : ["leads"];
}

function platformsForClient(
  services: string[],
  configuredTables: PulseCampaignTable[],
  activeTables: PulseCampaignTable[],
): PulsePlatform[] {
  const platforms = new Set<PulsePlatform>();
  for (const table of [...activeTables, ...configuredTables]) {
    const key = pulsePlatformKey(table.integration_type);
    if (key) platforms.add(key);
  }
  if (!platforms.size) {
    if (services.includes("ppc_meta")) platforms.add("meta");
    if (services.includes("ppc_google")) platforms.add("google");
  }
  return Array.from(platforms);
}

/**
 * Expand one client snapshot into dashboard rows per platform (and goal when hybrid on Meta).
 * Clients with both Meta + Google tables get separate rows/cards for each platform.
 */
export function expandPulseToPlatformGoalRows(input: {
  snapshot: PulseSnapshotRow | null;
  services: string[];
  tables: PulseCampaignTable[];
  records: PulseCrmRecord[];
  bounds: PulsePeriodBounds;
}): PulsePlatformDisplayRow[] {
  const { snapshot, services, tables, records, bounds } = input;
  const serviceSet = clientCampaignServices(services);
  let configuredTables = tables.filter((table) => tableMatchesServices(table, serviceSet));
  // Many clients have connected report tables before ppc_* is set on client.services.
  if (!configuredTables.length) {
    configuredTables = tables.filter((table) => pulsePlatformKey(table.integration_type) !== null);
  }
  const activeTables = configuredTables.filter((table) => table.campaign_active !== false);
  const platforms = platformsForClient(services, configuredTables, activeTables);

  if (!platforms.length) {
    return [];
  }

  const sharedMeta = snapshot
    ? {
        flags: Array.isArray(snapshot.flags) ? snapshot.flags : [],
        data_fresh_through: snapshot.data_fresh_through,
        calculated_at: snapshot.calculated_at,
        last_meta_change_at: snapshot.last_meta_change_at,
        last_meta_change_type: snapshot.last_meta_change_type,
        last_meta_change_actor: snapshot.last_meta_change_actor,
        last_meta_change_object: snapshot.last_meta_change_object,
        meta_change_availability: snapshot.meta_change_availability,
        last_client_call_at: snapshot.last_client_call_at,
      }
    : {
        flags: [] as string[],
        data_fresh_through: null as string | null,
        calculated_at: null as string | null,
        last_meta_change_at: null as string | null,
        last_meta_change_type: null as string | null,
        last_meta_change_actor: null as string | null,
        last_meta_change_object: null as string | null,
        meta_change_availability: null as string | null,
        last_client_call_at: null as string | null,
      };

  const rows: PulsePlatformDisplayRow[] = [];
  const clientId = snapshot?.client_id || configuredTables[0]?.client_id || activeTables[0]?.client_id;
  if (!clientId) return rows;

  for (const platform of platforms) {
    const platformLabel = pulsePlatformLabel(platform);
    const platformActive = activeTables.filter((table) => pulsePlatformKey(table.integration_type) === platform);
    const platformConfigured = configuredTables.filter((table) => pulsePlatformKey(table.integration_type) === platform);
    const platformTableIds = new Set(platformActive.map((table) => table.id));
    const platformRecords = records.filter((record) => platformTableIds.has(record.table_id));

    for (const goal of goalsForPlatform(configuredTables, platform)) {
      const goalTableIds = new Set(
        platformActive
          .filter((table) => integrationTypeToGoal(table.integration_type, table) === goal)
          .map((table) => table.id),
      );
      const goalRecords = platformRecords.filter((record) => goalTableIds.has(record.table_id));
      const recentRecordCount = goalRecords.filter((record) => {
        const date = typeof record.data?.date === "string" ? record.data.date : null;
        if (!date) return false;
        const d30 = jerusalemYmd(new Date(Date.now() - 30 * 86_400_000));
        return date >= d30;
      }).length;

      const metrics = computeGoalMetricsForBounds(goalRecords, goal, bounds);
      const goalConfigured = platformConfigured.filter(
        (table) => integrationTypeToGoal(table.integration_type, table) === goal,
      );
      const goalActive = platformActive.filter((table) => integrationTypeToGoal(table.integration_type, table) === goal);

      const { status, flags } = classifyPlatformGoalStatus({
        platform,
        activeTables: goalActive,
        configuredTables: goalConfigured,
        goal,
        metrics,
        recentRecordCount,
        snapshotFlags: sharedMeta.flags,
        lastClientCallAt: sharedMeta.last_client_call_at,
      });

      const isMetaPlatform = platform === "meta";
      rows.push({
        rowKey: `${clientId}:${platform}:${goal}`,
        client_id: clientId,
        goal,
        platform,
        platformLabel,
        campaign_goal_mode: snapshot ? snapshotGoalMode(snapshot) : goal === "ecommerce" ? "ecommerce" : "leads",
        status,
        spend_7d: metrics.spend,
        outcomes_7d: metrics.outcomes,
        efficiency: metrics.efficiency,
        change_pct: metrics.changePct,
        efficiency_kind: goal === "ecommerce" ? "roas" : "cpl",
        flags,
        data_fresh_through: sharedMeta.data_fresh_through,
        calculated_at: sharedMeta.calculated_at,
        last_meta_change_at: isMetaPlatform ? sharedMeta.last_meta_change_at : null,
        last_meta_change_type: isMetaPlatform ? sharedMeta.last_meta_change_type : null,
        last_meta_change_actor: isMetaPlatform ? sharedMeta.last_meta_change_actor : null,
        last_meta_change_object: isMetaPlatform ? sharedMeta.last_meta_change_object : null,
        meta_change_availability: isMetaPlatform
          ? sharedMeta.meta_change_availability
          : "not_applicable",
      });
    }
  }

  return rows;
}

export function platformGoalLabel(row: Pick<PulsePlatformDisplayRow, "platformLabel" | "goal">): string {
  return `${row.platformLabel} · ${goalLabel(row.goal)}`;
}

function snapshotGoalMode(row: PulseSnapshotRow): CampaignGoalMode {
  if (row.campaign_goal_mode) return row.campaign_goal_mode;
  return row.is_ecommerce ? "ecommerce" : "leads";
}

export function expandPulseSnapshotToGoalRows(snapshot: PulseSnapshotRow): PulseGoalDisplayRow[] {
  const mode = snapshotGoalMode(snapshot);
  const shared = {
    client_id: snapshot.client_id,
    campaign_goal_mode: mode,
    flags: Array.isArray(snapshot.flags) ? snapshot.flags : [],
    data_fresh_through: snapshot.data_fresh_through,
    calculated_at: snapshot.calculated_at,
    last_meta_change_at: snapshot.last_meta_change_at,
    last_meta_change_type: snapshot.last_meta_change_type,
    last_meta_change_actor: snapshot.last_meta_change_actor,
    last_meta_change_object: snapshot.last_meta_change_object,
    meta_change_availability: snapshot.meta_change_availability,
  };

  const leadRow: PulseGoalDisplayRow = {
    ...shared,
    rowKey: `${snapshot.client_id}:leads`,
    goal: "leads",
    status: (snapshot.lead_goal_status ?? (mode !== "ecommerce" ? snapshot.status : "healthy")) as PulseStatus,
    spend_7d: Number(snapshot.lead_spend_7d ?? (mode === "ecommerce" ? 0 : snapshot.spend_7d) ?? 0),
    outcomes_7d: Number(snapshot.leads_7d ?? 0),
    efficiency: snapshot.cpl_7d === null || snapshot.cpl_7d === undefined ? null : Number(snapshot.cpl_7d),
    change_pct: snapshot.cpl_change_pct === null || snapshot.cpl_change_pct === undefined ? null : Number(snapshot.cpl_change_pct),
    efficiency_kind: "cpl",
  };

  const ecommerceRow: PulseGoalDisplayRow = {
    ...shared,
    rowKey: `${snapshot.client_id}:ecommerce`,
    goal: "ecommerce",
    status: (snapshot.ecommerce_goal_status ?? (mode !== "leads" ? snapshot.status : "healthy")) as PulseStatus,
    spend_7d: Number(snapshot.ecommerce_spend_7d ?? (mode === "leads" ? 0 : snapshot.spend_7d) ?? 0),
    outcomes_7d: Number(snapshot.purchases_7d ?? 0),
    efficiency: snapshot.roas_7d === null || snapshot.roas_7d === undefined ? null : Number(snapshot.roas_7d),
    change_pct: snapshot.roas_change_pct === null || snapshot.roas_change_pct === undefined ? null : Number(snapshot.roas_change_pct),
    efficiency_kind: "roas",
  };

  if (mode === "hybrid") return [leadRow, ecommerceRow];
  if (mode === "ecommerce") return [ecommerceRow];
  return [leadRow];
}

export function formatGoalOutcomes(row: Pick<PulseGoalDisplayRow, "goal" | "outcomes_7d">): string {
  return String(row.outcomes_7d);
}

export function formatGoalEfficiency(row: Pick<PulseGoalDisplayRow, "efficiency_kind" | "efficiency">): string {
  if (row.efficiency === null || row.efficiency === undefined) return "—";
  return row.efficiency_kind === "roas" ? `ROAS ${row.efficiency}` : `₪${row.efficiency}`;
}

export function formatGoalChange(row: Pick<PulseGoalDisplayRow, "change_pct">): string {
  return formatPulseChange(row.change_pct);
}

export function formatMetaChangeDate(row: PulseSnapshotRow | PulseGoalDisplayRow): string | null {
  if (!row.last_meta_change_at) return null;
  return new Date(row.last_meta_change_at).toLocaleDateString("he-IL", {
    timeZone: "Asia/Jerusalem",
    day: "numeric",
    month: "numeric",
    year: "numeric",
  });
}

export function formatMetaChangeDetails(row: PulseSnapshotRow | PulseGoalDisplayRow): string {
  if (row.last_meta_change_at) {
    const when = new Date(row.last_meta_change_at).toLocaleString("he-IL", {
      timeZone: "Asia/Jerusalem",
      dateStyle: "short",
      timeStyle: "short",
    });
    const lines = [
      `תאריך: ${when}`,
      `סוג: ${row.last_meta_change_type || "שינוי"}`,
    ];
    if (row.last_meta_change_object) lines.push(`אובייקט: ${row.last_meta_change_object}`);
    if (row.last_meta_change_actor) lines.push(`מי ביצע: ${row.last_meta_change_actor}`);
    return lines.join("\n");
  }
  if (row.meta_change_availability === "no_campaign_change_in_30d") return "לא נמצא שינוי במטה ב-30 הימים האחרונים";
  if (row.meta_change_availability === "not_applicable") return "לא רלוונטי";
  return "לא זמין";
}

export function metaChangeSummary(row: PulseSnapshotRow | PulseGoalDisplayRow): string {
  if (row.last_meta_change_at) return formatMetaChangeDate(row) || "—";
  if (row.meta_change_availability === "no_campaign_change_in_30d") return "לא נמצא";
  if (row.meta_change_availability === "not_applicable") return "—";
  return "לא זמין";
}

export function formatPulseOutcomes(row: Pick<PulseSnapshotRow, "is_ecommerce" | "leads_7d" | "purchases_7d">): string {
  if (row.is_ecommerce) {
    return row.purchases_7d === null || row.purchases_7d === undefined ? "—" : String(row.purchases_7d);
  }
  return row.leads_7d === null || row.leads_7d === undefined ? "—" : String(row.leads_7d);
}

export function formatPulseEfficiency(row: Pick<PulseSnapshotRow, "is_ecommerce" | "cpl_7d" | "roas_7d">): string {
  if (row.is_ecommerce) {
    return row.roas_7d === null || row.roas_7d === undefined ? "—" : `ROAS ${row.roas_7d}`;
  }
  return row.cpl_7d === null || row.cpl_7d === undefined ? "—" : `₪${row.cpl_7d}`;
}

export function formatPulseChange(cplChangePct: number | null | undefined): string {
  if (cplChangePct === null || cplChangePct === undefined) return "—";
  const sign = cplChangePct > 0 ? "+" : "";
  return `${sign}${cplChangePct}%`;
}

export function formatMetaChange(row: PulseSnapshotRow): string {
  if (row.last_meta_change_at) {
    const when = new Date(row.last_meta_change_at).toLocaleString("he-IL", {
      timeZone: "Asia/Jerusalem",
      dateStyle: "short",
      timeStyle: "short",
    });
    const type = row.last_meta_change_type || "שינוי";
    const object = row.last_meta_change_object ? ` (${row.last_meta_change_object})` : "";
    return `${when} — ${type}${object}`;
  }
  if (row.meta_change_availability === "no_campaign_change_in_30d") return "לא נמצא ב-30 יום";
  if (row.meta_change_availability === "not_applicable") return "—";
  return "לא זמין";
}

export function formatLastClientCall(row: PulseSnapshotRow): string {
  if (!row.last_client_call_at) return "לא תועדה שיחה";
  return new Date(row.last_client_call_at).toLocaleString("he-IL", {
    timeZone: "Asia/Jerusalem",
    dateStyle: "short",
    timeStyle: "short",
  });
}

/** Call-freshness flags are shown in the dedicated call column, not under הערה. */
export function isPulseCallFreshnessFlag(flag: string): boolean {
  const normalized = flag.trim();
  return (
    normalized.startsWith("לא תועדה שיחה") ||
    /שיחה טלפונית עם הלקוח/.test(normalized)
  );
}

export function filterPulseCallFlags(flags: string[] | null | undefined): string[] {
  if (!Array.isArray(flags)) return [];
  return flags.filter((flag) => !isPulseCallFreshnessFlag(flag));
}

export const CLIENT_CALL_STALE_MS = 14 * 24 * 60 * 60 * 1000;

export function isClientCallFresh(
  lastClientCallAt: string | null | undefined,
  nowMs = Date.now(),
): boolean {
  if (!lastClientCallAt) return false;
  const ts = new Date(lastClientCallAt).getTime();
  if (Number.isNaN(ts)) return false;
  return nowMs - ts <= CLIENT_CALL_STALE_MS;
}

function isPulseCriticalFlag(flag: string): boolean {
  return /קמפיין נעצר|קמפיינים נעצרו|הוצאה ללא רכישות|הוצאה ללא לידים|ROAS נמוך מ-1/.test(flag);
}

function isPulseNoDataFlag(flag: string): boolean {
  return flag.includes("אין טבלת קמפיין") || flag.includes("שגיאה בחישוב דופק");
}

/** Infer pulse status from non-call flags (mirrors campaign-pulse classification). */
export function inferPulseStatusFromFlags(flags: string[]): PulseStatus | null {
  if (flags.some(isPulseCriticalFlag)) return "critical";
  if (flags.some(isPulseNoDataFlag)) return "no_data";
  if (flags.length > 0) return "warning";
  return null;
}

export function worstPulseStatus(a: PulseStatus, b: PulseStatus): PulseStatus {
  const rank: Record<PulseStatus, number> = { critical: 0, warning: 1, no_data: 2, healthy: 3 };
  return rank[a] <= rank[b] ? a : b;
}

function reconcileGoalStatusAfterFreshCall(
  current: PulseStatus,
  allFlags: string[] | null | undefined,
  callApplies: boolean,
  lastClientCallAt: string,
): PulseStatus {
  if (!callApplies || !isClientCallFresh(lastClientCallAt)) return current;
  const remainingFlags = filterPulseCallFlags(allFlags);
  const fromFlags = inferPulseStatusFromFlags(remainingFlags);
  if (fromFlags !== null) return fromFlags;
  if (current === "warning") return "healthy";
  return current;
}

/** Update snapshot row after a fresh client call is logged from the dashboard. */
export function applyClientCallToPulseSnapshot(
  snapshot: PulseSnapshotRow,
  lastClientCallAt: string,
  lastClientCallBy: string,
): PulseSnapshotRow {
  const mode: CampaignGoalMode =
    snapshot.campaign_goal_mode ?? (snapshot.is_ecommerce ? "ecommerce" : "leads");
  const leadStatus = reconcileGoalStatusAfterFreshCall(
    (snapshot.lead_goal_status ?? (mode !== "ecommerce" ? snapshot.status : "healthy")) as PulseStatus,
    snapshot.flags,
    mode !== "ecommerce",
    lastClientCallAt,
  );
  const ecommerceStatus = reconcileGoalStatusAfterFreshCall(
    (snapshot.ecommerce_goal_status ?? (mode !== "leads" ? snapshot.status : "healthy")) as PulseStatus,
    snapshot.flags,
    mode === "ecommerce",
    lastClientCallAt,
  );
  const status =
    mode === "hybrid"
      ? worstPulseStatus(leadStatus, ecommerceStatus)
      : mode === "ecommerce"
        ? ecommerceStatus
        : leadStatus;

  return {
    ...snapshot,
    last_client_call_at: lastClientCallAt,
    last_client_call_by: lastClientCallBy,
    flags: filterPulseCallFlags(snapshot.flags),
    status,
    lead_goal_status: mode === "ecommerce" ? snapshot.lead_goal_status : leadStatus,
    ecommerce_goal_status: mode === "leads" ? snapshot.ecommerce_goal_status : ecommerceStatus,
  };
}

/** Build shareable authenticated pulse dashboard URL for a tenant + optional agency. */
export function buildPulseDashboardUrl(origin: string, tenantSlug: string, agencyId?: string | null): string {
  // App routes live under `/t/:tenantSlug/...` — without `/t/` TenantUnknownRoute
  // redirects unknown paths to home.
  const base = `${origin.replace(/\/$/, "")}/t/${tenantSlug}/dmm-dashboard`;
  if (agencyId && agencyId !== "all") {
    return `${base}?agency=${encodeURIComponent(agencyId)}`;
  }
  return base;
}

/** YYYY-MM-DD in Asia/Jerusalem (matches how campaigners read the dashboard). */
export function jerusalemYmd(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jerusalem",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function ymdToUtcDate(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function utcDateToYmd(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export type PulsePeriodBounds = {
  startDate: string;
  endDate: string;
  prevStartDate: string;
  prevEndDate: string;
  label: string;
};

/**
 * Calendar bounds for pulse period filters.
 * Weeks are Sunday–Saturday (same as SharedTable / public-table / DashboardView).
 * Previous period is the equal-length window immediately before `startDate`
 * (mirrors snapshot CPL change: current window vs prior window).
 */
export function getPulsePeriodBounds(period: PulsePeriod, now: Date = new Date()): PulsePeriodBounds {
  const todayStr = jerusalemYmd(now);
  const today = ymdToUtcDate(todayStr);
  const y = today.getUTCFullYear();
  const m = today.getUTCMonth();
  const d = today.getUTCDate();
  const dow = today.getUTCDay(); // 0 = Sunday

  let start: Date;
  let end: Date;

  if (period === "last_7_days") {
    // Align with campaign-pulse-snapshot rolling window (date >= now-7).
    start = new Date(Date.UTC(y, m, d - 7));
    end = today;
  } else if (period === "this_week") {
    start = new Date(Date.UTC(y, m, d - dow));
    end = today;
  } else {
    // last_week: previous Sun–Sat
    start = new Date(Date.UTC(y, m, d - dow - 7));
    end = new Date(Date.UTC(y, m, d - dow - 1));
  }

  const dayCount = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
  const prevEnd = new Date(start.getTime() - 86_400_000);
  const prevStart = new Date(prevEnd.getTime() - (dayCount - 1) * 86_400_000);
  const label = PULSE_PERIOD_OPTIONS.find((o) => o.value === period)?.label ?? period;

  return {
    startDate: utcDateToYmd(start),
    endDate: utcDateToYmd(end),
    prevStartDate: utcDateToYmd(prevStart),
    prevEndDate: utcDateToYmd(prevEnd),
    label,
  };
}

function round(value: number | null, digits = 2): number | null {
  if (value === null || Number.isNaN(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function inRange(date: string | null | undefined, start: string, end: string): boolean {
  if (!date) return false;
  return date >= start && date <= end;
}

type CrmRecordLike = { data?: Record<string, unknown> | null };

/** Field sum matching campaign-pulse-snapshot (spend/cost, leads/conversions, …). */
function sumFields(rows: CrmRecordLike[], fields: string[]): number {
  return rows.reduce((total, row) => {
    const data = row.data || {};
    const field = fields.find((candidate) => data[candidate] !== undefined && data[candidate] !== null);
    return total + (field ? Number(data[field]) || 0 : 0);
  }, 0);
}

/**
 * Aggregate crm_records into pulse-shaped metrics for a calendar period,
 * with CPL change vs the previous equal-length window (same as snapshot).
 */
export function aggregatePulseMetricsFromRecords(
  records: CrmRecordLike[],
  bounds: PulsePeriodBounds,
  _isEcommerce = false,
): PulsePeriodMetrics {
  const current: CrmRecordLike[] = [];
  const previous: CrmRecordLike[] = [];

  for (const row of records) {
    const date = typeof row.data?.date === "string" ? row.data.date : null;
    if (!date) continue;
    if (inRange(date, bounds.startDate, bounds.endDate)) current.push(row);
    else if (inRange(date, bounds.prevStartDate, bounds.prevEndDate)) previous.push(row);
  }

  const spend = sumFields(current, ["spend", "cost"]);
  const leads = sumFields(current, ["leads", "conversions", "all_conversions"]);
  const purchases = sumFields(current, ["purchases"]);
  const revenue = sumFields(current, ["purchase_value", "conversions_value", "revenue"]);
  const cpl = leads > 0 ? spend / leads : null;
  const roas = spend > 0 ? revenue / spend : null;

  const prevSpend = sumFields(previous, ["spend", "cost"]);
  const prevLeads = sumFields(previous, ["leads", "conversions", "all_conversions"]);
  const prevCpl = prevLeads > 0 ? prevSpend / prevLeads : null;
  const changePct =
    cpl !== null && prevCpl !== null && prevCpl > 0
      ? ((cpl - prevCpl) / prevCpl) * 100
      : null;

  const freshestInPeriod = current
    .map((r) => (typeof r.data?.date === "string" ? r.data.date : null))
    .filter((d): d is string => !!d)
    .sort()
    .reverse()[0] ?? null;

  return {
    spend_7d: round(spend) ?? 0,
    leads_7d: round(leads) ?? 0,
    cpl_7d: round(cpl),
    cpl_change_pct: round(changePct, 1),
    purchases_7d: round(purchases) ?? 0,
    revenue_7d: round(revenue) ?? 0,
    roas_7d: round(roas),
    data_fresh_through: freshestInPeriod,
    record_count: current.length,
  };
}

/** Overlay period metrics onto a snapshot row (keeps meta-change + status/flags). */
export function applyPeriodMetricsToSnapshot(
  snapshot: PulseSnapshotRow,
  metrics: PulsePeriodMetrics,
): PulseSnapshotRow {
  return {
    ...snapshot,
    spend_7d: metrics.spend_7d,
    leads_7d: metrics.leads_7d,
    cpl_7d: metrics.cpl_7d,
    cpl_change_pct: metrics.cpl_change_pct,
    purchases_7d: metrics.purchases_7d,
    revenue_7d: metrics.revenue_7d,
    roas_7d: metrics.roas_7d,
    data_fresh_through: metrics.data_fresh_through ?? snapshot.data_fresh_through,
  };
}

export function pulseSpendColumnLabel(period: PulsePeriod): string {
  if (period === "last_week") return "הוצאה שבוע שעבר";
  if (period === "this_week") return "הוצאה השבוע";
  return "הוצאה 7 ימים";
}

/** Skip facebook_insights when the same client also has facebook_ecommerce (avoid double cards). */
export function filterDuplicateFacebookPulseTables<T extends { id: string; client_id: string; integration_type: string }>(
  tables: T[],
): T[] {
  const clientFbTypes = new Map<string, Set<string>>();
  for (const table of tables) {
    if (table.integration_type !== "facebook_insights" && table.integration_type !== "facebook_ecommerce") {
      continue;
    }
    if (!clientFbTypes.has(table.client_id)) clientFbTypes.set(table.client_id, new Set());
    clientFbTypes.get(table.client_id)!.add(table.integration_type);
  }
  const skipTableIds = new Set<string>();
  for (const table of tables) {
    if (table.integration_type === "facebook_insights") {
      const types = clientFbTypes.get(table.client_id);
      if (types?.has("facebook_ecommerce")) skipTableIds.add(table.id);
    }
  }
  return tables.filter((table) => !skipTableIds.has(table.id));
}

const PULSE_RECORD_PAGE_SIZE = 1000;
const PULSE_RECORD_MAX_ROWS = 100_000;
const PULSE_TABLE_ID_CHUNK = 40;

async function fetchPulseCampaignRecordsChunk(
  tableIds: string[],
  bounds: PulsePeriodBounds,
): Promise<PulseCrmRecord[]> {
  const rows: PulseCrmRecord[] = [];
  for (let from = 0; from < PULSE_RECORD_MAX_ROWS; from += PULSE_RECORD_PAGE_SIZE) {
    const to = from + PULSE_RECORD_PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from("crm_records")
      .select("table_id, data")
      .in("table_id", tableIds)
      .filter("data->>date", "gte", bounds.prevStartDate)
      .filter("data->>date", "lte", bounds.endDate)
      .range(from, to);
    if (error) throw error;
    if (!data?.length) break;
    rows.push(...(data as PulseCrmRecord[]));
    if (data.length < PULSE_RECORD_PAGE_SIZE) break;
  }
  return rows;
}

/**
 * Paginated crm_records fetch (chunked by table_id).
 * Avoids per-table edge-function calls (~20s for large agencies) and the old
 * single-query 20k row cap that dropped clients.
 */
export async function fetchPulseCampaignRecords(
  tableIds: string[],
  bounds: PulsePeriodBounds,
): Promise<PulseCrmRecord[]> {
  if (!tableIds.length) return [];

  const chunks: string[][] = [];
  for (let offset = 0; offset < tableIds.length; offset += PULSE_TABLE_ID_CHUNK) {
    chunks.push(tableIds.slice(offset, offset + PULSE_TABLE_ID_CHUNK));
  }

  const chunkResults = await Promise.all(
    chunks.map((chunk) => fetchPulseCampaignRecordsChunk(chunk, bounds)),
  );
  return chunkResults.flat();
}

export function pulseGoalKeyForTable(
  integrationType: string,
  campaignType: "leads" | "ecommerce",
): { platform: PulsePlatform | null; goal: CampaignGoal } {
  const platform = pulsePlatformKey(integrationType);
  const goal = integrationTypeToGoal(integrationType) || campaignType;
  return { platform, goal };
}
