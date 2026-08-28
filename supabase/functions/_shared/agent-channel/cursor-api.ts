export type CloudAgentResult = { url: string; id: string; reused: boolean };

const DEFAULT_REPO = "https://github.com/davidcastelnuovo/aios";

function authHeaders(apiKey: string, basic = false): Record<string, string> {
  return {
    Authorization: basic ? `Basic ${btoa(`${apiKey}:`)}` : `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    Accept: "application/json",
    "User-Agent": "aios-agent-channel/1.0",
  };
}

export async function cursorFetch(apiKey: string, url: string, init: RequestInit): Promise<Response> {
  const headers = { ...authHeaders(apiKey, false), ...(init.headers || {}) };
  let resp = await fetch(url, { ...init, headers });
  if (resp.status === 401 || resp.status === 403) {
    const basicHeaders = { ...authHeaders(apiKey, true), ...(init.headers || {}) };
    resp = await fetch(url, { ...init, headers: basicHeaders });
  }
  return resp;
}

export function parseAgentResponse(raw: string): { url: string; id: string } {
  let data: any = {};
  try { data = JSON.parse(raw); } catch { /* ignore */ }
  const agent = data?.agent || data;
  const id = String(agent?.id || data?.id || "");
  const url = String(
    agent?.url ||
      data?.url ||
      (id ? `https://cursor.com/agents/${id}` : "") ||
      "(agent created)",
  );
  return { url, id: id || url };
}

export async function followUpCloudAgent(
  apiKey: string,
  agentId: string,
  promptText: string,
): Promise<CloudAgentResult | null> {
  const url = `https://api.cursor.com/v1/agents/${encodeURIComponent(agentId)}/runs`;
  for (let attempt = 1; attempt <= 4; attempt++) {
    const resp = await cursorFetch(apiKey, url, {
      method: "POST",
      body: JSON.stringify({ prompt: { text: promptText } }),
    });
    const raw = await resp.text();
    if (resp.ok) {
      const parsed = parseAgentResponse(raw);
      return {
        id: agentId,
        url: parsed.url.includes("/agents/") ? parsed.url : `https://cursor.com/agents/${agentId}`,
        reused: true,
      };
    }
    if (resp.status === 409) {
      await new Promise((r) => setTimeout(r, 2500 * attempt));
      continue;
    }
    if (resp.status === 404 || resp.status === 410 || resp.status === 400) {
      console.warn(`[agent-channel] follow-up ${resp.status}: ${raw.slice(0, 200)}`);
      return null;
    }
    let detail = raw.slice(0, 500);
    try { detail = JSON.parse(raw)?.error?.message || JSON.parse(raw)?.message || detail; } catch { /* keep */ }
    throw new Error(`Cloud agent follow-up ${resp.status}: ${detail}`);
  }
  return { id: agentId, url: `https://cursor.com/agents/${agentId}`, reused: true };
}

export async function createCloudAgent(args: {
  apiKey: string;
  promptText: string;
  name: string;
  modelId?: string;
  startingRef?: string;
}): Promise<CloudAgentResult> {
  const repoUrl = Deno.env.get("CURSOR_REPO_URL") || DEFAULT_REPO;
  const startingRef = args.startingRef || Deno.env.get("CURSOR_STARTING_REF") || "main";
  const envName = Deno.env.get("CURSOR_CLOUD_ENV_NAME") || "";
  const autoCreatePR = (Deno.env.get("CURSOR_AUTO_CREATE_PR") || "true").toLowerCase() !== "false";
  const body: Record<string, unknown> = {
    prompt: { text: args.promptText },
    autoCreatePR,
    name: args.name.slice(0, 100),
  };
  if (args.modelId) body.model = { id: args.modelId };
  if (envName) body.env = { type: "cloud", name: envName };
  else body.repos = [{ url: repoUrl, startingRef }];

  const resp = await cursorFetch(args.apiKey, "https://api.cursor.com/v1/agents", {
    method: "POST",
    body: JSON.stringify(body),
  });
  const raw = await resp.text();
  if (!resp.ok) {
    let detail = raw.slice(0, 500);
    try { detail = JSON.parse(raw)?.error?.message || JSON.parse(raw)?.message || detail; } catch { /* keep */ }
    throw new Error(`Cloud agent create ${resp.status}: ${detail}`);
  }
  const parsed = parseAgentResponse(raw);
  return { ...parsed, reused: false };
}

export function cursorApiKey(): string {
  return Deno.env.get("CURSOR_API_KEY") || Deno.env.get("GROK_BOT_API_KEY") || "";
}
