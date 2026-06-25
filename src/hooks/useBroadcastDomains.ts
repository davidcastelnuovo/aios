import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { useCurrentUser } from "@/hooks/useCurrentUser";

export interface SenderDomain {
  id: string;
  tenant_id: string;
  domain: string;
  from_name: string | null;
  default_local: string;
  is_default: boolean;
  created_at: string;
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
    mutationFn: async (payload: { domain: string; from_name?: string; default_local?: string; is_default?: boolean }) => {
      const domain = payload.domain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
      // First domain becomes default automatically
      const isFirst = (list.data || []).length === 0;
      const makeDefault = payload.is_default || isFirst;
      if (makeDefault) {
        await supabase.from("broadcast_email_domains").update({ is_default: false }).eq("tenant_id", tenantId);
      }
      const { error } = await supabase.from("broadcast_email_domains").insert({
        tenant_id: tenantId, created_by: userId, domain,
        from_name: payload.from_name?.trim() || null,
        default_local: payload.default_local?.trim() || "noreply",
        is_default: makeDefault,
      });
      if (error) throw error;
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

  return { list, add, remove, setDefault };
}
