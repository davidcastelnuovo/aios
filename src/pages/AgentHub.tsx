import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { AgentSidebar, type AgentListItem } from "@/components/agents/AgentSidebar";
import { AgentEditor } from "@/components/agents/AgentEditor";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function AgentHub() {
  const { tenantId } = useCurrentTenant();
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newTalent, setNewTalent] = useState("");

  const { data: agents = [] } = useQuery({
    queryKey: ["ai-agents", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_agents")
        .select("*")
        .eq("tenant_id", tenantId!)
        .order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    if (!selectedId && agents.length > 0) {
      const carmen = agents.find(a => (a.name || "").toLowerCase().includes("carmen") || a.name?.includes("כרמן"));
      setSelectedId(carmen?.id || agents[0].id);
    }
  }, [agents, selectedId]);

  const selectedAgent = agents.find(a => a.id === selectedId);

  const create = useMutation({
    mutationFn: async () => {
      if (!tenantId) throw new Error("missing tenant");
      const { data, error } = await supabase.from("ai_agents").insert({
        tenant_id: tenantId,
        name: newName,
        talent: newTalent,
        engine: "gemini-3-flash",
        active: true,
      }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["ai-agents"] });
      setSelectedId(data.id);
      setNewName(""); setNewTalent(""); setCreateOpen(false);
      toast.success("סוכן נוצר");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const list: AgentListItem[] = agents.map(a => ({
    id: a.id, name: a.name, active: a.active ?? true, engine: a.engine,
  }));

  return (
    <div className="h-[calc(100vh-4rem)] flex overflow-hidden" dir="rtl">
      <AgentSidebar
        agents={list}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onCreate={() => setCreateOpen(true)}
      />
      {selectedAgent ? (
        <AgentEditor key={selectedAgent.id} agent={selectedAgent} />
      ) : (
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          בחר סוכן מהרשימה או צור סוכן חדש
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>סוכן חדש</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>שם</Label>
              <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="לדוגמה: סוכן מכירות" />
            </div>
            <div>
              <Label>טלנט / מומחיות</Label>
              <Input value={newTalent} onChange={e => setNewTalent(e.target.value)} placeholder="מה הסוכן עושה?" />
            </div>
            <Button onClick={() => create.mutate()} disabled={!newName || create.isPending} className="w-full">
              {create.isPending ? "יוצר..." : "צור סוכן"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
