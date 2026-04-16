// Display-only currency helpers for dynamic tables.
// We do NOT convert values — only swap the displayed symbol.

export type CurrencyCode = "ILS" | "USD" | "EUR";

export const CURRENCY_OPTIONS: { value: CurrencyCode; label: string; symbol: string }[] = [
  { value: "ILS", label: "שקל (₪)", symbol: "₪" },
  { value: "USD", label: "דולר ($)", symbol: "$" },
  { value: "EUR", label: "אירו (€)", symbol: "€" },
];

export function getCurrencySymbol(code?: string | null): string {
  switch ((code || "ILS").toUpperCase()) {
    case "USD":
      return "$";
    case "EUR":
      return "€";
    case "ILS":
    default:
      return "₪";
  }
}
