import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ShieldAlert } from "lucide-react";
import { useTenant } from "@/contexts/TenantContext";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { he } from "date-fns/locale";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

export function GlobalApprovalsBell() {
  const { currentTenantId, currentTenant } = useTenant();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: items = [] } = useQuery({
    queryKey: ["agent-approvals-global", currentTenantId],
    queryFn: async () => {
      if (!currentTenantId) return [];
      const { data, error } = await supabase
        .from("agent_approval_queue")
        .select("id, agent_id, tool_name, action_type, title, description, created_at, expires_at, ai_agents(name)")
        .eq("tenant_id", currentTenantId)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []).filter((it: any) => !it.expires_at || new Date(it.expires_at) > new Date());
    },
    enabled: !!currentTenantId,
    refetchInterval: 15_000,
  });

  // Lightweight realtime — best-effort, ignored if not enabled
  useEffect(() => {
    if (!currentTenantId) return;
    const ch = supabase
      .channel(`approvals-${currentTenantId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "agent_approval_queue", filter: `tenant_id=eq.${currentTenantId}` },
        () => qc.invalidateQueries({ queryKey: ["agent-approvals-global", currentTenantId] })
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [currentTenantId, qc]);

  const count = items.length;
  const slug = currentTenant?.slug;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" title="אישורי סוכן ממתינים">
          <ShieldAlert className="h-5 w-5" />
          {count > 0 && (
            <Badge className="absolute -top-1 -right-1 h-5 min-w-[20px] px-1 bg-red-600 text-white text-[10px] rounded-full">
              {count}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        <div className="p-3 border-b">
          <h4 className="font-semibold text-sm">אישורי סוכן ממתינים</h4>
          <p className="text-xs text-muted-foreground">{count} בקשות פתוחות</p>
        </div>
        <ScrollArea className="max-h-[60vh]">
          <div className="p-2 space-y-1">
            {count === 0 && <p className="text-sm text-muted-foreground p-4 text-center">אין בקשות</p>}
            {items.map((it: any) => (
              <button
                key={it.id}
                onClick={() => slug && navigate(`/t/${slug}/agents?agent=${it.agent_id}&tab=approvals`)}
                className="w-full text-right p-2 rounded hover:bg-muted text-sm"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium truncate">{it.tool_name || it.action_type || it.title}</span>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatDistanceToNow(new Date(it.created_at), { addSuffix: true, locale: he })}
                  </span>
                </div>
                {it.ai_agents?.name && (
                  <p className="text-xs text-muted-foreground">{it.ai_agents.name}</p>
                )}
              </button>
            ))}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
