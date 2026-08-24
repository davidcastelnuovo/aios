import { useEffect, useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { OverallStatus } from "@/lib/healthScore";
import { OVERALL_STATUS_CONFIG } from "@/lib/healthScore";
import {
  buildPulseAlgorithmMetrics,
  overallStatusLabel,
  pulseStatusLabel,
  pulseStatusToOverall,
  type PulseOverrideRow,
  type PulseSnapshotRow,
} from "@/lib/pulseDashboard";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { useCurrentUser } from "@/hooks/useCurrentUser";

const OVERRIDE_OPTIONS: OverallStatus[] = ["green", "yellow", "red"];

export type PulseStatusOverrideTarget = {
  clientId: string;
  clientName: string;
  algorithmOverall: OverallStatus;
  pulse: PulseSnapshotRow | null;
  flags: string[];
  activeOverride: PulseOverrideRow | null;
};

interface PulseStatusOverrideDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: PulseStatusOverrideTarget | null;
  onSaved: () => void;
}

export function PulseStatusOverrideDialog({
  open,
  onOpenChange,
  target,
  onSaved,
}: PulseStatusOverrideDialogProps) {
  const { tenantId } = useCurrentTenant();
  const { user } = useCurrentUser();
  const [overrideStatus, setOverrideStatus] = useState<OverallStatus>("yellow");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!target) return;
    setOverrideStatus(target.activeOverride?.override_status ?? target.algorithmOverall);
    setReason("");
  }, [target]);

  if (!target) return null;

  const algorithmLabel = target.pulse
    ? pulseStatusLabel(target.pulse.status)
    : overallStatusLabel(target.algorithmOverall);

  const handleSave = async () => {
    if (!tenantId || !user?.id) {
      toast.error("חסר טננט או משתמש מחובר");
      return;
    }
    const trimmedReason = reason.trim();
    if (trimmedReason.length < 3) {
      toast.error("נא להסביר למה שינית (לפחות 3 תווים) — כדי שכרמן תלמד");
      return;
    }
    if (overrideStatus === target.algorithmOverall && !target.activeOverride) {
      toast.error("בחר צבע שונה מהחישוב האוטומטי, או החזר לחישוב אוטומטי");
      return;
    }

    setSaving(true);
    try {
      if (target.activeOverride?.id) {
        const { error: clearError } = await (supabase as any)
          .from("campaign_pulse_overrides")
          .update({ cleared_at: new Date().toISOString(), cleared_by: user.id })
          .eq("id", target.activeOverride.id)
          .is("cleared_at", null);
        if (clearError) throw clearError;
      }

      if (overrideStatus !== target.algorithmOverall) {
        const algorithmStatus = target.pulse?.status ?? "no_data";
        const { error: insertError } = await (supabase as any)
          .from("campaign_pulse_overrides")
          .insert({
            tenant_id: tenantId,
            client_id: target.clientId,
            algorithm_status: algorithmStatus,
            override_status: overrideStatus,
            reason: trimmedReason,
            algorithm_flags: target.flags,
            algorithm_metrics: buildPulseAlgorithmMetrics(target.pulse),
            snapshot_calculated_at: target.pulse?.calculated_at ?? null,
            created_by: user.id,
          });
        if (insertError) throw insertError;

        const algoOverall = pulseStatusToOverall(algorithmStatus as any);
        const historyContent = [
          `בדיקת דופק — שינוי ידני: ${overallStatusLabel(algoOverall)} → ${overallStatusLabel(overrideStatus)}`,
          `הסבר: ${trimmedReason}`,
          target.flags.length ? `דגלים אוטומטיים: ${target.flags.join(", ")}` : null,
        ]
          .filter(Boolean)
          .join("\n");

        await supabase.from("client_updates").insert({
          client_id: target.clientId,
          tenant_id: tenantId,
          user_id: user.id,
          content: historyContent,
          update_type: "pulse_override",
        } as any);
      }

      toast.success(
        overrideStatus === target.algorithmOverall
          ? "הוחזר לחישוב אוטומטי"
          : "הצבע עודכן — כרמן תוכל ללמוד מההסבר",
      );
      onSaved();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.message || "שגיאה בשמירה");
    } finally {
      setSaving(false);
    }
  };

  const handleClearOverride = async () => {
    if (!target.activeOverride?.id || !user?.id) return;
    setSaving(true);
    try {
      const { error } = await (supabase as any)
        .from("campaign_pulse_overrides")
        .update({ cleared_at: new Date().toISOString(), cleared_by: user.id })
        .eq("id", target.activeOverride.id)
        .is("cleared_at", null);
      if (error) throw error;
      toast.success("הוחזר לחישוב אוטומטי");
      onSaved();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.message || "שגיאה בהחזרה");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" dir="rtl">
        <DialogHeader>
          <DialogTitle>עריכת צבע דופק — {target.clientName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-md border bg-muted/40 p-3 space-y-2 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">חישוב אוטומטי</span>
              <Badge variant="outline">{algorithmLabel}</Badge>
            </div>
            {target.activeOverride && (
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">עריכה ידנית פעילה</span>
                <Badge variant="secondary">
                  {overallStatusLabel(target.activeOverride.override_status)}
                </Badge>
              </div>
            )}
            {target.flags.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1">
                {target.flags.slice(0, 6).map((flag) => (
                  <Badge key={flag} variant="outline" className="text-xs">
                    {flag}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>צבע להצגה בדשבורד</Label>
            <Select value={overrideStatus} onValueChange={(v) => setOverrideStatus(v as OverallStatus)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-background">
                {OVERRIDE_OPTIONS.map((status) => (
                  <SelectItem key={status} value={status}>
                    {OVERALL_STATUS_CONFIG[status].dot} {OVERALL_STATUS_CONFIG[status].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="pulse-override-reason">
              למה שינית? (כדי שכרמן תלמד את הלוגיקה)
            </Label>
            <Textarea
              id="pulse-override-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="לדוגמה: CPL עלה אבל זה בגלל עצירת קמפיין יזומה — לא סכנה. הלקוח ביצועים תקינים."
              className="min-h-[100px]"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          {target.activeOverride ? (
            <Button type="button" variant="ghost" onClick={handleClearOverride} disabled={saving}>
              החזר לחישוב אוטומטי
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              ביטול
            </Button>
            <Button type="button" onClick={handleSave} disabled={saving}>
              {saving ? "שומר..." : "שמור"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
