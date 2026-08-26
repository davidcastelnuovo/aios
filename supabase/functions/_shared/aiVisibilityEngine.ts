/** ChatGPT measured like a user: live web search + IL location, not frozen API knowledge. */

export type UserSearchAnswer = {
  text: string;
  citations: string[];
  searchQueries: string[];
  engine: "chatgpt_web_search";
};

export type UserLocation = {
  country: string;
  city?: string;
  timezone?: string;
};

export const ISRAEL_USER: UserLocation = {
  country: "IL",
  city: "Tel Aviv",
  timezone: "Asia/Jerusalem",
};

const URL_RE = /https?:\/\/[^\s)]+/g;

export function mentionRateScore(mentioned: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((mentioned / total) * 100);
}

export function brandIsMentioned(text: string, brandName: string, keywords: string[]): boolean {
  const haystack = text.toLowerCase();
  if (brandName.trim() && haystack.includes(brandName.trim().toLowerCase())) return true;
  return keywords.some((keyword) => keyword.trim() && haystack.includes(keyword.trim().toLowerCase()));
}

export function listPosition(text: string, name: string): number | null {
  const lines = text.split("\n");
  let index = 0;
  for (const line of lines) {
    if (/^\d+[.)]/.test(line.trim()) || /^[-•*]/.test(line.trim())) {
      index += 1;
      if (line.toLowerCase().includes(name.toLowerCase())) return index;
    }
  }
  return null;
}

export function parseResponsesWebSearch(payload: unknown): UserSearchAnswer {
  const root = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
  const output = Array.isArray(root.output) ? root.output : [];
  const citations: string[] = [];
  const searchQueries: string[] = [];
  const texts: string[] = [];

  if (typeof root.output_text === "string" && root.output_text.trim()) texts.push(root.output_text);

  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    if (row.type === "web_search_call") {
      const action = row.action && typeof row.action === "object" ? row.action as Record<string, unknown> : {};
      if (typeof action.query === "string" && action.query.trim()) searchQueries.push(action.query.trim());
      if (Array.isArray(action.queries)) {
        for (const query of action.queries) {
          if (typeof query === "string" && query.trim()) searchQueries.push(query.trim());
        }
      }
    }
    if (row.type === "message" && Array.isArray(row.content)) {
      for (const part of row.content) {
        if (!part || typeof part !== "object") continue;
        const block = part as Record<string, unknown>;
        if (typeof block.text === "string") texts.push(block.text);
        if (Array.isArray(block.annotations)) {
          for (const annotation of block.annotations) {
            if (!annotation || typeof annotation !== "object") continue;
            const cite = annotation as Record<string, unknown>;
            if ((cite.type === "url_citation" || cite.type === "citation") && typeof cite.url === "string") {
              citations.push(cite.url);
            }
          }
        }
      }
    }
  }

  const text = texts.join("\n").trim();
  for (const url of text.match(URL_RE) ?? []) citations.push(url.replace(/[.,;]+$/, ""));
  return {
    text,
    citations: [...new Set(citations)],
    searchQueries: [...new Set(searchQueries)],
    engine: "chatgpt_web_search",
  };
}

async function postResponses(
  apiKey: string,
  prompt: string,
  location: UserLocation,
  toolType: "web_search" | "web_search_preview",
  model: string,
): Promise<{ ok: boolean; status: number; json: unknown }> {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: prompt,
      tools: [{
        type: toolType,
        user_location: {
          type: "approximate",
          country: location.country,
          city: location.city,
          timezone: location.timezone,
        },
      }],
      tool_choice: "required",
    }),
  });
  const json = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, json };
}

/** Official ChatGPT-with-search, located like an Israeli user. Not a chatgpt.com scrape. */
export async function askChatGPTAsUser(opts: {
  apiKey: string;
  prompt: string;
  location?: UserLocation;
  model?: string;
}): Promise<UserSearchAnswer & { model: string; usage?: { input: number; output: number } }> {
  const location = opts.location ?? ISRAEL_USER;
  const model = opts.model ?? "gpt-4o-mini";
  const attempts: Array<{ tool: "web_search" | "web_search_preview"; model: string }> = [
    { tool: "web_search", model },
    { tool: "web_search_preview", model },
    { tool: "web_search", model: "gpt-4o" },
  ];

  let lastError = "ChatGPT web search failed";
  for (const attempt of attempts) {
    const result = await postResponses(opts.apiKey, opts.prompt, location, attempt.tool, attempt.model);
    if (result.status === 429) throw new Error("Rate limit exceeded, please try again later.");
    if (!result.ok) {
      const err = result.json && typeof result.json === "object" ? (result.json as { error?: { message?: string } }).error?.message : "";
      lastError = err || `ChatGPT web search ${result.status}`;
      continue;
    }
    const parsed = parseResponsesWebSearch(result.json);
    if (!parsed.text) {
      lastError = "Empty ChatGPT search answer";
      continue;
    }
    const usage = result.json && typeof result.json === "object"
      ? (result.json as { usage?: { input_tokens?: number; output_tokens?: number } }).usage
      : undefined;
    return {
      ...parsed,
      model: attempt.model,
      usage: {
        input: usage?.input_tokens ?? 0,
        output: usage?.output_tokens ?? 0,
      },
    };
  }
  throw new Error(lastError);
}
