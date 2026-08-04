// Display-only currency helpers for dynamic tables / dashboards.
// We do NOT convert values — only swap the displayed symbol/code.

export type CurrencyCode = "ILS" | "USD" | "EUR";

export const CURRENCY_OPTIONS: { value: CurrencyCode; label: string; symbol: string }[] = [
  { value: "ILS", label: "שקל (₪)", symbol: "₪" },
  { value: "USD", label: "דולר ($)", symbol: "$" },
  { value: "EUR", label: "אירו (€)", symbol: "€" },
];

const ADS_INTEGRATION_TYPES = new Set([
  "google_ads",
  "facebook_insights",
  "facebook_ecommerce",
]);

export function normalizeCurrencyCode(code?: string | null): CurrencyCode {
  switch (String(code || "ILS").toUpperCase()) {
    case "USD":
      return "USD";
    case "EUR":
      return "EUR";
    case "ILS":
    default:
      return "ILS";
  }
}

export function getCurrencySymbol(code?: string | null): string {
  switch (normalizeCurrencyCode(code)) {
    case "USD":
      return "$";
    case "EUR":
      return "€";
    case "ILS":
    default:
      return "₪";
  }
}

export function formatCurrency(
  num: number,
  code?: string | null,
  options?: { maximumFractionDigits?: number; minimumFractionDigits?: number },
): string {
  return new Intl.NumberFormat("he-IL", {
    style: "currency",
    currency: normalizeCurrencyCode(code),
    maximumFractionDigits: options?.maximumFractionDigits ?? 0,
    ...(options?.minimumFractionDigits != null
      ? { minimumFractionDigits: options.minimumFractionDigits }
      : {}),
  }).format(Number.isFinite(num) ? num : 0);
}

/**
 * Unit costs (CPC / CPM) are almost always under $10 — rounding them to whole
 * currency units (the dashboard default) collapses real values like $0.30 to $0.
 */
export function formatUnitCost(num: number, code?: string | null): string {
  return formatCurrency(num, code, {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  });
}

/**
 * Prefer currency from ads tables (Google Ads / Facebook) because those drive
 * spend/CPL KPIs on client dashboards. Falls back to the first non-empty
 * table currency, then ILS.
 */
export function resolveDashboardCurrency(
  tables: Array<{
    integration_type?: string | null;
    integration_settings?: { currency?: string | null } | null;
  }> = [],
): CurrencyCode {
  const adsCurrencies = tables
    .filter((table) => ADS_INTEGRATION_TYPES.has(String(table.integration_type || "")))
    .map((table) => normalizeCurrencyCode(table.integration_settings?.currency))
    .filter(Boolean);

  if (adsCurrencies.length > 0) {
    // Prefer USD/EUR when any ads table is not ILS so a USD Google Ads report
    // is not forced to ₪ by a leftover ILS Facebook default.
    const nonIls = adsCurrencies.find((code) => code !== "ILS");
    return nonIls || adsCurrencies[0];
  }

  for (const table of tables) {
    const code = table.integration_settings?.currency;
    if (code) return normalizeCurrencyCode(code);
  }

  return "ILS";
}
