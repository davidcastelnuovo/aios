// WhatsApp → direct channel (Claude / Cursor) without Carmen's brain.
// "קלוד ..." / "קרסר ..." from the tenant owner's own phone in a private chat
// goes straight to the agent; the agent's callback reply is sent back to WhatsApp.
import { launchClaude, launchCloudDirect } from "./direct.ts";
import {
  ensureDefaultRoutes,
  insertMessage,
  loadRoute,
  resolveCarmenAgent,
  serviceClient,
  setConversationStatus,
} from "./store.ts";
import type { SendContext } from "./types.ts";
import {
  isOwnerSender,
  LABEL,
  parseWhatsAppDirectCommand,
  whatsAppReplyText,
  type WhatsAppDirectProvider,
  type WhatsAppReplyTarget,
} from "./whatsapp-direct-logic.ts";

export { parseWhatsAppDirectCommand } from "./whatsapp-direct-logic.ts";

export async function routeWhatsAppDirect(args: {
  tenantId: string;
  integrationId: string;
  connectionUserId: string;
  senderPhone: string;
  messageText: string;
}): Promise<
  | { handled: false }
  | { handled: true; provider: WhatsAppDirectProvider; ack: string }
> {
  const command = parseWhatsAppDirectCommand(args.messageText);
  if (!command || !args.connectionUserId) return { handled: false };

  const sb = serviceClient();
  const [{ data: profile }, { data: memberships }] = await Promise.all([
    sb
      .from("profiles")
      .select("phone, campaigner_id")
      .eq("id", args.connectionUserId)
      .maybeSingle(),
    sb
      .from("tenant_users")
      .select("role")
      .eq("tenant_id", args.tenantId)
      .eq("user_id", args.connectionUserId),
  ]);
  const { data: campaigner } = profile?.campaigner_id
    ? await sb
        .from("campaigners")
        .select("phone")
        .eq("id", profile.campaigner_id)
        .maybeSingle()
    : { data: null };
  const roles = (memberships || []).map((row: any) => String(row.role));
  const ownerPhones = [profile?.phone, campaigner?.phone];
  if (!isOwnerSender({ senderPhone: args.senderPhone, ownerPhones, roles })) {
    return { handled: false };
  }

  const carmen = await resolveCarmenAgent(sb, args.tenantId);
  if (!carmen) return { handled: false };
  await ensureDefaultRoutes(sb, args.tenantId, carmen.id);
  const route = await loadRoute(sb, args.tenantId, { slug: command.provider });
  if (!route) return { handled: false };

  const title = `WhatsApp · ${route.label}`;
  const { data: existing } = await sb
    .from("ai_conversations")
    .select("id")
    .eq("tenant_id", args.tenantId)
    .eq("user_id", args.connectionUserId)
    .eq("brain_route_id", route.id)
    .eq("title", title)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  let conversationId = existing?.id as string | undefined;
  if (!conversationId) {
    const { data, error } = await sb
      .from("ai_conversations")
      .insert({
        user_id: args.connectionUserId,
        tenant_id: args.tenantId,
        title,
        messages: [],
        agent_id: carmen.id,
        brain_route_id: route.id,
        routing_mode: route.route_type,
        status: "idle",
      })
      .select("id")
      .single();
    if (error || !data)
      throw new Error(
        `Failed to create WhatsApp conversation: ${error?.message || "unknown"}`,
      );
    conversationId = data.id;
  }

  const { data: recent } = await sb
    .from("ai_conversation_messages")
    .select("role, content")
    .eq("conversation_id", conversationId)
    .eq("event_type", "message")
    .order("created_at", { ascending: false })
    .limit(10);
  const history = (recent || []).reverse().map((row: any) => ({
    role: String(row.role),
    content: String(row.content),
  }));

  const idempotencyKey = crypto.randomUUID();
  const replyTarget: WhatsAppReplyTarget = {
    integration_id: args.integrationId,
    phone_number: args.senderPhone,
    connection_user_id: args.connectionUserId,
  };
  await insertMessage(sb, {
    tenant_id: args.tenantId,
    conversation_id: conversationId!,
    role: "user",
    speaker: "user",
    channel: command.provider,
    content: command.content,
    idempotency_key: idempotencyKey,
    metadata: { input_mode: "typed", origin_surface: "whatsapp" },
  });

  const ctx: SendContext = {
    tenantId: args.tenantId,
    userId: args.connectionUserId,
    agentId: carmen.id,
    conversationId: conversationId!,
    route,
    content: command.content,
    inputMode: "typed",
    idempotencyKey,
    history,
  };
  const sessionMetadata = { reply_whatsapp: replyTarget };
  const label = LABEL[command.provider];
  try {
    const result =
      command.provider === "claude"
        ? await launchClaude(ctx, undefined, { sessionMetadata })
        : await launchCloudDirect(ctx, "cursor", undefined, undefined, {
            sessionMetadata,
          });
    await setConversationStatus(sb, conversationId!, result.status);
  } catch (e) {
    await setConversationStatus(sb, conversationId!, "error");
    const reason = String((e as Error)?.message ?? e).slice(0, 300);
    return {
      handled: true,
      provider: command.provider,
      ack: `לא הצלחתי לשלוח ל-${label}: ${reason}`,
    };
  }

  return {
    handled: true,
    provider: command.provider,
    ack: `נשלח ל-${label} ✅ התשובה תגיע לכאן.`,
  };
}

/** Send an agent's callback reply back to the WhatsApp chat that asked for it. null = not a WhatsApp session. */
export async function deliverWhatsAppReply(
  sessionMetadata: unknown,
  tenantId: string,
  provider: string,
  content: string,
): Promise<boolean | null> {
  const target = (sessionMetadata as any)?.reply_whatsapp as
    WhatsAppReplyTarget | undefined;
  if (
    !target?.integration_id ||
    !target.phone_number ||
    !target.connection_user_id
  )
    return null;
  const res = await fetch(
    `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-manus-wa-message`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""}`,
      },
      body: JSON.stringify({
        integrationId: target.integration_id,
        tenantId,
        phoneNumber: target.phone_number,
        senderUserId: target.connection_user_id,
        message: whatsAppReplyText(provider, content),
      }),
    },
  );
  return res.ok;
}
