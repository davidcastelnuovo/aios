import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Wrench, Plug, Sparkles, ShieldCheck, Save } from "lucide-react";
import { toast } from "sonner";
import { AGENT_TOOLS_CATALOG } from "@/lib/agentToolsCatalog";

// Carmen's access control. Default = everything ON; turning a switch OFF adds the
// item to the matching denylist on ai_agents (disabled_tools / disabled_skins /
// disabled_integrations), which run-ai-agent subtracts at runtime.
export default function CarmenAccess() {
  const { tenantId } = useCurrentTenant();
  const queryClient = useQueryClient();

  const [offTools, setOffTools] = useState<Set<string>>(new Set());
  const [offSkins, setOffSkins] = useState<Set<string>>(new Set());
  const [offIntegrations, setOffIntegrations] = useState<Set<string>>(new Set());

  const { data: agent, isLoading: loadingAgent } = useQuery({
    queryKey: ["carmen-access-agent", tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("ai_agents" as any)
        .select("id,name,active,disabled_tools,disabled_skins,disabled_integrations")
        .eq("tenant_id", tenantId)
        .eq("active", true);
      const list = (data as any[]) || [];
      return list.find((a) => /כרמן|carmen/i.test(a.name || "")) || list[0] || null;
    },
    enabled: !!tenantId,
  });

  useEffect(() => {
    if (!agent) return;
    setOffTools(new Set(agent.disabled_tools || []));
    setOffSkins(new Set(agent.disabled_skins || []));
    setOffIntegrations(new Set(agent.disabled_integrations || []));
  }, [agent]);

  const { data: skins } = useQuery({
    queryKey: ["carmen-access-skins", tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("ai_skills" as any)
        .select("slug,name,scope,is_active")
        .eq("is_active", true)
        .or(tenantId ? `scope.eq.global,and(scope.eq.tenant,tenant_id.eq.${tenantId})` : "scope.eq.global");
      const bySlug = new Map<string, any>();
      for (const r of (data as any[]) || []) {
        if (!r.slug) continue;
        const ex = bySlug.get(r.slug);
        if (!ex || r.scope === "tenant") bySlug.set(r.slug, r);
      }
      return Array.from(bySlug.values()).sort((a, b) => a.name.localeCompare(b.name, "he"));
    },
    enabled: !!tenantId,
  });

  const { data: integrations } = useQuery({
    queryKey: ["carmen-access-integrations", tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("agent_mcp_connections" as any)
        .select("id,name,state")
        .eq("tenant_id", tenantId);
      return (data as any[]) || [];
    },
    enabled: !!tenantId,
  });

  const toolGroups = useMemo(() => {
    const g: Record<string, typeof AGENT_TOOLS_CATALOG> = {};
    for (const t of AGENT_TOOLS_CATALOG) (g[t.group] ||= []).push(t);
    return g;
  }, []);

  const save = useMutation({
    mutationFn: async () => {
      if (!agent?.id) throw new Error("לא נמצא סוכן (כרמן).");
      const { error } = await supabase
        .from("ai_agents" as any)
        .update({
          disabled_tools: Array.from(offTools),
          disabled_skins: Array.from(offSkins),
          disabled_integrations: Array.from(offIntegrations),
        })
        .eq("id", agent.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("הגישות נשמרו");
      queryClient.invalidateQueries({ queryKey: ["carmen-access-agent", tenantId] });
    },
    onError: (e: any) => toast.error("שמירה נכשלה: " + (e?.message || e)),
  });

  const toggle = (set: Set<string>, setter: (s: Set<string>) => void, key: string) => {
    const next = new Set(set);
    next.has(key) ? next.delete(key) : next.add(key);
    setter(next);
  };

  const Row = ({ on, label, sub, onToggle }: { on: boolean; label: string; sub?: string; onToggle: () => void }) => (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <Switch checked={on} onCheckedChange={onToggle} />
      <div className="flex-1 text-right">
        <span className="text-sm">{label}</span>
        {sub && <span className="text-[11px] text-muted-foreground block">{sub}</span>}
      </div>
    </div>
  );

  if (loadingAgent) {
    return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }
  if (!agent) {
    return <div className="p-6 text-center text-muted-foreground" dir="rtl">לא נמצא סוכן פעיל (כרמן). צרי סוכן תחילה.</div>;
  }

  const totalOff = offTools.size + offSkins.size + offIntegrations.size;

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-5xl mx-auto" dir="rtl">
      <div className="flex items-center justify-between">
        <Button onClick={() => save.mutate()} disabled={save.isPending} className="gap-1.5">
          {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          שמור גישות
        </Button>
        <div className="text-right">
          <h1 className="text-2xl font-bold flex items-center gap-2 justify-end">
            <ShieldCheck className="h-6 w-6 text-emerald-500" />גישות של כרמן
          </h1>
          <p className="text-sm text-muted-foreground">
            כרמן ניגשת לכל הכלים, האינטגרציות והסקינז כברירת מחדל. כבי כאן מה שלא רוצה שתשתמש בו.
            {totalOff > 0 && <Badge variant="outline" className="mr-2 text-[10px]">{totalOff} מכובים</Badge>}
          </p>
        </div>
      </div>

      <ScrollArea className="h-[calc(100vh-190px)]">
        <div className="grid gap-4 md:grid-cols-2 pl-2">
          {/* Tools */}
          <Card className="p-4 space-y-3 md:col-span-2">
            <h2 className="font-semibold flex items-center gap-1.5 justify-end"><Wrench className="h-4 w-4" />כלים</h2>
            <div className="grid gap-x-6 md:grid-cols-2">
              {Object.entries(toolGroups).map(([group, tools]) => (
                <div key={group} className="space-y-0.5">
                  <p className="text-[11px] font-medium text-muted-foreground text-right pt-2">{group}</p>
                  {tools.map((t) => (
                    <Row
                      key={t.name}
                      on={!offTools.has(t.name)}
                      label={t.label}
                      sub={t.name}
                      onToggle={() => toggle(offTools, setOffTools, t.name)}
                    />
                  ))}
                </div>
              ))}
            </div>
          </Card>

          {/* Skins */}
          <Card className="p-4 space-y-2">
            <h2 className="font-semibold flex items-center gap-1.5 justify-end"><Sparkles className="h-4 w-4 text-orange-500" />סקינז</h2>
            {(skins || []).map((s: any) => (
              <Row
                key={s.slug}
                on={!offSkins.has(s.slug)}
                label={s.name}
                sub={s.slug}
                onToggle={() => toggle(offSkins, setOffSkins, s.slug)}
              />
            ))}
            {(!skins || skins.length === 0) && <p className="text-xs text-muted-foreground text-center py-2">אין סקינז.</p>}
          </Card>

          {/* Integrations */}
          <Card className="p-4 space-y-2">
            <h2 className="font-semibold flex items-center gap-1.5 justify-end"><Plug className="h-4 w-4 text-blue-500" />אינטגרציות (MCP)</h2>
            {(integrations || []).map((c: any) => (
              <Row
                key={c.id}
                on={!offIntegrations.has(c.name)}
                label={c.name}
                sub={c.state}
                onToggle={() => toggle(offIntegrations, setOffIntegrations, c.name)}
              />
            ))}
            {(!integrations || integrations.length === 0) && (
              <p className="text-xs text-muted-foreground text-center py-2">אין חיבורי MCP. חיבורים יופיעו כאן אוטומטית.</p>
            )}
          </Card>
        </div>
      </ScrollArea>
    </div>
  );
}
