import assert from 'node:assert/strict';
import test from 'node:test';
import {
  aggregateOrdersByAttribution,
  buildWooAttributionLabel,
  extractWooOrderAttribution,
} from './wooAttribution.ts';

test('extractWooOrderAttribution reads WC meta fields', () => {
  const attr = extractWooOrderAttribution([
    { key: '_wc_order_attribution_source_type', value: 'utm' },
    { key: '_wc_order_attribution_utm_source', value: 'fb' },
    { key: '_wc_order_attribution_utm_medium', value: 'paid' },
    { key: '_wc_order_attribution_utm_campaign', value: '120250917574950776' },
    { key: '_wc_order_attribution_referrer', value: 'https://facebook.com/' },
  ]);
  assert.equal(attr?.utm_source, 'fb');
  assert.equal(attr?.utm_medium, 'paid');
  assert.equal(attr?.label, 'Facebook ממומן');
});

test('extractWooOrderAttribution returns null when no attribution meta', () => {
  assert.equal(extractWooOrderAttribution([{ key: '_ga_tracked', value: '1' }]), null);
});

test('buildWooAttributionLabel maps direct traffic', () => {
  assert.equal(
    buildWooAttributionLabel({ source_type: 'typein', utm_source: '(direct)' }),
    'ישיר / Direct',
  );
});

test('aggregateOrdersByAttribution groups valid orders by label', () => {
  const rows = aggregateOrdersByAttribution([
    { status: 'processing', total: 500, attribution: { label: 'Facebook ממומן' } as any },
    { status: 'completed', total: 300, attribution: { label: 'Facebook ממומן' } as any },
    { status: 'processing', total: 100, attribution: { label: 'ישיר / Direct' } as any },
    { status: 'cancelled', total: 999, attribution: { label: 'Facebook ממומן' } as any },
  ]);
  const fb = rows.find((r) => r.label === 'Facebook ממומן');
  assert.equal(fb?.orders, 2);
  assert.equal(fb?.revenue, 800);
});
