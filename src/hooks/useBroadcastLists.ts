import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { useCurrentUser } from "@/hooks/useCurrentUser";

export interface BroadcastList {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  kind: "static" | "dynamic";
  source: "manual" | "csv" | "google_sheet" | "crm_filter";
  source_config: any;
  auto_sync_enabled: boolean;
  last_synced_at: string | null;
  last_sync_status: string | null;
  member_count: number;
  created_at: string;
}

export interface ListMember {
  id: string;
  list_id: string;
  entity_type: string;
  entity_id: string | null;
  name: string | null;
  phone: string | null;
  email: string | null;
  added_via: string;
}

export interface ListRule {
  id: string;
  list_id: string;
  trigger: string;
  filter: { statusKeys?: string[]; sources?: string[] };
  enabled: boolean;
}

export function useBroadcastLists() {
  const { tenantId } = useCurrentTenant();
  const { userId } = useCurrentUser();
  const qc = useQueryClient();

  const lists = useQuery({
    queryKey: ["broadcast-lists", tenantId],
    enabled: !!tenantId,
    queryFn: async (): Promise<BroadcastList[]> => {
      const { data, error } = await supabase
        .from("broadcast_lists").select("*").eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as BroadcastList[];
    },
  });

  const recomputeCount = async (listId: string) => {
    const { count } = await supabase
      .from("broadcast_list_members").select("id", { count: "exact", head: true }).eq("list_id", listId);
    await supabase.from("broadcast_lists").update({ member_count: count ?? 0 }).eq("id", listId);
  };

  const createList = useMutation({
    mutationFn: async (payload: Partial<BroadcastList>) => {
      const { data, error } = await supabase.from("broadcast_lists").insert({
        tenant_id: tenantId, created_by: userId,
        name: payload.name ?? "רשימה חדשה",
        description: payload.description ?? null,
        kind: payload.kind ?? "static",
        source: payload.source ?? "manual",
      }).select().single();
      if (error) throw error;
      return data as unknown as BroadcastList;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["broadcast-lists", tenantId] }),
  });

  const deleteList = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("broadcast_lists").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["broadcast-lists", tenantId] }),
  });

  const updateList = useMutation({
    mutationFn: async ({ id, ...patch }: Partial<BroadcastList> & { id: string }) => {
      const { error } = await supabase.from("broadcast_lists").update(patch as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["broadcast-lists", tenantId] }),
  });

  const useMembers = (listId: string | undefined) =>
    useQuery({
      queryKey: ["broadcast-list-members", listId],
      enabled: !!listId,
      queryFn: async (): Promise<ListMember[]> => {
        const { data, error } = await supabase
          .from("broadcast_list_members").select("*").eq("list_id", listId)
          .order("created_at", { ascending: false }).limit(1000);
        if (error) throw error;
        return (data || []) as unknown as ListMember[];
      },
    });

  /** Insert rows (manual or parsed CSV). rows: {name?, phone?, email?}[] */
  const addMembers = useMutation({
    mutationFn: async ({ listId, rows, via }: { listId: string; rows: any[]; via: string }) => {
      const norm = (p?: string) => {
        if (!p) return null;
        let d = String(p).replace(/[^0-9]/g, "");
        if (!d) return null;
        if (d.startsWith("00")) d = d.slice(2);
        if (d.startsWith("972")) return d;
        if (d.startsWith("0")) return "972" + d.slice(1);
        return d.length >= 9 ? "972" + d : d;
      };
      const payload = rows
        .map((r) => ({
          list_id: listId, tenant_id: tenantId, entity_type: "manual",
          name: r.name?.trim() || null,
          phone: norm(r.phone),
          email: r.email?.trim()?.toLowerCase() || null,
          added_via: via,
        }))
        .filter((r) => r.phone || r.email);
      for (let i = 0; i < payload.length; i += 500) {
        const { error } = await supabase.from("broadcast_list_members")
          .upsert(payload.slice(i, i + 500), { onConflict: "list_id,phone", ignoreDuplicates: true });
        if (error && !String(error.message).includes("duplicate")) throw error;
      }
      await recomputeCount(listId);
      return payload.length;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["broadcast-list-members", v.listId] });
      qc.invalidateQueries({ queryKey: ["broadcast-lists", tenantId] });
    },
  });

  const removeMember = useMutation({
    mutationFn: async ({ id, listId }: { id: string; listId: string }) => {
      const { error } = await supabase.from("broadcast_list_members").delete().eq("id", id);
      if (error) throw error;
      await recomputeCount(listId);
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["broadcast-list-members", v.listId] });
      qc.invalidateQueries({ queryKey: ["broadcast-lists", tenantId] });
    },
  });

  // ── Google Sheets ──
  const sheetHeaders = async (sheetId: string) => {
    const { data, error } = await supabase.functions.invoke("import-broadcast-list-sheet", {
      body: { sheetId, fetchHeadersOnly: true, tenantId },
    });
    if (error) throw error;
    return data as { headers: string[]; previewRows: string[][]; suggestedMap: Record<string, string> };
  };

  const sheetImport = useMutation({
    mutationFn: async ({ listId, sheetId, range, fieldMap, autoSync }:
      { listId: string; sheetId: string; range?: string; fieldMap: Record<string, string>; autoSync: boolean }) => {
      const { data, error } = await supabase.functions.invoke("import-broadcast-list-sheet", {
        body: { listId, sheetId, range, fieldMap, tenantId },
      });
      if (error) throw error;
      await supabase.from("broadcast_lists")
        .update({ kind: autoSync ? "dynamic" : "static", auto_sync_enabled: autoSync }).eq("id", listId);
      return data as { success: boolean; total: number };
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["broadcast-list-members", v.listId] });
      qc.invalidateQueries({ queryKey: ["broadcast-lists", tenantId] });
    },
  });

  // ── Auto-add rules ──
  const useRules = (listId: string | undefined) =>
    useQuery({
      queryKey: ["broadcast-list-rules", listId],
      enabled: !!listId,
      queryFn: async (): Promise<ListRule[]> => {
        const { data, error } = await supabase.from("broadcast_list_rules").select("*").eq("list_id", listId);
        if (error) throw error;
        return (data || []) as unknown as ListRule[];
      },
    });

  const addRule = useMutation({
    mutationFn: async ({ listId, filter }: { listId: string; filter: any }) => {
      const { error } = await supabase.from("broadcast_list_rules").insert({
        list_id: listId, tenant_id: tenantId, trigger: "lead_created", filter, enabled: true, created_by: userId,
      });
      if (error) throw error;
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ["broadcast-list-rules", v.listId] }),
  });

  const deleteRule = useMutation({
    mutationFn: async ({ id }: { id: string; listId: string }) => {
      const { error } = await supabase.from("broadcast_list_rules").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ["broadcast-list-rules", v.listId] }),
  });

  return {
    lists, createList, deleteList, updateList,
    useMembers, addMembers, removeMember,
    sheetHeaders, sheetImport,
    useRules, addRule, deleteRule,
  };
}
