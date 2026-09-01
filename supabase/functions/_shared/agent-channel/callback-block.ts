import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import { extractConversationId } from "./logic.ts";
import { mintCallbackToken } from "./hmac.ts";
import { buildCallbackInstructions } from "./prompts.ts";
import { resolveCallbackSessionForTenant } from "./store.ts";
import type { ChannelProvider } from "./types.ts";

/** Append AIOS callback instructions when a Command Center session exists for this tenant. */
export async function buildAiosCallbackBlock(
  sb: SupabaseClient,
  args: {
    tenantId: string;
    conversationIdHint?: string | null;
    messageHint?: string;
    contextHint?: string;
    origin?: ChannelProvider;
  },
): Promise<string> {
  const conversationId =
    String(args.conversationIdHint || "").trim() ||
    extractConversationId(args.contextHint || "") ||
    extractConversationId(args.messageHint || "") ||
    "";
  const channelSession = await resolveCallbackSessionForTenant(sb, args.tenantId, conversationId || null);
  if (!channelSession) return "";
  const token = await mintCallbackToken({
    sessionId: channelSession.id,
    conversationId: channelSession.conversation_id,
    tenantId: args.tenantId,
  });
  return buildCallbackInstructions({
    origin: args.origin || (channelSession.provider as ChannelProvider) || "cursor",
    conversationId: channelSession.conversation_id,
    sessionId: channelSession.id,
    tenantId: args.tenantId,
    token,
  });
}
