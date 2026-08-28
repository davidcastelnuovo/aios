import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import type {
  BrainRouteRow,
  CallbackPayload,
  ChannelProvider,
  ChannelSessionRow,
  ConversationMessageRow,
  ConversationStatus,
  SendResult,
} from "./types.ts";
import { DEFAULT_BRAIN_ROUTE_SEEDS } from "./types.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

export function serviceClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
}

export async function userHasTenantAccess(
  sb: SupabaseClient,
  userId: string,
  tenantId: string,
): Promise<boolean> {
  try {
    const { data: superRow } = await sb
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "super_admin")
      .maybeSingle();
    if (superRow) return true;
  } catch { /* user_roles may not be readable */ }
  const { data: membership } = await sb
    .from("tenant_users")
    .select("user_id")
    .eq("user_id", userId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  return !!membership;
}

export async function resolveCarmenAgent(sb: SupabaseClient, tenantId: string): Promise<{ id: string; name: string } | null> {
  const { data } = await sb
    .from("ai_agents")
    .select("id, name")
    .eq("tenant_id", tenantId)
    .or("name.ilike.%carmen%,name.ilike.%כרמן%")
    .eq("active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return data ?? null;
}

export async function ensureDefaultRoutes(
  sb: SupabaseClient,
  tenantId: string,
  agentId: string | null,
): Promise<BrainRouteRow[]> {
  const { data: existing } = await sb
    .from("agent_brain_routes")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("active", true);
  const have = new Set((existing || []).map((r: { slug: string }) => r.slug));
  const missing = DEFAULT_BRAIN_ROUTE_SEEDS.filter((seed) => !have.has(seed.slug));
  if (missing.length) {
    const rows = missing.map((seed) => ({
      tenant_id: tenantId,
      agent_id: agentId,
      slug: seed.slug,
      label: seed.label,
      route_type: seed.route_type,
      provider: seed.provider,
      config: seed.config,
      active: true,
    }));
    const { error } = await sb
      .from("agent_brain_routes")
      .upsert(rows, { onConflict: "tenant_id,slug" });
    if (error) console.error("[agent-channel] seed routes failed", error.message);
  }

  const parliament = (existing || []).find((r: { slug: string }) => r.slug === "parliament") as BrainRouteRow | undefined;
  if (parliament) {
    const cfg = (parliament.config && typeof parliament.config === "object") ? { ...parliament.config } : {};
    const seats = Array.isArray(cfg.seats) ? cfg.seats.map(String) : [];
    if (!seats.includes("codex")) {
      await sb.from("agent_brain_routes").update({
        label: "שולחן אבירים · Cursor + Grok + Codex",
        config: { ...cfg, seats: [...(seats.length ? seats : ["cursor", "grok"]), "codex"], chair: "carmen" },
      }).eq("id", parliament.id);
    }
  }

  const { data: all } = await sb
    .from("agent_brain_routes")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("active", true);
  return (all || existing || []) as BrainRouteRow[];
}

export async function loadRoute(
  sb: SupabaseClient,
  tenantId: string,
  opts: { routeId?: string | null; slug?: string | null },
): Promise<BrainRouteRow | null> {
  const routes = await ensureDefaultRoutes(sb, tenantId, null);
  if (opts.routeId && !opts.routeId.startsWith("fallback-")) {
    const hit = routes.find((r) => r.id === opts.routeId);
    if (hit) return hit;
    const { data } = await sb
      .from("agent_brain_routes")
      .select("*")
      .eq("id", opts.routeId)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (data) return data as BrainRouteRow;
  }
  const slug = opts.slug || "cursor";
  return routes.find((r) => r.slug === slug)
    || routes.find((r) => r.slug === "cursor")
    || routes.find((r) => r.route_type === "internal")
    || null;
}

export async function ensureConversation(
  sb: SupabaseClient,
  args: {
    conversationId?: string | null;
    tenantId: string;
    userId: string;
    agentId: string | null;
    route: BrainRouteRow;
    title: string;
  },
): Promise<{ id: string; status: ConversationStatus }> {
  if (args.conversationId) {
    const { data } = await sb
      .from("ai_conversations")
      .select("id, status, tenant_id")
      .eq("id", args.conversationId)
      .maybeSingle();
    if (data && data.tenant_id === args.tenantId) {
      await sb
        .from("ai_conversations")
        .update({
          agent_id: args.agentId,
          brain_route_id: args.route.id,
          routing_mode: args.route.route_type,
          updated_at: new Date().toISOString(),
        })
        .eq("id", data.id);
      return { id: data.id, status: (data.status as ConversationStatus) || "idle" };
    }
  }
  const { data, error } = await sb
    .from("ai_conversations")
    .insert({
      user_id: args.userId,
      tenant_id: args.tenantId,
      title: args.title.slice(0, 60),
      messages: [],
      agent_id: args.agentId,
      brain_route_id: args.route.id,
      routing_mode: args.route.route_type,
      status: "idle",
    })
    .select("id, status")
    .single();
  if (error || !data) throw new Error(`Failed to create conversation: ${error?.message || "unknown"}`);
  return { id: data.id, status: "idle" };
}

export async function setConversationStatus(
  sb: SupabaseClient,
  conversationId: string,
  status: ConversationStatus,
  extra?: Record<string, unknown>,
): Promise<void> {
  await sb
    .from("ai_conversations")
    .update({ status, ...(extra || {}), updated_at: new Date().toISOString() })
    .eq("id", conversationId);
}

export async function insertMessage(
  sb: SupabaseClient,
  row: {
    tenant_id: string;
    conversation_id: string;
    role: string;
    speaker?: string | null;
    channel?: string | null;
    content: string;
    event_type?: string;
    external_message_id?: string | null;
    correlation_id?: string | null;
    idempotency_key?: string | null;
    metadata?: Record<string, unknown>;
  },
): Promise<{ row: ConversationMessageRow; duplicate: boolean }> {
  const payload = {
    tenant_id: row.tenant_id,
    conversation_id: row.conversation_id,
    role: row.role,
    speaker: row.speaker ?? null,
    channel: row.channel ?? null,
    content: row.content,
    event_type: row.event_type ?? "message",
    external_message_id: row.external_message_id ?? null,
    correlation_id: row.correlation_id ?? null,
    idempotency_key: row.idempotency_key ?? null,
    metadata: row.metadata ?? {},
  };
  const { data, error } = await sb
    .from("ai_conversation_messages")
    .insert(payload)
    .select("*")
    .single();
  if (error) {
    const code = (error as any).code;
    if (code === "23505" && row.idempotency_key) {
      const { data: existing } = await sb
        .from("ai_conversation_messages")
        .select("*")
        .eq("tenant_id", row.tenant_id)
        .eq("idempotency_key", row.idempotency_key)
        .maybeSingle();
      if (existing) return { row: existing as ConversationMessageRow, duplicate: true };
    }
    throw new Error(`insert message failed: ${error.message}`);
  }
  await appendJsonbMessage(sb, row.conversation_id, {
    role: row.role,
    content: row.content,
    speaker: row.speaker,
    channel: row.channel,
    input_mode: (row.metadata as any)?.input_mode,
    delivery_mode: (row.metadata as any)?.delivery_mode,
  });
  return { row: data as ConversationMessageRow, duplicate: false };
}

async function appendJsonbMessage(
  sb: SupabaseClient,
  conversationId: string,
  msg: Record<string, unknown>,
): Promise<void> {
  const { data } = await sb
    .from("ai_conversations")
    .select("messages")
    .eq("id", conversationId)
    .maybeSingle();
  const current = Array.isArray(data?.messages) ? data!.messages : [];
  await sb
    .from("ai_conversations")
    .update({ messages: [...current, msg], updated_at: new Date().toISOString() })
    .eq("id", conversationId);
}

export async function findMessageByIdempotency(
  sb: SupabaseClient,
  tenantId: string,
  key: string,
): Promise<ConversationMessageRow | null> {
  const { data } = await sb
    .from("ai_conversation_messages")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("idempotency_key", key)
    .maybeSingle();
  return (data as ConversationMessageRow) || null;
}

export async function getRunningSession(
  sb: SupabaseClient,
  conversationId: string,
  provider: ChannelProvider,
): Promise<ChannelSessionRow | null> {
  const { data } = await sb
    .from("agent_channel_sessions")
    .select("*")
    .eq("conversation_id", conversationId)
    .eq("provider", provider)
    .in("status", ["running", "waiting"])
    .order("last_activity_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as ChannelSessionRow) || null;
}

export async function getLatestSession(
  sb: SupabaseClient,
  conversationId: string,
  provider: ChannelProvider,
): Promise<ChannelSessionRow | null> {
  const { data } = await sb
    .from("agent_channel_sessions")
    .select("*")
    .eq("conversation_id", conversationId)
    .eq("provider", provider)
    .order("last_activity_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as ChannelSessionRow) || null;
}

export async function upsertRunningSession(
  sb: SupabaseClient,
  row: {
    tenant_id: string;
    conversation_id: string;
    brain_route_id: string | null;
    provider: ChannelProvider;
    external_session_id?: string | null;
    external_run_id?: string | null;
    external_url?: string | null;
    conversation_key?: string | null;
    status?: string;
    parliament_run_id?: string | null;
    parliament_round?: number | null;
    metadata?: Record<string, unknown>;
  },
): Promise<ChannelSessionRow> {
  const existing = (await getRunningSession(sb, row.conversation_id, row.provider))
    || (await getLatestSession(sb, row.conversation_id, row.provider));
  if (existing) {
    const { data, error } = await sb
      .from("agent_channel_sessions")
      .update({
        brain_route_id: row.brain_route_id,
        external_session_id: row.external_session_id ?? existing.external_session_id,
        external_run_id: row.external_run_id ?? existing.external_run_id,
        external_url: row.external_url ?? existing.external_url,
        conversation_key: row.conversation_key ?? existing.conversation_key,
        status: row.status ?? existing.status,
        parliament_run_id: row.parliament_run_id ?? existing.parliament_run_id,
        parliament_round: row.parliament_round ?? existing.parliament_round,
        metadata: { ...(existing.metadata || {}), ...(row.metadata || {}) },
        last_activity_at: new Date().toISOString(),
      })
      .eq("id", existing.id)
      .select("*")
      .single();
    if (error || !data) throw new Error(`update session failed: ${error?.message}`);
    return data as ChannelSessionRow;
  }
  const { data, error } = await sb
    .from("agent_channel_sessions")
    .insert({
      tenant_id: row.tenant_id,
      conversation_id: row.conversation_id,
      brain_route_id: row.brain_route_id,
      provider: row.provider,
      external_session_id: row.external_session_id ?? null,
      external_run_id: row.external_run_id ?? null,
      external_url: row.external_url ?? null,
      conversation_key: row.conversation_key ?? null,
      status: row.status ?? "running",
      parliament_run_id: row.parliament_run_id ?? null,
      parliament_round: row.parliament_round ?? null,
      metadata: row.metadata ?? {},
      last_activity_at: new Date().toISOString(),
    })
    .select("*")
    .single();
  if (error || !data) throw new Error(`insert session failed: ${error?.message}`);
  return data as ChannelSessionRow;
}

export async function completeSession(
  sb: SupabaseClient,
  sessionId: string,
  status: "completed" | "failed" | "cancelled" = "completed",
): Promise<void> {
  await sb
    .from("agent_channel_sessions")
    .update({ status, last_activity_at: new Date().toISOString() })
    .eq("id", sessionId);
}

export async function loadSession(
  sb: SupabaseClient,
  sessionId: string,
): Promise<ChannelSessionRow | null> {
  const { data } = await sb.from("agent_channel_sessions").select("*").eq("id", sessionId).maybeSingle();
  return (data as ChannelSessionRow) || null;
}

export async function logChannelAction(
  sb: SupabaseClient,
  args: {
    tenantId: string;
    agentId: string | null;
    runId?: string | null;
    action: string;
    details: Record<string, unknown>;
    status?: string;
    error?: string | null;
  },
): Promise<void> {
  try {
    await sb.from("agent_action_log").insert({
      tenant_id: args.tenantId,
      agent_id: args.agentId,
      run_id: args.runId ?? null,
      action_type: args.action,
      action_details: args.details,
      status: args.status ?? "success",
      error_message: args.error ?? null,
    });
  } catch (e) {
    console.error("[agent-channel] action log failed", (e as any)?.message ?? e);
  }
}

export function duplicateSendResult(existing: ConversationMessageRow): SendResult | null {
  const dispatch = (existing.metadata as any)?.dispatch;
  if (!dispatch) return null;
  return dispatch as SendResult;
}
