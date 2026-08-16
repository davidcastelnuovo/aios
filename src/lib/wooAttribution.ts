/** Shape stored on woocommerce_orders.attribution (synced from WC meta_data). */
export type WooOrderAttribution = {
  source_type: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  referrer: string | null;
  session_entry: string | null;
  device_type: string | null;
  label: string;
};

const ATTRIBUTION_META_KEYS = {
  source_type: '_wc_order_attribution_source_type',
  utm_source: '_wc_order_attribution_utm_source',
  utm_medium: '_wc_order_attribution_utm_medium',
  utm_campaign: '_wc_order_attribution_utm_campaign',
  utm_content: '_wc_order_attribution_utm_content',
  utm_term: '_wc_order_attribution_utm_term',
  referrer: '_wc_order_attribution_referrer',
  session_entry: '_wc_order_attribution_session_entry',
  device_type: '_wc_order_attribution_device_type',
} as const;

const metaValue = (meta: Array<{ key?: string; value?: unknown }> | undefined, key: string): string | null => {
  const row = (meta || []).find((m) => m.key === key);
  const value = row?.value;
  if (value === null || value === undefined || value === '') return null;
  return String(value);
};

/** Extract WooCommerce Order Attribution from order meta_data (WC 8.5+). */
export function extractWooOrderAttribution(
  metaData: Array<{ key?: string; value?: unknown }> | undefined,
): WooOrderAttribution | null {
  const source_type = metaValue(metaData, ATTRIBUTION_META_KEYS.source_type);
  const utm_source = metaValue(metaData, ATTRIBUTION_META_KEYS.utm_source);
  const utm_medium = metaValue(metaData, ATTRIBUTION_META_KEYS.utm_medium);
  const utm_campaign = metaValue(metaData, ATTRIBUTION_META_KEYS.utm_campaign);
  const utm_content = metaValue(metaData, ATTRIBUTION_META_KEYS.utm_content);
  const utm_term = metaValue(metaData, ATTRIBUTION_META_KEYS.utm_term);
  const referrer = metaValue(metaData, ATTRIBUTION_META_KEYS.referrer);
  const session_entry = metaValue(metaData, ATTRIBUTION_META_KEYS.session_entry);
  const device_type = metaValue(metaData, ATTRIBUTION_META_KEYS.device_type);

  if (!source_type && !utm_source && !referrer && !session_entry) return null;

  const partial = {
    source_type,
    utm_source,
    utm_medium,
    utm_campaign,
    utm_content,
    utm_term,
    referrer,
    session_entry,
    device_type,
  };
  return { ...partial, label: buildWooAttributionLabel(partial) };
}

/** Human-readable Hebrew label for dashboard grouping. */
export function buildWooAttributionLabel(attr: {
  source_type?: string | null;
  utm_source?: string | null;
  utm_medium?: string | null;
  referrer?: string | null;
  session_entry?: string | null;
} | null): string {
  if (!attr) return 'לא ידוע';

  const src = (attr.utm_source || '').toLowerCase();
  const med = (attr.utm_medium || '').toLowerCase();
  const ref = (attr.referrer || '').toLowerCase();
  const entry = (attr.session_entry || '').toLowerCase();

  const looksFacebook =
    src === 'fb' ||
    src === 'facebook' ||
    ref.includes('facebook') ||
    ref.includes('fb.com') ||
    entry.includes('fbclid');

  if (looksFacebook) {
    return med === 'paid' || med === 'cpc' ? 'Facebook ממומן' : 'Facebook';
  }

  const looksGoogle =
    src === 'google' ||
    src.includes('google') ||
    ref.includes('google') ||
    entry.includes('gclid');

  if (looksGoogle) {
    return med === 'paid' || med === 'cpc' || med === 'ppc' ? 'Google ממומן' : 'Google';
  }

  if (src === '(direct)' || attr.source_type === 'typein') {
    return 'ישיר / Direct';
  }

  if (attr.utm_source && attr.utm_medium) {
    return `${attr.utm_source} / ${attr.utm_medium}`;
  }
  if (attr.utm_source) return attr.utm_source;

  return 'אחר';
}

export type WooAttributionBreakdownRow = {
  label: string;
  orders: number;
  revenue: number;
};

const VALID_WOO_ORDER_STATUSES = ['completed', 'processing', 'on-hold'] as const;

/** Group valid orders by attribution label for dashboard tables. */
export function aggregateOrdersByAttribution(
  orders: Array<{ total?: number | string; status?: string; attribution?: WooOrderAttribution | null }>,
): WooAttributionBreakdownRow[] {
  const map: Record<string, WooAttributionBreakdownRow> = {};

  orders.forEach((order) => {
    if (!VALID_WOO_ORDER_STATUSES.includes((order.status || '') as typeof VALID_WOO_ORDER_STATUSES[number])) return;
    const label = order.attribution?.label || buildWooAttributionLabel(order.attribution) || 'לא ידוע';
    if (!map[label]) map[label] = { label, orders: 0, revenue: 0 };
    map[label].orders += 1;
    map[label].revenue += Number(order.total || 0);
  });

  return Object.values(map).sort((a, b) => b.revenue - a.revenue);
}
