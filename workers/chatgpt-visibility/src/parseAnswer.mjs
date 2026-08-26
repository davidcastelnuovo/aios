const URL_RE = /https?:\/\/[^\s)\]>"]+/g;

export function extractCitations(text, hrefs = []) {
  const urls = [...hrefs, ...(String(text || "").match(URL_RE) || [])]
    .map((url) => url.replace(/[.,;]+$/, ""))
    .filter((url) => /^https?:\/\//.test(url) && !/chatgpt\.com|openai\.com|oaistatic/.test(url));
  return [...new Set(urls)];
}

export function cleanAnswerText(raw) {
  return String(raw || "")
    .replace(/\u00a0/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
