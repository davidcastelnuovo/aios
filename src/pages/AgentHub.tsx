import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { useIsMobile } from "@/hooks/use-mobile";
import { AgentSidebar, type AgentListItem } from "@/components/agents/AgentSidebar";
import { AgentEditor } from "@/components/agents/AgentEditor";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";
import { toast } from "sonner";

export default function AgentHub() {
  const { tenantId } = useCurrentTenant();
  const qc = useQueryClient();
  const isMobile = useIsMobile();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
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

  const handleSelect = (id: string) => {
    setSelectedId(id);
    if (isMobile) setSheetOpen(false);
  };

  const handleCreate = () => {
    setCreateOpen(true);
    if (isMobile) setSheetOpen(false);
  };

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col md:flex-row overflow-hidden" dir="rtl">
      {isMobile ? (
        <>
          <div className="flex items-center justify-between gap-2 p-2 border-b bg-card shrink-0">
            <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Menu className="h-4 w-4" />
                  סוכנים
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="p-0 w-72 max-w-[85vw]">
                <AgentSidebar
                  agents={list}
                  selectedId={selectedId}
                  onSelect={handleSelect}
                  onCreate={handleCreate}
                />
              </SheetContent>
            </Sheet>
            <div className="text-sm font-medium truncate">
              {selectedAgent?.name || "בחר סוכן"}
            </div>
          </div>
        </>
      ) : (
        <AgentSidebar
          agents={list}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onCreate={() => setCreateOpen(true)}
        />
      )}

      {selectedAgent ? (
        <AgentEditor key={selectedAgent.id} agent={selectedAgent} />
      ) : (
        <div className="flex-1 flex items-center justify-center text-muted-foreground p-6 text-center">
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
