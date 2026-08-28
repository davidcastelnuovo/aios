import type { ChannelProvider, SendContext, SendResult } from "./types.ts";
import { acceptedMessageFor, capabilitiesForProvider, statusForKind } from "./logic.ts";
import { launchChatgpt, launchClaude, launchCloudDirect } from "./direct.ts";
import { startParliament } from "./parliament.ts";

export async function dispatchSend(ctx: SendContext): Promise<SendResult> {
  const kind: ChannelProvider =
    ctx.route.route_type === "parliament"
      ? "parliament"
      : ((ctx.route.provider || ctx.route.slug || "internal") as ChannelProvider);

  if (kind === "internal") {
    return {
      ok: true,
      kind: "internal",
      conversation_id: ctx.conversationId,
      status: statusForKind("internal"),
      stream: true,
      accepted_message: acceptedMessageFor("internal"),
      capabilities: capabilitiesForProvider("internal"),
    };
  }

  if (kind === "cursor" || kind === "grok") return launchCloudDirect(ctx, kind);
  if (kind === "claude") return launchClaude(ctx);
  if (kind === "chatgpt") return launchChatgpt(ctx);
  if (kind === "parliament") return startParliament(ctx);
  throw new Error(`Unknown brain route: ${kind}`);
}
