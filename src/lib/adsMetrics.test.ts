import assert from 'node:assert/strict';
import test from 'node:test';
import {
  aggregateFacebookCampaignsFromRecords,
  classifyFacebookCampaignTotals,
  classifyFacebookRecord,
  facebookTableUsesMixedRows,
  groupFacebookCampaigns,
  getAddToCartFromData,
  getAdsPurchasesFromData,
  getPurchasesFromData,
  getRevenueFromData,
  getSpendFromData,
  hasAddToCartMetric,
} from './adsMetrics.ts';

// Real record shapes as written by each sync into `crm_records.data`.
const googleAdsRow = {
  date: '2026-07-15',
  campaign_id: '22264861592',
  campaign_name: 'Performance Max- קהל מקצועי+ביתי',
  impressions: 4179,
  clicks: 89,
  ctr: 2.13,
  cpc: 1.95,
  cost: 173.55,
  conversions: 3.5,
  conversions_value: 2190,
  all_conversions: 4.2,
  all_conversions_value: 2190,
  cost_per_conversion: 49.58,
  roas: 12.62,
};

const facebookEcommerceRow = {
  date: '2026-07-20',
  campaign_id: '120232338548940345',
  campaign_name: 'רימרקטינג - מכירות - אוג/ספט 2025',
  impressions: 2121,
  clicks: 12,
  spend: 45.93,
  purchases: 3,
  purchase_value: 7908,
  add_to_cart: 14,
  add_to_cart_value: 1114,
  roas: 172.18,
};

// Analytics rows carry `conversions` (key events) alongside `purchases`, so the
// generic purchases getter must never fall back to it.
const analyticsRow = {
  date: '2026-07-03',
  report_type: 'daily',
  users: 132,
  sessions: 155,
  purchases: 2,
  purchase_value: 430.999998,
  add_to_cart: 34,
  conversions: 13,
};

test('Google Ads conversions count as purchases for an ecommerce ads row', () => {
  // The row has no `purchases` field at all — reading it alone was the bug.
  assert.equal(getPurchasesFromData(googleAdsRow), 0);
  assert.equal(getAdsPurchasesFromData(googleAdsRow), 3.5);
  assert.equal(getRevenueFromData(googleAdsRow), 2190);
  assert.equal(getSpendFromData(googleAdsRow), 173.55);
});

test('Facebook purchases win over any conversion fallback', () => {
  assert.equal(getAdsPurchasesFromData(facebookEcommerceRow), 3);
  assert.equal(getRevenueFromData(facebookEcommerceRow), 7908);
  assert.equal(getSpendFromData(facebookEcommerceRow), 45.93);
});

test('Analytics purchases ignore key events reported as conversions', () => {
  assert.equal(getPurchasesFromData(analyticsRow), 2);
  assert.equal(getRevenueFromData(analyticsRow), 430.999998);
});

test('add-to-cart is tracked by Facebook and Analytics but not by Google Ads', () => {
  assert.equal(hasAddToCartMetric(facebookEcommerceRow), true);
  assert.equal(getAddToCartFromData(facebookEcommerceRow), 14);
  assert.equal(hasAddToCartMetric(analyticsRow), true);
  assert.equal(getAddToCartFromData(analyticsRow), 34);
  assert.equal(hasAddToCartMetric(googleAdsRow), false);
  assert.equal(getAddToCartFromData(googleAdsRow), 0);
});

test('a tracked but empty add-to-cart day stays a real zero', () => {
  const quietDay = { ...facebookEcommerceRow, add_to_cart: 0 };
  assert.equal(hasAddToCartMetric(quietDay), true);
  assert.equal(getAddToCartFromData(quietDay), 0);
});

test('the platform breakdown row matches the Google Ads tab totals', () => {
  // Same 30-day window the dashboard aggregates, one row per campaign/day.
  const rows = [
    { ...googleAdsRow, date: '2026-07-15', conversions: 3.5, conversions_value: 2190, cost: 173.55 },
    { ...googleAdsRow, date: '2026-07-16', conversions: 0, conversions_value: 0, cost: 143.09 },
    { ...googleAdsRow, date: '2026-07-17', conversions: 2.26, conversions_value: 1409, cost: 155.4 },
  ];

  // "All" tab: platform breakdown row.
  const breakdown = rows.reduce(
    (acc, row) => ({
      purchases: acc.purchases + getAdsPurchasesFromData(row),
      revenue: acc.revenue + getRevenueFromData(row),
      spend: acc.spend + getSpendFromData(row),
    }),
    { purchases: 0, revenue: 0, spend: 0 },
  );

  // Google Ads tab: campaign summary totals read the raw Google Ads fields.
  const googleAdsTab = rows.reduce(
    (acc, row) => ({
      conversions: acc.conversions + row.conversions,
      conversions_value: acc.conversions_value + row.conversions_value,
      spend: acc.spend + row.cost,
    }),
    { conversions: 0, conversions_value: 0, spend: 0 },
  );

  assert.equal(breakdown.purchases, googleAdsTab.conversions);
  assert.equal(breakdown.revenue, googleAdsTab.conversions_value);
  assert.equal(breakdown.spend, googleAdsTab.spend);
});

test('mixed Facebook table is detected when campaign_type is unset', () => {
  assert.equal(facebookTableUsesMixedRows('facebook_insights', {}), true);
  assert.equal(facebookTableUsesMixedRows('facebook_insights', { campaign_type: 'leads' }), false);
  assert.equal(facebookTableUsesMixedRows('facebook_ecommerce', {}), false);
});

test('classifyFacebookRecord splits ecommerce vs leads rows', () => {
  assert.equal(
    classifyFacebookRecord({ campaign_name: 'מכירות', purchases: 2, purchase_value: 500 }),
    'ecommerce',
  );
  assert.equal(
    classifyFacebookRecord({ campaign_name: 'לידים', form_leads: 12, purchases: 0, purchase_value: 0 }),
    'leads',
  );
  assert.equal(
    classifyFacebookRecord({ campaign_name: 'לידים עם רעש', form_leads: 5, add_to_cart: 3 }),
    'leads',
  );
});

test('classifyFacebookCampaignTotals mirrors per-row rules on aggregates', () => {
  assert.equal(
    classifyFacebookCampaignTotals({ name: 'מכירות', purchases: 4, purchase_value: 1200, leads: 0 } as any),
    'ecommerce',
  );
  assert.equal(
    classifyFacebookCampaignTotals({ name: 'לידים', purchases: 0, purchase_value: 0, leads: 18 }),
    'leads',
  );
});

test('groupFacebookCampaigns splits Avieli-like mixed account like DynamicTableView', () => {
  const campaigns = [
    { name: 'מכירות אוגוסט 2', impressions: 1000, clicks: 50, spend: 572, leads: 0, purchases: 6, purchase_value: 2903, add_to_cart: 10, campaign_type: 'ecommerce' },
    { name: 'לידים דרושים', impressions: 2000, clicks: 80, spend: 400, leads: 36, purchases: 0, purchase_value: 0, add_to_cart: 0, campaign_type: 'lead' },
    { name: 'תנועה אוגוסט', impressions: 5000, clicks: 250, spend: 539, leads: 0, purchases: 0, purchase_value: 0, add_to_cart: 0, campaign_type: 'traffic' },
    { name: 'מודעות פתחנו', impressions: 800, clicks: 20, spend: 280, leads: 0, purchases: 0, purchase_value: 0, add_to_cart: 0, campaign_type: 'other' },
  ];

  const mixed = groupFacebookCampaigns(campaigns);
  assert.equal(mixed.ecommerce.length, 1);
  assert.equal(mixed.leads.length, 2);
  assert.equal(mixed.traffic.length, 1);

  const leadsOnly = groupFacebookCampaigns(campaigns, { forceLeadsOnly: true });
  assert.equal(leadsOnly.ecommerce.length, 0);
  assert.equal(leadsOnly.leads.length, 3);
  assert.equal(leadsOnly.traffic.length, 1);

  const singleEcom = groupFacebookCampaigns(campaigns, { singleTableMode: 'ecommerce' });
  assert.equal(singleEcom.ecommerce.length, 3);
  assert.equal(singleEcom.leads.length, 0);
});
