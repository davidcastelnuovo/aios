import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Download, Share2, FileText, Pencil, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ShareSummaryDialog, type ShareableRecording } from "./ShareSummaryDialog";

interface SummaryViewerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recording: ShareableRecording;
  tenantId: string;
  /** All recording rows in the same meeting — keeps grouped Zoom files in sync. */
  recordingIds?: string[];
  onSaved?: (summaryMd: string) => void;
}

// RTL prose wrapper matching the Carmen chat markdown styling.
export const SUMMARY_PROSE_CLASS =
  "prose prose-sm dark:prose-invert max-w-none text-right " +
  "[&>h2]:text-primary [&>h2]:mt-5 [&>h2]:mb-2 [&>h3]:mt-3 [&>h3]:mb-1 " +
  "[&_table]:my-2 [&_table]:w-full [&_table]:border-collapse " +
  "[&_th]:border [&_th]:border-border [&_th]:bg-muted/50 [&_th]:px-2 [&_th]:py-1 [&_th]:text-right " +
  "[&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1 [&_td]:text-right " +
  "[&_blockquote]:border-r-4 [&_blockquote]:border-l-0 [&_blockquote]:pr-3 [&_blockquote]:pl-0";

export function SummaryViewerDialog({
  open,
  onOpenChange,
  recording,
  tenantId,
  recordingIds,
  onSaved,
}: SummaryViewerDialogProps) {
  const queryClient = useQueryClient();
  const [shareOpen, setShareOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [summaryMd, setSummaryMd] = useState(recording.summary_md || "");
  const [draft, setDraft] = useState(recording.summary_md || "");

  useEffect(() => {
    if (!open) return;
    const next = recording.summary_md || "";
    setSummaryMd(next);
    setDraft(next);
    setEditing(false);
  }, [open, recording.id, recording.summary_md]);

  const ids = recordingIds?.length ? recordingIds : [recording.id];

  const saveMutation = useMutation({
    mutationFn: async (nextSummary: string) => {
      const { error } = await supabase
        .from("zoom_recordings")
        .update({ summary_md: nextSummary })
        .in("id", ids);
      if (error) throw error;
      return nextSummary;
    },
    onSuccess: (nextSummary) => {
      setSummaryMd(nextSummary);
      setDraft(nextSummary);
      setEditing(false);
      queryClient.invalidateQueries({ queryKey: ["recordings"] });
      queryClient.invalidateQueries({ queryKey: ["client-recordings"] });
      onSaved?.(nextSummary);
      toast.success("הסיכום נשמר");
    },
    onError: (err: Error) => {
      toast.error(err.message || "שגיאה בשמירת הסיכום");
    },
  });

  const meetingName = recording.meeting_topic || "פגישה";
  const meetingDate = recording.start_time
    ? new Date(recording.start_time).toLocaleDateString("he-IL")
    : "";
  const dirty = draft !== summaryMd;
  const displayRecording = { ...recording, summary_md: summaryMd || null };

  const startEditing = () => {
    setDraft(summaryMd);
    setEditing(true);
  };

  const cancelEditing = () => {
    setDraft(summaryMd);
    setEditing(false);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl w-[calc(100vw-2rem)] max-h-[88vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              סיכום פגישה — {meetingName}
            </DialogTitle>
            {meetingDate && <DialogDescription>{meetingDate}</DialogDescription>}
          </DialogHeader>

          <div className="flex gap-2 flex-wrap">
            {editing ? (
              <>
                <Button
                  size="sm"
                  onClick={() => saveMutation.mutate(draft)}
                  disabled={saveMutation.isPending || !dirty}
                >
                  {saveMutation.isPending
                    ? <Loader2 className="h-4 w-4 ml-1 animate-spin" />
                    : null}
                  שמור
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={cancelEditing}
                  disabled={saveMutation.isPending}
                >
                  <X className="h-4 w-4 ml-1" />
                  ביטול
                </Button>
              </>
            ) : (
              <Button size="sm" variant="outline" onClick={startEditing}>
                <Pencil className="h-4 w-4 ml-1" />
                {summaryMd ? "ערוך סיכום" : "כתוב סיכום"}
              </Button>
            )}
            <Button
              size="sm"
              onClick={() => setShareOpen(true)}
              disabled={!summaryMd || editing}
            >
              <Share2 className="h-4 w-4 ml-1" />
              שתף ללקוח
            </Button>
            {recording.summary_file_url && !editing && (
              <Button size="sm" variant="outline" asChild>
                <a href={recording.summary_file_url} target="_blank" rel="noreferrer">
                  <Download className="h-4 w-4 ml-1" />
                  הורד Word
                </a>
              </Button>
            )}
          </div>

          {editing ? (
            <Textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if ((event.metaKey || event.ctrlKey) && event.key === "Enter" && dirty) {
                  event.preventDefault();
                  saveMutation.mutate(draft);
                }
                if (event.key === "Escape") {
                  event.preventDefault();
                  cancelEditing();
                }
              }}
              dir="rtl"
              className="flex-1 min-h-[320px] font-mono text-sm leading-6 resize-none"
              placeholder="כתוב את סיכום הפגישה ב-Markdown..."
              autoFocus
            />
          ) : (
            <div className="flex-1 min-h-0 overflow-y-auto rounded-lg border bg-card p-5">
              {summaryMd ? (
                <div dir="rtl" className={SUMMARY_PROSE_CLASS}>
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{summaryMd}</ReactMarkdown>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground text-center py-8">
                  לסיכום הזה אין עדיין גרסת תצוגה — הוא נוצר לפני השדרוג.
                  {recording.summary_file_url && (
                    <>
                      {" "}ניתן{" "}
                      <a href={recording.summary_file_url} target="_blank" rel="noreferrer" className="text-primary underline">
                        להוריד את קובץ ה-Word
                      </a>
                      {" "}או לכתוב סיכום כאן.
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {shareOpen && (
        <ShareSummaryDialog
          open={shareOpen}
          onOpenChange={setShareOpen}
          recording={displayRecording}
          tenantId={tenantId}
        />
      )}
    </>
  );
}
