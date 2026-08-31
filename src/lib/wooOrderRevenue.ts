/** WooCommerce revenue helpers — match Woo admin analytics (paid date + gross total). */

export const WOO_REVENUE_STATUSES = ["completed", "processing", "on-hold"] as const;

export type WooOrderRevenueRow = {
  id?: string;
  total?: number | string | null;
  status?: string | null;
  date_created?: string | null;
  date_completed?: string | null;
  date_paid?: string | null;
};

/** Revenue attribution date — Woo admin uses paid date when available. */
export function wooOrderRevenueTimestamp(order: WooOrderRevenueRow): string | null {
  return order.date_paid || order.date_completed || order.date_created || null;
}

export function isWooRevenueStatus(status?: string | null): boolean {
  return WOO_REVENUE_STATUSES.includes((status || "") as (typeof WOO_REVENUE_STATUSES)[number]);
}

export function isWooOrderInRevenueRange(
  order: WooOrderRevenueRow,
  range: { start: string; end: string },
): boolean {
  const ts = wooOrderRevenueTimestamp(order);
  if (!ts) return false;
  const t = new Date(ts).getTime();
  return t >= new Date(range.start).getTime() && t <= new Date(range.end).getTime();
}

export function filterWooOrdersForRevenue(
  orders: WooOrderRevenueRow[],
  range: { start: string; end: string } | null,
): WooOrderRevenueRow[] {
  const valid = orders.filter((o) => isWooRevenueStatus(o.status));
  if (!range) return valid;
  return valid.filter((o) => isWooOrderInRevenueRange(o, range));
}

export function sumWooRevenue(orders: WooOrderRevenueRow[]): number {
  return orders.reduce((sum, o) => sum + Number(o.total || 0), 0);
}

export function dedupeWooOrdersById<T extends { id?: string }>(orders: T[]): T[] {
  const map = new Map<string, T>();
  for (const order of orders) {
    const key = order.id ? String(order.id) : JSON.stringify(order);
    map.set(key, order);
  }
  return Array.from(map.values());
}
