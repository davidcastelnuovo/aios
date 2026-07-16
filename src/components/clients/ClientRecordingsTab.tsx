import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Video,
  Play,
  FileText,
  Download,
  Sparkles,
  Loader2,
  CheckCircle2,
  XCircle,
  Megaphone,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import SummarizeRecordingDialog from "@/components/SummarizeRecordingDialog";
import { useTenantPath } from "@/hooks/useTenantPath";

interface ClientRecordingsTabProps {
  clientId: string;
  tenantId: string;
}

interface RecordingRow {
  id: string;
  meeting_topic: string | null;
  start_time: string | null;
  duration: number | null;
  source: string | null;
  recording_type: string | null;
  file_path: string | null;
  recording_url: string | null;
  transcription: string | null;
  transcription_status: string | null;
  summary_file_url: string | null;
}

interface WorkItemRow {
  id: string;
  title: string;
  status: string;
  payload: { source_recording_id?: string | null } | null;
}

const sourceLabel = (source: string | null) => {
  switch (source) {
    case "zoom": return "Zoom";
    case "manual": return "העלאה ידנית";
    case "chrome_extension": return "הקלטת מסך";
    case "google_meet": return "Google Meet";
    default: return source || "Zoom";
  }
};

export function ClientRecordingsTab({ clientId, tenantId }: ClientRecordingsTabProps) {
  const navigate = useNavigate();
  const { buildPath } = useTenantPath();
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);
  const [transcriptRecording, setTranscriptRecording] = useState<RecordingRow | null>(null);
  const [summarizeRecording, setSummarizeRecording] = useState<RecordingRow | null>(null);

  const { data: recordings = [], isLoading } = useQuery({
    queryKey: ["client-recordings", tenantId, clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("zoom_recordings")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("client_id", clientId)
        .order("start_time", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as RecordingRow[];
    },
    refetchInterval: (query) =>
      (query.state.data ?? []).some((r) => r.transcription_status === "processing") ? 7000 : false,
  });

  // Marketing briefs generated from these recordings (payload.source_recording_id)
  const { data: workItems = [] } = useQuery({
    queryKey: ["client-recording-work-items", tenantId, clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("marketing_work_items")
        .select("id, title, status, payload")
        .eq("tenant_id", tenantId)
        .eq("client_id", clientId);
      if (error) throw error;
      return ((data ?? []) as WorkItemRow[]).filter((wi) => wi.payload?.source_recording_id);
    },
  });

  const workItemForRecording = (recordingId: string) =>
    workItems.find((wi) => wi.payload?.source_recording_id === recordingId);

  const handlePlay = async (rec: RecordingRow) => {
    if (!rec.file_path) {
      if (rec.recording_url) window.open(rec.recording_url, "_blank");
      return;
    }
    if (playingId === rec.id) {
      setPlayingId(null);
      setPlaybackUrl(null);
      return;
    }
    const { data, error } = await supabase.storage
      .from("recordings")
      .createSignedUrl(rec.file_path, 3600);
    if (error || !data) {
      toast.error("שגיאה בטעינת ההקלטה");
      return;
    }
    setPlayingId(rec.id);
    setPlaybackUrl(data.signedUrl);
  };

  const transcriptionBadge = (rec: RecordingRow) => {
    if (rec.transcription) {
      return (
        <Badge variant="outline" className="text-green-600 border-green-600">
          <CheckCircle2 className="h-3 w-3 ml-1" />תומלל
        </Badge>
      );
    }
    if (rec.transcription_status === "processing") {
      return (
        <Badge variant="outline" className="text-blue-600 border-blue-600">
          <Loader2 className="h-3 w-3 ml-1 animate-spin" />מתמלל...
        </Badge>
      );
    }
    if (rec.transcription_status === "failed") {
      return (
        <Badge variant="outline" className="text-red-600 border-red-600">
          <XCircle className="h-3 w-3 ml-1" />תמלול נכשל
        </Badge>
      );
    }
    return null;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-10 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin ml-2" />טוען הקלטות...
      </div>
    );
  }

  if (recordings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 gap-2 text-muted-foreground">
        <Video className="h-8 w-8" />
        <div>אין הקלטות משויכות ללקוח זה</div>
        <div className="text-xs">
          הקלטות מפגישות (Zoom / תוסף ההקלטה / העלאה ידנית) שישויכו ללקוח יופיעו כאן
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {recordings.map((rec) => {
        const workItem = workItemForRecording(rec.id);
        const isAudioOnly = rec.recording_type === "audio_only";
        return (
          <Card key={rec.id}>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div className="min-w-0">
                  <div className="font-medium truncate">{rec.meeting_topic || "ללא נושא"}</div>
                  <div className="text-xs text-muted-foreground flex gap-2 flex-wrap mt-1">
                    {rec.start_time && <span>{format(new Date(rec.start_time), "dd/MM/yyyy HH:mm")}</span>}
                    {rec.duration ? <span>{rec.duration} דקות</span> : null}
                    <Badge variant="secondary" className="text-[10px]">{sourceLabel(rec.source)}</Badge>
                    {transcriptionBadge(rec)}
                  </div>
                </div>
                <div className="flex gap-1.5 flex-wrap">
                  {(rec.file_path || rec.recording_url) && (
                    <Button size="sm" variant="outline" onClick={() => handlePlay(rec)}>
                      <Play className="h-3.5 w-3.5 ml-1" />
                      {playingId === rec.id ? "סגור" : "נגן"}
                    </Button>
                  )}
                  {rec.transcription && (
                    <Button size="sm" variant="outline" onClick={() => setTranscriptRecording(rec)}>
                      <FileText className="h-3.5 w-3.5 ml-1" />תמלול
                    </Button>
                  )}
                  {rec.summary_file_url ? (
                    <Button size="sm" variant="outline" asChild>
                      <a href={rec.summary_file_url} target="_blank" rel="noreferrer">
                        <Download className="h-3.5 w-3.5 ml-1" />סיכום
                      </a>
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => setSummarizeRecording(rec)}>
                      <Sparkles className="h-3.5 w-3.5 ml-1" />צור סיכום
                    </Button>
                  )}
                  {workItem && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-primary"
                      onClick={() => navigate(buildPath(`/marketing/${clientId}`))}
                      title={workItem.title}
                    >
                      <Megaphone className="h-3.5 w-3.5 ml-1" />בריף שיווקי
                    </Button>
                  )}
                </div>
              </div>

              {playingId === rec.id && playbackUrl && (
                isAudioOnly ? (
                  <audio src={playbackUrl} controls autoPlay className="w-full" />
                ) : (
                  <video src={playbackUrl} controls autoPlay className="w-full max-h-80 rounded-md bg-black" />
                )
              )}
            </CardContent>
          </Card>
        );
      })}

      {/* Transcript viewer */}
      <Dialog open={!!transcriptRecording} onOpenChange={(open) => !open && setTranscriptRecording(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>תמלול — {transcriptRecording?.meeting_topic || "הקלטה"}</DialogTitle>
          </DialogHeader>
          <div className="whitespace-pre-wrap text-sm leading-relaxed">
            {transcriptRecording?.transcription}
          </div>
        </DialogContent>
      </Dialog>

      {summarizeRecording && (
        <SummarizeRecordingDialog
          open={!!summarizeRecording}
          onOpenChange={(open) => !open && setSummarizeRecording(null)}
          recording={summarizeRecording}
        />
      )}
    </div>
  );
}
