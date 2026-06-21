import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { he } from "date-fns/locale";
import { AlertTriangle, CheckCircle2, RefreshCw, ChevronDown, ChevronRight, Megaphone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

type Alert = {
  id: string;
  client_id: string | null;
  campaign_id: string;
  campaign_name: string | null;
  ad_account_id: string | null;
  alert_type: string;
  severity: "info" | "warning" | "critical";
  details: any;
  acknowledged_at: string | null;
  resolved_at: string | null;
  created_at: string;
};

type ClientWithIntegration = {
  id: string;
  name: string;
  meta_ads_account_id: string | null;
  google_ads_account_id: string | null;
};

const severityConfig = {
  critical: { label: "קריטיות", color: "bg-red-500", border: "border-red-200 bg-red-50/50", text: "text-red-700" },
  warning: { label: "אזהרות", color: "bg-amber-500", border: "border-amber-200 bg-amber-50/50", text: "text-amber-700" },
  info: { label: "מידע", color: "bg-blue-500", border: "border-blue-200 bg-blue-50/50", text: "text-blue-700" },
} as const;

const alertTypeLabels: Record<string, string> = {
  cpl_spike: "CPL חורג",
  ad_disapproved: "מודעה לא מאושרת",
  campaign_stopped: "קמפיין הושהה",
  budget_exhausted: "תקציב מוצה",
  low_delivery: "אספקה נמוכה",
};

export default function CampaignAlerts() {
  const { tenant } = useCurrentTenant();
  const tenantId = tenant?.id;
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"all" | "critical" | "warning" | "info">("all");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [scanning, setScanning] = useState(false);

  // Clients with at least one ad-platform integration synced
  const { data: clients = [] } = useQuery({
    queryKey: ["alerts-clients-with-integrations", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name, meta_ads_account_id, google_ads_account_id")
        .eq("tenant_id", tenantId!)
        .or("meta_ads_account_id.not.is.null,google_ads_account_id.not.is.null");
      if (error) throw error;
      return (data || []) as ClientWithIntegration[];
    },
  });

  const clientMap = useMemo(() => {
    const m = new Map<string, ClientWithIntegration>();
    for (const c of clients) m.set(c.id, c);
    return m;
  }, [clients]);

  const { data: alerts = [], refetch, isFetching } = useQuery({
    queryKey: ["campaign-alerts", tenantId, clients.map(c => c.id).join(",")],
    enabled: !!tenantId,
    queryFn: async () => {
      if (clients.length === 0) return [] as Alert[];
      const { data, error } = await supabase
        .from("campaign_alerts")
        .select("*")
        .eq("tenant_id", tenantId!)
        .is("resolved_at", null)
        .in("client_id", clients.map(c => c.id))
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data || []) as Alert[];
    },
  });

  const counts = useMemo(() => {
    const c = { all: alerts.length, critical: 0, warning: 0, info: 0 };
    for (const a of alerts) c[a.severity]++;
    return c;
  }, [alerts]);

  const filtered = useMemo(() => {
    if (filter === "all") return alerts;
    return alerts.filter(a => a.severity === filter);
  }, [alerts, filter]);

  const grouped = useMemo(() => {
    const map = new Map<string, Alert[]>();
    for (const a of filtered) {
      if (!a.client_id) continue;
      if (!map.has(a.client_id)) map.set(a.client_id, []);
      map.get(a.client_id)!.push(a);
    }
    // Sort by critical count desc
    return Array.from(map.entries()).sort(([, a], [, b]) => {
      const ac = a.filter(x => x.severity === "critical").length;
      const bc = b.filter(x => x.severity === "critical").length;
      if (bc !== ac) return bc - ac;
      return b.length - a.length;
    });
  }, [filtered]);

  const toggleClient = (id: string) =>
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));

  const acknowledge = async (id: string) => {
    const { error } = await supabase
      .from("campaign_alerts")
      .update({ acknowledged_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      toast.error("שגיאה בסימון התראה");
      return;
    }
    toast.success("סומן כטופל");
    qc.invalidateQueries({ queryKey: ["campaign-alerts"] });
  };

  const resolve = async (id: string) => {
    const { error } = await supabase
      .from("campaign_alerts")
      .update({ resolved_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      toast.error("שגיאה");
      return;
    }
    toast.success("ההתראה נסגרה");
    qc.invalidateQueries({ queryKey: ["campaign-alerts"] });
  };

  const scanNow = async () => {
    setScanning(true);
    try {
      const { error } = await supabase.functions.invoke("fb-campaign-monitor", {
        body: { tenant_id: tenantId },
      });
      if (error) throw error;
      toast.success("הסריקה הופעלה");
      setTimeout(() => refetch(), 1500);
    } catch (e: any) {
      toast.error("שגיאה בסריקה: " + (e.message || ""));
    } finally {
      setScanning(false);
    }
  };

  return (
    <div className="h-full flex flex-col p-6 gap-4 overflow-hidden" dir="rtl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <AlertTriangle className="h-6 w-6 text-amber-500" />
            התראות קמפיינים
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            מעקב אוטומטי על קמפיינים פעילים — רק לקוחות עם חשבון מודעות מסונכרן
            {clients.length > 0 && ` · ${clients.length} לקוחות`}
          </p>
        </div>
        <Button onClick={scanNow} disabled={scanning} variant="outline" size="sm">
          <RefreshCw className={`h-4 w-4 ml-2 ${scanning ? "animate-spin" : ""}`} />
          סרוק עכשיו
        </Button>
      </div>

      {/* Filters */}
      <Tabs value={filter} onValueChange={(v) => setFilter(v as any)}>
        <TabsList>
          <TabsTrigger value="all">הכל ({counts.all})</TabsTrigger>
          <TabsTrigger value="critical">
            <span className="h-2 w-2 rounded-full bg-red-500 ml-2" />
            קריטיות ({counts.critical})
          </TabsTrigger>
          <TabsTrigger value="warning">
            <span className="h-2 w-2 rounded-full bg-amber-500 ml-2" />
            אזהרות ({counts.warning})
          </TabsTrigger>
          <TabsTrigger value="info">
            <span className="h-2 w-2 rounded-full bg-blue-500 ml-2" />
            מידע ({counts.info})
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Content */}
      <div className="flex-1 overflow-y-auto overscroll-contain space-y-3">
        {clients.length === 0 ? (
          <Card className="p-12 text-center">
            <Megaphone className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <h3 className="font-semibold mb-1">אין לקוחות עם דוחות מסונכרנים</h3>
            <p className="text-sm text-muted-foreground">
              חברו חשבון Meta Ads או Google Ads ללקוחות כדי לקבל התראות
            </p>
          </Card>
        ) : grouped.length === 0 ? (
          <Card className="p-12 text-center">
            <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-3" />
            <h3 className="font-semibold mb-1">אין התראות פתוחות</h3>
            <p className="text-sm text-muted-foreground">
              כל הקמפיינים של הלקוחות שלך תקינים {isFetching && "· מרענן..."}
            </p>
          </Card>
        ) : (
          grouped.map(([clientId, list]) => {
            const client = clientMap.get(clientId);
            const isOpen = expanded[clientId] ?? true;
            const critCount = list.filter(a => a.severity === "critical").length;
            const warnCount = list.filter(a => a.severity === "warning").length;
            return (
              <Card key={clientId} className="overflow-hidden">
                <button
                  onClick={() => toggleClient(clientId)}
                  className="w-full flex items-center justify-between p-4 hover:bg-muted/40 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    <span className="font-semibold text-base">{client?.name || "לקוח"}</span>
                    <Badge variant="outline" className="text-xs">
                      {list.length} התראות
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    {critCount > 0 && (
                      <Badge className="bg-red-500 hover:bg-red-500">{critCount} קריטיות</Badge>
                    )}
                    {warnCount > 0 && (
                      <Badge className="bg-amber-500 hover:bg-amber-500">{warnCount} אזהרות</Badge>
                    )}
                  </div>
                </button>
                {isOpen && (
                  <div className="border-t divide-y">
                    {list.map(alert => {
                      const cfg = severityConfig[alert.severity];
                      return (
                        <div key={alert.id} className={`p-4 ${cfg.border}`}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <Badge variant="outline" className={cfg.text}>
                                  {alertTypeLabels[alert.alert_type] || alert.alert_type}
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  {formatDistanceToNow(new Date(alert.created_at), { addSuffix: true, locale: he })}
                                </span>
                              </div>
                              <div className="font-medium truncate">
                                {alert.campaign_name || alert.campaign_id}
                              </div>
                              {alert.ad_account_id && (
                                <div className="text-xs text-muted-foreground mt-0.5">
                                  חשבון מודעות: {alert.ad_account_id}
                                </div>
                              )}
                              {alert.details?.message && (
                                <p className="text-sm mt-1.5 text-muted-foreground">{alert.details.message}</p>
                              )}
                            </div>
                            <div className="flex flex-col gap-1.5 shrink-0">
                              {!alert.acknowledged_at && (
                                <Button size="sm" variant="outline" onClick={() => acknowledge(alert.id)}>
                                  סמן כטופל
                                </Button>
                              )}
                              <Button size="sm" variant="ghost" onClick={() => resolve(alert.id)}>
                                סגור
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
