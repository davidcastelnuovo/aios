/** Public-web browse and competitor research for Carmen. Names are kept only with a fetched page. */

export type BrowseResult = {
  url: string;
  title: string;
  text: string;
  error?: string;
};

export type CompetitorHit = {
  name: string;
  url: string;
  evidence: string;
  source: "page" | "ahrefs";
};

export type CompetitorResearch = {
  query: string;
  client_url: string | null;
  competitors: CompetitorHit[];
  pages_read: string[];
  search_results: number;
  gap: string | null;
};

const BLOCKED_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0", "metadata.google.internal"]);
const SKIP_HOSTS = ["facebook.com", "instagram.com", "youtube.com", "linkedin.com", "wikipedia.org", "bing.com", "google.com", "microsoft.com", "duckduckgo.com", "gov.il"];

function hostOf(raw: string): string | null {
  try {
    return new URL(raw).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

export function assertPublicUrl(raw: string): string {
  const normalized = raw.match(/^https?:\/\//i) ? raw.trim() : `https://${raw.trim()}`;
  const url = new URL(normalized);
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("רק http/https");
  if (url.username || url.password) throw new Error("כתובת עם סיסמה חסומה");
  const host = url.hostname.toLowerCase();
  if (BLOCKED_HOSTS.has(host) || host.endsWith(".local") || host.endsWith(".internal")) throw new Error("כתובת פנימית חסומה");
  if (/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.|169\.254\.|127\.)/.test(host)) throw new Error("כתובת פנימית חסומה");
  return url.toString();
}

function stripHtml(html: string): { title: string; text: string } {
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s+/g, " ").trim() ?? "";
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return { title, text: text.slice(0, 4000) };
}

export async function browseWeb(rawUrl: string): Promise<BrowseResult> {
  try {
    const url = assertPublicUrl(rawUrl);
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        Accept: "text/html,text/plain",
        "Accept-Language": "he-IL,he;q=0.9",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return { url, title: "", text: "", error: `HTTP ${res.status}` };
    const html = (await res.text()).slice(0, 400_000);
    const page = stripHtml(html);
    return { url: res.url || url, title: page.title, text: page.text };
  } catch (error) {
    return { url: rawUrl, title: "", text: "", error: error instanceof Error ? error.message : String(error) };
  }
}

export function parseSearchResults(html: string): Array<{ title: string; url: string }> {
  const results: Array<{ title: string; url: string }> = [];
  const pattern = /class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(pattern)) {
    const href = match[1].replace(/&amp;/g, "&");
    const uddg = href.match(/uddg=([^&]+)/)?.[1];
    const url = uddg ? decodeURIComponent(uddg) : (href.startsWith("http") ? href : "");
    const title = match[2].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    if (!title || !url.startsWith("http")) continue;
    results.push({ title, url });
  }
  return results;
}

async function searchWeb(query: string): Promise<Array<{ title: string; url: string }>> {
  const endpoint = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}&kl=il-he`;
  const res = await fetch(endpoint, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      "Accept-Language": "he-IL,he;q=0.9",
    },
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) return [];
  return parseSearchResults(await res.text());
}

async function ahrefsCompetitors(domain: string, apiKey: string): Promise<CompetitorHit[]> {
  const date = new Date().toISOString().slice(0, 10);
  const endpoint = `https://api.ahrefs.com/v3/site-explorer/organic-competitors?target=${encodeURIComponent(domain)}&country=il&date=${date}&mode=subdomains&protocol=both&limit=12&output=json&select=competitor_domain,keywords_common,share`;
  const res = await fetch(endpoint, { headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" }, signal: AbortSignal.timeout(15_000) });
  if (!res.ok) return [];
  const json = await res.json();
  const rows = Array.isArray(json?.competitors) ? json.competitors : Array.isArray(json?.organic_competitors) ? json.organic_competitors : [];
  return rows.map((row: Record<string, unknown>) => {
    const domainName = String(row.competitor_domain ?? row.competitor ?? "").replace(/^www\./, "");
    return {
      name: domainName,
      url: domainName ? `https://${domainName}/` : "",
      evidence: `Ahrefs organic competitors${row.keywords_common != null ? `, ביטויים משותפים: ${row.keywords_common}` : ""}`,
      source: "ahrefs" as const,
    };
  }).filter((row: CompetitorHit) => row.url);
}

function tokens(query: string): string[] {
  return [...new Set(query.split(/[^\p{L}\p{N}]+/u).map((part) => part.trim()).filter((part) => part.length >= 3))];
}

export async function researchCompetitors(input: {
  website?: string;
  query: string;
  ahrefsApiKey?: string;
}): Promise<CompetitorResearch> {
  const query = input.query.trim();
  const clientBrowse = input.website ? await browseWeb(input.website) : null;
  let clientHost: string | null = null;
  try {
    clientHost = input.website ? hostOf(assertPublicUrl(input.website)) : null;
  } catch {
    clientHost = null;
  }
  const pagesRead = clientBrowse && !clientBrowse.error ? [clientBrowse.url] : [];
  const hits: CompetitorHit[] = [];

  if (input.ahrefsApiKey && clientHost) {
    try {
      hits.push(...await ahrefsCompetitors(clientHost, input.ahrefsApiKey));
    } catch {
      /* Ahrefs is optional; browsing still runs */
    }
  }

  let searchResults = 0;
  const seen = new Set<string>(clientHost ? [clientHost] : []);
  for (const hit of hits) {
    const host = hostOf(hit.url);
    if (host) seen.add(host);
  }
  const found = [...await searchWeb(query), ...await searchWeb(`${query} חברות`)];
  searchResults = found.length;
  const candidates = found.filter((row) => {
    const host = hostOf(row.url);
    if (!host || seen.has(host)) return false;
    if (SKIP_HOSTS.some((skip) => host === skip || host.endsWith(`.${skip}`))) return false;
    seen.add(host);
    return true;
  }).slice(0, 6);

  const need = tokens(query);
  for (const candidate of candidates) {
    const page = await browseWeb(candidate.url);
    pagesRead.push(page.url);
    if (page.error || !page.text) continue;
    const matched = need.filter((token) => page.text.includes(token) || page.title.includes(token) || candidate.title.includes(token));
    if (need.length > 0 && matched.length === 0) continue;
    const name = (page.title || candidate.title).split(/[|\-–—]/)[0].trim().slice(0, 80);
    const evidence = page.text.slice(0, 220);
    hits.push({ name: name || hostOf(page.url) || candidate.url, url: page.url, evidence, source: "page" });
  }

  const gap = hits.length === 0
    ? "לא נמצאו מתחרים עם עמוד שנקרא בפועל ומתאים לשאילתה. אין להמציא שמות."
    : null;
  return {
    query,
    client_url: clientBrowse?.url ?? null,
    competitors: hits.slice(0, 12),
    pages_read: pagesRead,
    search_results: searchResults,
    gap,
  };
}
