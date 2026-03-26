import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { Phone, PhoneIncoming, PhoneOutgoing, PhoneMissed, Clock, FileText } from "lucide-react";
import { format } from "date-fns";
import { he } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import CustomAudioPlayer from "@/components/chat/CustomAudioPlayer";

interface CallHistoryTabProps {
  leadId?: string;
  clientId?: string;
}

const STATUS_CONFIG: Record<string, { label: string; icon: typeof Phone; color: string }> = {
  completed: { label: "הושלם", icon: PhoneOutgoing, color: "text-green-500" },
  "in-progress": { label: "בשיחה", icon: Phone, color: "text-blue-500" },
  initiated: { label: "יזום", icon: PhoneOutgoing, color: "text-yellow-500" },
  ringing: { label: "מצלצל", icon: PhoneOutgoing, color: "text-blue-400" },
  failed: { label: "נכשל", icon: PhoneMissed, color: "text-destructive" },
  "no-answer": { label: "אין מענה", icon: PhoneMissed, color: "text-orange-500" },
  busy: { label: "תפוס", icon: PhoneMissed, color: "text-orange-500" },
  cancelled: { label: "בוטל", icon: PhoneMissed, color: "text-muted-foreground" },
};

function formatDuration(seconds: number | null) {
  if (!seconds) return "—";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function CallHistoryTab({ leadId, clientId }: CallHistoryTabProps) {
  const { tenantId } = useCurrentTenant();

  const { data: callLogs, isLoading } = useQuery({
    queryKey: ["call-logs", tenantId, leadId, clientId],
    queryFn: async () => {
      let query = supabase
        .from("call_logs")
        .select("*")
        .eq("tenant_id", tenantId!)
        .order("created_at", { ascending: false });

      if (leadId) query = query.eq("lead_id", leadId);
      if (clientId) query = query.eq("client_id", clientId);

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId && !!(leadId || clientId),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8 text-muted-foreground">
        <Clock className="h-5 w-5 animate-spin ml-2" />
        טוען היסטוריית שיחות...
      </div>
    );
  }

  if (!callLogs?.length) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-muted-foreground gap-3">
        <Phone className="h-12 w-12 opacity-30" />
        <p className="text-sm">אין שיחות עדיין</p>
        <p className="text-xs">שיחות שתבצע דרך המרכזיה יופיעו כאן</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="space-y-3 p-1">
        {callLogs.map((log) => {
          const config = STATUS_CONFIG[log.status] || STATUS_CONFIG.completed;
          const StatusIcon = config.icon;

          return (
            <div key={log.id} className="border rounded-lg p-3 space-y-2 text-right">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs gap-1">
                    <StatusIcon className={`h-3 w-3 ${config.color}`} />
                    {config.label}
                  </Badge>
                  {log.duration > 0 && (
                    <span className="text-xs text-muted-foreground font-mono">
                      {formatDuration(log.duration)}
                    </span>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">
                  {format(new Date(log.created_at), "dd/MM/yyyy HH:mm", { locale: he })}
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 text-sm">
                <span className="font-mono text-muted-foreground" dir="ltr">{log.to_number}</span>
                <Phone className="h-3.5 w-3.5 text-muted-foreground" />
              </div>

              {log.notes && (
                <div className="flex items-start gap-2 text-sm bg-muted/30 rounded p-2">
                  <p className="text-muted-foreground flex-1">{log.notes}</p>
                  <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                </div>
              )}

              {log.recording_url && (
                <CustomAudioPlayer src={log.recording_url} className="mt-2" />
              )}
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
