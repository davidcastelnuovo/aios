/** Native date inputs store yyyy-mm-dd. Contracts print day/month/year. */
export function formatSignatureDateValue(value: string): string {
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!iso) return value;
  return `${iso[3]}/${iso[2]}/${iso[1]}`;
}

/** Hebrew form fields start at the right edge of the placed box. */
export function signatureFieldTextLayout(
  width: number,
  height: number,
  align: "right" | "left" = "right",
): { x: number; y: number; textAnchor: "start" | "end"; direction: "rtl" | "ltr" } {
  const pad = Math.min(4, Math.max(1, width * 0.02));
  const right = align === "right";
  return {
    x: right ? Math.max(0, width - pad) : pad,
    y: height * 0.7,
    textAnchor: right ? "end" : "start",
    direction: right ? "rtl" : "ltr",
  };
}
