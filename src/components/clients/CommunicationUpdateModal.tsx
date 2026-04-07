/**
 * CommunicationUpdateModal
 *
 * Popup for logging a communication interaction with a client.
 * Writes to communication_logs table and updates client.mood_status.
 *
 * Usage:
 *   <CommunicationUpdateModal
 *     clientId={client.id}
 *     clientName={client.name}
 *     open={open}
 *     onOpenChange={setOpen}
 *   />
 */

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, MessageSquare } from "lucide-react";
import {
  COMMUNICATION_STATUS_LABELS,
  INTERACTION_TYPE_LABELS,
} from "@/lib/healthScore";

// Map communication_status → mood_status (keep backward compat)
const COMM_TO_MOOD: Record<string, string> = {
  normal: "happy",
  sensitive: "wavering",
  complaint: "churn_risk",
};

interface CommunicationUpdateModalProps {
  clientId: string;
  clientName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommunicationUpdateModal({
  clientId,
  clientName,
  open,
  onOpenChange,
}: CommunicationUpdateModalProps) {
  const { tenantId } = useCurrentTenant();
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();

  const [status, setStatus] = useState<"normal" | "sensitive" | "complaint">("normal");
  const [interactionType, setInteractionType] = useState("other");
  const [note, setNote] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      if (!tenantId || !user?.id) throw new Error("Missing tenant or user");
      if (!note.trim()) throw new Error("הערה נדרשת");

      // 1. Insert communication log
      const { error: logError } = await (supabase as any)
        .from("communication_logs")
        .insert({
          client_id: clientId,
          tenant_id: tenantId,
          status,
          interaction_type: interactionType,
          note: note.trim(),
          updated_by: user.id,
        });
      if (logError) throw logError;

      // 2. Sync mood_status on client (backward compat)
      const { error: clientError } = await supabase
        .from("clients")
        .update({ mood_status: (COMM_TO_MOOD[status] || "happy") as any })
        .eq("id", clientId);
      if (clientError) throw clientError;
    },
    onSuccess: () => {
      toast.success("עדכון תקשורת נשמר בהצלחה");
      queryClient.invalidateQueries({ queryKey: ["communication-logs-latest"] });
      queryClient.invalidateQueries({ queryKey: ["communication-logs-single", clientId] });
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      queryClient.invalidateQueries({ queryKey: ["dmm-clients"] });
      setNote("");
      setStatus("normal");
      setInteractionType("other");
      onOpenChange(false);
    },
    onError: (err: any) => {
      toast.error(err?.message || "שגיאה בשמירת עדכון תקשורת");
    },
  });

  const handleSubmit = () => {
    if (!note.trim()) {
      toast.error("יש להזין הערה לפני השמירה");
      return;
    }
    mutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            עדכון תקשורת — {clientName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Communication Status */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">מצב תקשורת</Label>
            <RadioGroup
              value={status}
              onValueChange={(v) => setStatus(v as any)}
              className="flex gap-4"
            >
              <label className="flex items-center gap-2 cursor-pointer">
                <RadioGroupItem value="normal" />
                <span className="text-sm text-green-700 font-medium">✅ תקין</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <RadioGroupItem value="sensitive" />
                <span className="text-sm text-yellow-700 font-medium">⚠️ רגיש</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <RadioGroupItem value="complaint" />
                <span className="text-sm text-red-700 font-medium">🚨 תלונה</span>
              </label>
            </RadioGroup>
          </div>

          {/* Interaction Type */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">סוג אינטראקציה</Label>
            <Select value={interactionType} onValueChange={setInteractionType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-background">
                {Object.entries(INTERACTION_TYPE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Note */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              הערה <span className="text-destructive">*</span>
            </Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="תאר את האינטראקציה עם הלקוח..."
              rows={4}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">שדה חובה — לא ניתן לשמור ללא הערה</p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            ביטול
          </Button>
          <Button onClick={handleSubmit} disabled={mutation.isPending || !note.trim()}>
            {mutation.isPending && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
            שמור עדכון
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
