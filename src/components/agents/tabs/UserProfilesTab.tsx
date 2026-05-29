import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, UserCog, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useTenant } from "@/contexts/TenantContext";
import { formatDistanceToNow } from "date-fns";
import { he } from "date-fns/locale";

export function UserProfilesTab({ agent }: { agent: any }) {
  const { currentTenantId } = useTenant();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<any | null>(null);
  const [creating, setCreating] = useState(false);

  const { data: profiles = [], isLoading } = useQuery({
    queryKey: ["agent-user-profiles", agent.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agent_user_profiles")
        .select("*")
        .eq("agent_id", agent.id)
        .order("last_interaction_at", { ascending: false, nullsFirst: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  const save = useMutation({
    mutationFn: async (p: any) => {
      const payload = {
        tenant_id: currentTenantId,
        agent_id: agent.id,
        contact_phone: p.contact_phone,
        display_name: p.display_name || null,
        profile: typeof p.profile === "string" ? JSON.parse(p.profile || "{}") : p.profile,
      };
      if (p.id) {
        const { error } = await supabase.from("agent_user_profiles").update(payload).eq("id", p.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("agent_user_profiles").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agent-user-profiles", agent.id] });
      setEditing(null);
      setCreating(false);
      toast.success("נשמר");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("agent_user_profiles").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agent-user-profiles", agent.id] });
      toast.success("נמחק");
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <UserCog className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">פרופילי משתמשים</h3>
          <Badge variant="secondary">{profiles.length}</Badge>
        </div>
        <Button size="sm" onClick={() => { setEditing({ contact_phone: "", display_name: "", profile: "{}" }); setCreating(true); }}>
          <Plus className="h-4 w-4 ml-1" /> חדש
        </Button>
      </div>

      <ScrollArea className="h-[60vh]">
        <div className="space-y-2 pl-2">
          {isLoading && <p className="text-sm text-muted-foreground">טוען...</p>}
          {!isLoading && profiles.length === 0 && (
            <Card className="p-8 text-center text-muted-foreground">
              אין פרופילים. כרמן בונה אותם אוטומטית במהלך שיחות, או צור ידנית.
            </Card>
          )}
          {profiles.map((p) => (
            <Card key={p.id} className="p-3 hover:bg-muted/30 cursor-pointer" onClick={() => setEditing({ ...p, profile: JSON.stringify(p.profile, null, 2) })}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{p.display_name || p.contact_phone}</span>
                    <span className="text-xs text-muted-foreground" dir="ltr">{p.contact_phone}</span>
                  </div>
                  {p.last_interaction_at && (
                    <p className="text-xs text-muted-foreground mt-1">
                      אחרון: {formatDistanceToNow(new Date(p.last_interaction_at), { addSuffix: true, locale: he })}
                    </p>
                  )}
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={(e) => { e.stopPropagation(); if (confirm("למחוק?")) del.mutate(p.id); }}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </ScrollArea>

      <Dialog open={!!editing} onOpenChange={(o) => { if (!o) { setEditing(null); setCreating(false); } }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{creating ? "פרופיל חדש" : "עריכת פרופיל"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div>
                <Label>טלפון</Label>
                <Input
                  dir="ltr"
                  value={editing.contact_phone}
                  onChange={(e) => setEditing({ ...editing, contact_phone: e.target.value })}
                  disabled={!creating}
                />
              </div>
              <div>
                <Label>שם תצוגה</Label>
                <Input
                  value={editing.display_name || ""}
                  onChange={(e) => setEditing({ ...editing, display_name: e.target.value })}
                />
              </div>
              <div>
                <Label>פרופיל (JSON) – traits / preferences / communication_style / notes</Label>
                <Textarea
                  dir="ltr"
                  rows={12}
                  className="font-mono text-xs"
                  value={editing.profile}
                  onChange={(e) => setEditing({ ...editing, profile: e.target.value })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditing(null); setCreating(false); }}>ביטול</Button>
            <Button
              onClick={() => {
                try {
                  JSON.parse(editing.profile || "{}");
                } catch {
                  toast.error("JSON לא תקין");
                  return;
                }
                save.mutate(editing);
              }}
              disabled={save.isPending || !editing?.contact_phone}
            >
              שמור
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
