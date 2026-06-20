import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Brain, Sparkles, AlertTriangle, CheckCircle2, MessageSquare, Trash2, RefreshCw, Loader2, Search } from "lucide-react";
import { format } from "date-fns";
import { he } from "date-fns/locale";

const CATEGORY_META: Record<string, { label: string; icon: any; color: string }> = {
  what_worked: { label: "מה עבד", icon: CheckCircle2, color: "text-emerald-600" },
  what_failed: { label: "מה לא עבד", icon: AlertTriangle, color: "text-rose-600" },
  instructions: { label: "הוראות מפורשות", icon: Sparkles, color: "text-amber-600" },
  style: { label: "העדפות סגנון", icon: Brain, color: "text-blue-600" },
  learned_facts: { label: "עובדות שנלמדו", icon: Brain, color: "text-purple-600" },
};

export default function CarmenInsights() {
  const { tenantId } = useCurrentTenant();
  const [tab, setTab] = useState("sessions");
  const [openSession, setOpenSession] = useState<any | null>(null);
  const [search, setSearch] = useState("");
  const [analyzing, setAnalyzing] = useState<string | null>(null);
  const [backfilling, setBackfilling] = useState(false);
  const [backfillProgress, setBackfillProgress] = useState({ done: 0, total: 0 });

  // Sessions
  const { data: sessions = [], refetch: refetchSessions } = useQuery({
    queryKey: ["carmen-sessions", tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("carmen_whatsapp_sessions")
        .select("*")
        .eq("tenant_id", tenantId!)
        .order("last_message_at", { ascending: false, nullsFirst: false })
        .limit(200);
      return data ?? [];
    },
    enabled: !!tenantId,
  });

  // Episodes (joined with sessions for quality)
  const { data: episodes = [], refetch: refetchEpisodes } = useQuery({
    queryKey: ["carmen-episodes", tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("carmen_memory_episodes")
        .select("*")
        .eq("tenant_id", tenantId!)
        .not("session_ref", "is", null)
        .order("created_at", { ascending: false })
        .limit(200);
      return data ?? [];
    },
    enabled: !!tenantId,
  });

  // Pointers (memories from learning)
  const { data: pointers = [], refetch: refetchPointers } = useQuery({
    queryKey: ["carmen-learn-pointers", tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("carmen_memory_pointers")
        .select("*")
        .eq("tenant_id", tenantId!)
        .in("category", ["what_worked", "what_failed", "instructions", "style", "learned_facts"])
        .order("created_at", { ascending: false })
        .limit(500);
      return data ?? [];
    },
    enabled: !!tenantId,
  });

  const episodesBySession = useMemo(() => {
    const m = new Map<string, any>();
    for (const e of episodes) m.set(e.session_ref, e);
    return m;
  }, [episodes]);

  const filteredSessions = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return sessions;
    return sessions.filter((x: any) =>
      [x.sender_name, x.phone, x.chat_id].filter(Boolean).join(" ").toLowerCase().includes(s)
    );
  }, [sessions, search]);

  const analyzeSession = async (sessionId: string, force = false) => {
    setAnalyzing(sessionId);
    try {
      const { data, error } = await supabase.functions.invoke("carmen-learn-from-session", {
        body: { session_id: sessionId, force },
      });
      if (error) throw error;
      if (data?.skipped) toast.info(`דילוג: ${data.reason}`);
      else toast.success(`נותח! איכות ${data?.quality_score ?? "?"}/5`);
      await Promise.all([refetchEpisodes(), refetchPointers()]);
    } catch (e: any) {
      toast.error(`שגיאה: ${e.message}`);
    } finally {
      setAnalyzing(null);
    }
  };

  const backfillAll = async () => {
    if (!confirm(`לנתח את כל ${sessions.length} השיחות? הפעולה תיקח כמה דקות.`)) return;
    setBackfilling(true);
    setBackfillProgress({ done: 0, total: sessions.length });
    const batch = 5;
    for (let i = 0; i < sessions.length; i += batch) {
      const slice = sessions.slice(i, i + batch);
      await Promise.all(slice.map((s: any) =>
        supabase.functions.invoke("carmen-learn-from-session", { body: { session_id: s.id } }).catch(() => null)
      ));
      setBackfillProgress({ done: Math.min(i + batch, sessions.length), total: sessions.length });
    }
    setBackfilling(false);
    toast.success("ניתוח הושלם!");
    await Promise.all([refetchEpisodes(), refetchPointers()]);
  };

  const deletePointer = async (id: string) => {
    await supabase.from("carmen_memory_pointers").delete().eq("id", id);
    refetchPointers();
    toast.success("נמחק");
  };

  const expirePointer = async (id: string) => {
    await supabase.from("carmen_memory_pointers").update({ valid_until: new Date().toISOString() }).eq("id", id);
    refetchPointers();
    toast.success("הוצא משימוש");
  };

  const pointersByCategory = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const p of pointers) (map[p.category] ??= []).push(p);
    return map;
  }, [pointers]);

  const stats = useMemo(() => {
    const analyzedCount = episodes.length;
    const avgQuality = episodes.length
      ? episodes.reduce((s: number, e: any) => s + (e.importance ?? 0), 0) / episodes.length
      : 0;
    return {
      sessions: sessions.length,
      analyzed: analyzedCount,
      pending: sessions.length - analyzedCount,
      avgQuality: avgQuality.toFixed(1),
      memories: pointers.filter((p: any) => !p.valid_until).length,
    };
  }, [sessions, episodes, pointers]);

  return (
    <div className="container mx-auto py-6 space-y-6" dir="rtl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Brain className="text-primary" />
            למידה עצמית של כרמן
          </h1>
          <p className="text-muted-foreground mt-1">
            כרמן לומדת אוטומטית מכל שיחה שנסגרת ומשפרת את עצמה
          </p>
        </div>
        <Button onClick={backfillAll} disabled={backfilling || sessions.length === 0} variant="outline">
          {backfilling ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Sparkles className="ml-2 h-4 w-4" />}
          נתח את כל השיחות הקיימות
        </Button>
      </div>

      {backfilling && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2 text-sm">
              <span>מנתח שיחות...</span>
              <span>{backfillProgress.done} / {backfillProgress.total}</span>
            </div>
            <Progress value={(backfillProgress.done / Math.max(1, backfillProgress.total)) * 100} />
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard label="סה״כ שיחות" value={stats.sessions} />
        <StatCard label="נותחו" value={stats.analyzed} accent="emerald" />
        <StatCard label="ממתינות" value={stats.pending} accent="amber" />
        <StatCard label="איכות ממוצעת" value={`${stats.avgQuality}/5`} accent="blue" />
        <StatCard label="זיכרונות פעילים" value={stats.memories} accent="purple" />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="sessions">שיחות</TabsTrigger>
          <TabsTrigger value="insights">תובנות</TabsTrigger>
          <TabsTrigger value="memories">זיכרונות</TabsTrigger>
        </TabsList>

        <TabsContent value="sessions" className="space-y-3">
          <div className="relative max-w-md">
            <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pr-9" placeholder="חיפוש לפי שם או טלפון" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Card>
            <CardContent className="p-0">
              <div className="divide-y">
                {filteredSessions.map((s: any) => {
                  const ep = episodesBySession.get(s.id);
                  return (
                    <div key={s.id} className="p-4 hover:bg-muted/40 flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium">{s.sender_name || s.phone || "ללא שם"}</span>
                          {s.phone && <span className="text-xs text-muted-foreground">{s.phone}</span>}
                          {ep ? (
                            <Badge variant="default" className="bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/20">
                              נותחה · איכות {ep.importance}/5
                            </Badge>
                          ) : (
                            <Badge variant="outline">ממתינה</Badge>
                          )}
                          {s.status && <Badge variant="secondary">{s.status}</Badge>}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {s.last_message_at && format(new Date(s.last_message_at), "d MMM yyyy HH:mm", { locale: he })}
                          {Array.isArray(s.conversation_history) && ` · ${s.conversation_history.length} הודעות`}
                        </div>
                        {ep?.summary && <p className="text-sm mt-1 line-clamp-2">{ep.summary}</p>}
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <Button size="sm" variant="ghost" onClick={() => setOpenSession(s)}>
                          <MessageSquare className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => analyzeSession(s.id, !!ep)} disabled={analyzing === s.id}>
                          {analyzing === s.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                  );
                })}
                {filteredSessions.length === 0 && (
                  <div className="p-8 text-center text-muted-foreground">אין שיחות</div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="insights" className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <InsightColumn title="✓ מה עבד" items={pointersByCategory.what_worked || []} color="emerald" onDelete={deletePointer} />
            <InsightColumn title="✗ מה לא עבד" items={pointersByCategory.what_failed || []} color="rose" onDelete={deletePointer} />
          </div>
        </TabsContent>

        <TabsContent value="memories" className="space-y-4">
          {Object.entries(CATEGORY_META).map(([cat, meta]) => {
            const items = pointersByCategory[cat] || [];
            if (cat === "what_worked" || cat === "what_failed") return null;
            const Icon = meta.icon;
            return (
              <Card key={cat}>
                <CardHeader>
                  <CardTitle className={`flex items-center gap-2 ${meta.color}`}>
                    <Icon className="h-5 w-5" />
                    {meta.label} <Badge variant="outline">{items.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {items.length === 0 && <p className="text-sm text-muted-foreground">אין רשומות</p>}
                  {items.map((p: any) => (
                    <div key={p.id} className={`flex items-start justify-between gap-2 p-3 rounded-md border ${p.valid_until ? "opacity-50" : ""}`}>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm">{p.summary || p.title}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {p.created_at && format(new Date(p.created_at), "d MMM yyyy", { locale: he })}
                          {p.valid_until && " · הוצא משימוש"}
                        </p>
                      </div>
                      <div className="flex gap-1">
                        {!p.valid_until && (
                          <Button size="sm" variant="ghost" onClick={() => expirePointer(p.id)}>הוצא משימוש</Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => deletePointer(p.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>
      </Tabs>

      <Sheet open={!!openSession} onOpenChange={(o) => !o && setOpenSession(null)}>
        <SheetContent className="sm:max-w-2xl" side="left">
          <SheetHeader>
            <SheetTitle>{openSession?.sender_name || openSession?.phone}</SheetTitle>
          </SheetHeader>
          <ScrollArea className="h-[calc(100vh-100px)] mt-4 pl-3">
            <div className="space-y-3">
              {Array.isArray(openSession?.conversation_history) &&
                openSession.conversation_history.map((m: any, i: number) => (
                  <div key={i} className={`p-3 rounded-lg ${m.role === "assistant" || m.direction === "outbound" ? "bg-primary/10 mr-8" : "bg-muted ml-8"}`}>
                    <div className="text-xs text-muted-foreground mb-1">{m.role || m.direction}</div>
                    <div className="text-sm whitespace-pre-wrap">{m.content || m.message || m.text}</div>
                  </div>
                ))}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: any; accent?: string }) {
  const colors: Record<string, string> = {
    emerald: "text-emerald-600",
    amber: "text-amber-600",
    blue: "text-blue-600",
    purple: "text-purple-600",
  };
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-sm text-muted-foreground">{label}</div>
        <div className={`text-2xl font-bold mt-1 ${accent ? colors[accent] : ""}`}>{value}</div>
      </CardContent>
    </Card>
  );
}

function InsightColumn({ title, items, color, onDelete }: { title: string; items: any[]; color: string; onDelete: (id: string) => void }) {
  const bg = color === "emerald" ? "bg-emerald-500/5 border-emerald-500/20" : "bg-rose-500/5 border-rose-500/20";
  return (
    <Card className={bg}>
      <CardHeader>
        <CardTitle className="text-base flex items-center justify-between">
          <span>{title}</span>
          <Badge variant="outline">{items.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.length === 0 && <p className="text-sm text-muted-foreground">אין רשומות</p>}
        {items.map((p: any) => (
          <div key={p.id} className="flex items-start justify-between gap-2 p-3 rounded-md bg-background border">
            <p className="text-sm flex-1">{p.summary || p.title}</p>
            <Button size="sm" variant="ghost" onClick={() => onDelete(p.id)}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
