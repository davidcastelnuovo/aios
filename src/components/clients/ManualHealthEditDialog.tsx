import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  FLAG_LABELS,
  FLAG_COLORS,
  COMMUNICATION_STATUS_LABELS,
  type FlagKey,
  type OverallStatus,
} from "@/lib/healthScore";

const ALL_FLAGS: FlagKey[] = [
  'sensitive', 'complaint',
  'performance_medium_drop', 'performance_significant_drop', 'performance_sharp_drop',
  'no_touch_campaign', 'drop_no_action',
  'seo_stable', 'seo_down', 'seo_no_up_2months',
  'no_communication_30d', 'no_communication_45d',
];

const MOOD_OPTIONS = [
  { value: 'happy', label: '😊 מבסוט / תקין' },
  { value: 'wavering', label: '😐 מתנדנד / רגיש' },
  { value: 'churn_risk', label: '😟 סכנת נטישה / תלונה' },
  { value: 'not_progressing', label: '😔 לא מתקדם' },
];

interface ManualHealthEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  clientName: string;
  currentScore: number;
  currentFlags: FlagKey[];
  currentMood: string | null;
  onSaved: () => void;
}

export function ManualHealthEditDialog({
  open, onOpenChange, clientId, clientName,
  currentScore, currentFlags, currentMood, onSaved,
}: ManualHealthEditDialogProps) {
  const [score, setScore] = useState(currentScore);
  const [flags, setFlags] = useState<FlagKey[]>(currentFlags);
  const [mood, setMood] = useState(currentMood || 'happy');
  const [saving, setSaving] = useState(false);

  const toggleFlag = (flag: FlagKey) => {
    setFlags(prev => prev.includes(flag) ? prev.filter(f => f !== flag) : [...prev, flag]);
  };

  const computeStatus = (s: number): OverallStatus => {
    if (s >= 80) return 'green';
    if (s >= 60) return 'yellow';
    return 'red';
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const overall = computeStatus(score);
      const { error } = await supabase
        .from('clients')
        .update({
          health_score: score,
          overall_status: overall,
          active_flags: flags as any,
          mood_status: mood as any,
        })
        .eq('id', clientId);
      if (error) throw error;
      toast.success('עודכן בהצלחה');
      onSaved();
      onOpenChange(false);
    } catch (err: any) {
      toast.error('שגיאה בשמירה: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle>עריכת בריאות — {clientName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-5">
          {/* Score */}
          <div className="space-y-2">
            <Label>ציון בריאות: {score}</Label>
            <Slider
              value={[score]}
              onValueChange={([v]) => setScore(v)}
              min={0} max={100} step={1}
            />
          </div>

          {/* Mood */}
          <div className="space-y-2">
            <Label>סטטוס תקשורת</Label>
            <Select value={mood} onValueChange={setMood}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent className="bg-background">
                {MOOD_OPTIONS.map(o => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Flags */}
          <div className="space-y-2">
            <Label>Flags פעילים</Label>
            <div className="flex flex-wrap gap-1.5">
              {ALL_FLAGS.map(flag => (
                <Badge
                  key={flag}
                  variant="outline"
                  className={`text-xs cursor-pointer transition-opacity ${
                    flags.includes(flag) ? FLAG_COLORS[flag] : 'opacity-30'
                  }`}
                  onClick={() => toggleFlag(flag)}
                >
                  {FLAG_LABELS[flag]}
                </Badge>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter className="gap-2 mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>ביטול</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'שומר...' : 'שמור'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
