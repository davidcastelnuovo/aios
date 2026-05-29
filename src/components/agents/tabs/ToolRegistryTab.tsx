import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { toast } from "sonner";
import { Plus, Edit, Trash2, Library, Shield, Zap } from "lucide-react";

interface AgentTool {
  id?: string;
  tenant_id: string | null;
  name: string;
  display_name: string | null;
  category: string | null;
  description: string | null;
  input_schema: any;
  handler_kind: "edge" | "internal" | "mcp";
  handler_ref: string | null;
  requires_approval: boolean;
  enabled: boolean;
}

const EMPTY: AgentTool = {
  tenant_id: "",
  name: "",
  display_name: "",
  category: "general",
  description: "",
  input_schema: { type: "object", properties: {} },
  handler_kind: "edge",
  handler_ref: "",
  requires_approval: false,
  enabled: true,
};

export function ToolRegistryTab() {
  const { tenant } = useCurrentTenant();
  const tenantId = tenant?.id;
  const qc = useQueryClient();
  const [editing, setEditing] = useState<AgentTool | null>(null);
  const [schemaText, setSchemaText] = useState("");

  const { data: tools = [], isLoading } = useQuery({
    queryKey: ["agent-tools-registry", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agent_tools")
        .select("*")
        .or(`tenant_id.eq.${tenantId},tenant_id.is.null`)
        .order("category")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const save = useMutation({
    mutationFn: async (tool: AgentTool) => {
      let parsedSchema = tool.input_schema;
      try {
        parsedSchema = schemaText ? JSON.parse(schemaText) : { type: "object", properties: {} };
      } catch {
        throw new Error("Input schema אינו JSON תקין");
      }
      const payload = {
        ...tool,
        tenant_id: tenantId,
        input_schema: parsedSchema,
        handler_ref: tool.handler_ref || null,
        display_name: tool.display_name || tool.name,
      };
      if (tool.id) {
        const { error } = await supabase.from("agent_tools").update(payload).eq("id", tool.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("agent_tools").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agent-tools-registry"] });
      toast.success("נשמר");
      setEditing(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("agent_tools").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agent-tools-registry"] });
      toast.success("נמחק");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleEnabled = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const { error } = await supabase.from("agent_tools").update({ enabled }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["agent-tools-registry"] }),
  });

  const openEditor = (tool?: AgentTool) => {
    const t = tool ? { ...tool } : { ...EMPTY };
    setEditing(t);
    setSchemaText(JSON.stringify(t.input_schema ?? { type: "object", properties: {} }, null, 2));
  };

  const byCategory: Record<string, AgentTool[]> = {};
  for (const t of tools as AgentTool[]) {
    const c = t.category || "general";
    (byCategory[c] ||= []).push(t);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Library className="h-5 w-5 text-primary" />
        <h3 className="font-semibold">מאגר כלים (Tool Registry)</h3>
        <Badge variant="outline">{tools.length}</Badge>
        <div className="flex-1" />
        <Button size="sm" onClick={() => openEditor()}>
          <Plus className="h-4 w-4 ml-1" />
          כלי חדש
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        כל הכלים שזמינים לסוכנים. כלי עם <Shield className="inline h-3 w-3 mx-1" /> ידרוש אישור אנושי לפני ביצוע.
        ה-<code>handler_ref</code> מציין איזה Edge Function יקבל את הקריאה.
      </p>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">טוען...</div>
      ) : tools.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          עדיין אין כלים. לחץ "כלי חדש" כדי להתחיל.
        </Card>
      ) : (
        Object.entries(byCategory).map(([cat, list]) => (
          <Card key={cat} className="p-3">
            <h4 className="text-sm font-medium mb-2 text-muted-foreground">{cat}</h4>
            <div className="space-y-2">
              {list.map((t) => (
                <div key={t.id} className="flex items-center gap-2 p-2 rounded border">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{t.name}</code>
                      <span className="text-sm font-medium truncate">{t.display_name || t.name}</span>
                      {t.requires_approval && (
                        <Badge variant="outline" className="gap-1">
                          <Shield className="h-3 w-3" />
                          אישור
                        </Badge>
                      )}
                      <Badge variant="secondary" className="gap-1">
                        <Zap className="h-3 w-3" />
                        {t.handler_kind}
                      </Badge>
                      {t.tenant_id === null && <Badge variant="outline">גלובלי</Badge>}
                    </div>
                    {t.description && (
                      <p className="text-xs text-muted-foreground mt-1 truncate">{t.description}</p>
                    )}
                    {t.handler_ref && (
                      <code className="text-[10px] text-muted-foreground">→ {t.handler_ref}</code>
                    )}
                  </div>
                  <Switch
                    checked={t.enabled}
                    onCheckedChange={(v) => t.id && toggleEnabled.mutate({ id: t.id, enabled: v })}
                    disabled={t.tenant_id === null}
                  />
                  <Button size="sm" variant="ghost" onClick={() => openEditor(t)} disabled={t.tenant_id === null}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => t.id && confirm(`למחוק "${t.name}"?`) && remove.mutate(t.id)}
                    disabled={t.tenant_id === null}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          </Card>
        ))
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "עריכת כלי" : "כלי חדש"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>שם (snake_case)</Label>
                  <Input
                    value={editing.name}
                    onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                    placeholder="send_email"
                  />
                </div>
                <div>
                  <Label>תווית (לתצוגה)</Label>
                  <Input
                    value={editing.display_name ?? ""}
                    onChange={(e) => setEditing({ ...editing, display_name: e.target.value })}
                    placeholder="שליחת אימייל"
                  />
                </div>
              </div>
              <div>
                <Label>תיאור (לסוכן)</Label>
                <Textarea
                  value={editing.description ?? ""}
                  onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                  rows={2}
                  placeholder="מה הכלי עושה ומתי להשתמש בו..."
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>קטגוריה</Label>
                  <Input
                    value={editing.category ?? ""}
                    onChange={(e) => setEditing({ ...editing, category: e.target.value })}
                  />
                </div>
                <div>
                  <Label>סוג מבצע</Label>
                  <Select
                    value={editing.handler_kind}
                    onValueChange={(v: any) => setEditing({ ...editing, handler_kind: v })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="edge">Edge Function</SelectItem>
                      <SelectItem value="internal">Internal</SelectItem>
                      <SelectItem value="mcp">MCP Server</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>שם הפונקציה</Label>
                  <Input
                    value={editing.handler_ref ?? ""}
                    onChange={(e) => setEditing({ ...editing, handler_ref: e.target.value })}
                    placeholder="send-email"
                  />
                </div>
              </div>
              <div>
                <Label>Input Schema (JSON Schema)</Label>
                <Textarea
                  value={schemaText}
                  onChange={(e) => setSchemaText(e.target.value)}
                  rows={8}
                  className="font-mono text-xs"
                />
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Switch
                    checked={editing.requires_approval}
                    onCheckedChange={(v) => setEditing({ ...editing, requires_approval: v })}
                  />
                  <Shield className="h-4 w-4" />
                  דורש אישור אנושי
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Switch
                    checked={editing.enabled}
                    onCheckedChange={(v) => setEditing({ ...editing, enabled: v })}
                  />
                  פעיל
                </label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>ביטול</Button>
            <Button onClick={() => editing && save.mutate(editing)} disabled={save.isPending}>
              {save.isPending ? "שומר..." : "שמור"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
