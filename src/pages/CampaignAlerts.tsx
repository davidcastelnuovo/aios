import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertTriangle, CheckCircle2, Loader2, Pause, Play, RefreshCw } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { he } from "date-fns/locale";
import { toast } from "sonner";

type Alert = {
  id: string;
  tenant_id: string;
  client_id: string | null;
  campaign_id: string;
  campaign_name: string | null;
  ad_account_id: string | null;
  alert_type: string;
  severity: "info" | "warning" | "critical";
  details: Record<string, any>;
  created_at: string;
  acknowledged_at: string | null;
  resolved_at: string | null;
  notified_at: string | null;
};

const TYPE_LABELS: Record<string, string> = {
  campaign_stopped: "קמפיין הושהה / נדחה",
  ad_disapproved: "מודעה לא מאושרת",
  cpl_spike: "CPL חורג",
  frequency_high: "Frequency גבוה",
  campaign_with_issues: "בעיה ע״פ Meta",
  ctr_drop: "ירידה ב-CTR",
};

const SEVERITY_STYLE: Record<Alert["severity"], string> = {
  critical: "bg-destructive/10 text-destructive border-destructive/30",
  warning: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/30",
  info: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30",
};

export default function CampaignAlerts() {
  const { tenant } = useCurrentTenant();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [clientsByAdAccount, setClientsByAdAccount] = useState<Map<string, { id: string; name: string }>>(new Map());
  const [clientsById, setClientsById] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "critical" | "warning" | "info">("all");
  const [running, setRunning] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    if (!tenant?.id) return;
    setLoading(true);
    const [alertsRes, clientsRes] = await Promise.all([
      supabase
        .from("campaign_alerts")
        .select("*")
        .eq("tenant_id", tenant.id)
        .is("resolved_at", null)
        .order("created_at", { ascending: false })
        .limit(200),
      supabase
        .from("clients")
        .select("id, name, meta_ads_account_id")
        .eq("tenant_id", tenant.id),
    ]);
    if (alertsRes.error) toast.error(alertsRes.error.message);
    setAlerts((alertsRes.data || []) as Alert[]);
    const byAcc = new Map<string, { id: string; name: string }>();
    const byId = new Map<string, string>();
    for (const c of (clientsRes.data || []) as any[]) {
      byId.set(c.id, c.name);
      if (c.meta_ads_account_id) byAcc.set(String(c.meta_ads_account_id), { id: c.id, name: c.name });
    }
    setClientsByAdAccount(byAcc);
    setClientsById(byId);
    setLoading(false);
  };


  useEffect(() => { load(); }, [tenant?.id]);

  useEffect(() => {
    if (!tenant?.id) return;
    const ch = supabase
      .channel("campaign_alerts_rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "campaign_alerts", filter: `tenant_id=eq.${tenant.id}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [tenant?.id]);

  const runScanNow = async () => {
    setRunning(true);
    try {
      const { error } = await supabase.functions.invoke("fb-campaign-monitor", { body: {} });
      if (error) throw error;
      toast.success("הסריקה הסתיימה");
      await load();
    } catch (e: any) { toast.error(e.message); } finally { setRunning(false); }
  };

  const acknowledge = async (id: string) => {
    setBusyId(id);
    const { error } = await supabase.from("campaign_alerts").update({ acknowledged_at: new Date().toISOString(), resolved_at: new Date().toISOString() }).eq("id", id);
    setBusyId(null);
    if (error) toast.error(error.message);
    else { toast.success("סומן כטופל"); load(); }
  };

  const toggleCampaign = async (a: Alert, status: "PAUSED" | "ACTIVE") => {
    setBusyId(a.id);
    try {
      const { data, error } = await supabase.functions.invoke("toggle-facebook-campaign", {
        body: { tenant_id: a.tenant_id, campaign_id: a.campaign_id, status },
      });
      if (error || (data as any)?.error) throw new Error((data as any)?.error || error?.message);
      toast.success(`קמפיין ${status === "PAUSED" ? "הושהה" : "הופעל"}`);
    } catch (e: any) { toast.error(e.message); } finally { setBusyId(null); }
  };

  const filtered = filter === "all" ? alerts : alerts.filter((a) => a.severity === filter);
  const counts = {
    all: alerts.length,
    critical: alerts.filter((a) => a.severity === "critical").length,
    warning: alerts.filter((a) => a.severity === "warning").length,
    info: alerts.filter((a) => a.severity === "info").length,
  };

  return (
    <div className="p-6 space-y-4 max-w-6xl mx-auto" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">התראות קמפיינים</h1>
          <p className="text-sm text-muted-foreground">מעקב אוטומטי 24/7 על קמפיינים פעילים — סריקה כל 30 דקות</p>
        </div>
        <Button variant="outline" onClick={runScanNow} disabled={running}>
          {running ? <Loader2 className="ms-2 h-4 w-4 animate-spin" /> : <RefreshCw className="ms-2 h-4 w-4" />}
          סרוק עכשיו
        </Button>
      </div>

      <Tabs value={filter} onValueChange={(v) => setFilter(v as any)}>
        <TabsList>
          <TabsTrigger value="all">הכל ({counts.all})</TabsTrigger>
          <TabsTrigger value="critical">🔴 קריטיות ({counts.critical})</TabsTrigger>
          <TabsTrigger value="warning">🟡 אזהרות ({counts.warning})</TabsTrigger>
          <TabsTrigger value="info">🔵 מידע ({counts.info})</TabsTrigger>
        </TabsList>
      </Tabs>

      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <Card className="p-8 text-center">
          <CheckCircle2 className="h-10 w-10 text-green-500 mx-auto mb-2" />
          <p className="text-lg font-medium">אין התראות פתוחות</p>
          <p className="text-sm text-muted-foreground">כל הקמפיינים תקינים 🎉</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((a) => (
            <Card key={a.id} className={`p-4 border-r-4 ${SEVERITY_STYLE[a.severity]}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <Badge variant="outline" className="text-xs">{TYPE_LABELS[a.alert_type] || a.alert_type}</Badge>
                    {a.notified_at && <Badge variant="secondary" className="text-xs">📱 נשלח WA</Badge>}
                  </div>
                  <h3 className="font-semibold truncate">{a.campaign_name || a.campaign_id}</h3>
                  {(() => {
                    const accId = a.ad_account_id || "";
                    const accNum = accId.replace(/^act_/, "");
                    const linkedClient = a.client_id ? clientsById.get(a.client_id) : clientsByAdAccount.get(accNum)?.name;
                    return (
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-xs text-muted-foreground">
                        {accId && <span>חשבון מודעות: <span className="font-mono">{accNum}</span></span>}
                        <span>
                          לקוח:{" "}
                          {linkedClient ? (
                            <span className="font-medium text-foreground">{linkedClient}</span>
                          ) : (
                            <span className="italic">לא משויך</span>
                          )}
                        </span>
                      </div>
                    );
                  })()}
                  <p className="text-sm text-muted-foreground mt-1">
                    {a.alert_type === "cpl_spike" && a.details?.cpl_today
                      ? `CPL היום: ₪${Number(a.details.cpl_today).toFixed(1)} | ממוצע 7 ימים: ₪${Number(a.details.cpl_7d_avg).toFixed(1)} (+${a.details.spike_pct}%)`
                      : a.alert_type === "ad_disapproved"
                      ? `מודעה: ${a.details?.ad_name || ""} (${a.details?.ad_status})`
                      : a.alert_type === "frequency_high"
                      ? `Frequency: ${Number(a.details?.frequency || 0).toFixed(2)}`
                      : a.alert_type === "campaign_stopped"
                      ? `סטטוס: ${a.details?.effective_status}`
                      : JSON.stringify(a.details).slice(0, 120)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    לפני {formatDistanceToNow(new Date(a.created_at), { locale: he })}
                  </p>
                </div>
                <div className="flex flex-col gap-2 shrink-0">
                  {(a.alert_type === "cpl_spike" || a.alert_type === "frequency_high") && (
                    <Button size="sm" variant="outline" disabled={busyId === a.id} onClick={() => toggleCampaign(a, "PAUSED")}>
                      <Pause className="ms-1 h-3.5 w-3.5" />השהה
                    </Button>
                  )}
                  {a.alert_type === "campaign_stopped" && (
                    <Button size="sm" variant="outline" disabled={busyId === a.id} onClick={() => toggleCampaign(a, "ACTIVE")}>
                      <Play className="ms-1 h-3.5 w-3.5" />הפעל
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" disabled={busyId === a.id} onClick={() => acknowledge(a.id)}>
                    <CheckCircle2 className="ms-1 h-3.5 w-3.5" />סמן כטופל
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
