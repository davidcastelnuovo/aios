import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plug, Trash2, Plus, CheckCircle2, XCircle, Wrench } from "lucide-react";
import { toast } from "sonner";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";

// Production Supabase project ref (AfterLead). Used to prefill the Claude MCP URL.
const SUPABASE_PROJECT_REF = "zvoijyneresvkadpprel";

export function McpConnectionsTab({ agent }: { agent: any }) {
  const qc = useQueryClient();
  const { tenantId } = useCurrentTenant();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [bearer, setBearer] = useState("");

  const { data: conns } = useQuery({
    queryKey: ["mcp-connections", agent.id, tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("agent_mcp_connections")
        .select("*")
        .eq("tenant_id", tenantId)
        .or(`agent_id.eq.${agent.id},agent_id.is.null`)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!tenantId,
  });

  const connect = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("mcp-connect", {
        body: { tenant_id: tenantId, agent_id: agent.id, name, url, bearer_token: bearer || undefined },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (d) => {
      toast.success(`חובר! ${d?.tools?.length ?? 0} כלים זמינים`);
      qc.invalidateQueries({ queryKey: ["mcp-connections"] });
      setOpen(false); setName(""); setUrl(""); setBearer("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const disconnect = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("agent_mcp_connections").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mcp-connections"] }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Plug className="h-5 w-5" />
          <h3 className="text-lg font-semibold">MCP Connections</h3>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 me-1" />חיבור חדש</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>חיבור MCP Server</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => {
                  setName("Claude");
                  setUrl(`https://${SUPABASE_PROJECT_REF}.supabase.co/functions/v1/claude-mcp`);
                }}
              >
                ⚡ הוסף את Claude (כרמן תוכל לבקש ממנו משימות פיתוח)
              </Button>
              <p className="text-xs text-muted-foreground">
                ממלא שם + URL אוטומטית. הזן את ה-Bearer (ערך CLAUDE_MCP_BEARER) ולחץ התחבר.
              </p>
              <div>
                <Label>שם</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="לדוגמה: Notion" />
              </div>
              <div>
                <Label>URL</Label>
                <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://mcp.example.com/" dir="ltr" />
              </div>
              <div>
                <Label>Bearer Token (אופציונלי)</Label>
                <Input type="password" value={bearer} onChange={(e) => setBearer(e.target.value)} dir="ltr" />
              </div>
              <Button onClick={() => connect.mutate()} disabled={!name || !url || connect.isPending} className="w-full">
                {connect.isPending ? "מתחבר…" : "התחבר"}
              </Button>
              <p className="text-xs text-muted-foreground">
                תמיכת OAuth מלאה בקרוב. כרגע: HTTP MCP servers עם או בלי Bearer token.
              </p>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-2">
        {(conns ?? []).map((c: any) => (
          <Card key={c.id} className="p-3">
            <div className="flex items-center gap-3">
              {c.state === "ready" ? <CheckCircle2 className="h-5 w-5 text-green-500" /> : <XCircle className="h-5 w-5 text-destructive" />}
              <div className="flex-1 min-w-0">
                <div className="font-medium">{c.name}</div>
                <div className="text-xs text-muted-foreground truncate" dir="ltr">{c.url}</div>
                {c.last_error && <div className="text-xs text-destructive truncate">{c.last_error}</div>}
              </div>
              <Badge variant={c.state === "ready" ? "default" : "destructive"}>{c.state}</Badge>
              <Badge variant="outline"><Wrench className="h-3 w-3 me-1" />{(c.available_tools ?? []).length}</Badge>
              <Button variant="ghost" size="icon" onClick={() => disconnect.mutate(c.id)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
            {c.state === "ready" && (c.available_tools ?? []).length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1 ps-8">
                {(c.available_tools as any[]).slice(0, 12).map((t: any) => (
                  <Badge key={t.name} variant="secondary" className="text-xs">{t.name}</Badge>
                ))}
              </div>
            )}
          </Card>
        ))}
        {!conns?.length && <p className="text-sm text-muted-foreground text-center py-6">אין חיבורי MCP. הוסף אחד למעלה.</p>}
      </div>
    </div>
  );
}
