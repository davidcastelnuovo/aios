export type WeeklyAdsSource = "facebook_insights" | "facebook_ecommerce" | "google_ads";
export type WeeklyCampaignKind = "leads" | "ecommerce" | "traffic";

export type WeeklyAdsRecord = {
  data?: Record<string, unknown>;
  _source?: string;
};

export type WeeklyCampaignRow = {
  key: string;
  source: WeeklyAdsSource;
  campaignId: string;
  campaign: string;
  kind: WeeklyCampaignKind;
  impressions: number;
  clicks: number;
  results: number;
  spend: number;
  costPerResult: number;
  revenue: number;
  addToCart: number;
  roas: number;
};

export type WeeklyCampaignSection = {
  key: string;
  index: number;
  startDate: string;
  endDate: string;
  isCurrentWeek: boolean;
  rows: WeeklyCampaignRow[];
  totals: Omit<WeeklyCampaignRow, "key" | "source" | "campaignId" | "campaign" | "kind">;
};

const ADS_SOURCES = new Set<WeeklyAdsSource>([
  "facebook_insights",
  "facebook_ecommerce",
  "google_ads",
]);

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;

const numberFrom = (data: Record<string, unknown>, ...keys: string[]): number => {
  for (const key of keys) {
    const value = Number(data[key]);
    if (value) return value;
  }
  return 0;
};

const shouldIncludeCampaignRow = (data: Record<string, unknown>): boolean => {
  const level = String(data.entity_level || "").toLowerCase();
  return !level || level === "campaign";
};

const facebookKind = (totals: {
  leads: number;
  purchases: number;
  revenue: number;
  campaignType?: string;
}): WeeklyCampaignKind => {
  const explicit = String(totals.campaignType || "").toLowerCase();
  if (explicit === "traffic") return "traffic";
  if (explicit === "ecommerce") return "ecommerce";
  if (explicit === "lead" || explicit === "leads") return "leads";
  return (totals.purchases > 0 || totals.revenue > 0) &&
    !(totals.leads > 0 && totals.purchases === 0 && totals.revenue === 0)
    ? "ecommerce"
    : "leads";
};

function utcDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function parseDate(value: unknown): Date | null {
  const raw = typeof value === "string" ? value.slice(0, 10) : "";
  if (!ISO_DATE.test(raw)) return null;
  const date = new Date(`${raw}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function getSundayStart(date: Date): Date {
  const day = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  day.setUTCDate(day.getUTCDate() - day.getUTCDay());
  return day;
}

function campaignKind(
  source: WeeklyAdsSource,
  totals: { leads: number; purchases: number; revenue: number; campaignType?: string },
  sourceModes: Partial<Record<WeeklyAdsSource, "leads" | "ecommerce">>,
): WeeklyCampaignKind {
  if (source === "google_ads") return sourceModes[source] === "ecommerce" ? "ecommerce" : "leads";
  if (source === "facebook_ecommerce") return "ecommerce";
  if (sourceModes[source] === "leads") return "leads";
  return facebookKind(totals);
}

/**
 * Builds calendar-week campaign tables, newest first. Week boundaries are always
 * Sunday–Saturday; the first section may be the current partial week.
 */
export function buildWeeklyCampaignSections(
  records: WeeklyAdsRecord[],
  options: {
    now?: Date;
    maxWeeks?: number;
    defaultSource?: WeeklyAdsSource;
    sourceModes?: Partial<Record<WeeklyAdsSource, "leads" | "ecommerce">>;
  } = {},
): WeeklyCampaignSection[] {
  const now = options.now ?? new Date();
  const maxWeeks = options.maxWeeks ?? 53;
  const currentSunday = getSundayStart(now);
  const sourceModes = options.sourceModes ?? {};
  const weeks = new Map<number, Map<string, {
    source: WeeklyAdsSource;
    campaignId: string;
    campaign: string;
    impressions: number;
    clicks: number;
    leads: number;
    purchases: number;
    spend: number;
    revenue: number;
    addToCart: number;
    campaignType?: string;
  }>>();

  for (const record of records) {
    const source = (record._source ?? options.defaultSource) as WeeklyAdsSource | undefined;
    if (!source || !ADS_SOURCES.has(source)) continue;
    const data = record.data ?? {};
    if (!shouldIncludeCampaignRow(data)) continue;

    const date = parseDate(data.date);
    if (!date) continue;
    const recordSunday = getSundayStart(date);
    const weekIndex = Math.round((currentSunday.getTime() - recordSunday.getTime()) / (7 * DAY_MS));
    if (weekIndex < 0 || weekIndex >= maxWeeks) continue;

    const campaign = String(data.campaign_name || data.campaign || "ללא שם קמפיין");
    const campaignId = String(data.campaign_id || campaign);
    const rowKey = `${source}:${campaignId}`;
    const week = weeks.get(weekIndex) ?? new Map();
    const row = week.get(rowKey) ?? {
      source,
      campaignId,
      campaign,
      impressions: 0,
      clicks: 0,
      leads: 0,
      purchases: 0,
      spend: 0,
      revenue: 0,
      addToCart: 0,
      campaignType: undefined,
    };

    row.impressions += Number(data.impressions) || 0;
    row.clicks += Number(data.clicks) || Number(data.link_clicks) || 0;
    row.leads += numberFrom(
      data,
      "leads",
      "form_leads",
      "leadgen.other",
      "leadgen_grouped",
      "onsite_conversion.lead_grouped",
      "conversions",
      "website_leads",
      "offsite_conversion",
      "offsite_conversion_fb_pixel_lead",
    );
    row.purchases += numberFrom(data, "purchases", "ecommercePurchases", "transactions", "conversions");
    row.spend += numberFrom(data, "spend", "cost");
    row.revenue += numberFrom(
      data,
      "purchase_value",
      "purchaseRevenue",
      "total_revenue",
      "conversions_value",
      "conversion_value",
    );
    row.addToCart += numberFrom(data, "add_to_cart", "addToCarts");
    const explicitType = String(data.campaign_type || "").toLowerCase();
    if (explicitType === "ecommerce" || explicitType === "lead" || explicitType === "traffic") {
      row.campaignType = explicitType;
    }
    week.set(rowKey, row);
    weeks.set(weekIndex, week);
  }

  return [...weeks.entries()]
    .sort(([a], [b]) => a - b)
    .map(([index, campaigns]) => {
      const start = new Date(currentSunday);
      start.setUTCDate(start.getUTCDate() - index * 7);
      const end = new Date(start);
      end.setUTCDate(end.getUTCDate() + 6);

      const rows = [...campaigns.entries()].map(([key, campaign]) => {
        const kind = campaignKind(campaign.source, campaign, sourceModes);
        const results = kind === "ecommerce" ? campaign.purchases : kind === "traffic" ? campaign.clicks : campaign.leads;
        return {
          key,
          source: campaign.source,
          campaignId: campaign.campaignId,
          campaign: campaign.campaign,
          kind,
          impressions: campaign.impressions,
          clicks: campaign.clicks,
          results,
          spend: campaign.spend,
          costPerResult: results > 0 ? campaign.spend / results : 0,
          revenue: campaign.revenue,
          addToCart: campaign.addToCart,
          roas: campaign.spend > 0 ? campaign.revenue / campaign.spend : 0,
        };
      }).sort((a, b) => b.spend - a.spend);

      const totals = rows.reduce((sum, row) => ({
        impressions: sum.impressions + row.impressions,
        clicks: sum.clicks + row.clicks,
        results: sum.results + row.results,
        spend: sum.spend + row.spend,
        costPerResult: 0,
        revenue: sum.revenue + row.revenue,
        addToCart: sum.addToCart + row.addToCart,
        roas: 0,
      }), { impressions: 0, clicks: 0, results: 0, spend: 0, costPerResult: 0, revenue: 0, addToCart: 0, roas: 0 });
      totals.costPerResult = totals.results > 0 ? totals.spend / totals.results : 0;
      totals.roas = totals.spend > 0 ? totals.revenue / totals.spend : 0;

      return {
        key: utcDateString(start),
        index,
        startDate: utcDateString(start),
        endDate: utcDateString(end),
        isCurrentWeek: index === 0,
        rows,
        totals,
      };
    });
}

export function formatWeeklyRange(startDate: string, endDate: string): string {
  const format = (value: string) => {
    const [year, month, day] = value.split("-");
    return `${day}/${month}/${year}`;
  };
  return `${format(startDate)}–${format(endDate)}`;
}
