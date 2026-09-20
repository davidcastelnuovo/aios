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
