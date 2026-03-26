import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Phone, PhoneOff, Mic, MicOff, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { Textarea } from "@/components/ui/textarea";

interface CallDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  phoneNumber: string;
  contactName: string;
  leadId?: string;
  clientId?: string;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  idle: { label: "מוכן לשיחה", color: "text-muted-foreground" },
  initiated: { label: "מתחיל שיחה...", color: "text-yellow-500" },
  ringing: { label: "מצלצל...", color: "text-blue-500" },
  "in-progress": { label: "בשיחה", color: "text-green-500" },
  completed: { label: "שיחה הסתיימה", color: "text-muted-foreground" },
  failed: { label: "שיחה נכשלה", color: "text-destructive" },
  "no-answer": { label: "אין מענה", color: "text-orange-500" },
  busy: { label: "תפוס", color: "text-orange-500" },
  cancelled: { label: "בוטל", color: "text-muted-foreground" },
};

export function CallDialog({ open, onOpenChange, phoneNumber, contactName, leadId, clientId }: CallDialogProps) {
  const { tenantId } = useCurrentTenant();
  const [callStatus, setCallStatus] = useState<string>("idle");
  const [callDuration, setCallDuration] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [notes, setNotes] = useState("");
  const [callLogId, setCallLogId] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (callStatus === "in-progress") {
      timerRef.current = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [callStatus]);

  useEffect(() => {
    if (!open) {
      setCallStatus("idle");
      setCallDuration(0);
      setNotes("");
      setCallLogId(null);
    }
  }, [open]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handleCall = async () => {
    if (!tenantId) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("make-paycall-call", {
        body: {
          to_number: phoneNumber,
          lead_id: leadId || null,
          client_id: clientId || null,
          tenant_id: tenantId,
        },
      });

      if (error) throw error;

      if (data?.error === "Paycall not configured") {
        toast.error("מרכזיה לא מוגדרת", {
          description: "יש להגדיר את אינטגרציית Paycall בהגדרות הטלפוניה",
        });
        setCallStatus("failed");
      } else {
        setCallLogId(data?.call_log?.id || null);
        setCallStatus("initiated");
        // Simulate progression for now (will be replaced by realtime)
        setTimeout(() => setCallStatus("ringing"), 1500);
      }
    } catch (err: any) {
      toast.error("שגיאה ביזום שיחה", { description: err.message });
      setCallStatus("failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleHangup = async () => {
    setCallStatus("completed");
    if (callLogId && notes) {
      await supabase.from("call_logs").update({ notes, status: "completed", duration: callDuration }).eq("id", callLogId);
    }
  };

  const statusInfo = STATUS_LABELS[callStatus] || STATUS_LABELS.idle;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-center">שיחה טלפונית</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center gap-6 py-4">
          {/* Contact avatar */}
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
            <Phone className={`h-8 w-8 ${callStatus === "in-progress" ? "text-green-500 animate-pulse" : "text-primary"}`} />
          </div>

          {/* Contact info */}
          <div className="text-center">
            <h3 className="text-lg font-semibold">{contactName}</h3>
            <p className="text-muted-foreground text-sm" dir="ltr">{phoneNumber}</p>
          </div>

          {/* Status */}
          <div className="text-center">
            <p className={`text-sm font-medium ${statusInfo.color}`}>
              {statusInfo.label}
            </p>
            {(callStatus === "in-progress" || callStatus === "ringing") && (
              <p className="text-2xl font-mono mt-2">{formatDuration(callDuration)}</p>
            )}
            {callStatus === "completed" && callDuration > 0 && (
              <p className="text-lg font-mono mt-1 text-muted-foreground">{formatDuration(callDuration)}</p>
            )}
          </div>

          {/* Notes */}
          {(callStatus === "in-progress" || callStatus === "completed") && (
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="הערות לשיחה..."
              className="w-full"
              rows={3}
            />
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-4">
            {callStatus === "idle" || callStatus === "failed" ? (
              <Button
                onClick={handleCall}
                disabled={isLoading}
                className="rounded-full h-14 w-14 bg-green-600 hover:bg-green-700"
                size="icon"
              >
                {isLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : <Phone className="h-6 w-6" />}
              </Button>
            ) : callStatus === "completed" || callStatus === "no-answer" || callStatus === "busy" || callStatus === "cancelled" ? (
              <Button
                onClick={() => onOpenChange(false)}
                variant="outline"
                className="rounded-full h-14 px-6"
              >
                סגור
              </Button>
            ) : (
              <Button
                onClick={handleHangup}
                className="rounded-full h-14 w-14 bg-destructive hover:bg-destructive/90"
                size="icon"
              >
                <PhoneOff className="h-6 w-6" />
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
