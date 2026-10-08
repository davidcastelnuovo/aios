/** ChatGPT Workspace / Work Mode — repo-connected agent, not the OpenAI API Carmen uses. */

export type WorkspaceProvider = "chatgpt" | "codex";

export function workspaceAgentCreds(
  provider: WorkspaceProvider,
  env: Record<string, string | undefined> = {},
): { triggerId: string; accessToken: string } {
  const chatgptTrigger = String(
    env.CHATGPT_WORK_AGENT_TRIGGER_ID ||
      env.CHATGPT_WORK_AGENT_API_TRIGGER_ID ||
      env.WORKSPACE_AGENT_TRIGGER_ID ||
      env.CHATGPT_WORK_AGENT_WORKFLOW_ID ||
      "",
  ).trim();
  const chatgptToken = String(
    env.CHATGPT_WORK_AGENT_TOKEN || env.CHATGPT_WORK_AGENT_ACCESS_TOKEN || "",
  ).trim();
  if (provider === "codex") {
    return {
      triggerId: String(
        env.CODEX_WORK_AGENT_TRIGGER_ID || chatgptTrigger,
      ).trim(),
      accessToken: String(env.CODEX_WORK_AGENT_TOKEN || chatgptToken).trim(),
    };
  }
  return { triggerId: chatgptTrigger, accessToken: chatgptToken };
}

export function workspaceConversationKey(
  provider: WorkspaceProvider,
  conversationId: string,
): string {
  return `aios:${provider}:${conversationId}`;
}

const WORKSPACE_API_BASE = "https://api.chatgpt.com/v1";

/** Normalize secret value from Supabase (trim, strip wrapping quotes). */
export function normalizeWorkspaceTriggerId(triggerId: string): string {
  return String(triggerId || "")
    .trim()
    .replace(/^["']|["']$/g, "");
}

/** Trigger id from the Triggers tab: current ids are UUIDs; legacy ids use `agtch_…`, not About-tab `agt_…`. */
export function validateWorkspaceTriggerId(triggerId: string): string | null {
  const id = normalizeWorkspaceTriggerId(triggerId);
  if (!id) return "חסר Trigger ID.";
  if (id.startsWith("agt_") && !id.startsWith("agtch_")) {
    return "שמת Agent ID (agt_…) במקום Trigger ID. בבuilder של הסוכן: Add channel → API, שמור ו-Publish, והעתק agtch_… ל-CHATGPT_WORK_AGENT_TRIGGER_ID.";
  }
  const legacyTriggerId = /^agtch_[a-z0-9]+$/i.test(id);
  const uuidTriggerId = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(
    id,
  );
  if (!legacyTriggerId && !uuidTriggerId) {
    return "Trigger ID חייב להיות UUID מלשונית Triggers, או מזהה legacy שמתחיל ב-agtch_.";
  }
  return null;
}

export function assertWorkspaceAccessToken(accessToken: string): string | null {
  const token = String(accessToken || "").trim();
  if (!token)
    return "חסר Workspace Agent access token (CHATGPT_WORK_AGENT_TOKEN).";
  if (token.startsWith("sk-")) {
    return "זה נראה כמו OpenAI Platform key (sk-…). צריך ChatGPT Workspace Agent access token מ-Admin → Access tokens (scope Workspace Agents).";
  }
  return null;
}

export function workspaceAgentTriggerUrl(triggerId: string): string {
  const id = normalizeWorkspaceTriggerId(triggerId);
  return `${WORKSPACE_API_BASE}/workspace_agents/${encodeURIComponent(id)}/trigger`;
}

export type WorkspaceTriggerResult =
  | {
      ok: true;
      status: number;
      conversationUrl: string | null;
      runId: string | null;
    }
  | { ok: false; status: number; error: string };

/** POST /v1/workspace_agents/{agtch_…}/trigger — OpenAI Workspace Agents API. */
export async function triggerWorkspaceAgentRun(args: {
  triggerId: string;
  accessToken: string;
  conversationKey: string;
  input: string;
  idempotencyKey: string;
  includeRunStatusBeta?: boolean;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}): Promise<WorkspaceTriggerResult> {
  const triggerId = normalizeWorkspaceTriggerId(args.triggerId);
  const triggerProblem = validateWorkspaceTriggerId(triggerId);
  if (triggerProblem) return { ok: false, status: 0, error: triggerProblem };
  const tokenProblem = assertWorkspaceAccessToken(args.accessToken);
  if (tokenProblem) return { ok: false, status: 0, error: tokenProblem };

  const headers: Record<string, string> = {
    Authorization: `Bearer ${String(args.accessToken).trim()}`,
    "Content-Type": "application/json",
    "Idempotency-Key": args.idempotencyKey,
  };
  if (args.includeRunStatusBeta !== false) {
    headers["OpenAI-Beta"] = "workspace_agent_runs=v1";
  }

  if (!String(args.input || "").trim()) {
    return {
      ok: false,
      status: 0,
      error: "input ריק — לא נשלח trigger ל-ChatGPT.",
    };
  }
  const fetchImpl = args.fetchImpl ?? fetch;
  const timeoutMs = args.timeoutMs ?? 25_000;
  const body = JSON.stringify({
    conversation_key: args.conversationKey,
    input: args.input,
  });

  let resp: Response | null = null;
  let raw = "";
  let lastError = "";
  // Same Idempotency-Key on retry: the API returns the original accepted outcome instead of queueing twice.
  for (let attempt = 0; attempt < 2; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      resp = await fetchImpl(workspaceAgentTriggerUrl(triggerId), {
        method: "POST",
        headers,
        body,
        signal: controller.signal,
      });
      raw = await resp.text();
    } catch (e) {
      resp = null;
      lastError =
        (e as Error)?.name === "AbortError"
          ? `ChatGPT לא ענה תוך ${Math.round(timeoutMs / 1000)} שניות`
          : `שגיאת רשת מול ChatGPT: ${(e as Error)?.message ?? e}`;
    } finally {
      clearTimeout(timer);
    }
    if (resp && resp.status < 500) break;
  }
  if (!resp) return { ok: false, status: 0, error: lastError };
  if (resp.status < 200 || resp.status >= 300) {
    return {
      ok: false,
      status: resp.status,
      error: formatWorkspaceTriggerError(resp.status, raw),
    };
  }

  let data: Record<string, unknown> = {};
  if (raw.trim()) {
    try {
      data = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      /* 202 may be empty in some modes */
    }
  }
  const conversationUrl =
    String(data.conversation_url || data.url || "") || null;
  const runId = String(data.agent_trigger_run_id || data.id || "") || null;
  return { ok: true, status: resp.status, conversationUrl, runId };
}

export function formatWorkspaceTriggerError(
  status: number,
  raw: string,
): string {
  const detail = raw.slice(0, 280);
  if (status === 404 || /not_found|not found/i.test(detail)) {
    return "ChatGPT לא מוצא את ה-trigger (404). בדוק: (1) ה-ID הועתק מלשונית Triggers, (2) הסוכן Published, (3) TRIGGER_ID + TOKEN ב-Supabase נוצרו יחד עבור הסוכן הזה, (4) הטוקן עם scope Workspace Agents.";
  }
  if (status === 401 || status === 403) {
    return "טוקן Workspace Agents לא תקף או בלי הרשאה לסוכן הזה. צור token חדש ב-Admin → Access tokens.";
  }
  if (status === 409) {
    return "הסוכן לא במצב runnable (409). נסה שוב או בדוק שהסוכן Published.";
  }
  return `ChatGPT Workspace trigger ${status}: ${detail}`;
}

/** Config-only health check (does not enqueue a run). */
export async function probeWorkspaceAgent(
  provider: WorkspaceProvider,
  env: Record<string, string | undefined> = {},
): Promise<{
  ok: boolean;
  status?: number;
  error?: string;
  trigger_id_prefix?: string;
}> {
  const { triggerId, accessToken } = workspaceAgentCreds(provider, env);
  const id = normalizeWorkspaceTriggerId(triggerId);
  const triggerProblem = validateWorkspaceTriggerId(id);
  if (triggerProblem) {
    return {
      ok: false,
      error: triggerProblem,
      trigger_id_prefix: id.slice(0, 6) || undefined,
    };
  }
  const tokenProblem = assertWorkspaceAccessToken(accessToken);
  if (tokenProblem)
    return {
      ok: false,
      error: tokenProblem,
      trigger_id_prefix: id.slice(0, 10),
    };
  return { ok: true, status: 200, trigger_id_prefix: id.slice(0, 10) };
}

export function missingWorkspaceMessage(provider: WorkspaceProvider): string {
  if (provider === "codex") {
    return (
      "Codex Direct צריך ChatGPT Workspace / Work Mode (עם חיבורי הריפו), " +
      "לא את מפתח ה-OpenAI של כרמן. חסרים CHATGPT_WORK_AGENT_TRIGGER_ID ו-CHATGPT_WORK_AGENT_TOKEN " +
      "(או CODEX_WORK_AGENT_*). הסוכן ב-workspace חייב לקרוא ל-reply_to_aios_session."
    );
  }
  return (
    "ChatGPT Work Agent עדיין לא מחובר. צריך סודות CHATGPT_WORK_AGENT_TRIGGER_ID ו-CHATGPT_WORK_AGENT_TOKEN, " +
    "והסוכן חייב לקרוא ל-reply_to_aios_session."
  );
}
