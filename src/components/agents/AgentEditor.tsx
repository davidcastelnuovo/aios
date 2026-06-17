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
import { ApprovalsTab } from "./tabs/ApprovalsTab";
import { UserProfilesTab } from "./tabs/UserProfilesTab";
import { ToolRegistryTab } from "./tabs/ToolRegistryTab";
import { RunsTab } from "./tabs/RunsTab";
import { SupervisorTab } from "./tabs/SupervisorTab";
import { McpConnectionsTab } from "./tabs/McpConnectionsTab";
import { EvalsTab } from "./tabs/EvalsTab";

import { Crown, Bot, Settings, ListTodo, ChevronDown } from "lucide-react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useTenantPath } from "@/hooks/useTenantPath";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

      <AgentTabsWithUrl agent={agent} />
    </div>
  );
}

function AgentTabsWithUrl({ agent }: { agent: any }) {
  const [params, setParams] = useSearchParams();
  const initial = params.get("tab") || "profile";
  return (
    <Tabs
      value={initial}
      onValueChange={(v) => { params.set("tab", v); setParams(params, { replace: true }); }}
      className="flex-1 flex flex-col overflow-hidden"
    >
      <TabsList className="mx-4 mt-3 self-start flex-wrap h-auto">
        <TabsTrigger value="profile">⚙️ פרופיל</TabsTrigger>
        <TabsTrigger value="goals">🎯 מטרות</TabsTrigger>
        <TabsTrigger value="tasks">📋 משימות</TabsTrigger>
        <TabsTrigger value="tools">🛠️ כלים</TabsTrigger>
        <TabsTrigger value="registry">📚 מאגר כלים</TabsTrigger>
        <TabsTrigger value="mcp">🔌 MCP</TabsTrigger>
        <TabsTrigger value="supervisor">👑 Supervisor</TabsTrigger>
        <TabsTrigger value="runs">🔁 ריצות</TabsTrigger>
        <TabsTrigger value="evals">✅ Evals</TabsTrigger>
        <TabsTrigger value="knowledge">📖 ידע</TabsTrigger>
        <TabsTrigger value="memory">🧠 זיכרון</TabsTrigger>
        <TabsTrigger value="approvals">🛡️ אישורים</TabsTrigger>
        <TabsTrigger value="user-profiles">👥 פרופילי משתמשים</TabsTrigger>
        <TabsTrigger value="cost">💰 עלות</TabsTrigger>
      </TabsList>
      <div className="flex-1 overflow-auto p-4">
        <TabsContent value="profile" className="mt-0"><ProfileTab agent={agent} /></TabsContent>
        <TabsContent value="goals" className="mt-0"><GoalsTab agentId={agent.id} /></TabsContent>
        <TabsContent value="tasks" className="mt-0"><TasksTab agent={agent} /></TabsContent>
        <TabsContent value="tools" className="mt-0"><ToolsTab agent={agent} /></TabsContent>
        <TabsContent value="registry" className="mt-0"><ToolRegistryTab /></TabsContent>
        <TabsContent value="mcp" className="mt-0"><McpConnectionsTab agent={agent} /></TabsContent>
        <TabsContent value="supervisor" className="mt-0"><SupervisorTab agent={agent} /></TabsContent>
        <TabsContent value="runs" className="mt-0"><RunsTab agent={agent} /></TabsContent>
        <TabsContent value="evals" className="mt-0"><EvalsTab agent={agent} /></TabsContent>
        <TabsContent value="knowledge" className="mt-0"><KnowledgeTab agentId={agent.id} /></TabsContent>
        <TabsContent value="memory" className="mt-0"><MemoryTab agent={agent} /></TabsContent>
        <TabsContent value="approvals" className="mt-0"><ApprovalsTab agent={agent} /></TabsContent>
        <TabsContent value="user-profiles" className="mt-0"><UserProfilesTab agent={agent} /></TabsContent>
        <TabsContent value="cost" className="mt-0"><CostTab agent={agent} /></TabsContent>
      </div>
    </Tabs>
  );
}


