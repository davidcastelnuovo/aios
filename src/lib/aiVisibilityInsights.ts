export type PromptStatus = "owned" | "present" | "competitor_wins" | "blank" | "negative";
export type TipImpact = "high" | "medium" | "low";
export type TipType = "onsite" | "offsite" | "content" | "technical";

export const STATUS_LABELS: Record<PromptStatus, string> = {
  owned: "מובילים",
  present: "מוזכרים",
  competitor_wins: "המתחרה מנצח",
  blank: "ריק",
  negative: "שלילי",
};

export type ScanResult = {
  prompt_id: string;
  platform: string;
  is_mentioned: boolean;
  position: number | null;
  sentiment: string | null;
  response_snippet: string | null;
  citations: string[] | null;
  scanned_at: string;
};

export type ScanPrompt = {
  id: string;
  prompt: string;
  category: string;
};

export type ScanCompetitor = {
  competitor_name: string;
  prompt_id?: string | null;
  platform: string;
  is_mentioned: boolean;
  scanned_at?: string | null;
};

export type PromptInsight = {
  promptId: string;
  prompt: string;
  category: string;
  status: PromptStatus;
  mentioned: boolean;
  position: number | null;
  sentiment: "positive" | "neutral" | "negative" | null;
  snippet: string | null;
  citations: string[];
  competitors: string[];
  platforms: { chatgpt: boolean; gemini: boolean; perplexity: boolean };
  lastChecked: string | null;
};

export type VisibilityTip = {
  id: string;
  title: string;
  description: string;
  evidence: string;
  impact: TipImpact;
  type: TipType;
  promptId?: string;
  promptText?: string;
};

export type CitationInsight = {
  id: string;
  source: string;
  url: string;
  mentions: number;
  influence: "high" | "medium" | "low";
  type: "blog" | "review" | "news" | "directory" | "social" | "docs";
  lostToCompetitor: boolean;
};

export type VisibilitySummary = {
  owned: number;
  present: number;
  competitorWins: number;
  blank: number;
  negative: number;
  shareOfVoice: number;
  mentionedPrompts: number;
  avgPosition: number | null;
  citationCount: number;
  prompts: PromptInsight[];
  tips: VisibilityTip[];
  citations: CitationInsight[];
};

function latestByPromptPlatform(results: ScanResult[]): Map<string, ScanResult> {
  const latest = new Map<string, ScanResult>();
  for (const result of results) {
    const key = `${result.prompt_id}:${result.platform}`;
    const current = latest.get(key);
    if (!current || new Date(result.scanned_at) > new Date(current.scanned_at)) latest.set(key, result);
  }
  return latest;
}

function asSentiment(value: string | null | undefined): PromptInsight["sentiment"] {
  if (value === "positive" || value === "negative" || value === "neutral") return value;
  return null;
}

export function classifyPrompt(
  brandResults: ScanResult[],
  competitorNames: string[],
): PromptStatus {
  const mentioned = brandResults.some((result) => result.is_mentioned);
  const negative = brandResults.some((result) => result.is_mentioned && result.sentiment === "negative");
  const positions = brandResults.map((result) => result.position).filter((value): value is number => typeof value === "number" && value > 0);
  const bestPosition = positions.length ? Math.min(...positions) : null;
  if (negative) return "negative";
  if (mentioned && bestPosition === 1) return "owned";
  if (mentioned) return "present";
  if (competitorNames.length > 0) return "competitor_wins";
  return "blank";
}

function domainFromUrl(url: string): string {
  return url.replace(/^https?:\/\//, "").split("/")[0].replace(/^www\./, "");
}

function citationType(domain: string): CitationInsight["type"] {
  if (/(reddit|facebook|linkedin|x\.com|twitter|tiktok|instagram)/.test(domain)) return "social";
  if (/(g2\.com|capterra|trustpilot|google\.com\/maps)/.test(domain)) return "review";
  if (/(wikipedia|wikidata)/.test(domain)) return "directory";
  if (/(nytimes|bbc|cnn|haaretz|ynet|globes|themarker|techcrunch)/.test(domain)) return "news";
  if (/(docs\.|developer\.|readme)/.test(domain)) return "docs";
  return "blog";
}

export function buildVisibilitySummary(input: {
  prompts: ScanPrompt[];
  results: ScanResult[];
  competitorResults: ScanCompetitor[];
  brandUrl?: string | null;
}): VisibilitySummary {
  const latest = latestByPromptPlatform(input.results);
  const latestList = [...latest.values()];
  const prompts: PromptInsight[] = input.prompts.map((prompt) => {
    const brandResults = ["chatgpt", "gemini", "perplexity"].map((platform) => latest.get(`${prompt.id}:${platform}`)).filter((value): value is ScanResult => !!value);
    const competitorNames = [...new Set(
      input.competitorResults
        .filter((row) => (!row.prompt_id || row.prompt_id === prompt.id) && row.is_mentioned)
        .map((row) => row.competitor_name),
    )];
    const mentioned = brandResults.some((result) => result.is_mentioned);
    const positions = brandResults.map((result) => result.position).filter((value): value is number => typeof value === "number" && value > 0);
    const sentiments = brandResults.map((result) => asSentiment(result.sentiment)).filter(Boolean);
    const snippet = brandResults.find((result) => result.response_snippet)?.response_snippet ?? null;
    const citations = [...new Set(brandResults.flatMap((result) => result.citations ?? []))];
    const last = brandResults.sort((a, b) => new Date(b.scanned_at).getTime() - new Date(a.scanned_at).getTime())[0];
    return {
      promptId: prompt.id,
      prompt: prompt.prompt,
      category: prompt.category,
      status: classifyPrompt(brandResults, competitorNames),
      mentioned,
      position: positions.length ? Math.min(...positions) : null,
      sentiment: sentiments.includes("negative") ? "negative" : sentiments.includes("positive") ? "positive" : sentiments.length ? "neutral" : null,
      snippet,
      citations,
      competitors: competitorNames,
      platforms: {
        chatgpt: latest.get(`${prompt.id}:chatgpt`)?.is_mentioned || false,
        gemini: latest.get(`${prompt.id}:gemini`)?.is_mentioned || false,
        perplexity: latest.get(`${prompt.id}:perplexity`)?.is_mentioned || false,
      },
      lastChecked: last?.scanned_at ?? null,
    };
  });

  const counted = prompts.filter((prompt) => latestList.some((result) => result.prompt_id === prompt.promptId));
  const owned = counted.filter((prompt) => prompt.status === "owned").length;
  const present = counted.filter((prompt) => prompt.status === "present").length;
  const competitorWins = counted.filter((prompt) => prompt.status === "competitor_wins").length;
  const blank = counted.filter((prompt) => prompt.status === "blank").length;
  const negative = counted.filter((prompt) => prompt.status === "negative").length;
  const mentionedPrompts = counted.filter((prompt) => prompt.mentioned).length;
  const contested = mentionedPrompts + competitorWins;
  const shareOfVoice = contested > 0 ? Math.round((mentionedPrompts / contested) * 100) : 0;
  const positions = counted.map((prompt) => prompt.position).filter((value): value is number => value !== null);
  const avgPosition = positions.length ? Math.round(positions.reduce((sum, value) => sum + value, 0) / positions.length) : null;

  const citationMap = new Map<string, { mentions: number; url: string; lostToCompetitor: boolean }>();
  for (const insight of prompts) {
    for (const url of insight.citations) {
      const domain = domainFromUrl(url);
      const current = citationMap.get(domain) ?? { mentions: 0, url, lostToCompetitor: false };
      current.mentions += 1;
      if (insight.status === "competitor_wins") current.lostToCompetitor = true;
      citationMap.set(domain, current);
    }
  }
  const brandHost = input.brandUrl ? domainFromUrl(input.brandUrl) : "";
  const citations: CitationInsight[] = [...citationMap.entries()]
    .sort((a, b) => b[1].mentions - a[1].mentions)
    .slice(0, 12)
    .map(([domain, value], index) => ({
      id: String(index),
      source: domain,
      url: value.url.startsWith("http") ? value.url : `https://${domain}`,
      mentions: value.mentions,
      influence: value.mentions > 4 ? "high" : value.mentions > 1 ? "medium" : "low",
      type: citationType(domain),
      lostToCompetitor: value.lostToCompetitor && domain !== brandHost,
    }));

  return {
    owned,
    present,
    competitorWins,
    blank,
    negative,
    shareOfVoice,
    mentionedPrompts,
    avgPosition,
    citationCount: citations.length,
    prompts,
    tips: buildTips(prompts, citations, brandHost),
    citations,
  };
}

export function buildTips(prompts: PromptInsight[], citations: CitationInsight[], brandHost: string): VisibilityTip[] {
  const tips: VisibilityTip[] = [];
  const scanned = prompts.filter((prompt) => prompt.lastChecked);

  for (const prompt of scanned.filter((item) => item.status === "competitor_wins").slice(0, 5)) {
    const winner = prompt.competitors[0] || "המתחרה";
    tips.push({
      id: `lose-${prompt.promptId}`,
      title: `לזכות בפרומפט: ${prompt.prompt.slice(0, 48)}`,
      description: `${winner} מוזכר בתשובת ה-AI ואתם לא. כתבו עמוד FAQ / השוואה שעונה בדיוק על השאלה הזו, עם ישויות מותג ו-Schema.`,
      evidence: `סטטוס: המתחרה מנצח · מתחרים: ${prompt.competitors.join(", ") || "—"}`,
      impact: "high",
      type: "content",
      promptId: prompt.promptId,
      promptText: prompt.prompt,
    });
  }

  for (const prompt of scanned.filter((item) => item.status === "blank").slice(0, 3)) {
    tips.push({
      id: `blank-${prompt.promptId}`,
      title: "הזדמנות כניסה — אף מותג לא מוזכר",
      description: `השאלה "${prompt.prompt}" לא מחזירה אף מותג. מאמר pillar קצר עם תשובה מפורשת יכול לתפוס את המקום.`,
      evidence: `קטגוריה: ${prompt.category || "כללי"} · סטטוס: ריק`,
      impact: "medium",
      type: "content",
      promptId: prompt.promptId,
      promptText: prompt.prompt,
    });
  }

  const mentionedNoCite = scanned.filter((prompt) => prompt.mentioned && prompt.citations.length === 0);
  if (mentionedNoCite.length > 0) {
    tips.push({
      id: "no-cite",
      title: "מוזכרים בלי מקור — חזקו Schema ו-FAQ באתר",
      description: `${mentionedNoCite.length} פרומפטים מזכירים אתכם בלי URL. הוסיפו FAQPage / Organization וקישור ברור לעמוד השירות.`,
      evidence: mentionedNoCite.slice(0, 2).map((prompt) => prompt.prompt).join(" · "),
      impact: "medium",
      type: "technical",
      promptId: mentionedNoCite[0]?.promptId,
      promptText: mentionedNoCite[0]?.prompt,
    });
  }

  for (const citation of citations.filter((item) => item.lostToCompetitor && item.source !== brandHost).slice(0, 3)) {
    tips.push({
      id: `cite-${citation.source}`,
      title: `AI מצטט את ${citation.source} כשאתם מפסידים`,
      description: "זה מקור שהמודל סומך עליו בקטגוריה. תכננו ציטוט, כתבת אורח, או תוכן שיתחרה באותו עמוד.",
      evidence: `${citation.mentions} ציטוטים · השפעה ${citation.influence}`,
      impact: citation.influence === "high" ? "high" : "medium",
      type: "offsite",
    });
  }

  for (const prompt of scanned.filter((item) => item.status === "negative").slice(0, 2)) {
    tips.push({
      id: `neg-${prompt.promptId}`,
      title: "אזכור שלילי — לתקן עובדות",
      description: "המותג מוזכר בהקשר שלילי. עדכנו עמוד שמפריך את הטענה, ביקורות עדכניות, או תשובת FAQ מדויקת.",
      evidence: prompt.snippet?.slice(0, 180) || prompt.prompt,
      impact: "high",
      type: "onsite",
      promptId: prompt.promptId,
      promptText: prompt.prompt,
    });
  }

  return tips.slice(0, 8);
}

export function normalizePromptText(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

export function collectGeoQuestions(items: Array<{ payload?: Record<string, unknown> | null }>): string[] {
  const seen = new Set<string>();
  const questions: string[] = [];
  const add = (value: unknown) => {
    if (typeof value !== "string") return;
    const trimmed = value.trim();
    if (!trimmed) return;
    const key = normalizePromptText(trimmed);
    if (seen.has(key)) return;
    seen.add(key);
    questions.push(trimmed);
  };

  for (const item of items) {
    const plan = item.payload?.seo_plan;
    if (!plan || typeof plan !== "object") continue;
    const geo = (plan as { geo?: { questions?: unknown } }).geo;
    if (Array.isArray(geo?.questions)) geo.questions.forEach(add);
    const contentPlan = (plan as { contentPlan?: Array<{ geoQuestions?: unknown }> }).contentPlan;
    if (Array.isArray(contentPlan)) {
      for (const content of contentPlan) {
        if (Array.isArray(content?.geoQuestions)) content.geoQuestions.forEach(add);
      }
    }
  }
  return questions;
}

export function visibilityCsv(prompts: PromptInsight[]): string {
  const header = ["prompt", "category", "status", "chatgpt", "gemini", "perplexity", "position", "sentiment", "competitors", "citations"];
  const rows = prompts.map((prompt) => [
    prompt.prompt,
    prompt.category,
    prompt.status,
    prompt.platforms.chatgpt ? "1" : "0",
    prompt.platforms.gemini ? "1" : "0",
    prompt.platforms.perplexity ? "1" : "0",
    prompt.position ?? "",
    prompt.sentiment ?? "",
    prompt.competitors.join("|"),
    prompt.citations.join("|"),
  ].map((value) => `"${String(value).replaceAll('"', '""')}"`).join(","));
  return [header.join(","), ...rows].join("\n");
}
