import { getAdsPurchasesFromData, getRevenueFromData, getSpendFromData } from "@/lib/adsMetrics";
import { shouldIncludeInAdsDashboardAggregate } from "@/lib/adsEntityLevel";

export type CampaignRecord = {
  campaignName: string;
  impressions: number;
  clicks: number;
  leads: number;
  purchases: number;
  spend: number;
  revenue: number;
};

export type ClientCampaignTableData = {
  clientId: string;
  clientName: string;
  tableId: string;
  tableName: string;
  integrationType: string;
  campaignType: "leads" | "ecommerce";
  records: CampaignRecord[];
  totals: CampaignRecord;
};

const emptyTotals = (): CampaignRecord => ({
  campaignName: 'סה"כ',
  impressions: 0,
  clicks: 0,
  leads: 0,
  purchases: 0,
  spend: 0,
  revenue: 0,
});

export const isFacebookIntegration = (source: string) =>
  ["facebook_insights", "facebook_ecommerce"].includes(source);

export const isGoogleAdsIntegration = (source: string) => source === "google_ads";

export const isAdsIntegration = (source: string) =>
  isFacebookIntegration(source) || isGoogleAdsIntegration(source);

export type AgencyPlatformFilter = "all" | "facebook" | "google_ads";

export function matchesAgencyPlatformFilter(integrationType: string, filter: AgencyPlatformFilter): boolean {
  if (filter === "all") return true;
  if (filter === "facebook") return isFacebookIntegration(integrationType);
  if (filter === "google_ads") return isGoogleAdsIntegration(integrationType);
  return true;
}

export const getLeadsFromData = (data: Record<string, unknown>) =>
  Number(data?.leads) ||
  Number(data?.conversions) ||
  Number(data?.website_leads) ||
  Number(data?.offsite_conversion) ||
  Number(data?.offsite_conversion_fb_pixel_lead) ||
  Number(data?.leadgen_grouped) ||
  Number(data?.lead) ||
  0;

export function getCampaignType(
  integrationType: string,
  integrationSettings?: Record<string, unknown> | null,
): "leads" | "ecommerce" {
  if (integrationType === "facebook_insights") return "leads";
  if (integrationType === "facebook_ecommerce") return "ecommerce";
  if (integrationType === "google_ads") {
    return integrationSettings?.campaign_type === "ecommerce" ? "ecommerce" : "leads";
  }
  return "leads";
}

type RawCampaignRecord = {
  table_id: string;
  data?: Record<string, unknown>;
};

type CampaignTableMeta = {
  id: string;
  client_id: string;
  name?: string | null;
  integration_type: string;
  integration_settings?: Record<string, unknown> | null;
};

export function buildClientCampaignTableData(input: {
  clients: Array<{ id: string; name: string }>;
  tables: CampaignTableMeta[];
  records: RawCampaignRecord[];
  startDate: string;
  endDate: string;
  platformFilter: AgencyPlatformFilter;
}): ClientCampaignTableData[] {
  const { clients, tables, records, startDate, endDate, platformFilter } = input;
  const clientMap = new Map(clients.map((client) => [client.id, client.name]));
  const tableMeta = new Map(tables.map((table) => [table.id, table]));
  const tableDataMap = new Map<string, ClientCampaignTableData>();

  for (const record of records) {
    const table = tableMeta.get(record.table_id);
    if (!table?.client_id) continue;
    if (!isAdsIntegration(table.integration_type)) continue;
    if (!matchesAgencyPlatformFilter(table.integration_type, platformFilter)) continue;

    const data = record.data || {};
    const date = typeof data.date === "string" ? data.date : null;
    if (!date || date < startDate || date > endDate) continue;
    if (!shouldIncludeInAdsDashboardAggregate(data, table.integration_type)) continue;

    const key = `${table.client_id}-${table.id}`;
    if (!tableDataMap.has(key)) {
      tableDataMap.set(key, {
        clientId: table.client_id,
        clientName: clientMap.get(table.client_id) || "לקוח לא ידוע",
        tableId: table.id,
        tableName: table.name || "",
        integrationType: table.integration_type,
        campaignType: getCampaignType(table.integration_type, table.integration_settings),
        records: [],
        totals: emptyTotals(),
      });
    }

    const tableData = tableDataMap.get(key)!;
    const campaignName = String(
      data.campaign_name || data.campaignName || data.name || "ללא שם",
    );

    let campaignRecord = tableData.records.find((row) => row.campaignName === campaignName);
    if (!campaignRecord) {
      campaignRecord = {
        campaignName,
        impressions: 0,
        clicks: 0,
        leads: 0,
        purchases: 0,
        spend: 0,
        revenue: 0,
      };
      tableData.records.push(campaignRecord);
    }

    const impressions = Number(data.impressions) || 0;
    const clicks = Number(data.clicks) || 0;
    const leads = getLeadsFromData(data);
    const purchases = getAdsPurchasesFromData(data);
    const spend = getSpendFromData(data);
    const revenue = getRevenueFromData(data);

    campaignRecord.impressions += impressions;
    campaignRecord.clicks += clicks;
    campaignRecord.leads += leads;
    campaignRecord.purchases += purchases;
    campaignRecord.spend += spend;
    campaignRecord.revenue += revenue;

    tableData.totals.impressions += impressions;
    tableData.totals.clicks += clicks;
    tableData.totals.leads += leads;
    tableData.totals.purchases += purchases;
    tableData.totals.spend += spend;
    tableData.totals.revenue += revenue;
  }

  return Array.from(tableDataMap.values())
    .filter((row) => row.records.length > 0)
    .sort((a, b) => a.clientName.localeCompare(b.clientName, "he"));
}
