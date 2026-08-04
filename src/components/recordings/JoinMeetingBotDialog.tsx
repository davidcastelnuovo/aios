import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Bot, Loader2 } from "lucide-react";

interface ClientOption {
  id: string;
  name: string;
}

interface JoinMeetingBotDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId?: string;
  clients: ClientOption[];
  defaultClientId?: string;
}

export function JoinMeetingBotDialog({
  open,
  onOpenChange,
  tenantId,
  clients,
  defaultClientId,
}: JoinMeetingBotDialogProps) {
  const { toast } = useToast();
  const [meetingUrl, setMeetingUrl] = useState("");
  const [meetingTopic, setMeetingTopic] = useState("");
  const [clientId, setClientId] = useState(defaultClientId || "");

  const dispatchMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId) throw new Error("לא נבחר ארגון");
      const { data, error } = await supabase.functions.invoke("dispatch-meeting-bot", {
        body: {
          tenant_id: tenantId,
          meeting_url: meetingUrl.trim(),
          client_id: clientId || null,
          meeting_topic: meetingTopic.trim() || null,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: "כרמן מצטרפת לפגישה",
        description: data.message || "אשרו את כרמן בחדר ההמתנה אם נדרש.",
      });
      setMeetingUrl("");
      setMeetingTopic("");
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast({ title: "שגיאה", description: err.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            שלחי את כרמן לפגישה
          </DialogTitle>
          <DialogDescription>
            הדביקו קישור לפגישת Zoom, Google Meet או Microsoft Teams — גם בלי זימון ביומן.
            כרמן תופיעה כמשתתפת גלויה, תקליט, תתמלל את כל הדוברים, ותייצר סיכום (ושיוך ללקוח אם נבחר).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label>קישור לפגישה *</Label>
            <Textarea
              value={meetingUrl}
              onChange={(e) => setMeetingUrl(e.target.value)}
              placeholder="https://zoom.us/j/... או meet.google.com/... או teams.microsoft.com/..."
              rows={2}
              dir="ltr"
              className="font-mono text-sm"
            />
          </div>

          <div>
            <Label>נושא הפגישה (אופציונלי)</Label>
            <Input
              value={meetingTopic}
              onChange={(e) => setMeetingTopic(e.target.value)}
              placeholder="לדוגמה: סטטוס קמפיין Q3"
            />
          </div>

          <div>
            <Label>שיוך ללקוח (מומלץ)</Label>
            <Select value={clientId || "none"} onValueChange={(v) => setClientId(v === "none" ? "" : v)}>
              <SelectTrigger>
                <SelectValue placeholder="בחר לקוח..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">ללא שיוך (AI ינסה לזהות)</SelectItem>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            className="w-full"
            onClick={() => dispatchMutation.mutate()}
            disabled={!meetingUrl.trim() || dispatchMutation.isPending}
          >
            {dispatchMutation.isPending ? (
              <Loader2 className="h-4 w-4 ml-2 animate-spin" />
            ) : (
              <Bot className="h-4 w-4 ml-2" />
            )}
            שלח את כרמן
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
