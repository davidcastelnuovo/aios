import assert from 'node:assert/strict';
import test from 'node:test';
import {
  aggregateOrdersByAttribution,
  buildWooAttributionLabel,
  extractWooOrderAttribution,
  isGooglePaidWooAttribution,
  summarizeGoogleAttributedWooOrders,
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

test('isGooglePaidWooAttribution detects google/cpc and gclid', () => {
  assert.equal(
    isGooglePaidWooAttribution({
      source_type: 'utm',
      utm_source: 'google',
      utm_medium: 'cpc',
      utm_campaign: null,
      utm_content: null,
      utm_term: null,
      referrer: null,
      session_entry: null,
      device_type: null,
      label: 'Google ממומן',
    }),
    true,
  );
  assert.equal(
    isGooglePaidWooAttribution({
      source_type: 'utm',
      utm_source: null,
      utm_medium: null,
      utm_campaign: null,
      utm_content: null,
      utm_term: null,
      referrer: null,
      session_entry: 'https://avieli.co.il/?gclid=abc',
      device_type: null,
      label: 'Google ממומן',
    }),
    true,
  );
  assert.equal(
    isGooglePaidWooAttribution({
      source_type: 'organic',
      utm_source: 'google',
      utm_medium: 'organic',
      utm_campaign: null,
      utm_content: null,
      utm_term: null,
      referrer: 'https://google.com/',
      session_entry: null,
      device_type: null,
      label: 'Google',
    }),
    false,
  );
});

test('summarizeGoogleAttributedWooOrders splits paid vs organic Google', () => {
  const summary = summarizeGoogleAttributedWooOrders([
    { status: 'processing', total: 500, attribution: { label: 'Google ממומן', utm_source: 'google', utm_medium: 'cpc' } as any },
    { status: 'completed', total: 150, attribution: { label: 'Google', utm_source: 'google', utm_medium: 'organic' } as any },
    { status: 'processing', total: 200, attribution: { label: 'Facebook ממומן' } as any },
    { status: 'cancelled', total: 999, attribution: { label: 'Google ממומן' } as any },
  ]);
  assert.equal(summary.paidOrders, 1);
  assert.equal(summary.paidRevenue, 500);
  assert.equal(summary.organicOrders, 1);
  assert.equal(summary.organicRevenue, 150);
});
