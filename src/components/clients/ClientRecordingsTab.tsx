import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Video,
  Play,
  FileText,
  Sparkles,
  Loader2,
  CheckCircle2,
  XCircle,
  Megaphone,
  Mic,
  ExternalLink,
  Download,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import SummarizeRecordingDialog from "@/components/SummarizeRecordingDialog";
import { SummaryViewerDialog } from "@/components/recordings/SummaryViewerDialog";
import { TranscriptViewerDialog } from "@/components/recordings/TranscriptViewerDialog";
import { useTenantPath } from "@/hooks/useTenantPath";

interface ClientRecordingsTabProps {
  clientId: string;
  tenantId: string | null;
}

interface RecordingRow {
  id: string;
  meeting_id: string | null;
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
  summary_md: string | null;
  client_id: string | null;
  _ids?: string[];
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
    case "meeting_bot": return "כרמן";
    case "microsoft_teams":
    case "teams": return "Teams";
    default: return source || "Zoom";
  }
};

function groupClientRecordings(rows: RecordingRow[]): RecordingRow[] {
  const groups = new Map<string, RecordingRow[]>();
  for (const rec of rows) {
    const key = rec.meeting_id || rec.id;
    const list = groups.get(key) ?? [];
    list.push(rec);
    groups.set(key, list);
  }

  return Array.from(groups.values()).map((group) => {
    const videoRec = group.find((r) => r.recording_type === "shared_screen_with_speaker_view")
      || group.find((r) => r.recording_type === "speaker_view")
      || group.find((r) => r.recording_type === "screen_capture");
    const audioRec = group.find((r) => r.recording_type === "audio_only");
    const primary = videoRec || audioRec || group[0];
    const transcribed = group.find((r) => r.transcription);
    const summarized = group.find((r) => r.summary_md || r.summary_file_url);
    return {
      ...primary,
      transcription: transcribed?.transcription || primary.transcription,
      transcription_status: transcribed?.transcription_status
        || group.find((r) => r.transcription_status === "processing")?.transcription_status
        || primary.transcription_status,
      summary_md: summarized?.summary_md || null,
      summary_file_url: summarized?.summary_file_url || null,
      _ids: group.map((r) => r.id),
    };
  });
}

export function ClientRecordingsTab({ clientId, tenantId }: ClientRecordingsTabProps) {
  const navigate = useNavigate();
  const { buildPath } = useTenantPath();
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);
  const [transcriptRecording, setTranscriptRecording] = useState<RecordingRow | null>(null);
  const [summarizeRecording, setSummarizeRecording] = useState<RecordingRow | null>(null);
  const [summaryRecording, setSummaryRecording] = useState<RecordingRow | null>(null);

  const { data: recordings = [], isLoading } = useQuery({
    queryKey: ["client-recordings", tenantId, clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("zoom_recordings")
        .select("id, meeting_id, meeting_topic, start_time, duration, source, recording_type, file_path, recording_url, transcription, transcription_status, summary_file_url, summary_md, client_id")
        .eq("tenant_id", tenantId!)
        .eq("client_id", clientId)
        .order("start_time", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as RecordingRow[];
    },
    enabled: !!tenantId && !!clientId,
    refetchInterval: (query) =>
      (query.state.data ?? []).some((r) => r.transcription_status === "processing") ? 7000 : false,
  });

  const grouped = useMemo(() => groupClientRecordings(recordings), [recordings]);

  // Marketing briefs generated from these recordings (payload.source_recording_id)
  const { data: workItems = [] } = useQuery({
    queryKey: ["client-recording-work-items", tenantId, clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("marketing_work_items")
        .select("id, title, status, payload")
        .eq("tenant_id", tenantId!)
        .eq("client_id", clientId);
      if (error) throw error;
      return ((data ?? []) as WorkItemRow[]).filter((wi) => wi.payload?.source_recording_id);
    },
    enabled: !!tenantId && !!clientId,
  });

  const workItemForRecording = (recording: RecordingRow) => {
    const ids = new Set(recording._ids || [recording.id]);
    return workItems.find((wi) => wi.payload?.source_recording_id && ids.has(wi.payload.source_recording_id));
  };

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

  const handleDownload = async (rec: RecordingRow) => {
    if (rec.file_path) {
      const { data, error } = await supabase.storage
        .from("recordings")
        .createSignedUrl(rec.file_path, 3600, {
          download: (rec.meeting_topic || "recording").replace(/[\\/:*?"<>|]+/g, "-").slice(0, 80),
        });
      if (error || !data) {
        toast.error("שגיאה בהורדת ההקלטה");
        return;
      }
      window.open(data.signedUrl, "_blank");
      return;
    }
    if (rec.recording_url) {
      window.open(rec.recording_url, "_blank");
      return;
    }
    toast.error("אין קובץ זמין להורדה");
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

  if (!tenantId || isLoading) {
    return (
      <div className="flex items-center justify-center py-10 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin ml-2" />טוען הקלטות...
      </div>
    );
  }

  if (grouped.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 gap-2 text-muted-foreground">
        <Video className="h-8 w-8" />
        <div>אין הקלטות משויכות ללקוח זה</div>
        <div className="text-xs text-center max-w-sm">
          הקלטות מפגישות (Zoom / כרמן / תוסף / העלאה ידנית) ששויכו ללקוח יופיעו כאן
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link to={buildPath("/recordings")}>
            <ExternalLink className="h-3.5 w-3.5 ml-1" />
            פתח את מסך ההקלטות
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm text-muted-foreground">
          {grouped.length.toLocaleString("he-IL")} הקלטות משויכות ללקוח
        </div>
        <Button variant="ghost" size="sm" asChild>
          <Link to={buildPath("/recordings")}>
            <ExternalLink className="h-3.5 w-3.5 ml-1" />
            כל ההקלטות
          </Link>
        </Button>
      </div>

      {grouped.map((rec) => {
        const workItem = workItemForRecording(rec);
        const isAudioOnly = rec.recording_type === "audio_only";
        const canPlay = !!(rec.file_path || rec.recording_url);
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
                  {canPlay && (
                    <Button size="sm" variant="outline" onClick={() => void handlePlay(rec)}>
                      <Play className="h-3.5 w-3.5 ml-1" />
                      {playingId === rec.id ? "סגור" : "נגן"}
                    </Button>
                  )}
                  {canPlay && (
                    <Button size="sm" variant="outline" onClick={() => void handleDownload(rec)}>
                      <Download className="h-3.5 w-3.5 ml-1" />
                      הורד
                    </Button>
                  )}
                  {rec.transcription && (
                    <Button size="sm" variant="outline" onClick={() => setTranscriptRecording(rec)}>
                      <Mic className="h-3.5 w-3.5 ml-1" />תמלול
                    </Button>
                  )}
                  {(rec.summary_md || rec.summary_file_url) ? (
                    <Button size="sm" variant="outline" onClick={() => setSummaryRecording(rec)}>
                      <FileText className="h-3.5 w-3.5 ml-1" />סיכום
                    </Button>
                  ) : rec.transcription ? (
                    <Button size="sm" variant="outline" onClick={() => setSummarizeRecording(rec)}>
                      <Sparkles className="h-3.5 w-3.5 ml-1" />צור סיכום
                    </Button>
                  ) : null}
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

      {transcriptRecording && (
        <TranscriptViewerDialog
          open={!!transcriptRecording}
          onOpenChange={(open) => !open && setTranscriptRecording(null)}
          recording={transcriptRecording}
        />
      )}

      {summarizeRecording && (
        <SummarizeRecordingDialog
          open={!!summarizeRecording}
          onOpenChange={(open) => !open && setSummarizeRecording(null)}
          recording={summarizeRecording}
        />
      )}

      {summaryRecording && tenantId && (
        <SummaryViewerDialog
          open={!!summaryRecording}
          onOpenChange={(open) => !open && setSummaryRecording(null)}
          recording={summaryRecording}
          tenantId={tenantId}
          recordingIds={summaryRecording._ids}
          onSaved={(summaryMd) => setSummaryRecording((prev) => prev ? { ...prev, summary_md: summaryMd } : prev)}
        />
      )}
    </div>
  );
}
