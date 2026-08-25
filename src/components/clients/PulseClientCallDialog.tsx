import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { he } from "date-fns/locale";
import { Calendar, Loader2, Phone, Send, User } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { formatLastClientCall, type PulseSnapshotRow } from "@/lib/pulseDashboard";
import { isClientCallUpdate, resolveClientUpdateType } from "@/lib/clientUpdateType";

export type PulseClientCallTarget = {
  clientId: string;
  clientName: string;
  pulse: PulseSnapshotRow | null;
};

export type PulseClientCallSaved = {
  clientId: string;
  lastClientCallAt: string;
  lastClientCallBy: string;
};

interface PulseClientCallDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: PulseClientCallTarget | null;
  onSaved: (payload: PulseClientCallSaved) => void;
}

export function PulseClientCallDialog({
  open,
  onOpenChange,
  target,
  onSaved,
}: PulseClientCallDialogProps) {
  const { tenantId } = useCurrentTenant();
  const { user } = useCurrentUser();
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) setContent("");
  }, [open, target?.clientId]);

  const { data: callUpdates = [], isLoading: updatesLoading } = useQuery({
    queryKey: ["pulse-client-call-updates", target?.clientId],
    queryFn: async () => {
      if (!target?.clientId) return [];
      const { data, error } = await supabase
        .from("client_updates")
        .select(`
          id,
          content,
          update_type,
          created_at,
          user_id,
          profiles:user_id (full_name, email)
        `)
        .eq("client_id", target.clientId)
        .in("update_type", ["call", "weekly_update"])
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return (data ?? []).filter((row: any) =>
        isClientCallUpdate(row.update_type, row.content ?? ""),
      );
    },
    enabled: open && !!target?.clientId,
    staleTime: 10_000,
  });

  if (!target) return null;

  const handleSave = async () => {
    if (!tenantId || !user?.id) {
      toast.error("חסר טננט או משתמש מחובר");
      return;
    }
    const trimmed = content.trim();
    if (trimmed.length < 3) {
      toast.error("נא לתאר את השיחה (לפחות 3 תווים)");
      return;
    }

    setSaving(true);
    try {
      const updateType = resolveClientUpdateType("call", trimmed);
      const { data: inserted, error } = await supabase
        .from("client_updates")
        .insert({
          client_id: target.clientId,
          tenant_id: tenantId,
          user_id: user.id,
          content: trimmed,
          update_type: updateType,
        } as any)
        .select("id, created_at")
        .single();
      if (error) throw error;

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("id", user.id)
        .maybeSingle();

      const recordedBy =
        profile?.full_name?.trim() ||
        profile?.email?.trim() ||
        user.email?.trim() ||
        "משתמש";

      onSaved({
        clientId: target.clientId,
        lastClientCallAt: inserted.created_at,
        lastClientCallBy: recordedBy,
      });
      toast.success("השיחה תועדה — תופיע בדופק לאחר רענון הבדיקה");
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.message || "שגיאה בשמירה");
    } finally {
      setSaving(false);
    }
  };

  const pulseCallLabel = target.pulse ? formatLastClientCall(target.pulse) : "—";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" dir="rtl">
        <DialogHeader>
          <DialogTitle>עדכוני שיחה — {target.clientName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-md border bg-muted/40 p-3 text-sm space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">שיחה אחרונה בדופק</span>
              <Badge variant="outline" className="gap-1">
                <Phone className="h-3 w-3" />
                {pulseCallLabel}
              </Badge>
            </div>
            {target.pulse?.last_client_call_by ? (
              <p className="text-xs text-muted-foreground">
                תיעד/ה: {target.pulse.last_client_call_by}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label>היסטוריית שיחות (מעדכוני כרטיס הלקוח)</Label>
            {updatesLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                <Loader2 className="h-4 w-4 animate-spin" />
                טוען עדכונים...
              </div>
            ) : callUpdates.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">אין עדיין עדכוני שיחה מתועדים.</p>
            ) : (
              <div className="space-y-2 max-h-[200px] overflow-y-auto">
                {callUpdates.map((update: any) => (
                  <Card key={update.id} className="bg-muted/50">
                    <CardContent className="p-3">
                      <p className="text-sm whitespace-pre-wrap">{update.content}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2 flex-wrap">
                        <User className="h-3 w-3 shrink-0" />
                        <span>
                          {update.profiles?.full_name || update.profiles?.email || "משתמש"}
                        </span>
                        <span>•</span>
                        <Calendar className="h-3 w-3 shrink-0" />
                        <span>
                          {format(new Date(update.created_at), "d/M/yy HH:mm", { locale: he })}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="pulse-call-note">תעד שיחה חדשה</Label>
            <Textarea
              id="pulse-call-note"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="לדוגמה: דיברתי טלפונית עם הלקוח — מרוצה מהביצועים, מבקש להגדיל תקציב בשבוע הבא."
              className="min-h-[100px]"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-end">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            ביטול
          </Button>
          <Button type="button" onClick={handleSave} disabled={saving || !content.trim()}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 ml-1 animate-spin" />
                שומר...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 ml-1" />
                שמור שיחה
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
