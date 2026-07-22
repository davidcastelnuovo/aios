import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

// Several ops tables (heartbeat_logs, integration_alerts_log, agent_action_log…)
// are not in the generated Database types yet.
const sb = supabase as any;

const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString();
const todayStr = () => new Date().toISOString().slice(0, 10);

export type Severity = "info" | "warning" | "critical";

export interface FeedItem {
  id: string;
  severity: Severity;
  source: string;
  title: string;
  time: string;
}

export interface ServiceHealth {
  key: string;
  label: string;
  status: "ok" | "warn" | "down" | "unknown";
  detail: string;
  latencyMs?: number;
}

/* ---------------- Core overview ---------------- */

export function useCoreOverview(tenantId: string | null) {
  return useQuery({
    queryKey: ["cc-core", tenantId],
    enabled: !!tenantId,
    refetchInterval: 60000,
    queryFn: async () => {
      const [agentRes, memRes, sessRes, llmRes, agentsCount] = await Promise.all([
        sb.from("ai_agents").select("id, name, mood, voice, engine").eq("tenant_id", tenantId).limit(1).maybeSingle(),
        sb.from("carmen_memory_pointers").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId),
        sb.from("carmen_whatsapp_sessions").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("status", "active"),
        sb.from("tenant_integrations").select("id, is_active").eq("tenant_id", tenantId).eq("integration_type", "llm").maybeSingle(),
        sb.from("ai_agents").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId),
      ]);
      return {
        agent: agentRes.data as { id: string; name: string; mood: string | null; voice: string | null; engine: string | null } | null,
        memoryCount: memRes.count ?? 0,
        activeSessions: sessRes.count ?? 0,
        llmConfigured: !!llmRes.data,
        llmActive: llmRes.data?.is_active ?? false,
        agentsCount: agentsCount.count ?? 0,
      };
    },
  });
}

/* ---------------- Intel feed (merged alerts) ---------------- */

export function useIntelFeed(tenantId: string | null) {
  return useQuery({
    queryKey: ["cc-feed", tenantId],
    enabled: !!tenantId,
    refetchInterval: 45000,
    queryFn: async (): Promise<FeedItem[]> => {
      const safe = async (p: Promise<{ data: any[] | null }>) => {
        try { return (await p).data ?? []; } catch { return []; }
      };
      const [campaign, integr, anomalies, overdue] = await Promise.all([
        safe(sb.from("campaign_alerts").select("id, alert_type, severity, campaign_name, created_at").eq("tenant_id", tenantId).is("resolved_at", null).order("created_at", { ascending: false }).limit(10)),
        safe(sb.from("integration_alerts_log").select("id, provider, alert_type, reason, fired_at").eq("tenant_id", tenantId).gte("fired_at", daysAgo(7)).order("fired_at", { ascending: false }).limit(10)),
        safe(sb.from("agent_tasks").select("id, title, created_at").eq("tenant_id", tenantId).eq("task_mode", "anomaly_alert").gte("created_at", daysAgo(1)).order("created_at", { ascending: false }).limit(10)),
        safe(sb.from("tasks").select("id, title, due_date").eq("tenant_id", tenantId).neq("status", "done").lt("due_date", todayStr()).order("due_date", { ascending: true }).limit(10)),
      ]);

      const items: FeedItem[] = [
        ...campaign.map((a: any): FeedItem => ({
          id: `ca-${a.id}`,
          severity: a.severity === "critical" ? "critical" : "warning",
          source: "קמפיינים",
          title: `${alertTypeLabel(a.alert_type)}${a.campaign_name ? ` — ${a.campaign_name}` : ""}`,
          time: a.created_at,
        })),
        ...integr.map((a: any): FeedItem => ({
          id: `il-${a.id}`,
          severity: a.alert_type === "reconnected" ? "info" : "critical",
          source: "אינטגרציות",
          title: a.alert_type === "reconnected" ? `${a.provider} התחבר מחדש` : `${a.provider} התנתק${a.reason ? ` — ${a.reason}` : ""}`,
          time: a.fired_at,
        })),
        ...anomalies.map((a: any): FeedItem => ({
          id: `an-${a.id}`, severity: "warning", source: "אנומליות", title: a.title, time: a.created_at,
        })),
        ...overdue.map((t: any): FeedItem => ({
          id: `od-${t.id}`, severity: "warning", source: "משימות",
          title: `משימה באיחור: ${t.title}`, time: `${t.due_date}T00:00:00Z`,
        })),
      ];
      return items.sort((a, b) => (a.time < b.time ? 1 : -1)).slice(0, 30);
    },
  });
}

function alertTypeLabel(type: string): string {
  const map: Record<string, string> = {
    campaign_stopped: "קמפיין נעצר",
    campaign_with_issues: "קמפיין עם בעיות",
    cpl_spike: "קפיצה בעלות ליד",
    frequency_high: "תדירות גבוהה",
    ad_disapproved: "מודעה נדחתה",
  };
  return map[type] ?? type;
}

/* ---------------- Health / heartbeats ---------------- */

export function useHealth(tenantId: string | null) {
  return useQuery({
    queryKey: ["cc-health", tenantId],
    enabled: !!tenantId,
    refetchInterval: 30000,
    queryFn: async (): Promise<{ services: ServiceHealth[]; lastHeartbeat: string | null }> => {
      // DB probe — round-trip latency of a minimal query
      const t0 = performance.now();
      const dbRes = await sb.from("tenants").select("id").limit(1);
      const dbLatency = Math.round(performance.now() - t0);

      const [waRes, hbRes, ihRes] = await Promise.all([
        sb.from("tenant_integrations").select("is_active, settings").eq("tenant_id", tenantId).eq("integration_type", "manus_wa").maybeSingle(),
        sb.from("heartbeat_logs").select("triggered_at, summary").eq("tenant_id", tenantId).order("triggered_at", { ascending: false }).limit(1).maybeSingle(),
        sb.from("integration_health").select("provider, consecutive_failures, is_circuit_open, last_success_at").eq("tenant_id", tenantId),
      ]);

      const waSettings = waRes.data?.settings ?? {};
      const waStatus: ServiceHealth["status"] = waRes.error ? "unknown"
        : !waRes.data ? "unknown"
        : !waRes.data.is_active ? "down"
        : waSettings.status === "connected" || waSettings.status === "authorized" ? "ok"
        : waSettings.status ? "warn" : "ok";

      const openCircuits = (ihRes.data ?? []).filter((r: any) => r.is_circuit_open);

      const services: ServiceHealth[] = [
        {
          key: "db", label: "מסד נתונים",
          status: dbRes.error ? "down" : dbLatency > 1500 ? "warn" : "ok",
          detail: dbRes.error ? "שגיאת חיבור" : "Supabase Postgres",
          latencyMs: dbRes.error ? undefined : dbLatency,
        },
        {
          key: "whatsapp", label: "WhatsApp",
          status: waStatus,
          detail: waRes.data
            ? `${waSettings.phone_number ?? ""} ${waSettings.status ?? "מחובר"}`.trim()
            : "לא מוגדר לטננט הזה",
        },
        {
          key: "integrations", label: "אינטגרציות",
          status: ihRes.error || !ihRes.data?.length ? "unknown" : openCircuits.length ? "warn" : "ok",
          detail: ihRes.error || !ihRes.data?.length
            ? "אין נתוני ניטור"
            : openCircuits.length
              ? `${openCircuits.length} אינטגרציות בכשל`
              : `${ihRes.data.length} אינטגרציות תקינות`,
        },
        {
          key: "mcp", label: "שרתי MCP",
          status: "unknown",
          detail: "אין ניטור פעיל עדיין",
        },
      ];
      return { services, lastHeartbeat: hbRes.data?.triggered_at ?? null };
    },
  });
}

/* ---------------- API usage ---------------- */

export interface UsageDay { date: string; tokens: number; cost: number; calls: number; }

export function useUsage(tenantId: string | null) {
  return useQuery({
    queryKey: ["cc-usage", tenantId],
    enabled: !!tenantId,
    refetchInterval: 120000,
    queryFn: async () => {
      const since = daysAgo(30);
      const safe = async (p: Promise<{ data: any[] | null }>) => {
        try { return (await p).data ?? []; } catch { return []; }
      };
      const [actions, marketing] = await Promise.all([
        safe(sb.from("agent_action_log").select("created_at, tokens_in, tokens_out, cost_usd").eq("tenant_id", tenantId).gte("created_at", since).limit(5000)),
        safe(sb.from("marketing_runs").select("created_at, tokens_in, tokens_out, cost_usd").eq("tenant_id", tenantId).gte("created_at", since).limit(5000)),
      ]);

      const byDay = new Map<string, UsageDay>();
      for (let i = 29; i >= 0; i--) {
        const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
        byDay.set(d, { date: d, tokens: 0, cost: 0, calls: 0 });
      }
      const add = (rows: any[]) => {
        for (const r of rows) {
          const d = (r.created_at as string).slice(0, 10);
          const day = byDay.get(d);
          if (!day) continue;
          day.tokens += (r.tokens_in ?? 0) + (r.tokens_out ?? 0);
          day.cost += Number(r.cost_usd ?? 0);
          day.calls += 1;
        }
      };
      add(actions); add(marketing);

      const days = Array.from(byDay.values());
      const today = days[days.length - 1];
      const week = days.slice(-7);
      return {
        days,
        callsToday: today?.calls ?? 0,
        tokens7d: week.reduce((s, d) => s + d.tokens, 0),
        cost30d: days.reduce((s, d) => s + d.cost, 0),
        tracked: actions.some((r: any) => r.tokens_in) || marketing.length > 0,
      };
    },
  });
}

/* ---------------- Tasks ---------------- */

export interface CcTask {
  id: string; title: string; status: string;
  due_date: string | null; due_time: string | null; priority: number;
}

export function useCcTasks(tenantId: string | null) {
  return useQuery({
    queryKey: ["cc-tasks", tenantId],
    enabled: !!tenantId,
    refetchInterval: 60000,
    queryFn: async (): Promise<CcTask[]> => {
      const { data, error } = await sb
        .from("tasks")
        .select("id, title, status, due_date, due_time, priority")
        .eq("tenant_id", tenantId)
        .neq("status", "done")
        .order("due_date", { ascending: true, nullsFirst: false })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useMarkTaskDone(tenantId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await sb.from("tasks").update({ status: "done" }).eq("id", taskId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cc-tasks", tenantId] });
      qc.invalidateQueries({ queryKey: ["cc-timeline", tenantId] });
    },
  });
}

/* ---------------- Daily timeline ---------------- */

export interface TimelineEvent { id: string; time: string | null; title: string; kind: "task" | "agent"; done: boolean; }

export function useTimeline(tenantId: string | null) {
  return useQuery({
    queryKey: ["cc-timeline", tenantId],
    enabled: !!tenantId,
    refetchInterval: 60000,
    queryFn: async (): Promise<TimelineEvent[]> => {
      const today = todayStr();
      const [tasksRes, agentRes] = await Promise.all([
        sb.from("tasks").select("id, title, due_time, status").eq("tenant_id", tenantId).eq("due_date", today).order("due_time", { ascending: true, nullsFirst: false }),
        sb.from("agent_tasks").select("id, title, scheduled_at, status").eq("tenant_id", tenantId).gte("scheduled_at", `${today}T00:00:00Z`).lt("scheduled_at", `${today}T23:59:59Z`).order("scheduled_at", { ascending: true }),
      ]);
      const events: TimelineEvent[] = [
        ...(tasksRes.data ?? []).map((t: any): TimelineEvent => ({
          id: `t-${t.id}`, time: t.due_time ? t.due_time.slice(0, 5) : null,
          title: t.title, kind: "task", done: t.status === "done",
        })),
        ...(agentRes.data ?? []).map((a: any): TimelineEvent => ({
          id: `a-${a.id}`, time: a.scheduled_at ? new Date(a.scheduled_at).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" }) : null,
          title: `🤖 ${a.title}`, kind: "agent", done: a.status === "completed",
        })),
      ];
      return events.sort((a, b) => (a.time ?? "99").localeCompare(b.time ?? "99"));
    },
  });
}

/* ---------------- Realtime invalidation ---------------- */

export function useCommandRealtime(tenantId: string | null, onCritical: () => void) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!tenantId) return;
    const channel = supabase
      .channel("carmen-command-center")
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks", filter: `tenant_id=eq.${tenantId}` }, () => {
        qc.invalidateQueries({ queryKey: ["cc-tasks", tenantId] });
        qc.invalidateQueries({ queryKey: ["cc-timeline", tenantId] });
        qc.invalidateQueries({ queryKey: ["cc-feed", tenantId] });
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "campaign_alerts", filter: `tenant_id=eq.${tenantId}` }, (payload: any) => {
        qc.invalidateQueries({ queryKey: ["cc-feed", tenantId] });
        if (payload.new?.severity === "critical") onCritical();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "agent_tasks", filter: `tenant_id=eq.${tenantId}` }, () => {
        qc.invalidateQueries({ queryKey: ["cc-feed", tenantId] });
        qc.invalidateQueries({ queryKey: ["cc-timeline", tenantId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [tenantId, qc, onCritical]);
}
