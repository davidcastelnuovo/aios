import { useMemo } from "react";
import { Copy, Download, Loader2, Mic, Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useRegenerateRecordingSummary } from "@/hooks/useRegenerateRecordingSummary";

interface TranscriptRecording {
  id?: string;
  meeting_topic: string | null;
  start_time: string | null;
  transcription: string | null;
}

interface TranscriptViewerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recording: TranscriptRecording;
  tenantId?: string;
  /** All recording rows in the same meeting — keeps grouped Zoom files in sync. */
  recordingIds?: string[];
  onSummarized?: (summaryMd: string) => void;
}

function safeFileName(value: string): string {
  return value.replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim().slice(0, 100) || "transcript";
}

export function TranscriptViewerDialog({
  open,
  onOpenChange,
  recording,
  tenantId,
  recordingIds,
  onSummarized,
}: TranscriptViewerDialogProps) {
  const { toast } = useToast();
  const transcript = recording.transcription?.trim() || "";
  const ids = recordingIds?.length
    ? recordingIds
    : recording.id
    ? [recording.id]
    : [];
  const regenerateMutation = useRegenerateRecordingSummary({
    tenantId: tenantId ?? "",
    recordingIds: ids,
    onRegenerated: onSummarized,
  });
  const canSummarize = !!tenantId && ids.length > 0 && !!transcript;
  const stats = useMemo(() => {
    const words = transcript ? transcript.split(/\s+/).filter(Boolean).length : 0;
    const speakers = new Set(
      transcript
        .split("\n")
        .map((line) => line.match(/^\[[^\]]+\]\s+([^:]+):/)?.[1]?.trim())
        .filter(Boolean),
    ).size;
    return { words, speakers };
  }, [transcript]);

  const copyTranscript = async () => {
    await navigator.clipboard.writeText(transcript);
    toast({ title: "התמלול הועתק" });
  };

  const downloadTranscript = () => {
    const blob = new Blob([transcript], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${safeFileName(recording.meeting_topic || "תמלול פגישה")}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const meetingDate = recording.start_time
    ? new Date(recording.start_time).toLocaleString("he-IL")
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mic className="h-5 w-5 text-primary" />
            תמלול מלא — {recording.meeting_topic || "פגישה"}
          </DialogTitle>
          <DialogDescription>
            {[meetingDate, `${stats.words.toLocaleString("he-IL")} מילים`, stats.speakers > 0 ? `${stats.speakers} דוברים` : null]
              .filter(Boolean)
              .join(" · ")}
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => void copyTranscript()} disabled={!transcript}>
            <Copy className="h-4 w-4 ml-1" />
            העתק
          </Button>
          <Button size="sm" variant="outline" onClick={downloadTranscript} disabled={!transcript}>
            <Download className="h-4 w-4 ml-1" />
            הורד TXT
          </Button>
          {canSummarize && (
            <Button
              size="sm"
              onClick={() => regenerateMutation.mutate()}
              disabled={regenerateMutation.isPending}
              title="יוצר סיכום מפורט מהתמלול, לפי מתודת הסיכום הנוכחית"
            >
              {regenerateMutation.isPending
                ? <Loader2 className="h-4 w-4 ml-1 animate-spin" />
                : <Sparkles className="h-4 w-4 ml-1" />}
              {regenerateMutation.isPending ? "מסכם מחדש..." : "סכם מחדש מפורט"}
            </Button>
          )}
        </div>

        <div
          className="flex-1 min-h-0 overflow-y-auto rounded-lg border bg-card p-5"
          dir="rtl"
        >
          {transcript ? (
            <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-7 text-right">
              {transcript}
            </pre>
          ) : (
            <div className="text-sm text-muted-foreground text-center py-8">
              אין תמלול זמין להקלטה הזו.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
