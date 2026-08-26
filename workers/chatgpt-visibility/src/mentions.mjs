export function brandIsMentioned(text, brandName, keywords = []) {
  const haystack = String(text || "").toLowerCase();
  if (brandName?.trim() && haystack.includes(brandName.trim().toLowerCase())) return true;
  return (keywords || []).some((keyword) => keyword?.trim() && haystack.includes(keyword.trim().toLowerCase()));
}

export function listPosition(text, name) {
  const lines = String(text || "").split("\n");
  let index = 0;
  for (const line of lines) {
    if (/^\d+[.)]/.test(line.trim()) || /^[-•*]/.test(line.trim())) {
      index += 1;
      if (line.toLowerCase().includes(String(name).toLowerCase())) return index;
    }
  }
  return null;
}

export function sentimentFromText(text, brandName) {
  const haystack = String(text || "").toLowerCase();
  const brand = String(brandName || "").toLowerCase();
  const window = brand && haystack.includes(brand)
    ? haystack.slice(Math.max(0, haystack.indexOf(brand) - 120), haystack.indexOf(brand) + brand.length + 120)
    : haystack;
  if (/(scam|גרוע|לא מומלץ|avoid|terrible|worst)/.test(window)) return "negative";
  if (/(מומלץ|recommend|best|top|excellent)/.test(window)) return "positive";
  return "neutral";
}
