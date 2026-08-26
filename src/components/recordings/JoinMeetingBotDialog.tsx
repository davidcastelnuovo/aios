import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { invokeErrorMessage } from "@/components/marketing/lib/invokeErrorMessage";

interface ClientOption {
  id: string;
  name: string;
}

interface CampaignerOption {
  id: string;
  full_name: string;
}

interface AgencyOption {
  id: string;
  name: string;
  is_default?: boolean | null;
}

interface JoinMeetingBotDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId?: string;
  clients: ClientOption[];
  campaigners: CampaignerOption[];
  agencies: AgencyOption[];
  defaultClientId?: string;
}

export function JoinMeetingBotDialog({
  open,
  onOpenChange,
  tenantId,
  clients,
  campaigners,
  agencies,
  defaultClientId,
}: JoinMeetingBotDialogProps) {
  const { toast } = useToast();
  const [meetingUrl, setMeetingUrl] = useState("");
  const [meetingTopic, setMeetingTopic] = useState("");
  const [targetType, setTargetType] = useState<"auto" | "client" | "campaigner" | "agency">(
    defaultClientId ? "client" : "agency",
  );
  const [targetId, setTargetId] = useState(defaultClientId || "");

  useEffect(() => {
    if (targetType === "agency" && !targetId && agencies.length > 0) {
      setTargetId(agencies.find((agency) => agency.is_default)?.id || agencies[0].id);
    }
  }, [agencies, targetId, targetType]);

  const dispatchMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId) throw new Error("לא נבחר ארגון");
      const { data, error } = await supabase.functions.invoke("dispatch-meeting-bot", {
        body: {
          tenant_id: tenantId,
          meeting_url: meetingUrl.trim(),
          summary_scope: targetType,
          client_id: targetType === "client" ? targetId || null : null,
          campaigner_ids: targetType === "campaigner" && targetId ? [targetId] : [],
          agency_id: targetType === "agency" ? targetId || null : null,
          meeting_topic: meetingTopic.trim() || null,
        },
      });
      if (error || data?.error) {
        throw new Error(await invokeErrorMessage(error, data, "שליחת כרמן לפגישה נכשלה"));
      }
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: "כרמן מצטרפת לפגישה",
        description: data.message || "אשרו את כרמן בחדר ההמתנה אם נדרש.",
      });
      setMeetingUrl("");
      setMeetingTopic("");
      setTargetType(defaultClientId ? "client" : "agency");
      setTargetId(defaultClientId || "");
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
            כרמן תופיעה כמשתתפת גלויה, תקליט, תתמלל את כל הדוברים ותייצר סיכום ללקוח,
            לאיש צוות או לסוכנות.
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

          <div className="space-y-2">
            <Label>סוג הפגישה והשיוך</Label>
            <Select
              value={targetType}
              onValueChange={(value: "auto" | "client" | "campaigner" | "agency") => {
                setTargetType(value);
                if (value === "agency") {
                  setTargetId(agencies.find((agency) => agency.is_default)?.id || agencies[0]?.id || "");
                } else {
                  setTargetId("");
                }
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="client">פגישת לקוח</SelectItem>
                <SelectItem value="campaigner">פגישה פנימית — איש צוות / קמפיינר</SelectItem>
                <SelectItem value="agency">פגישה כללית של הסוכנות</SelectItem>
                <SelectItem value="auto">זיהוי אוטומטי (לקוח / פנימי / סוכנות)</SelectItem>
              </SelectContent>
            </Select>

            {targetType !== "auto" && (
              <Select value={targetId || "none"} onValueChange={(value) => setTargetId(value === "none" ? "" : value)}>
                <SelectTrigger>
                  <SelectValue
                    placeholder={targetType === "client"
                      ? "בחר לקוח..."
                      : targetType === "campaigner"
                      ? "בחר איש צוות..."
                      : "בחר סוכנות..."}
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">בחר...</SelectItem>
                  {targetType === "client" &&
                    clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>
                    ))}
                  {targetType === "campaigner" &&
                    campaigners.map((campaigner) => (
                      <SelectItem key={campaigner.id} value={campaigner.id}>{campaigner.full_name}</SelectItem>
                    ))}
                  {targetType === "agency" &&
                    agencies.map((agency) => (
                      <SelectItem key={agency.id} value={agency.id}>{agency.name}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <Button
            className="w-full"
            onClick={() => dispatchMutation.mutate()}
            disabled={
              !meetingUrl.trim() ||
              dispatchMutation.isPending ||
              (targetType !== "auto" && !targetId)
            }
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
