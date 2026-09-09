import {
  aggregateFacebookCampaignsFromRecords,
  getAdsPurchasesFromData,
  getLeadsFromData,
  getRevenueFromData,
  getSpendFromData,
  type FacebookCampaignRow,
} from '@/lib/adsMetrics';

export type AdsEntityLevel = 'campaign' | 'adset' | 'ad';

export const ADS_ENTITY_LEVELS: AdsEntityLevel[] = ['campaign', 'adset', 'ad'];

export const ADS_ENTITY_LEVEL_LABELS: Record<AdsEntityLevel, string> = {
  campaign: 'קמפיינים',
  adset: 'קבוצות מודעות',
  ad: 'מודעות',
};

export const ADS_ENTITY_SEARCH_PLACEHOLDERS: Record<AdsEntityLevel, string> = {
  campaign: 'חפש קמפיין...',
  adset: 'חפש קבוצת מודעות...',
  ad: 'חפש מודעה...',
};

export function resolveRecordEntityLevel(data: Record<string, unknown> | undefined | null): AdsEntityLevel {
  const level = String(data?.entity_level || 'campaign').toLowerCase();
  if (level === 'adset' || level === 'ad') return level;
  return 'campaign';
}

const ADS_INTEGRATION_TYPES = new Set([
  'facebook_insights',
  'facebook_ecommerce',
  'google_ads',
  'tiktok',
]);

export function isAdsIntegrationType(integrationType: string | null | undefined): boolean {
  return !!integrationType && ADS_INTEGRATION_TYPES.has(integrationType);
}

/** Dashboards and pulse metrics must aggregate campaign-level rows only — adset/ad rows duplicate spend. */
export function shouldIncludeInAdsDashboardAggregate(
  data: Record<string, unknown> | undefined | null,
  integrationType?: string | null,
): boolean {
  if (integrationType && !isAdsIntegrationType(integrationType)) return true;
  return resolveRecordEntityLevel(data) === 'campaign';
}

export function filterCampaignLevelAdsRecords<T extends { data?: Record<string, any> }>(
  records: T[],
  integrationType?: string | null,
): T[] {
  if (!isAdsIntegrationType(integrationType)) return records;
  return records.filter((record) => shouldIncludeInAdsDashboardAggregate(record.data, integrationType));
}

export function filterRecordsByEntityLevel<T extends { data?: Record<string, any> }>(
  records: T[],
  level: AdsEntityLevel,
): T[] {
  return records.filter((record) => resolveRecordEntityLevel(record.data) === level);
}

export function getEntityDisplayName(data: Record<string, any> | undefined | null, level: AdsEntityLevel): string {
  const d = data || {};
  if (level === 'ad') {
    return String(d.ad_name || d.ad_id || 'ללא שם');
  }
  if (level === 'adset') {
    return String(d.adset_name || d.ad_group_name || d.adset_id || d.ad_group_id || 'ללא שם');
  }
  return String(d.campaign_name || d.campaign || 'ללא שם');
}

export function getEntityGroupKey(data: Record<string, any> | undefined | null, level: AdsEntityLevel): string {
  const d = data || {};
  if (level === 'ad') {
    return String(d.ad_id || d.ad_name || getEntityDisplayName(d, level));
  }
  if (level === 'adset') {
    return String(d.adset_id || d.ad_group_id || d.adset_name || d.ad_group_name || getEntityDisplayName(d, level));
  }
  return String(d.campaign_id || d.campaign_name || d.campaign || getEntityDisplayName(d, level));
}

export function recordMatchesEntitySearch(
  data: Record<string, any> | undefined | null,
  level: AdsEntityLevel,
  searchTerm: string,
): boolean {
  const term = searchTerm.trim().toLowerCase();
  if (!term) return true;
  const name = getEntityDisplayName(data, level).toLowerCase();
  if (name.includes(term)) return true;
  const campaignName = String(data?.campaign_name || data?.campaign || '').toLowerCase();
  if (level !== 'campaign' && campaignName.includes(term)) return true;
  const adsetName = String(data?.adset_name || data?.ad_group_name || '').toLowerCase();
  if (level === 'ad' && adsetName.includes(term)) return true;
  return false;
}

export type AdsEntityRow = {
  key: string;
  name: string;
  campaign_name?: string;
  adset_name?: string;
  impressions: number;
  clicks: number;
  spend: number;
  leads: number;
  purchases: number;
  purchase_value: number;
  add_to_cart: number;
  campaign_type?: string;
  conversions?: number;
  conversions_value?: number;
  cost?: number;
  verified_leads?: number;
  roas_sum?: number;
  roas_count?: number;
  all_conversions?: number;
  all_conversions_value?: number;
};

/** Aggregate Facebook insight records at campaign/adset/ad granularity. */
export function aggregateFacebookRecordsAtLevel(
  records: Array<{ data?: any }>,
  level: AdsEntityLevel,
): FacebookCampaignRow[] {
  if (level === 'campaign') {
    return aggregateFacebookCampaignsFromRecords(records);
  }

  const map: Record<string, FacebookCampaignRow & { key: string }> = {};
  records.forEach((record) => {
    const d = record.data || {};
    const key = getEntityGroupKey(d, level);
    const name = getEntityDisplayName(d, level);
    if (!map[key]) {
      map[key] = {
        key,
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
    const rowType = String(d.campaign_type || '').toLowerCase();
    if (rowType === 'ecommerce' || rowType === 'lead' || rowType === 'traffic') {
      map[key].campaign_type = rowType;
    }
    map[key].impressions += Number(d.impressions) || 0;
    map[key].clicks += Number(d.clicks) || 0;
    map[key].spend += getSpendFromData(d);
    map[key].leads += getLeadsFromData(d);
    map[key].purchases += getAdsPurchasesFromData(d);
    map[key].purchase_value += getRevenueFromData(d);
    map[key].add_to_cart += Number(d.add_to_cart) || 0;
  });

  return Object.values(map).sort((a, b) => b.spend - a.spend);
}

/** Aggregate Google Ads records at campaign/adset/ad granularity. */
export function aggregateGoogleRecordsAtLevel(
  records: Array<{ data?: any }>,
  level: AdsEntityLevel,
): AdsEntityRow[] {
  const map: Record<string, AdsEntityRow> = {};

  records.forEach((record) => {
    const d = record.data || {};
    const key = getEntityGroupKey(d, level);
    const name = getEntityDisplayName(d, level);
    if (!map[key]) {
      map[key] = {
        key,
        name,
        campaign_name: d.campaign_name,
        adset_name: d.adset_name || d.ad_group_name,
        impressions: 0,
        clicks: 0,
        spend: 0,
        cost: 0,
        leads: 0,
        conversions: 0,
        conversions_value: 0,
        purchases: 0,
        purchase_value: 0,
        add_to_cart: 0,
        verified_leads: 0,
        roas_sum: 0,
        roas_count: 0,
        all_conversions: 0,
        all_conversions_value: 0,
      };
    }
    map[key].impressions += Number(d.impressions) || 0;
    map[key].clicks += Number(d.clicks) || 0;
    const cost = Number(d.cost) || 0;
    map[key].cost! += cost;
    map[key].spend += cost;
    const conversions = Number(d.conversions) || Number(d.purchases) || 0;
    map[key].conversions! += conversions;
    map[key].leads += getLeadsFromData(d);
    const convValue = Number(d.conversions_value) || Number(d.purchase_value) || 0;
    map[key].conversions_value! += convValue;
    map[key].purchase_value += convValue;
    map[key].purchases += getAdsPurchasesFromData(d);
    map[key].add_to_cart += Number(d.add_to_cart) || 0;
    map[key].verified_leads! += Number(d.verified_leads) || 0;
    map[key].all_conversions! += Number(d.all_conversions) || 0;
    map[key].all_conversions_value! += Number(d.all_conversions_value) || 0;
    if (d.roas) {
      map[key].roas_sum! += Number(d.roas) || 0;
      map[key].roas_count! += 1;
    }
  });

  return Object.values(map)
    .map((row) => ({ ...row, leads: Math.round(row.leads) }))
    .sort((a, b) => b.spend - a.spend);
}

export function hasEntityLevelData(
  records: Array<{ data?: any }>,
  level: AdsEntityLevel,
): boolean {
  if (level === 'campaign') return records.length > 0;
  return records.some((record) => resolveRecordEntityLevel(record.data) === level);
}
