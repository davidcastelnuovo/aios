/**
 * Per-goal sticky Cursor agent — one session per goal, follow-ups preserve history.
 * Does NOT use tenant-wide cursor_sticky_agents (that stays for general Carmen dev work).
 */

export type GoalCursorFireResult = {
  cursorAgentId: string;
  sessionUrl: string;
  reused: boolean;
  delivered: boolean;
  parallel?: boolean;
};

function cursorAuthHeaders(apiKey: string, basic = false): Record<string, string> {
  return {
    Authorization: basic ? `Basic ${btoa(`${apiKey}:`)}` : `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    Accept: "application/json",
    "User-Agent": "aios-goal-cursor/1.0",
  };
}

async function cursorFetch(apiKey: string, url: string, init: RequestInit): Promise<Response> {
  const headers = { ...cursorAuthHeaders(apiKey, false), ...(init.headers || {}) };
  let resp = await fetch(url, { ...init, headers });
  if (resp.status === 401 || resp.status === 403) {
    resp = await fetch(url, { ...init, headers: { ...cursorAuthHeaders(apiKey, true), ...(init.headers || {}) } });
  }
  return resp;
}

function parseAgentResponse(raw: string): { url: string; id: string } {
  let data: Record<string, unknown> = {};
  try { data = JSON.parse(raw); } catch { /* ignore */ }
  const agent = (data?.agent || data) as Record<string, unknown>;
  const id = String(agent?.id || data?.id || "");
  const url = String(
    agent?.url || data?.url || (id ? `https://cursor.com/agents/${id}` : ""),
  );
  return { url, id: id || url };
}

export async function getPlanStepCursorAgent(
  supabase: { from: (t: string) => any },
  planStepId: string,
): Promise<{ cursorAgentId: string; sessionUrl: string } | null> {
  const { data } = await supabase.from("goal_plan_steps")
    .select("cursor_agent_id, cursor_session_url")
    .eq("id", planStepId)
    .maybeSingle();
  const id = String(data?.cursor_agent_id || "").trim();
  if (!id.startsWith("bc-")) return null;
  return {
    cursorAgentId: id,
    sessionUrl: String(data?.cursor_session_url || `https://cursor.com/agents/${id}`),
  };
}

export async function savePlanStepCursorAgent(
  supabase: { from: (t: string) => any },
  planStepId: string,
  cursorAgentId: string,
  sessionUrl: string,
): Promise<void> {
  if (!cursorAgentId.startsWith("bc-")) return;
  await supabase.from("goal_plan_steps").update({
    cursor_agent_id: cursorAgentId,
    cursor_session_url: sessionUrl || `https://cursor.com/agents/${cursorAgentId}`,
    updated_at: new Date().toISOString(),
  }).eq("id", planStepId);
}

export async function getGoalCursorAgent(
  supabase: { from: (t: string) => any },
  goalId: string,
): Promise<{ cursorAgentId: string; sessionUrl: string } | null> {
  const { data } = await supabase.from("goals")
    .select("cursor_agent_id, cursor_session_url")
    .eq("id", goalId)
    .maybeSingle();
  const id = String(data?.cursor_agent_id || "").trim();
  if (!id.startsWith("bc-")) return null;
  return {
    cursorAgentId: id,
    sessionUrl: String(data?.cursor_session_url || `https://cursor.com/agents/${id}`),
  };
}

export async function saveGoalCursorAgent(
  supabase: { from: (t: string) => any },
  goalId: string,
  cursorAgentId: string,
  sessionUrl: string,
): Promise<void> {
  if (!cursorAgentId.startsWith("bc-")) return;
  await supabase.from("goals").update({
    cursor_agent_id: cursorAgentId,
    cursor_session_url: sessionUrl || `https://cursor.com/agents/${cursorAgentId}`,
    updated_at: new Date().toISOString(),
  }).eq("id", goalId);
}

async function followUpCursorAgent(
  apiKey: string,
  agentId: string,
  promptText: string,
): Promise<GoalCursorFireResult | null> {
  const url = `https://api.cursor.com/v1/agents/${encodeURIComponent(agentId)}/runs`;
  const sessionUrl = `https://cursor.com/agents/${agentId}`;
  for (let attempt = 1; attempt <= 2; attempt++) {
    const resp = await cursorFetch(apiKey, url, {
      method: "POST",
      body: JSON.stringify({ prompt: { text: promptText } }),
    });
    const raw = await resp.text();
    if (resp.ok) {
      const parsed = parseAgentResponse(raw);
      return {
        cursorAgentId: agentId,
        sessionUrl: parsed.url.includes("/agents/") ? parsed.url : sessionUrl,
        reused: true,
        delivered: true,
      };
    }
    if (resp.status === 409) {
      if (attempt === 1) await new Promise((r) => setTimeout(r, 1500));
      continue;
    }
    if (resp.status === 404 || resp.status === 410 || resp.status === 400) return null;
    throw new Error(`Cursor follow-up ${resp.status}: ${raw.slice(0, 400)}`);
  }
  return { cursorAgentId: agentId, sessionUrl, reused: true, delivered: false };
}

async function createGoalCursorAgent(
  apiKey: string,
  promptText: string,
  opts?: { name?: string; startingRef?: string },
): Promise<GoalCursorFireResult> {
  const repoUrl = Deno.env.get("CURSOR_REPO_URL") || "https://github.com/davidcastelnuovo/aios";
  const startingRef = opts?.startingRef || "develop";
  const envName = Deno.env.get("CURSOR_CLOUD_ENV_NAME") || "";
  const { cursorModelBody, resolveCodingCursorModel } = await import("./cursorCreativeModel.ts");
  const modelId = Deno.env.get("CURSOR_MODEL_ID") || "";
  const autoCreatePR = (Deno.env.get("CURSOR_AUTO_CREATE_PR") || "true").toLowerCase() !== "false";

  const body: Record<string, unknown> = {
    prompt: { text: promptText },
    autoCreatePR,
    name: (opts?.name || "Carmen Goal").slice(0, 100),
    model: cursorModelBody(resolveCodingCursorModel(modelId)),
  };
  if (envName) {
    body.env = { type: "cloud", name: envName };
  } else {
    body.repos = [{ url: repoUrl, startingRef }];
  }

  const resp = await cursorFetch(apiKey, "https://api.cursor.com/v1/agents", {
    method: "POST",
    body: JSON.stringify(body),
  });
  const raw = await resp.text();
  if (!resp.ok) throw new Error(`Cursor create ${resp.status}: ${raw.slice(0, 400)}`);
  const parsed = parseAgentResponse(raw);
  const id = parsed.id.startsWith("bc-") ? parsed.id : parsed.url.match(/bc-[a-z0-9-]+/i)?.[0] || "";
  if (!id.startsWith("bc-")) throw new Error("Cursor create: missing agent id");
  return {
    cursorAgentId: id,
    sessionUrl: parsed.url.includes("/agents/") ? parsed.url : `https://cursor.com/agents/${id}`,
    reused: false,
    delivered: true,
  };
}

export function buildGoalTechnicalPrompt(args: {
  goalId: string;
  goalTitle: string;
  objective?: string;
  stepTitle: string;
  stepDescription?: string;
  acceptanceCriteria?: string;
  constraints?: Record<string, unknown>;
  subProjectLabel?: string;
  subProjectKey?: string;
}): string {
  return [
    "[Carmen Autonomous Goal · Technical Job]",
    `goal_id: ${args.goalId}`,
    `Goal: ${args.goalTitle}`,
    args.objective ? `Objective: ${args.objective}` : "",
    args.subProjectLabel ? `Sub-project / department: ${args.subProjectLabel} (${args.subProjectKey || ""})` : "",
    "",
    `Task:\n${args.stepTitle}`,
    args.stepDescription ? `\nDetails:\n${args.stepDescription}` : "",
    args.acceptanceCriteria ? `\nAcceptance criteria:\n${args.acceptanceCriteria}` : "",
    args.constraints && Object.keys(args.constraints).length
      ? `\nConstraints:\n${JSON.stringify(args.constraints, null, 2)}` : "",
    "",
    "Work on branch develop / Staging first.",
    args.subProjectKey
      ? "This sub-project has its OWN dedicated Cursor agent — stay scoped to this department only."
      : "This is a follow-up on the SAME goal session — do not restart from scratch unless necessary.",
  ].filter(Boolean).join("\n");
}

/** Dispatch technical work to the goal's sticky Cursor agent (create or follow-up). */
export async function dispatchToGoalCursor(
  supabase: { from: (t: string) => any },
  args: {
    tenantId: string;
    goalId: string;
    goalTitle: string;
    objective?: string;
    stepTitle: string;
    stepDescription?: string;
    acceptanceCriteria?: string;
    constraints?: Record<string, unknown>;
    startingRef?: string;
    planStepId?: string;
    subProjectKey?: string;
    subProjectLabel?: string;
    useStepSticky?: boolean;
  },
): Promise<GoalCursorFireResult> {
  const apiKey = Deno.env.get("CURSOR_API_KEY") || "";
  if (!apiKey) throw new Error("CURSOR_API_KEY not configured");

  const useStepSticky = args.useStepSticky ?? !!(args.planStepId && args.subProjectKey);

  const prompt = buildGoalTechnicalPrompt({
    goalId: args.goalId,
    goalTitle: args.goalTitle,
    objective: args.objective,
    stepTitle: args.stepTitle,
    stepDescription: args.stepDescription,
    acceptanceCriteria: args.acceptanceCriteria,
    constraints: args.constraints,
    subProjectKey: args.subProjectKey,
    subProjectLabel: args.subProjectLabel,
  });

  const existing = useStepSticky && args.planStepId
    ? await getPlanStepCursorAgent(supabase, args.planStepId)
    : await getGoalCursorAgent(supabase, args.goalId);
  let result: GoalCursorFireResult;

  if (existing) {
    const followed = await followUpCursorAgent(apiKey, existing.cursorAgentId, prompt);
    if (followed?.delivered) {
      result = followed;
    } else if (followed && !followed.delivered) {
      const parallel = await createGoalCursorAgent(apiKey, prompt, {
        name: (args.subProjectLabel || args.goalTitle).slice(0, 100),
        startingRef: args.startingRef,
      });
      result = { ...parallel, parallel: true };
    } else {
      result = await createGoalCursorAgent(apiKey, prompt, {
        name: (args.subProjectLabel || args.goalTitle).slice(0, 100),
        startingRef: args.startingRef,
      });
    }
  } else {
    result = await createGoalCursorAgent(apiKey, prompt, {
      name: (args.subProjectLabel || args.goalTitle).slice(0, 100),
      startingRef: args.startingRef,
    });
  }

  if (useStepSticky && args.planStepId) {
    await savePlanStepCursorAgent(supabase, args.planStepId, result.cursorAgentId, result.sessionUrl);
  } else {
    await saveGoalCursorAgent(supabase, args.goalId, result.cursorAgentId, result.sessionUrl);
  }

  try {
    await supabase.from("goal_events").insert({
      tenant_id: args.tenantId,
      goal_id: args.goalId,
      event_type: result.reused ? "cursor_goal_followup" : "cursor_goal_agent_created",
      actor: "autonomous_goal_engine",
      detail: {
        cursor_agent_id: result.cursorAgentId,
        session_url: result.sessionUrl,
        reused: result.reused,
        parallel: result.parallel ?? false,
        step: args.stepTitle,
      },
    });
  } catch { /* audit must not break dispatch */ }

  return result;
}
