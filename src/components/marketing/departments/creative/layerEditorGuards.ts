export const EDITOR_FONT_WEIGHTS = ["400", "600", "700", "800", "900"] as const;

export function safeSelectValue(
  value: string | undefined,
  options: readonly string[],
  fallback: string,
): string {
  return value && options.includes(value) ? value : fallback;
}

export function safeFontWeight(weight?: string): string {
  return safeSelectValue(weight, EDITOR_FONT_WEIGHTS, "800");
}

/** `<input type="color">` only accepts #rrggbb. */
export function safeHexColor(color?: string, fallback = "#111111"): string {
  const value = (color ?? "").trim();
  if (/^#[0-9a-fA-F]{6}$/.test(value)) return value;
  if (/^#[0-9a-fA-F]{3}$/.test(value)) {
    const r = value[1];
    const g = value[2];
    const b = value[3];
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  return fallback;
}
