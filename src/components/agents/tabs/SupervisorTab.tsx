import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Crown, Trash2, Plus, Play } from "lucide-react";
import { toast } from "sonner";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";

export function SupervisorTab({ agent }: { agent: any }) {
  const qc = useQueryClient();
  const { tenantId } = useCurrentTenant();
  const [childId, setChildId] = useState("");
  const [hint, setHint] = useState("");
  const [goal, setGoal] = useState("");

  const { data: allAgents } = useQuery({
    queryKey: ["ai-agents", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("ai_agents")
        .select("id, name, talent").eq("tenant_id", tenantId).neq("id", agent.id);
      return data ?? [];
    },
    enabled: !!tenantId,
  });

  const { data: links } = useQuery({
    queryKey: ["agent-supervisors", agent.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("agent_supervisors")
        .select("*, child:ai_agents!agent_supervisors_child_agent_id_fkey(id, name, talent)")
        .eq("supervisor_agent_id", agent.id)
        .order("priority", { ascending: false });
      return data ?? [];
    },
  });

  const addChild = useMutation({
    mutationFn: async () => {
      if (!childId) throw new Error("בחר סוכן");
      const { error } = await supabase.from("agent_supervisors").insert({
        tenant_id: tenantId, supervisor_agent_id: agent.id,
        child_agent_id: childId, routing_hint: hint || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agent-supervisors", agent.id] });
      setChildId(""); setHint(""); toast.success("נוסף");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: async ({ id, enabled }: any) => {
      const { error } = await supabase.from("agent_supervisors").update({ enabled }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["agent-supervisors", agent.id] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("agent_supervisors").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["agent-supervisors", agent.id] }),
  });

  const runSupervisor = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("run-agent-supervisor", {
        body: { supervisor_agent_id: agent.id, goal, tenant_id: tenantId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (d) => {
      toast.success("Supervisor רץ — " + (d?.delegations?.length ?? 0) + " האצלות");
      qc.invalidateQueries({ queryKey: ["agent-runs"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Crown className="h-5 w-5 text-amber-500" />
        <h3 className="text-lg font-semibold">Supervisor — סוכנים שכפופים ל-{agent.name}</h3>
      </div>
      <p className="text-sm text-muted-foreground">
        כשתריץ את ה-Supervisor עם מטרה, הוא יבחר באופן אוטומטי איזה סוכן-בן מתאים ויאציל לו.
      </p>

      <Card className="p-4 space-y-3">
        <div className="font-medium">הוסף סוכן-בן</div>
        <div className="flex gap-2">
          <Select value={childId} onValueChange={setChildId}>
            <SelectTrigger className="flex-1"><SelectValue placeholder="בחר סוכן" /></SelectTrigger>
            <SelectContent>
              {(allAgents ?? []).map((a: any) => (
                <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input placeholder="רמז ניתוב (אופציונלי)" value={hint} onChange={(e) => setHint(e.target.value)} className="flex-1" />
          <Button onClick={() => addChild.mutate()}><Plus className="h-4 w-4 me-1" />הוסף</Button>
        </div>
      </Card>

      <div className="space-y-2">
        {(links ?? []).map((l: any) => (
          <Card key={l.id} className="p-3 flex items-center gap-3">
            <Switch checked={l.enabled} onCheckedChange={(v) => toggle.mutate({ id: l.id, enabled: v })} />
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">{l.child?.name}</div>
              {l.routing_hint && <div className="text-xs text-muted-foreground truncate">💡 {l.routing_hint}</div>}
            </div>
            <Badge variant="outline">priority {l.priority}</Badge>
            <Button variant="ghost" size="icon" onClick={() => remove.mutate(l.id)}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </Card>
        ))}
        {!links?.length && <p className="text-sm text-muted-foreground text-center py-6">אין סוכנים-בנים. הוסף אחד למעלה.</p>}
      </div>

      <Card className="p-4 space-y-2 border-amber-500/30 bg-amber-500/5">
        <div className="font-medium">🚀 הרץ Supervisor</div>
        <Input placeholder="מטרה (לדוגמה: נתח את ביצועי הלקוחות השבוע)" value={goal} onChange={(e) => setGoal(e.target.value)} />
        <Button onClick={() => runSupervisor.mutate()} disabled={!goal || !links?.length || runSupervisor.isPending}>
          <Play className="h-4 w-4 me-1" />
          {runSupervisor.isPending ? "רץ…" : "הפעל"}
        </Button>
      </Card>
    </div>
  );
}
