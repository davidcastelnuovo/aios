import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { normalizeSenderEmailParts, formatSenderEmail } from "@/lib/senderEmailDomain";

export interface SenderDomain {
  id: string;
  tenant_id: string;
  domain: string;
  from_name: string | null;
  default_local: string;
  is_default: boolean;
  created_at: string;
}

type SenderDomainPayload = {
  domain: string;
  from_name?: string;
  default_local?: string;
  is_default?: boolean;
};

function normalizePayload(payload: SenderDomainPayload) {
  const normalized = normalizeSenderEmailParts(
    payload.default_local || "noreply",
    payload.domain,
  );
  return {
    domain: normalized.domain,
    default_local: normalized.default_local,
    from_name: payload.from_name?.trim() || null,
    wasSwapped: normalized.wasSwapped,
  };
}

/** Per-tenant Resend-verified sending domains for the broadcast module. */
export function useBroadcastDomains() {
  const { tenantId } = useCurrentTenant();
  const { userId } = useCurrentUser();
  const qc = useQueryClient();
  const key = ["broadcast-email-domains", tenantId];

  const list = useQuery({
    queryKey: key,
    enabled: !!tenantId,
    queryFn: async (): Promise<SenderDomain[]> => {
      const { data, error } = await supabase
        .from("broadcast_email_domains").select("*").eq("tenant_id", tenantId)
        .order("is_default", { ascending: false }).order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as SenderDomain[];
    },
  });

  const add = useMutation({
    mutationFn: async (payload: SenderDomainPayload) => {
      const { domain, default_local, from_name, wasSwapped } = normalizePayload(payload);
      if (!domain) throw new Error("missing_domain");
      const isFirst = (list.data || []).length === 0;
      const makeDefault = payload.is_default || isFirst;
      if (makeDefault) {
        await supabase.from("broadcast_email_domains").update({ is_default: false }).eq("tenant_id", tenantId);
      }
      const { error } = await supabase.from("broadcast_email_domains").insert({
        tenant_id: tenantId,
        created_by: userId,
        domain,
        from_name,
        default_local,
        is_default: makeDefault,
      });
      if (error) throw error;
      return { wasSwapped, email: formatSenderEmail(default_local, domain) };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...payload }: SenderDomainPayload & { id: string }) => {
      const { domain, default_local, from_name, wasSwapped } = normalizePayload(payload);
      if (!domain) throw new Error("missing_domain");
      const { error } = await supabase
        .from("broadcast_email_domains")
        .update({ domain, default_local, from_name })
        .eq("id", id)
        .eq("tenant_id", tenantId);
      if (error) throw error;
      return { wasSwapped, email: formatSenderEmail(default_local, domain) };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("broadcast_email_domains").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const setDefault = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("broadcast_email_domains").update({ is_default: false }).eq("tenant_id", tenantId);
      const { error } = await supabase.from("broadcast_email_domains").update({ is_default: true }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  return { list, add, update, remove, setDefault };
}
