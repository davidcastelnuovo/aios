import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { useCurrentUser } from "@/hooks/useCurrentUser";

export type BroadcastStatus =
  | "draft" | "scheduled" | "sending" | "sent" | "paused" | "failed" | "canceled";

export interface AudienceFilter {
  source: "clients" | "leads" | "campaigners" | "list" | "wa_groups";
  statuses?: string[];       // clients
  serviceTags?: string[];    // clients
  statusKeys?: string[];     // leads
  salesPersonIds?: string[]; // leads
  tagIds?: string[];         // clients/leads
  roles?: string[];          // campaigners
  activeOnly?: boolean;      // campaigners
  listId?: string;           // source = list
  groupIds?: string[];       // source = wa_groups (whatsapp_groups UUIDs)
  includeIds?: string[];     // manual selection within a source
  excludeIds?: string[];
}

export interface Broadcast {
  id: string;
  tenant_id: string;
  created_by: string | null;
  name: string;
  channel: "whatsapp" | "email";
  provider: "green_api" | "manus_wa" | "resend";
  integration_id: string | null;
  body_text: string | null;
  media_url: string | null;
  subject: string | null;
  from_email: string | null;
  from_name: string | null;
  reply_to: string | null;
  audience_filter: AudienceFilter;
  status: BroadcastStatus;
  scheduled_at: string | null;
  timezone: string;
  throttle_min_seconds: number;
  throttle_max_seconds: number;
  daily_cap: number;
  stats: { total?: number; sent?: number; delivered?: number; failed?: number; opened?: number; clicked?: number };
  started_at: string | null;
  completed_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export function useBroadcasts() {
  const { tenantId } = useCurrentTenant();
  const { userId } = useCurrentUser();
  const qc = useQueryClient();

  const list = useQuery({
    queryKey: ["broadcasts", tenantId],
    enabled: !!tenantId,
    queryFn: async (): Promise<Broadcast[]> => {
      const { data, error } = await supabase
        .from("broadcasts")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as Broadcast[];
    },
  });

  const create = useMutation({
    mutationFn: async (payload: Partial<Broadcast>) => {
      const { data, error } = await supabase
        .from("broadcasts")
        .insert({
          tenant_id: tenantId,
          created_by: userId,
          name: payload.name ?? "דיוור חדש",
          channel: payload.channel ?? "whatsapp",
          provider: payload.provider ?? "green_api",
          integration_id: payload.integration_id ?? null,
          body_text: payload.body_text ?? null,
          media_url: payload.media_url ?? null,
          subject: payload.subject ?? null,
          from_email: payload.from_email ?? null,
          from_name: payload.from_name ?? null,
          reply_to: payload.reply_to ?? null,
          audience_filter: (payload.audience_filter ?? { source: "leads" }) as any,
          scheduled_at: payload.scheduled_at ?? null,
          throttle_min_seconds: payload.throttle_min_seconds ?? 12,
          throttle_max_seconds: payload.throttle_max_seconds ?? 20,
          daily_cap: payload.daily_cap ?? 300,
        })
        .select()
        .single();
      if (error) throw error;
      return data as unknown as Broadcast;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["broadcasts", tenantId] }),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...patch }: Partial<Broadcast> & { id: string }) => {
      const { error } = await supabase.from("broadcasts").update(patch as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["broadcasts", tenantId] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("broadcasts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["broadcasts", tenantId] }),
  });

  /** Preview the audience size without committing recipients. */
  const previewAudience = async (filter: AudienceFilter, channel: "whatsapp" | "email") => {
    const { data, error } = await supabase.functions.invoke("broadcast-enqueue", {
      body: { dryRun: true, filter, channel, tenantId },
    });
    if (error) throw error;
    return data as { success: boolean; total: number; sample: any[] };
  };

  /** Freeze the recipient snapshot for a saved broadcast. */
  const enqueue = async (broadcastId: string) => {
    const { data, error } = await supabase.functions.invoke("broadcast-enqueue", {
      body: { broadcastId },
    });
    if (error) throw error;
    return data as { success: boolean; total: number };
  };

  /**
   * Commit a broadcast to send: enqueue recipients, then set status.
   * sendNow=true → status 'sending' (cron picks up immediately);
   * otherwise 'scheduled' with scheduled_at.
   */
  const launch = useMutation({
    mutationFn: async ({ id, sendNow, scheduledAt }: { id: string; sendNow: boolean; scheduledAt?: string | null }) => {
      const res = await enqueue(id);
      if (!res?.total && res?.total !== 0) throw new Error("אין נמענים תקינים לדיוור");
      if (res.total === 0) throw new Error("אין נמענים תקינים לדיוור");
      const patch: any = sendNow
        ? { status: "sending", scheduled_at: new Date().toISOString(), started_at: new Date().toISOString() }
        : { status: "scheduled", scheduled_at: scheduledAt };
      const { error } = await supabase.from("broadcasts").update(patch).eq("id", id);
      if (error) throw error;
      return res.total;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["broadcasts", tenantId] }),
  });

  return { list, create, update, remove, previewAudience, enqueue, launch };
}
