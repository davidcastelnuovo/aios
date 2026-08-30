import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  FALLBACK_BRAIN_ROUTES,
  channelHealthBanner,
  initialSelectedRoute,
  isInputLocked,
  pickDefaultRoute,
  sendPathForRoute,
  storageKeyForRoute,
  type BrainRoute,
  type ChannelHealth,
  type ConversationChannelStatus,
} from "@/lib/agentChannelRouting";

export type ChannelSendResult = {
  ok: boolean;
  kind: string;
  conversation_id: string;
  session_id?: string;
  run_id?: string;
  status: ConversationChannelStatus;
  stream: boolean;
  accepted_message: string;
  external_url?: string | null;
  duplicate?: boolean;
  error?: string;
};

const FN = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/agent-channel-send`;

async function authHeader(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("לא מחוברת");
  return { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` };
}

export function useBrainChannel(tenantId: string | null) {
  const [routes, setRoutes] = useState<BrainRoute[]>(FALLBACK_BRAIN_ROUTES);
  const [selected, setSelected] = useState<BrainRoute>(() => initialSelectedRoute());
  const [status, setStatus] = useState<ConversationChannelStatus>("idle");
  const [externalUrl, setExternalUrl] = useState<string | null>(null);
  const [channelHealth, setChannelHealth] = useState<ChannelHealth | null>(null);
  const selectedRef = useRef(selected);
  selectedRef.current = selected;

  useEffect(() => {
    if (!tenantId) return;
    (async () => {
      try {
        const headers = await authHeader();
        const res = await fetch(FN, {
          method: "POST",
          headers,
          body: JSON.stringify({ action: "list_routes", tenant_id: tenantId }),
        });
        if (!res.ok) throw new Error(String(res.status));
        const json = await res.json();
        const list = Array.isArray(json.routes) && json.routes.length ? json.routes as BrainRoute[] : FALLBACK_BRAIN_ROUTES;
        setRoutes(list);
        setSelected((prev) => list.find((r) => r.slug === prev.slug) || pickDefaultRoute(list));
      } catch {
        setSelected((prev) => pickDefaultRoute(FALLBACK_BRAIN_ROUTES, prev.slug));
      }
      try {
        const headers = await authHeader();
        const res = await fetch(FN, {
          method: "POST",
          headers,
          body: JSON.stringify({ action: "channel_health", tenant_id: tenantId }),
        });
        if (!res.ok) return;
        const json = await res.json();
        if (json && typeof json.ok === "boolean") setChannelHealth(json as ChannelHealth);
      } catch { /* health is advisory */ }
    })();
  }, [tenantId]);

  const selectRoute = useCallback(async (route: BrainRoute, conversationId?: string | null) => {
    selectedRef.current = route;
    setSelected(route);
    setStatus("idle");
    if (tenantId) localStorage.setItem(storageKeyForRoute(tenantId), route.slug);
    if (!tenantId) return;
    try {
      const headers = await authHeader();
      await fetch(FN, {
        method: "POST",
        headers,
        body: JSON.stringify({
          action: "select_route",
          tenant_id: tenantId,
          brain_route_id: route.id,
          brain_slug: route.slug,
          conversation_id: conversationId || undefined,
        }),
      });
    } catch { /* selection is local-first */ }
  }, [tenantId]);

  const send = useCallback(async (args: {
    content: string;
    conversationId: string | null;
    inputMode: string;
    history: Array<{ role: string; content: string }>;
    idempotencyKey: string;
    route?: BrainRoute;
  }): Promise<ChannelSendResult> => {
    if (!tenantId) throw new Error("missing tenant");
    const route = args.route || selectedRef.current;
    const headers = await authHeader();
    const res = await fetch(FN, {
      method: "POST",
      headers,
      body: JSON.stringify({
        action: "send",
        tenant_id: tenantId,
        content: args.content,
        conversation_id: args.conversationId,
        brain_route_id: route.id,
        brain_slug: route.slug,
        input_mode: args.inputMode,
        conversation_history: args.history,
        idempotency_key: args.idempotencyKey,
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (sendPathForRoute(route) === "internal_stream" && (res.status === 404 || res.status === 500)) {
        return {
          ok: true,
          kind: "internal",
          conversation_id: args.conversationId || "",
          status: "streaming",
          stream: true,
          accepted_message: "",
        };
      }
      throw new Error(json.error || "שגיאה בשליחה לערוץ");
    }
    const result = json as ChannelSendResult;
    setStatus(result.status);
    setExternalUrl(result.external_url || null);
    return result;
  }, [tenantId]);

  const persistAssistant = useCallback(async (conversationId: string, content: string, idempotencyKey: string) => {
    if (!tenantId || !conversationId || !content) return;
    try {
      const headers = await authHeader();
      await fetch(FN, {
        method: "POST",
        headers,
        body: JSON.stringify({
          action: "persist_assistant",
          tenant_id: tenantId,
          conversation_id: conversationId,
          content,
          idempotency_key: idempotencyKey,
        }),
      });
      setStatus("idle");
    } catch { /* best-effort */ }
  }, [tenantId]);

  const cancelParliament = useCallback(async (conversationId: string | null) => {
    if (!tenantId || !conversationId) return;
    const headers = await authHeader();
    await fetch(FN, {
      method: "POST",
      headers,
      body: JSON.stringify({ action: "cancel_parliament", tenant_id: tenantId, conversation_id: conversationId }),
    });
    setStatus("idle");
  }, [tenantId]);

  const parliamentAction = useCallback(async (
    action: "parliament_continue" | "parliament_synthesize" | "parliament_clarify",
    conversationId: string | null,
    extra?: Record<string, string>,
  ) => {
    if (!tenantId || !conversationId) return;
    const headers = await authHeader();
    const res = await fetch(FN, {
      method: "POST",
      headers,
      body: JSON.stringify({ action, tenant_id: tenantId, conversation_id: conversationId, ...(extra || {}) }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || "פעולת פרלמנט נכשלה");
    if (json.status) setStatus(json.status);
    return json;
  }, [tenantId]);

  return {
    routes,
    selected,
    selectRoute,
    status,
    setStatus,
    externalUrl,
    setExternalUrl,
    locked: isInputLocked(status) && sendPathForRoute(selected) !== "internal_stream",
    send,
    persistAssistant,
    cancelParliament,
    parliamentAction,
    sendPath: sendPathForRoute(selected),
    channelHealth,
    healthBanner: channelHealthBanner(channelHealth),
  };
}

export type BrainChannel = ReturnType<typeof useBrainChannel>;
