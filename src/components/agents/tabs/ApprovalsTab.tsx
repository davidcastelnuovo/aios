import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle2, XCircle, Clock, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { he } from "date-fns/locale";

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { cls: string; label: string }> = {
    pending: { cls: "bg-amber-500/15 text-amber-700 dark:text-amber-300", label: "ממתין" },
    approved: { cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300", label: "אושר" },
    rejected: { cls: "bg-red-500/15 text-red-700 dark:text-red-300", label: "נדחה" },
    executed: { cls: "bg-blue-500/15 text-blue-700 dark:text-blue-300", label: "בוצע" },
    expired: { cls: "bg-muted text-muted-foreground", label: "פג תוקף" },
  };
  const m = map[status] ?? map.pending;
  return <Badge className={m.cls}>{m.label}</Badge>;
}

function ApprovalCard({ item, canDecide }: { item: any; canDecide: boolean }) {
  const qc = useQueryClient();

  const decide = useMutation({
    mutationFn: async (decision: "approved" | "rejected") => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("agent_approval_queue")
        .update({
          status: decision,
          approved_by: user?.id,
          approved_at: new Date().toISOString(),
        })
        .eq("id", item.id);
      if (error) throw error;

      if (decision === "approved") {
        try {
          await supabase.functions.invoke("resume-agent-run", {
            body: { approval_id: item.id, decision },
          });
        } catch (e) {
          console.warn("resume-agent-run failed", e);
        }
      }
    },
    onSuccess: (_, d) => {
      qc.invalidateQueries({ queryKey: ["agent-approvals"] });
      qc.invalidateQueries({ queryKey: ["agent-approvals-global"] });
      toast.success(d === "approved" ? "אושר" : "נדחה");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const expired = item.expires_at && new Date(item.expires_at) < new Date();

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <ShieldAlert className="h-4 w-4 text-amber-500" />
            <span className="font-semibold truncate">
              {item.tool_name || item.action_type || item.title}
            </span>
            <StatusBadge status={expired && item.status === "pending" ? "expired" : item.status} />
          </div>
          {item.description && (
            <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
          )}
        </div>
        <div className="text-xs text-muted-foreground whitespace-nowrap flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {formatDistanceToNow(new Date(item.created_at), { addSuffix: true, locale: he })}
        </div>
      </div>

      {(item.tool_input || item.context || item.proposed_changes) && (
        <pre className="text-xs bg-muted/50 rounded p-2 overflow-auto max-h-48 dir-ltr">
{JSON.stringify(item.tool_input ?? item.proposed_changes ?? item.context, null, 2)}
        </pre>
      )}

      {item.expires_at && item.status === "pending" && (
        <p className="text-xs text-muted-foreground">
          תוקף עד: {new Date(item.expires_at).toLocaleString("he-IL")}
        </p>
      )}

      {canDecide && item.status === "pending" && !expired && (
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={() => decide.mutate("approved")}
            disabled={decide.isPending}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            <CheckCircle2 className="h-4 w-4 ml-1" /> אשר
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => decide.mutate("rejected")}
            disabled={decide.isPending}
          >
            <XCircle className="h-4 w-4 ml-1" /> דחה
          </Button>
        </div>
      )}
    </Card>
  );
}

export function ApprovalsTab({ agent }: { agent: any }) {
  const [tab, setTab] = useState("pending");

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["agent-approvals", agent.id, tab],
    queryFn: async () => {
      let q = supabase
        .from("agent_approval_queue")
        .select("*")
        .eq("agent_id", agent.id)
        .order("created_at", { ascending: false })
        .limit(100);
      if (tab === "pending") q = q.eq("status", "pending");
      else q = q.in("status", ["approved", "rejected", "executed", "expired"]);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: tab === "pending" ? 10_000 : false,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <ShieldAlert className="h-5 w-5 text-amber-500" />
        <h3 className="font-semibold">אישורים</h3>
        <p className="text-sm text-muted-foreground">
          פעולות שדורשות אישור אנושי לפני ביצוע
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="pending">ממתינים</TabsTrigger>
          <TabsTrigger value="history">היסטוריה</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-3">
          <ScrollArea className="h-[60vh]">
            <div className="space-y-3 pl-2">
              {isLoading && <p className="text-sm text-muted-foreground">טוען...</p>}
              {!isLoading && items.length === 0 && (
                <Card className="p-8 text-center text-muted-foreground">
                  {tab === "pending" ? "אין בקשות ממתינות" : "אין היסטוריה"}
                </Card>
              )}
              {items.map((it) => (
                <ApprovalCard key={it.id} item={it} canDecide={tab === "pending"} />
              ))}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}
