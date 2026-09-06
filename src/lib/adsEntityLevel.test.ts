import assert from 'node:assert/strict';
import test from 'node:test';
import {
  aggregateFacebookRecordsAtLevel,
  aggregateGoogleRecordsAtLevel,
  filterRecordsByEntityLevel,
  getEntityDisplayName,
  hasEntityLevelData,
  recordMatchesEntitySearch,
  resolveRecordEntityLevel,
} from './adsEntityLevel.ts';

test('legacy rows without entity_level are treated as campaign', () => {
  assert.equal(resolveRecordEntityLevel({ campaign_name: 'A' }), 'campaign');
});

test('filterRecordsByEntityLevel keeps only matching rows', () => {
  const records = [
    { data: { entity_level: 'campaign', campaign_name: 'C1' } },
    { data: { entity_level: 'adset', adset_name: 'AS1', campaign_name: 'C1' } },
    { data: { entity_level: 'ad', ad_name: 'Ad1', campaign_name: 'C1' } },
  ];
  assert.equal(filterRecordsByEntityLevel(records, 'adset').length, 1);
  assert.equal(getEntityDisplayName(records[1].data, 'adset'), 'AS1');
});

test('aggregateFacebookRecordsAtLevel groups ad sets separately from campaigns', () => {
  const records = [
    { data: { entity_level: 'adset', adset_id: '1', adset_name: 'Set A', campaign_name: 'Camp', spend: 10, impressions: 100, clicks: 5, leads: 2 } },
    { data: { entity_level: 'adset', adset_id: '1', adset_name: 'Set A', campaign_name: 'Camp', spend: 5, impressions: 50, clicks: 2, leads: 1 } },
    { data: { entity_level: 'adset', adset_id: '2', adset_name: 'Set B', campaign_name: 'Camp', spend: 20, impressions: 200, clicks: 10, leads: 4 } },
  ];
  const rows = aggregateFacebookRecordsAtLevel(records, 'adset');
  assert.equal(rows.length, 2);
  const setA = rows.find((r) => r.name === 'Set A');
  assert.ok(setA);
  assert.equal(setA!.spend, 15);
  assert.equal(setA!.leads, 3);
});

test('aggregateGoogleRecordsAtLevel groups ads by ad name', () => {
  const records = [
    { data: { entity_level: 'ad', ad_id: '11', ad_name: 'Ad One', campaign_name: 'Camp', cost: 12, conversions: 1, impressions: 10, clicks: 2 } },
    { data: { entity_level: 'ad', ad_id: '11', ad_name: 'Ad One', campaign_name: 'Camp', cost: 8, conversions: 0, impressions: 5, clicks: 1 } },
  ];
  const rows = aggregateGoogleRecordsAtLevel(records, 'ad');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].name, 'Ad One');
  assert.equal(rows[0].cost, 20);
});

test('recordMatchesEntitySearch matches parent campaign on ad rows', () => {
  const data = { entity_level: 'ad', ad_name: 'Creative A', campaign_name: 'Leads Promo' };
  assert.equal(recordMatchesEntitySearch(data, 'ad', 'promo'), true);
  assert.equal(recordMatchesEntitySearch(data, 'ad', 'missing'), false);
});

test('hasEntityLevelData requires explicit rows for adset/ad', () => {
  const legacy = [{ data: { campaign_name: 'Only campaign' } }];
  assert.equal(hasEntityLevelData(legacy, 'campaign'), true);
  assert.equal(hasEntityLevelData(legacy, 'adset'), false);
});
