/** One spoken script, in storyboard order. Blank lines are skipped. */
export function joinNarration(texts) {
  return texts
    .map((text) => String(text ?? "").trim())
    .filter(Boolean)
    .join(" ");
}
