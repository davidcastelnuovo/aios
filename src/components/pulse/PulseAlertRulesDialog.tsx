import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  DEFAULT_PULSE_ALERT_RULES,
  parsePulseAlertRules,
  type PulseAlertRules,
} from "@/lib/pulseAlertRules";

type PulseAlertRulesDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: unknown;
  onSave: (rules: PulseAlertRules) => Promise<void> | void;
  saving?: boolean;
};

export function PulseAlertRulesDialog({
  open,
  onOpenChange,
  value,
  onSave,
  saving = false,
}: PulseAlertRulesDialogProps) {
  const [rules, setRules] = useState<PulseAlertRules>(DEFAULT_PULSE_ALERT_RULES);

  useEffect(() => {
    if (open) setRules(parsePulseAlertRules(value));
  }, [open, value]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>חוקי התראות דופק ב-WhatsApp</DialogTitle>
          <DialogDescription>
            התראות מיידיות נשלחות לבעל הארגון ולקמפיינרים משויכים. סיכום שבועי נשלח ביום ראשון ב-07:00.
            רענון נתוני הדשבורד מתבצע פעמיים ביום (07:00 ו-16:00).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
            <div>
              <Label className="text-sm">התראות מיידיות ב-WhatsApp</Label>
              <p className="text-xs text-muted-foreground">מפעיל/מכבה את כל סוגי ההתראות למטה</p>
            </div>
            <Switch
              checked={rules.instant_wa_enabled !== false}
              onCheckedChange={(checked) => setRules((prev) => ({ ...prev, instant_wa_enabled: checked }))}
            />
          </div>

          <div className="rounded-lg border p-3 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <Label className="text-sm">אין שיחה/פגישה</Label>
                <p className="text-xs text-muted-foreground">התראה כשלא תועד קשר עם הלקוח</p>
              </div>
              <Switch
                checked={rules.no_contact_enabled !== false}
                onCheckedChange={(checked) => setRules((prev) => ({ ...prev, no_contact_enabled: checked }))}
              />
            </div>
            <div>
              <Label className="text-xs">ימים ללא עדכון קשר</Label>
              <Input
                type="number"
                min={1}
                className="h-8 mt-1"
                value={rules.no_contact_days ?? 14}
                onChange={(event) =>
                  setRules((prev) => ({ ...prev, no_contact_days: Number(event.target.value) || 14 }))
                }
              />
            </div>
          </div>

          <div className="rounded-lg border p-3 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <Label className="text-sm">עליית CPL</Label>
                <p className="text-xs text-muted-foreground">השוואה לשבוע הקודם</p>
              </div>
              <Switch
                checked={rules.cpl_spike_enabled !== false}
                onCheckedChange={(checked) => setRules((prev) => ({ ...prev, cpl_spike_enabled: checked }))}
              />
            </div>
            <div>
              <Label className="text-xs">אחוז עלייה מינימלי</Label>
              <Input
                type="number"
                min={1}
                className="h-8 mt-1"
                value={rules.cpl_spike_pct ?? 50}
                onChange={(event) =>
                  setRules((prev) => ({ ...prev, cpl_spike_pct: Number(event.target.value) || 50 }))
                }
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
            <div>
              <Label className="text-sm">ניתוק / חשבון לא פעיל</Label>
              <p className="text-xs text-muted-foreground">
                דוח מנותק, סנכרון ישן, קמפיין שנעצר או מודעה חסומה
              </p>
            </div>
            <Switch
              checked={rules.disconnected_enabled !== false}
              onCheckedChange={(checked) => setRules((prev) => ({ ...prev, disconnected_enabled: checked }))}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            ביטול
          </Button>
          <Button disabled={saving} onClick={() => onSave(parsePulseAlertRules(rules))}>
            שמור חוקים
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
