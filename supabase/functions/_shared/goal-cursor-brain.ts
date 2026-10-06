/**
 * Autonomous Goal Engine orchestration brain — routes planning/management through
 * Carmen Direct ↔ Cursor Direct sticky chat (not Model API).
 */

import {
  asCursorSessionId,
  resolveCursorDirectSession,
  type CursorDirectSession,
} from "./cursor-direct-session.ts";
import { followUpCloudAgent, cursorApiKey } from "./agent-channel/cursor-api.ts";
import { hmacSha256Hex, timingSafeEqual } from "./security.ts";

export const BRAIN_REQUEST_TYPES = ["plan", "step_execute", "efficiency_review", "manual_guidance"] as const;
export type BrainRequestType = typeof BRAIN_REQUEST_TYPES[number];

export type BrainRequestRow = {
  id: string;
  tenant_id: string;
  goal_id: string;
  iteration_id?: string | null;
  step_id?: string | null;
  action_id?: string | null;
  request_type: BrainRequestType;
  status: "pending" | "sent" | "completed" | "failed" | "busy";
  cursor_session_id?: string | null;
  prompt_summary?: string | null;
  response_json?: Record<string, unknown> | null;
  error_message?: string | null;
};

type SupabaseLike = { from: (t: string) => any };

const TOKEN_VERSION = "goal-brain-v1";

export function brainCallbackSecret(): string {
  return (
    Deno.env.get("GOAL_BRAIN_CALLBACK_SECRET") ||
    Deno.env.get("AGENT_CHANNEL_CALLBACK_SECRET") ||
    Deno.env.get("CURSOR_MCP_BEARER") ||
    ""
  );
}

export function goalBrainApiFallbackEnabled(): boolean {
  return String(Deno.env.get("GOAL_BRAIN_API_FALLBACK") || "").toLowerCase() === "true";
}

export async function mintGoalBrainToken(args: {
  requestId: string;
  tenantId: string;
  goalId: string;
}): Promise<string> {
  const secret = brainCallbackSecret();
  if (!secret) throw new Error("Goal brain callback secret is not configured");
  return hmacSha256Hex(
    secret,
    `${TOKEN_VERSION}:${args.requestId}:${args.tenantId}:${args.goalId}`,
  );
}

export async function verifyGoalBrainToken(args: {
  token: string;
  requestId: string;
  tenantId: string;
  goalId: string;
}): Promise<boolean> {
  const expected = await mintGoalBrainToken(args);
  return timingSafeEqual(expected, args.token);
}

export function extractJsonFromBrainResponse(content: string): Record<string, unknown> | null {
  const text = String(content || "").trim();
  if (!text) return null;

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced?.[1] || text).trim();

  const tryParse = (raw: string): Record<string, unknown> | null => {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? parsed as Record<string, unknown>
        : null;
    } catch {
      return null;
    }
  };

  const direct = tryParse(candidate);
  if (direct) return direct;

  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return tryParse(candidate.slice(start, end + 1));
  }
  return null;
}

export function buildGoalBrainCallbackBlock(args: {
  requestId: string;
  tenantId: string;
  goalId: string;
  token: string;
}): string {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  return (
    `\n\n--- GOAL ENGINE BRAIN CALLBACK (required) ---\n` +
    `You are the Cursor Direct orchestration brain for Carmen's autonomous goals.\n` +
    `Reply with a single JSON object (wrap in \`\`\`json fence). No prose outside the fence unless needed.\n\n` +
    `When finished, POST your full answer to AIOS:\n` +
    `POST ${supabaseUrl}/functions/v1/goal-brain-callback\n` +
    `Headers:\n` +
    `  Authorization: Bearer ${args.token}\n` +
    `  Content-Type: application/json\n` +
    `Body JSON:\n` +
    `{\n` +
    `  "request_id": "${args.requestId}",\n` +
    `  "goal_id": "${args.goalId}",\n` +
    `  "tenant_id": "${args.tenantId}",\n` +
    `  "content": "<your full answer including the JSON>"\n` +
    `}\n`
  );
}

export async function resolveGoalOrchestratorSession(
  supabase: SupabaseLike,
  tenantId: string,
): Promise<CursorDirectSession | null> {
  const { data: pinned } = await supabase.from("goal_orchestrator_brain")
    .select("cursor_session_id, cursor_session_url, session_source")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  const pinnedId = asCursorSessionId(String(pinned?.cursor_session_id || ""));
  if (pinnedId) {
    return {
      sessionId: pinnedId,
      sessionUrl: String(pinned?.cursor_session_url || `https://cursor.com/agents/${pinnedId}`),
      source: (pinned?.session_source as CursorDirectSession["source"]) || "db:goal_orchestrator_brain",
    };
  }

  const direct = await resolveCursorDirectSession(supabase, {
    tenantId,
    env: {
      CURSOR_DIRECT_AGENT_ID: Deno.env.get("CURSOR_DIRECT_AGENT_ID"),
      CURSOR_STICKY_AGENT_ID: Deno.env.get("CURSOR_STICKY_AGENT_ID"),
    },
  });
  if (!direct) return null;

  await supabase.from("goal_orchestrator_brain").upsert({
    tenant_id: tenantId,
    cursor_session_id: direct.sessionId,
    cursor_session_url: direct.sessionUrl,
    session_source: direct.source,
    updated_at: new Date().toISOString(),
  }, { onConflict: "tenant_id" });

  return direct;
}

export async function getInFlightBrainRequest(
  supabase: SupabaseLike,
  goalId: string,
  requestType?: BrainRequestType,
): Promise<BrainRequestRow | null> {
  let q = supabase.from("goal_brain_requests")
    .select("*")
    .eq("goal_id", goalId)
    .in("status", ["pending", "sent", "busy"])
    .order("created_at", { ascending: false })
    .limit(1);
  if (requestType) q = q.eq("request_type", requestType);
  const { data } = await q.maybeSingle();
  return data || null;
}

export async function createBrainRequest(
  supabase: SupabaseLike,
  args: {
    tenantId: string;
    goalId: string;
    requestType: BrainRequestType;
    iterationId?: string;
    stepId?: string;
    actionId?: string;
    promptSummary: string;
    cursorSessionId: string;
  },
): Promise<{ request: BrainRequestRow; token: string }> {
  const { data: request, error } = await supabase.from("goal_brain_requests").insert({
    tenant_id: args.tenantId,
    goal_id: args.goalId,
    iteration_id: args.iterationId || null,
    step_id: args.stepId || null,
    action_id: args.actionId || null,
    request_type: args.requestType,
    status: "pending",
    cursor_session_id: args.cursorSessionId,
    prompt_summary: args.promptSummary.slice(0, 500),
  }).select("*").single();
  if (error) throw error;

  const token = await mintGoalBrainToken({
    requestId: request.id,
    tenantId: args.tenantId,
    goalId: args.goalId,
  });

  await supabase.from("goal_brain_requests").update({
    callback_token: token,
    updated_at: new Date().toISOString(),
  }).eq("id", request.id);

  return { request, token };
}

export async function dispatchBrainToCursorDirect(
  supabase: SupabaseLike,
  args: {
    tenantId: string;
    goalId: string;
    request: BrainRequestRow;
    token: string;
    prompt: string;
  },
): Promise<{ delivered: boolean; sessionUrl: string }> {
  const apiKey = cursorApiKey();
  if (!apiKey) throw new Error("CURSOR_API_KEY is not configured");

  const sessionId = asCursorSessionId(args.request.cursor_session_id || "");
  if (!sessionId) throw new Error("brain_request missing cursor_session_id");

  const callbackBlock = buildGoalBrainCallbackBlock({
    requestId: args.request.id,
    tenantId: args.tenantId,
    goalId: args.goalId,
    token: args.token,
  });

  const text =
    `[Goal Engine Brain · Carmen Direct ↔ Cursor Direct]\n` +
    `Orchestration brain for autonomous goals — do NOT open a new Background Agent.\n` +
    `request_id: ${args.request.id}\n` +
    `goal_id: ${args.goalId}\n` +
    `request_type: ${args.request.request_type}\n\n` +
    `${args.prompt}\n` +
    callbackBlock;

  const outcome = await followUpCloudAgent(apiKey, sessionId, text);
  const sessionUrl = `https://cursor.com/agents/${sessionId}`;

  if (outcome.kind === "gone") {
    await supabase.from("goal_brain_requests").update({
      status: "failed",
      error_message: "cursor_direct_session_gone",
      updated_at: new Date().toISOString(),
    }).eq("id", args.request.id);
    throw new Error(`Cursor Direct session ${sessionId} is gone`);
  }

  if (outcome.kind === "busy") {
    await supabase.from("goal_brain_requests").update({
      status: "busy",
      error_message: "cursor_direct_busy",
      updated_at: new Date().toISOString(),
    }).eq("id", args.request.id);
    return { delivered: false, sessionUrl: outcome.url || sessionUrl };
  }

  await supabase.from("goal_brain_requests").update({
    status: "sent",
    delivered_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("id", args.request.id);

  await supabase.from("goals").update({
    engine_status: "AWAITING_BRAIN",
    updated_at: new Date().toISOString(),
  }).eq("id", args.goalId);

  return { delivered: true, sessionUrl: outcome.url || sessionUrl };
}

export async function queueBrainRequest(
  supabase: SupabaseLike,
  args: {
    tenantId: string;
    goalId: string;
    requestType: BrainRequestType;
    prompt: string;
    iterationId?: string;
    stepId?: string;
    actionId?: string;
  },
): Promise<{ dispatched: boolean; requestId?: string; awaiting?: boolean; reason?: string }> {
  const inflight = await getInFlightBrainRequest(supabase, args.goalId);
  if (inflight) {
    return { dispatched: false, awaiting: true, requestId: inflight.id, reason: "inflight" };
  }

  const session = await resolveGoalOrchestratorSession(supabase, args.tenantId);
  if (!session) {
    return { dispatched: false, reason: "no_cursor_direct_session" };
  }

  const { request, token } = await createBrainRequest(supabase, {
    tenantId: args.tenantId,
    goalId: args.goalId,
    requestType: args.requestType,
    iterationId: args.iterationId,
    stepId: args.stepId,
    actionId: args.actionId,
    promptSummary: args.prompt.slice(0, 500),
    cursorSessionId: session.sessionId,
  });

  const result = await dispatchBrainToCursorDirect(supabase, {
    tenantId: args.tenantId,
    goalId: args.goalId,
    request,
    token,
    prompt: args.prompt,
  });

  if (!result.delivered) {
    return { dispatched: false, awaiting: true, requestId: request.id, reason: "cursor_busy" };
  }
  return { dispatched: true, requestId: request.id };
}
