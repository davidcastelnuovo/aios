import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";

export type ChatProviderKey = "green_api" | "manus_wa" | "telegram" | "manychat";

const PROVIDER_LABEL: Record<ChatProviderKey, string> = {
  green_api: "Green API",
  manus_wa: "Manus",
  telegram: "טלגרם",
  manychat: "ManyChat",
};

export interface ChatConnection {
  id: string;
  integration_type: ChatProviderKey;
  user_id: string | null;
  display_name: string;
  is_own: boolean;
  shared_by_name: string | null;
  /** Maps to chat_messages.provider — kept distinct so Manus vs Green API filter separately */
  active_chat_provider: "green_api" | "manus_wa" | "telegram" | "manychat";
  /** UI grouping bucket */
  platform: "whatsapp" | "telegram" | "manychat";
}

/**
 * Fetches all chat-capable integrations (Manus WA, Green API, Telegram, ManyChat)
 * the current user has access to: own + shared via integration_user_permissions.
 */
export function useChatConnections(tenantId: string | undefined) {
  const { userId } = useCurrentUser();

  return useQuery({
    queryKey: ["chat-connections", tenantId, userId],
    enabled: !!tenantId && !!userId,
    queryFn: async (): Promise<ChatConnection[]> => {
      if (!tenantId || !userId) return [];

      const TYPES: ChatProviderKey[] = ["green_api", "manus_wa", "telegram", "manychat"];

      // Own integrations
      const { data: own, error: ownErr } = await supabase
        .from("tenant_integrations")
        .select("id, integration_type, user_id, display_name, instance_id, api_token_last_4, is_active")
        .eq("tenant_id", tenantId)
        .in("integration_type", TYPES)
        .eq("is_active", true)
        .eq("user_id", userId);
      if (ownErr) throw ownErr;

      // Shared via permissions
      const { data: perms } = await supabase
        .from("integration_user_permissions")
        .select("integration_id")
        .eq("user_id", userId);
      const sharedIds = (perms || []).map((p) => p.integration_id);

      let shared: any[] = [];
      if (sharedIds.length > 0) {
        const { data, error } = await supabase
          .from("tenant_integrations")
          .select("id, integration_type, user_id, display_name, instance_id, api_token_last_4, is_active")
          .eq("tenant_id", tenantId)
          .in("integration_type", TYPES)
          .eq("is_active", true)
          .in("id", sharedIds);
        if (error) throw error;
        shared = data || [];
      }

      // Tenant-scoped (no user_id) — e.g. ManyChat / Telegram historically
      const { data: tenantScoped } = await supabase
        .from("tenant_integrations")
        .select("id, integration_type, user_id, display_name, instance_id, api_token_last_4, is_active")
        .eq("tenant_id", tenantId)
        .in("integration_type", TYPES)
        .eq("is_active", true)
        .is("user_id", null);

      const ownIds = new Set((own || []).map((i: any) => i.id));
      const combinedRaw = [
        ...(own || []),
        ...shared.filter((i) => !ownIds.has(i.id)),
        ...(tenantScoped || []).filter((i) => !ownIds.has(i.id) && !shared.find((s) => s.id === i.id)),
      ];

      // Resolve owner names for shared ones
      const ownerIds = combinedRaw
        .map((i) => i.user_id)
        .filter((id): id is string => !!id && id !== userId);
      let ownerProfiles: Record<string, string> = {};
      if (ownerIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", ownerIds);
        ownerProfiles = Object.fromEntries((profiles || []).map((p: any) => [p.id, p.full_name || ""]));
      }

      return combinedRaw.map((i: any): ChatConnection => {
        const type = i.integration_type as ChatProviderKey;
        const isOwn = i.user_id === userId;
        const baseLabel = PROVIDER_LABEL[type];
        const customName = (i.display_name && String(i.display_name).trim()) || null;
        const fallbackTail = i.api_token_last_4 ? `··${i.api_token_last_4}` : (i.instance_id ? `··${String(i.instance_id).slice(-4)}` : "");
        const display_name = customName
          ? `${baseLabel} · ${customName}`
          : fallbackTail
            ? `${baseLabel} ${fallbackTail}`
            : baseLabel;

        const active_chat_provider: ChatConnection["active_chat_provider"] =
          type === "manus_wa" ? "manus_wa" : type === "green_api" ? "green_api" : (type as any);
        const platform: ChatConnection["platform"] =
          type === "telegram" ? "telegram" : type === "manychat" ? "manychat" : "whatsapp";

        return {
          id: i.id,
          integration_type: type,
          user_id: i.user_id,
          display_name,
          is_own: isOwn,
          shared_by_name: !isOwn && i.user_id ? (ownerProfiles[i.user_id] || null) : null,
          active_chat_provider,
          platform,
        };
      });
    },
  });
}
