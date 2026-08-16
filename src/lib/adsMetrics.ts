// Shared metric extraction for report records (`crm_records.data`).
//
// Every integration writes its own field names — Facebook syncs write
// `purchases` / `purchase_value` / `add_to_cart`, Google Ads writes
// `conversions` / `conversions_value` to mirror the Google Ads UI columns, and
// Google Analytics writes `ecommercePurchases` / `purchaseRevenue` / `addToCarts`.
// These getters are the single place that maps those dialects to one metric, so
// the "All" tab breakdown, the per-platform tabs, the shared/public views and
// the agency dashboard can never disagree about the same number again.

export const FACEBOOK_FORM_LEAD_ACTION_KEYS = [
  'form_leads',
  'leadgen.other',
  'leadgen_grouped',
  'onsite_conversion.lead_grouped',
] as const;

export const getFacebookFormLeadsFromData = (data: any) => {
  for (const key of FACEBOOK_FORM_LEAD_ACTION_KEYS) {
    const value = Number(data?.[key]);
    if (value > 0) return value;
  }
  return 0;
};

export const getExplicitLeadFieldsFromData = (data: any) =>
  getFacebookFormLeadsFromData(data) ||
  Number(data?.leads) ||
  Number(data?.website_leads) ||
  Number(data?.offsite_conversion) ||
  Number(data?.offsite_conversion_fb_pixel_lead) ||
  0;

export const getLeadsFromData = (data: any) =>
  Number(data?.leads) ||
  getFacebookFormLeadsFromData(data) ||
  Number(data?.conversions) ||
  Number(data?.website_leads) ||
  Number(data?.offsite_conversion) ||
  Number(data?.offsite_conversion_fb_pixel_lead) ||
  0;

export const getSpendFromData = (data: any) => Number(data?.spend) || Number(data?.cost) || 0;

export const getRevenueFromData = (data: any) =>
  Number(data?.purchase_value) ||
  Number(data?.purchaseRevenue) ||
  Number(data?.conversions_value) ||
  Number(data?.conversion_value) ||
  0;

/** Purchases as reported by Analytics / WooCommerce-style records. */
export const getPurchasesFromData = (data: any) =>
  Number(data?.purchases) ||
  Number(data?.ecommercePurchases) ||
  Number(data?.transactions) ||
  0;

/**
 * Purchases for an ecommerce ADS record (Facebook / Google Ads).
 *
 * `sync-google-ads-data` stores the campaign's conversions under `conversions`
 * so the report matches the Google Ads UI "Conversions" column, and never
 * writes a `purchases` field. Counting `purchases` alone therefore reports 0
 * purchases for a Google Ads ecommerce table even though its revenue — which
 * already falls back to `conversions_value` — is fully populated.
 */
export const getAdsPurchasesFromData = (data: any) =>
  getPurchasesFromData(data) || Number(data?.conversions) || 0;

const ADD_TO_CART_KEYS = ['add_to_cart', 'addToCarts'] as const;

export const getAddToCartFromData = (data: any) =>
  Number(data?.add_to_cart) || Number(data?.addToCarts) || 0;

/**
 * Whether the record's source reports add-to-cart at all. Google Ads campaign
 * reports carry no add-to-cart metric, so a summed 0 there means "not tracked"
 * rather than "nobody added to cart" and should be rendered as unavailable.
 */
export const hasAddToCartMetric = (data: any) =>
  !!data && ADD_TO_CART_KEYS.some((key) => data[key] !== undefined && data[key] !== null);

export const getSessionsFromData = (data: any) => Number(data?.sessions) || 0;

export const getUsersFromData = (data: any) => Number(data?.users) || 0;

export type FacebookCampaignRow = {
  name: string;
  impressions: number;
  clicks: number;
  spend: number;
  leads: number;
  purchases: number;
  purchase_value: number;
  add_to_cart: number;
  campaign_type?: string;
};

/** Mirrors DynamicTableView ecommerce campaign detection on aggregated rows. */
export function isFacebookEcommerceCampaign(data: FacebookCampaignRow): boolean {
  if (String(data.campaign_type || '').toLowerCase() === 'traffic') return false;
  return (
    (String(data.campaign_type || '').toLowerCase() === 'ecommerce' ||
      data.purchases > 0 ||
      data.purchase_value > 0) &&
    !(data.leads > 0 && data.purchases === 0 && data.purchase_value === 0)
  );
}

export function isFacebookTrafficCampaign(data: FacebookCampaignRow): boolean {
  return String(data.campaign_type || '').toLowerCase() === 'traffic';
}

/**
 * Split aggregated Facebook campaigns into ecommerce / leads / traffic tables.
 * Matches DynamicTableView exactly so mixed accounts (e.g. אביאלי) render the same breakdown.
 */
export function groupFacebookCampaigns(
  campaigns: FacebookCampaignRow[],
  options: {
    /** integration_settings.campaign_type = leads — hide ecommerce table */
    forceLeadsOnly?: boolean;
    /** Non-mixed tables: show a single campaign table (still keeps traffic separate) */
    singleTableMode?: 'ecommerce' | 'leads';
  } = {},
): { ecommerce: FacebookCampaignRow[]; leads: FacebookCampaignRow[]; traffic: FacebookCampaignRow[] } {
  const traffic = campaigns.filter(isFacebookTrafficCampaign);
  const nonTraffic = campaigns.filter((c) => !isFacebookTrafficCampaign(c));

  if (options.singleTableMode === 'ecommerce') {
    return { ecommerce: nonTraffic, leads: [], traffic };
  }
  if (options.singleTableMode === 'leads') {
    return { ecommerce: [], leads: nonTraffic, traffic };
  }

  const forceLeadsOnly = options.forceLeadsOnly ?? false;
  const ecommerce = forceLeadsOnly ? [] : nonTraffic.filter(isFacebookEcommerceCampaign);
  const leads = forceLeadsOnly
    ? nonTraffic
    : nonTraffic.filter((c) => !isFacebookEcommerceCampaign(c));

  return { ecommerce, leads, traffic };
}

/** Aggregate facebook_insights / facebook_ecommerce records by campaign name. */
export function aggregateFacebookCampaignsFromRecords(
  records: Array<{ data?: any }>,
): FacebookCampaignRow[] {
  const map: Record<string, FacebookCampaignRow> = {};

  records.forEach((r) => {
    const d = r.data || {};
    const name = d.campaign_name || d.campaign || 'ללא שם';
    if (!map[name]) {
      map[name] = {
        name,
        impressions: 0,
        clicks: 0,
        spend: 0,
        leads: 0,
        purchases: 0,
        purchase_value: 0,
        add_to_cart: 0,
        campaign_type: d.campaign_type,
      };
    }
    map[name].impressions += Number(d.impressions) || 0;
    map[name].clicks += Number(d.clicks) || 0;
    map[name].spend += getSpendFromData(d);
    map[name].leads += getLeadsFromData(d);
    map[name].purchases += getAdsPurchasesFromData(d);
    map[name].purchase_value += getRevenueFromData(d);
    map[name].add_to_cart += getAddToCartFromData(d);
    const rowType = String(d.campaign_type || '').toLowerCase();
    if (rowType === 'ecommerce' || rowType === 'lead' || rowType === 'traffic') {
      map[name].campaign_type = rowType;
    }
  });

  return Object.values(map).sort((a, b) => b.spend - a.spend);
}

export type FacebookRecordKind = 'ecommerce' | 'leads' | 'traffic';

/** Mirrors DynamicTableView campaign split — per row before aggregation. */
export function classifyFacebookRecord(data: any): FacebookRecordKind {
  const rowType = String(data?.campaign_type || '').toLowerCase();
  if (rowType === 'traffic') return 'traffic';
  if (rowType === 'ecommerce') return 'ecommerce';

  const purchases = Number(data?.purchases) || 0;
  const purchaseValue = Number(data?.purchase_value) || 0;
  const leads = getLeadsFromData(data);

  const isEcommerce =
    (purchases > 0 || purchaseValue > 0) &&
    !(leads > 0 && purchases === 0 && purchaseValue === 0);

  return isEcommerce ? 'ecommerce' : 'leads';
}

/** Classify an aggregated Facebook campaign row (same rules as DynamicTableView). */
export function classifyFacebookCampaignTotals(totals: {
  leads?: number;
  purchases?: number;
  purchase_value?: number;
  revenue?: number;
  campaign_type?: string;
}): FacebookRecordKind {
  const rowType = String(totals.campaign_type || '').toLowerCase();
  if (rowType === 'traffic') return 'traffic';
  const row: FacebookCampaignRow = {
    name: '',
    impressions: 0,
    clicks: 0,
    spend: 0,
    leads: Number(totals.leads) || 0,
    purchases: Number(totals.purchases) || 0,
    purchase_value: Number(totals.purchase_value) || Number(totals.revenue) || 0,
    add_to_cart: 0,
    campaign_type: totals.campaign_type,
  };
  return isFacebookEcommerceCampaign(row) ? 'ecommerce' : 'leads';
}

export function isFacebookLeadsOnlyTable(integrationSettings?: any): boolean {
  const t = String(integrationSettings?.campaign_type || '').toLowerCase();
  return t === 'leads' || t === 'lead';
}

/** facebook_insights tables without an explicit leads-only flag show both ecom + lead campaigns. */
export function facebookTableUsesMixedRows(
  integrationType?: string | null,
  integrationSettings?: any,
): boolean {
  if (integrationType !== 'facebook_insights') return false;
  return !isFacebookLeadsOnlyTable(integrationSettings);
}
