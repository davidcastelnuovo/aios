import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Trash2, Save } from "lucide-react";

interface MaskyooManualEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  last9: string;
  displayNumber: string;
  label: string;
  periodDays: number;
  /** Current automatic stats — shown for reference. */
  autoStats: { incoming: number; unique: number; answered: number };
  /** Existing override row, if any. */
  override: {
    id?: string;
    incoming_count: number | null;
    unique_count: number | null;
    answered_count: number | null;
    note: string | null;
  } | null;
}

export function MaskyooManualEditDialog({
  open, onOpenChange, tenantId, last9, displayNumber, label,
  periodDays, autoStats, override,
}: MaskyooManualEditDialogProps) {
  const qc = useQueryClient();
  const [incoming, setIncoming] = useState<string>("");
  const [unique, setUnique] = useState<string>("");
  const [answered, setAnswered] = useState<string>("");
  const [note, setNote] = useState<string>("");

  useEffect(() => {
    if (!open) return;
    setIncoming(override?.incoming_count != null ? String(override.incoming_count) : String(autoStats.incoming));
    setUnique(override?.unique_count != null ? String(override.unique_count) : String(autoStats.unique));
    setAnswered(override?.answered_count != null ? String(override.answered_count) : String(autoStats.answered));
    setNote(override?.note || "");
  }, [open, override, autoStats]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const payload = {
        tenant_id: tenantId,
        maskyoo_last9: last9,
        period_days: periodDays,
        incoming_count: incoming.trim() === "" ? null : Number(incoming),
        unique_count: unique.trim() === "" ? null : Number(unique),
        answered_count: answered.trim() === "" ? null : Number(answered),
        note: note.trim() || null,
        created_by: user?.id || null,
      };
      const { error } = await supabase
        .from("maskyoo_manual_overrides")
        .upsert(payload, { onConflict: "tenant_id,maskyoo_last9,period_days" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("הספירה הידנית נשמרה");
      qc.invalidateQueries({ queryKey: ["maskyoo-overrides", tenantId] });
      qc.invalidateQueries({ queryKey: ["maskyoo-call-logs-kpi"] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e?.message || "שמירה נכשלה"),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("maskyoo_manual_overrides")
        .delete()
        .eq("tenant_id", tenantId)
        .eq("maskyoo_last9", last9)
        .eq("period_days", periodDays);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("חזר לספירה אוטומטית");
      qc.invalidateQueries({ queryKey: ["maskyoo-overrides", tenantId] });
      qc.invalidateQueries({ queryKey: ["maskyoo-call-logs-kpi"] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e?.message || "מחיקה נכשלה"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>עריכת שיחות מסקיו ידנית</DialogTitle>
          <DialogDescription>
            {label} · <span dir="ltr">{displayNumber}</span> · {periodDays} ימים אחרונים
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">נכנסות</Label>
              <Input type="number" min={0} value={incoming} onChange={(e) => setIncoming(e.target.value)} />
              <p className="text-[10px] text-muted-foreground mt-1">אוטומטי: {autoStats.incoming}</p>
            </div>
            <div>
              <Label className="text-xs">ייחודיות</Label>
              <Input type="number" min={0} value={unique} onChange={(e) => setUnique(e.target.value)} />
              <p className="text-[10px] text-muted-foreground mt-1">אוטומטי: {autoStats.unique}</p>
            </div>
            <div>
              <Label className="text-xs">נענו</Label>
              <Input type="number" min={0} value={answered} onChange={(e) => setAnswered(e.target.value)} />
              <p className="text-[10px] text-muted-foreground mt-1">אוטומטי: {autoStats.answered}</p>
            </div>
          </div>
          <div>
            <Label className="text-xs">הערה (אופציונלי)</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="למה תוקן ידנית?" />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          {override?.id || override?.incoming_count != null || override?.unique_count != null || override?.answered_count != null ? (
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
            >
              <Trash2 className="h-4 w-4 ms-1" />
              חזור לאוטומטי
            </Button>
          ) : <span />}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>ביטול</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              <Save className="h-4 w-4 ms-1" />
              שמור
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
