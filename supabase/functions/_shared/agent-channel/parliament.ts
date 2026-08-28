import { aiChat } from "../ai.ts";
import type { ChannelProvider, CloudDirectProvider, SendContext, SendResult } from "./types.ts";
import {
  acceptedMessageFor,
  buildReviewPrompt,
  buildSynthesisPrompt,
  canAdvanceToReview,
  canSynthesize,
  capabilitiesForProvider,
  isCloudDirect,
  livingSeats,
  markParliamentFailed,
  parliamentRounds,
  parliamentSeatsFromConfig,
  recordParliamentAnswer,
  type ParliamentState,
} from "./logic.ts";
import { wrapDirectPrompt } from "./prompts.ts";
import {
  completeSession,
  insertMessage,
  logChannelAction,
  serviceClient,
  setConversationStatus,
} from "./store.ts";
import { launchParliamentSeat } from "./direct.ts";

function stateFromRun(run: { context?: unknown }): ParliamentState | null {
  const ctx = (run.context && typeof run.context === "object" ? run.context : {}) as Record<string, unknown>;
  const raw = ctx.parliament as ParliamentState | undefined;
  if (!raw || typeof raw !== "object") return null;
  if (!raw.seats || !raw.status) return null;
  return raw;
}

function withParliament(context: unknown, state: ParliamentState): Record<string, unknown> {
  const ctx = (context && typeof context === "object" ? context : {}) as Record<string, unknown>;
  return { ...ctx, parliament: state };
}

export async function startParliament(ctx: SendContext): Promise<SendResult> {
  const sb = serviceClient();
  const seats = parliamentSeatsFromConfig(ctx.route.config).filter(isCloudDirect);
  const maxRounds = parliamentRounds(ctx.route.config);
  const state: ParliamentState = {
    round: 1,
    max_rounds: maxRounds,
    seats: Object.fromEntries(seats.map((p) => [p, { provider: p }])),
    status: "round1",
    topic: ctx.content,
    tools: "read_only",
  };

  const { data: parent, error } = await sb
    .from("agent_runs")
    .insert({
      tenant_id: ctx.tenantId,
      agent_id: ctx.agentId,
      user_id: ctx.userId,
      goal: `Parliament: ${ctx.content.slice(0, 200)}`,
      context: { conversation_id: ctx.conversationId, brain_route_id: ctx.route.id, parliament: state },
      status: "running",
      trigger_source: "parliament",
      conversation_id: ctx.conversationId,
    })
    .select("id, context")
    .single();
  if (error || !parent) throw new Error(`Failed to create parliament run: ${error?.message || "unknown"}`);

  await setConversationStatus(sb, ctx.conversationId, "debating");
  await insertMessage(sb, {
    tenant_id: ctx.tenantId,
    conversation_id: ctx.conversationId,
    role: "system",
    speaker: "carmen",
    channel: "parliament",
    content: `פרלמנט נפתח — סבב 1 מתוך ${maxRounds}. משתתפים: ${seats.join(", ")}. כלים: קריאה בלבד עד הסיכום.`,
    event_type: "progress",
    correlation_id: parent.id,
    metadata: { parliament_run_id: parent.id, round: 1 },
  });

  const round1 = wrapDirectPrompt({ origin: "parliament", userText: ctx.content, history: ctx.history }) +
    `\nYou are a parliament member. Round 1 of ${maxRounds}: answer independently. You cannot see other seats. Read-only.`;

  const results = await Promise.allSettled(
    seats.map((provider) =>
      launchParliamentSeat(ctx, provider, round1, { runId: parent.id, round: 1 }),
    ),
  );

  let nextState: ParliamentState = { ...state, seats: { ...state.seats } };
  results.forEach((r, i) => {
    const provider = seats[i];
    if (r.status === "fulfilled") {
      nextState.seats[provider] = { ...nextState.seats[provider], sessionId: r.value.session_id, provider };
    } else {
      nextState = markParliamentFailed(nextState, provider, String((r as PromiseRejectedResult).reason?.message || r.reason));
    }
  });
  await sb.from("agent_runs").update({ context: withParliament(parent.context, nextState) }).eq("id", parent.id);

  const living = livingSeats(nextState);
  if (!living.length) {
    await setConversationStatus(sb, ctx.conversationId, "error");
    await sb.from("agent_runs").update({ status: "failed", error_message: "all seats failed to start" }).eq("id", parent.id);
    throw new Error("Parliament could not start — all seats failed to launch.");
  }

  await logChannelAction(sb, {
    tenantId: ctx.tenantId,
    agentId: ctx.agentId,
    runId: parent.id,
    action: "parliament_start",
    details: { conversation_id: ctx.conversationId, seats, living: living.map((s) => s.provider) },
  });

  const url = results.find((r): r is PromiseFulfilledResult<SendResult> => r.status === "fulfilled")?.value.external_url;
  return {
    ok: true,
    kind: "parliament",
    conversation_id: ctx.conversationId,
    run_id: parent.id,
    status: "debating",
    stream: false,
    accepted_message: acceptedMessageFor("parliament", url),
    external_url: url,
    capabilities: capabilitiesForProvider("parliament"),
  };
}

export async function onParliamentCallback(args: {
  tenantId: string;
  conversationId: string;
  origin: ChannelProvider;
  content: string;
  parliamentRunId?: string | null;
  round?: number | null;
}): Promise<void> {
  const sb = serviceClient();
  let runId = args.parliamentRunId || "";
  if (!runId) {
    const { data } = await sb
      .from("agent_runs")
      .select("id")
      .eq("conversation_id", args.conversationId)
      .eq("trigger_source", "parliament")
      .eq("status", "running")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    runId = data?.id || "";
  }
  if (!runId) return;

  const { data: run } = await sb.from("agent_runs").select("*").eq("id", runId).maybeSingle();
  if (!run) return;
  let state = stateFromRun(run);
  if (!state) return;

  const round = args.round || state.round;
  state = recordParliamentAnswer(state, args.origin, args.content, round);
  await sb.from("agent_runs").update({ context: withParliament(run.context, state) }).eq("id", runId);

  if (canAdvanceToReview(state) && state.max_rounds >= 2 && state.status === "round1") {
    state = { ...state, round: 2, status: "round2" };
    await sb.from("agent_runs").update({ context: withParliament(run.context, state) }).eq("id", runId);
    await insertMessage(sb, {
      tenant_id: args.tenantId,
      conversation_id: args.conversationId,
      role: "system",
      speaker: "carmen",
      channel: "parliament",
      content: "סבב ביקורת — כל מושב מקבל את תשובות האחרים.",
      event_type: "progress",
      correlation_id: runId,
    });
    const ctx = await rebuildCtx(run, args.conversationId, state);
    const launches = livingSeats(state)
      .filter((s) => isCloudDirect(s.provider))
      .map((s) =>
        launchParliamentSeat(
          ctx,
          s.provider as CloudDirectProvider,
          buildReviewPrompt(state, s.provider),
          { runId, round: 2 },
        ).catch(async (err) => {
          const failed = markParliamentFailed(state, s.provider, String(err?.message || err));
          await sb.from("agent_runs").update({ context: withParliament(run.context, failed) }).eq("id", runId);
        }),
      );
    await Promise.allSettled(launches);
    return;
  }

  if (canSynthesize(state) && state.status !== "synthesizing" && state.status !== "done") {
    await synthesizeParliament(runId, args.tenantId, args.conversationId, { ...state, status: "synthesizing" }, run.context);
  }
}

async function rebuildCtx(run: any, conversationId: string, state: ParliamentState): Promise<SendContext> {
  const sb = serviceClient();
  const { data: conv } = await sb.from("ai_conversations").select("brain_route_id").eq("id", conversationId).maybeSingle();
  const { data: route } = await sb.from("agent_brain_routes").select("*").eq("id", conv?.brain_route_id).maybeSingle();
  return {
    tenantId: run.tenant_id,
    userId: run.user_id || "system",
    agentId: run.agent_id,
    conversationId,
    route: route || {
      id: conv?.brain_route_id,
      tenant_id: run.tenant_id,
      agent_id: run.agent_id,
      slug: "parliament",
      label: "פרלמנט",
      route_type: "parliament",
      provider: "parliament",
      connection_id: null,
      config: { seats: ["cursor", "grok", "codex"], rounds: 2 },
      active: true,
    },
    content: state.topic || run.goal,
    inputMode: "typed",
    idempotencyKey: crypto.randomUUID(),
    history: [],
  };
}

async function synthesizeParliament(
  runId: string,
  tenantId: string,
  conversationId: string,
  state: ParliamentState,
  context: unknown,
): Promise<void> {
  const sb = serviceClient();
  await sb.from("agent_runs").update({ context: withParliament(context, state), status: "running" }).eq("id", runId);
  const prompt = buildSynthesisPrompt(state);
  const synthesis = (await aiChat(prompt)) || fallbackSynthesis(state);
  await insertMessage(sb, {
    tenant_id: tenantId,
    conversation_id: conversationId,
    role: "assistant",
    speaker: "carmen",
    channel: "parliament",
    content: synthesis,
    event_type: "message",
    correlation_id: runId,
    metadata: { parliament: true, origin: "parliament" },
  });
  await setConversationStatus(sb, conversationId, "idle");
  await sb
    .from("agent_runs")
    .update({
      status: "completed",
      final_answer: synthesis,
      context: withParliament(context, { ...state, status: "done" }),
      completed_at: new Date().toISOString(),
    })
    .eq("id", runId);

  const { data: sessions } = await sb
    .from("agent_channel_sessions")
    .select("id")
    .eq("parliament_run_id", runId)
    .in("status", ["running", "waiting"]);
  for (const s of sessions || []) await completeSession(sb, s.id, "completed");

  await logChannelAction(sb, {
    tenantId,
    agentId: null,
    runId,
    action: "parliament_synthesize",
    details: { conversation_id: conversationId },
  });
}

function fallbackSynthesis(state: ParliamentState): string {
  const living = livingSeats(state);
  const parts = living.map((s) => `**${s.provider}:** ${(s.round2 || s.round1 || "").slice(0, 1200)}`).join("\n\n");
  return (
    `סיכום פרלמנט (סינתזה חלקית — מודל הסיכום לא היה זמין):\n\n` +
    `1. מה מוסכם: ראו את התשובות למטה.\n` +
    `2. מה שנוי במחלוקת: לא הושווה אוטומטית.\n` +
    `3. ההמלצה: לדון ידנית אם יש פער מהותי.\n` +
    `4. פעולות המשך: כל כתיבה חיצונית דורשת אישור נפרד.\n\n` +
    parts
  );
}

export async function cancelParliament(conversationId: string): Promise<void> {
  const loaded = await loadRunningParliament(conversationId);
  if (!loaded.run) {
    await setConversationStatus(serviceClient(), conversationId, "idle");
    return;
  }
  const { sb, run, state } = loaded;
  await sb
    .from("agent_runs")
    .update({
      status: "cancelled",
      context: state ? withParliament(run.context, { ...state, status: "cancelled" }) : run.context,
      completed_at: new Date().toISOString(),
    })
    .eq("id", run.id);
  const { data: sessions } = await sb
    .from("agent_channel_sessions")
    .select("id")
    .eq("parliament_run_id", run.id)
    .in("status", ["running", "waiting"]);
  for (const s of sessions || []) await completeSession(sb, s.id, "cancelled");
  await setConversationStatus(sb, conversationId, "idle");
  await insertMessage(sb, {
    tenant_id: run.tenant_id,
    conversation_id: conversationId,
    role: "system",
    speaker: "carmen",
    channel: "parliament",
    content: "הפרלמנט נעצר.",
    event_type: "system",
    correlation_id: run.id,
  });
}

async function loadRunningParliament(conversationId: string): Promise<{
  sb: ReturnType<typeof serviceClient>;
  run: any | null;
  state: ParliamentState | null;
}> {
  const sb = serviceClient();
  const { data: run } = await sb
    .from("agent_runs")
    .select("*")
    .eq("conversation_id", conversationId)
    .eq("trigger_source", "parliament")
    .eq("status", "running")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return { sb, run: run || null, state: run ? stateFromRun(run) : null };
}

function skipSilentSeats(state: ParliamentState): ParliamentState {
  let next = state;
  for (const seat of Object.values(state.seats)) {
    const hasAnswer = state.round >= 2 ? !!(seat.round2 || seat.round1) : !!seat.round1;
    if (!hasAnswer && !seat.failed) {
      next = markParliamentFailed(next, seat.provider, "skipped — no answer in time");
    }
  }
  return next;
}

/** Skip silent seats and start round 2, or synthesize if already in review. */
export async function forceContinueParliament(conversationId: string): Promise<{ ok: true; status: string }> {
  const loaded = await loadRunningParliament(conversationId);
  if (!loaded.run || !loaded.state) throw new Error("no running parliament");
  const { sb, run } = loaded;
  let state = skipSilentSeats(loaded.state);
  await sb.from("agent_runs").update({ context: withParliament(run.context, state) }).eq("id", run.id);

  const living = livingSeats(state);
  if (state.status === "round1" && state.max_rounds >= 2 && living.some((s) => s.round1)) {
    state = { ...state, round: 2, status: "round2" };
    await sb.from("agent_runs").update({ context: withParliament(run.context, state) }).eq("id", run.id);
    await insertMessage(sb, {
      tenant_id: run.tenant_id,
      conversation_id: conversationId,
      role: "system",
      speaker: "carmen",
      channel: "parliament",
      content: "סבב ביקורת — כל מושב מקבל את תשובות האחרים.",
      event_type: "progress",
      correlation_id: run.id,
    });
    const ctx = await rebuildCtx(run, conversationId, state);
    await Promise.allSettled(
      living
        .filter((s) => isCloudDirect(s.provider))
        .map((s) =>
          launchParliamentSeat(ctx, s.provider as CloudDirectProvider, buildReviewPrompt(state, s.provider), {
            runId: run.id,
            round: 2,
          }),
        ),
    );
    return { ok: true, status: "debating" };
  }

  await synthesizeParliament(run.id, run.tenant_id, conversationId, { ...state, status: "synthesizing" }, run.context);
  return { ok: true, status: "idle" };
}

export async function forceSynthesizeParliament(conversationId: string): Promise<{ ok: true; status: string }> {
  const loaded = await loadRunningParliament(conversationId);
  if (!loaded.run || !loaded.state) throw new Error("no running parliament");
  const { run, state } = loaded;
  const skipped = skipSilentSeats(state);
  await synthesizeParliament(run.id, run.tenant_id, conversationId, { ...skipped, status: "synthesizing" }, run.context);
  return { ok: true, status: "idle" };
}

export async function clarifyParliamentSeat(
  conversationId: string,
  provider: CloudDirectProvider,
  question: string,
): Promise<{ ok: true; status: string }> {
  const loaded = await loadRunningParliament(conversationId);
  if (!loaded.run || !loaded.state) throw new Error("no running parliament");
  const { run, state } = loaded;
  const ctx = await rebuildCtx(run, conversationId, state);
  const prompt =
    `PARLIAMENT CLARIFICATION from Carmen (chair).\n` +
    `Topic:\n${state.topic}\n\n` +
    `David / Carmen asks:\n${question}\n\n` +
    `Answer this clarification only. Read-only. Do not start another parliament.`;
  await launchParliamentSeat(ctx, provider, prompt, { runId: run.id, round: state.round });
  await insertMessage(serviceClient(), {
    tenant_id: run.tenant_id,
    conversation_id: conversationId,
    role: "system",
    speaker: "carmen",
    channel: "parliament",
    content: `בקשת הבהרה מ-${provider}: ${question}`,
    event_type: "progress",
    correlation_id: run.id,
  });
  return { ok: true, status: "debating" };
}
