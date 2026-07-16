import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Share2, FileText } from "lucide-react";
import { ShareSummaryDialog, type ShareableRecording } from "./ShareSummaryDialog";

interface SummaryViewerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recording: ShareableRecording;
  tenantId: string;
}

// RTL prose wrapper matching the Carmen chat markdown styling.
export const SUMMARY_PROSE_CLASS =
  "prose prose-sm dark:prose-invert max-w-none text-right " +
  "[&>h2]:text-primary [&>h2]:mt-5 [&>h2]:mb-2 [&>h3]:mt-3 [&>h3]:mb-1 " +
  "[&_table]:my-2 [&_table]:w-full [&_table]:border-collapse " +
  "[&_th]:border [&_th]:border-border [&_th]:bg-muted/50 [&_th]:px-2 [&_th]:py-1 [&_th]:text-right " +
  "[&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1 [&_td]:text-right " +
  "[&_blockquote]:border-r-4 [&_blockquote]:border-l-0 [&_blockquote]:pr-3 [&_blockquote]:pl-0";

export function SummaryViewerDialog({ open, onOpenChange, recording, tenantId }: SummaryViewerDialogProps) {
  const [shareOpen, setShareOpen] = useState(false);

  const meetingName = recording.meeting_topic || "פגישה";
  const meetingDate = recording.start_time
    ? new Date(recording.start_time).toLocaleDateString("he-IL")
    : "";

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[88vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              סיכום פגישה — {meetingName}
            </DialogTitle>
            {meetingDate && <DialogDescription>{meetingDate}</DialogDescription>}
          </DialogHeader>

          <div className="flex gap-2">
            <Button size="sm" onClick={() => setShareOpen(true)} disabled={!recording.summary_md}>
              <Share2 className="h-4 w-4 ml-1" />
              שתף ללקוח
            </Button>
            {recording.summary_file_url && (
              <Button size="sm" variant="outline" asChild>
                <a href={recording.summary_file_url} target="_blank" rel="noreferrer">
                  <Download className="h-4 w-4 ml-1" />
                  הורד Word
                </a>
              </Button>
            )}
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto rounded-lg border bg-card p-5">
            {recording.summary_md ? (
              <div dir="rtl" className={SUMMARY_PROSE_CLASS}>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{recording.summary_md}</ReactMarkdown>
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
                    {" "}או ליצור סיכום מחדש.
                  </>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {shareOpen && (
        <ShareSummaryDialog
          open={shareOpen}
          onOpenChange={setShareOpen}
          recording={recording}
          tenantId={tenantId}
        />
      )}
    </>
  );
}
