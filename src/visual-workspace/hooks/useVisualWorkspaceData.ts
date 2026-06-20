import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import type { IslandSummary, IslandStatus } from "../types/visualWorkspaceTypes";

const startOfMonth = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
};

const sevenDaysAgo = () => new Date(Date.now() - 7 * 86400_000).toISOString();

function deriveStatus(alerts: number, errors = 0): IslandStatus {
  if (alerts >= 3 || errors >= 3) return "alert";
  if (alerts >= 1 || errors >= 1) return "watch";
  return "good";
}

export function useVisualWorkspaceData() {
  const { tenantId } = useCurrentTenant();

  return useQuery({
    queryKey: ["visual-workspace-data", tenantId],
    enabled: !!tenantId,
    refetchInterval: 60_000,
    queryFn: async () => {
      const tid = tenantId!;
      const monthStart = startOfMonth();
      const weekAgo = sevenDaysAgo();
      const todayIso = new Date().toISOString();

      const sb = supabase as any;
      const head = (q: any) => q.then((r: any) => r.count ?? 0);

      const tenantRow = await sb.from("tenants").select("name").eq("id", tid).maybeSingle();

      const [
        clientsActive,
        clientsAtRisk,
        tasksOpen,
        tasksUrgent,
        agentsActive,
        campaignAlertsOpen,
        reportAlertsOpen,
        leadsWeek,
        leadsHot,
        socialPlanned,
        automationsCount,
        automationExecsWeek,
        errorLogsWeek,
        integrationsCount,
        usersCount,
        agentRunsActive,
        goalsOpen,
        incomePayments,
        expensePayments,
        unpaidInvoices,
      ] = await Promise.all([
        head(sb.from("clients").select("id", { count: "exact", head: true }).eq("tenant_id", tid).neq("status", "ended")),
        head(sb.from("clients").select("id", { count: "exact", head: true }).eq("tenant_id", tid).in("mood_status", ["churn_risk", "not_progressing"])),
        head(sb.from("tasks").select("id", { count: "exact", head: true }).eq("tenant_id", tid).in("status", ["open", "in_progress"])),
        head(sb.from("tasks").select("id", { count: "exact", head: true }).eq("tenant_id", tid).in("status", ["open", "in_progress"]).lte("due_date", todayIso)),
        head(sb.from("ai_agents").select("id", { count: "exact", head: true }).eq("tenant_id", tid).eq("active", true)),
        head(sb.from("campaign_alerts").select("id", { count: "exact", head: true }).eq("tenant_id", tid).eq("status", "open")),
        head(sb.from("report_alerts").select("id", { count: "exact", head: true }).eq("tenant_id", tid).eq("is_active", true)),
        head(sb.from("leads").select("id", { count: "exact", head: true }).eq("tenant_id", tid).gte("created_at", weekAgo)),
        head(sb.from("leads").select("id", { count: "exact", head: true }).eq("tenant_id", tid).eq("status", "hot")),
        head(sb.from("social_publications").select("id", { count: "exact", head: true }).eq("tenant_id", tid).eq("status", "scheduled")),
        head(sb.from("automations").select("id", { count: "exact", head: true }).eq("tenant_id", tid).eq("is_active", true)),
        head(sb.from("automation_executions").select("id", { count: "exact", head: true }).eq("tenant_id", tid).gte("created_at", weekAgo)),
        head(sb.from("error_logs").select("id", { count: "exact", head: true }).eq("tenant_id", tid).gte("created_at", weekAgo)),
        head(sb.from("tenant_integrations").select("id", { count: "exact", head: true }).eq("tenant_id", tid).eq("is_active", true)),
        head(sb.from("tenant_users").select("user_id", { count: "exact", head: true }).eq("tenant_id", tid)),
        head(sb.from("agent_runs").select("id", { count: "exact", head: true }).eq("tenant_id", tid).in("status", ["running", "queued"])),
        head(sb.from("goals").select("id", { count: "exact", head: true }).eq("tenant_id", tid).neq("status", "completed")),
        sb.from("income_payments").select("amount").eq("tenant_id", tid).gte("payment_date", monthStart),
        sb.from("expense_payments").select("amount").eq("tenant_id", tid).gte("payment_date", monthStart),
        head(sb.from("supplier_invoices").select("id", { count: "exact", head: true }).eq("tenant_id", tid).neq("status", "paid")),
      ]);

      const incomeMonth = (incomePayments.data ?? []).reduce((s: number, r: any) => s + Number(r.amount || 0), 0);
      const expenseMonth = (expensePayments.data ?? []).reduce((s: number, r: any) => s + Number(r.amount || 0), 0);

      const businessName = (tenantRow.data?.name as string) || "העסק שלי";
      const totalAlerts = campaignAlertsOpen + reportAlertsOpen;

      const islands: IslandSummary[] = [
        {
          id: "management",
          name: "ניהול",
          description: "יעדים, KPI והחלטות",
          agentRole: "ceo",
          agentName: "CEO Agent",
          kpis: [
            { label: "יעדים פתוחים", value: goalsOpen },
            { label: "משימות דחופות", value: tasksUrgent, tone: tasksUrgent ? "warning" : "default" },
            { label: "לקוחות בסיכון", value: clientsAtRisk, tone: clientsAtRisk ? "danger" : "default" },
          ],
          openTasks: tasksOpen,
          alerts: totalAlerts,
          status: deriveStatus(totalAlerts + clientsAtRisk),
        },
        {
          id: "marketing",
          name: "שיווק",
          description: "קמפיינים, לידים, סושיאל",
          agentRole: "marketing",
          agentName: "CMO Agent",
          kpis: [
            { label: "אוטומציות פעילות", value: automationsCount },
            { label: "לידים השבוע", value: leadsWeek },
            { label: "התראות קמפיינים", value: campaignAlertsOpen, tone: campaignAlertsOpen ? "warning" : "default" },
          ],
          openTasks: 0,
          alerts: campaignAlertsOpen,
          status: deriveStatus(campaignAlertsOpen),
        },
        {
          id: "sales",
          name: "מכירות",
          description: "Pipeline, לידים, עסקאות",
          agentRole: "sales",
          agentName: "Sales Agent",
          kpis: [
            { label: "לידים חמים", value: leadsHot, tone: leadsHot ? "success" : "default" },
            { label: "לידים השבוע", value: leadsWeek },
            { label: "Pipeline", value: leadsWeek + leadsHot },
          ],
          openTasks: 0,
          alerts: 0,
          status: "good",
        },
        {
          id: "creative",
          name: "קריאייטיב",
          description: "תוכן, עיצובים, וידאו",
          agentRole: "creative",
          agentName: "Creative Agent",
          kpis: [
            { label: "פוסטים מתוכננים", value: socialPlanned },
            { label: "משימות פתוחות", value: tasksOpen },
            { label: "התראות", value: 0 },
          ],
          openTasks: tasksOpen,
          alerts: 0,
          status: "good",
        },
        {
          id: "finance",
          name: "כספים",
          description: "הכנסות, הוצאות, גבייה",
          agentRole: "finance",
          agentName: "CFO Agent",
          kpis: [
            { label: "הכנסות החודש", value: `₪${Math.round(incomeMonth).toLocaleString()}`, tone: "success" },
            { label: "הוצאות החודש", value: `₪${Math.round(expenseMonth).toLocaleString()}` },
            { label: "חשבוניות פתוחות", value: unpaidInvoices, tone: unpaidInvoices ? "warning" : "default" },
          ],
          openTasks: 0,
          alerts: 0,
          status: deriveStatus(unpaidInvoices > 5 ? 1 : 0),
        },
        {
          id: "development",
          name: "פיתוח",
          description: "אוטומציות, אינטגרציות, API",
          agentRole: "dev",
          agentName: "CTO Agent",
          kpis: [
            { label: "אוטומציות", value: automationsCount },
            { label: "ריצות השבוע", value: automationExecsWeek },
            { label: "שגיאות השבוע", value: errorLogsWeek, tone: errorLogsWeek ? "danger" : "default" },
          ],
          openTasks: 0,
          alerts: errorLogsWeek,
          status: deriveStatus(0, errorLogsWeek),
        },
        {
          id: "customer_success",
          name: "שירות לקוחות",
          description: "לקוחות, פניות, שביעות רצון",
          agentRole: "customer_success",
          agentName: "CS Agent",
          kpis: [
            { label: "לקוחות פעילים", value: clientsActive },
            { label: "לקוחות בסיכון", value: clientsAtRisk, tone: clientsAtRisk ? "danger" : "default" },
            { label: "משימות פתוחות", value: tasksOpen },
          ],
          openTasks: tasksOpen,
          alerts: clientsAtRisk,
          status: deriveStatus(clientsAtRisk),
        },
        {
          id: "system",
          name: "ניהול מערכת",
          description: "משתמשים, הרשאות, אינטגרציות",
          agentRole: "system",
          agentName: "System Admin",
          kpis: [
            { label: "משתמשים", value: usersCount },
            { label: "אינטגרציות פעילות", value: integrationsCount },
            { label: "שגיאות השבוע", value: errorLogsWeek, tone: errorLogsWeek ? "warning" : "default" },
          ],
          openTasks: 0,
          alerts: 0,
          status: deriveStatus(0, errorLogsWeek),
        },
        {
          id: "agents",
          name: "אייג׳נטים",
          description: "סוכני AI ופעולותיהם",
          agentRole: "ceo",
          agentName: "Agents Hub",
          kpis: [
            { label: "אייג׳נטים פעילים", value: agentsActive },
            { label: "ריצות פעילות", value: agentRunsActive },
            { label: "אוטומציות", value: automationsCount },
          ],
          openTasks: 0,
          alerts: 0,
          status: "good",
        },
      ];

      return {
        businessName,
        core: {
          businessName,
          clientsActive,
          clientsAtRisk,
          tasksOpen,
          tasksUrgent,
          agentsActive,
          alerts: totalAlerts,
          incomeMonth,
        },
        islands,
      };
    },
  });
}
