import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { BrainSelector } from "./BrainSelector";
import { ProfileTab } from "./tabs/ProfileTab";
import { GoalsTab } from "./tabs/GoalsTab";
import { ToolsTab } from "./tabs/ToolsTab";
import { KnowledgeTab } from "./tabs/KnowledgeTab";
import { MemoryTab } from "./tabs/MemoryTab";
import { TasksTab } from "./tabs/TasksTab";
import { CostTab } from "./tabs/CostTab";
import { Crown, Bot } from "lucide-react";
import { toast } from "sonner";

const CARMEN_AVATAR = "https://d2xsxph8kpxj0f.cloudfront.net/310419663030948028/XGJWpzb5zh76ZdoV37Q3K8/carmen-agents-avatar_17945787.png";

function isCarmen(name: string) {
  const n = (name || "").toLowerCase();
  return n.includes("carmen") || name?.includes("כרמן");
}

export function AgentEditor({ agent }: { agent: any }) {
  const qc = useQueryClient();
  const carmen = isCarmen(agent.name);

  const updateEngine = useMutation({
    mutationFn: async (engine: string) => {
      const { error } = await supabase.from("ai_agents").update({ engine }).eq("id", agent.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ai-agents"] });
      toast.success("המוח עודכן");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <div className="p-4 border-b flex items-center gap-3">
        {carmen ? (
          <img src={CARMEN_AVATAR} alt={agent.name} className="h-12 w-12 rounded-full object-cover" />
        ) : (
          <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
            <Bot className="h-6 w-6" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="font-bold text-lg truncate">{agent.name}</h2>
            {carmen && <Crown className="h-4 w-4 text-amber-500" />}
            {agent.active ? (
              <Badge className="bg-green-500/15 text-green-700 dark:text-green-300">● פעיל</Badge>
            ) : (
              <Badge variant="secondary">כבוי</Badge>
            )}
          </div>
          {agent.talent && <p className="text-sm text-muted-foreground truncate">{agent.talent}</p>}
        </div>
        <div className="w-72">
          <BrainSelector value={agent.engine} onChange={(v) => updateEngine.mutate(v)} />
        </div>
      </div>

      <Tabs defaultValue="profile" className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="mx-4 mt-3 self-start">
          <TabsTrigger value="profile">⚙️ פרופיל</TabsTrigger>
          <TabsTrigger value="goals">🎯 מטרות</TabsTrigger>
          <TabsTrigger value="tasks">📋 משימות</TabsTrigger>
          <TabsTrigger value="tools">🛠️ כלים</TabsTrigger>
          <TabsTrigger value="knowledge">📚 ידע</TabsTrigger>
          <TabsTrigger value="memory">🧠 זיכרון</TabsTrigger>
        </TabsList>
        <div className="flex-1 overflow-auto p-4">
          <TabsContent value="profile" className="mt-0"><ProfileTab agent={agent} /></TabsContent>
          <TabsContent value="goals" className="mt-0"><GoalsTab agentId={agent.id} /></TabsContent>
          <TabsContent value="tasks" className="mt-0"><TasksTab agent={agent} /></TabsContent>
          <TabsContent value="tools" className="mt-0"><ToolsTab agent={agent} /></TabsContent>
          <TabsContent value="knowledge" className="mt-0"><KnowledgeTab agentId={agent.id} /></TabsContent>
          <TabsContent value="memory" className="mt-0"><MemoryTab agent={agent} /></TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
