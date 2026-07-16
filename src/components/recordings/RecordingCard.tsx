import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Play,
  FileText,
  Share2,
  MoreVertical,
  Trash2,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Video,
  Folder,
  UserRound,
  Sparkles,
  Mic,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

export interface FeedRecording {
  id: string;
  meeting_topic: string | null;
  start_time: string | null;
  duration: number | null;
  source: string | null;
  recording_type: string | null;
  file_path: string | null;
  recording_url: string | null;
  thumbnail_path: string | null;
  folder_id: string | null;
  client_id: string | null;
  lead_id: string | null;
  transcription: string | null;
  transcription_status: string | null;
  summary_md: string | null;
  summary_file_url: string | null;
  clients?: { name: string } | null;
  // deno-style loose grouping payload from the page
  _group?: FeedRecording[];
}

export interface FolderOption {
  id: string;
  name: string;
  icon: string | null;
}

interface RecordingCardProps {
  rec: FeedRecording;
  clients: { id: string; name: string }[];
  folders: FolderOption[];
  onOpenSummary: (rec: FeedRecording) => void;
  onCreateSummary: (rec: FeedRecording) => void;
  onShare: (rec: FeedRecording) => void;
  onAssignClient: (rec: FeedRecording, clientId: string | null) => void;
  onMoveToFolder: (rec: FeedRecording, folderId: string | null) => void;
  onDelete: (rec: FeedRecording) => void;
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

function formatDuration(minutes: number | null): string | null {
  if (!minutes) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, "0")} ש׳` : `${m} דק׳`;
}

export function RecordingCard({
  rec,
  clients,
  folders,
  onOpenSummary,
  onCreateSummary,
  onShare,
  onAssignClient,
  onMoveToFolder,
  onDelete,
}: RecordingCardProps) {
  const [playOpen, setPlayOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const { data: thumbnailUrl } = useQuery({
    queryKey: ["recording-thumb", rec.thumbnail_path],
    queryFn: async () => {
      if (!rec.thumbnail_path) return null;
      const { data } = await supabase.storage
        .from("recordings")
        .createSignedUrl(rec.thumbnail_path, 60 * 60 * 12);
      return data?.signedUrl ?? null;
    },
    enabled: !!rec.thumbnail_path,
    staleTime: 60 * 60 * 1000,
  });

  const { data: playbackUrl } = useQuery({
    queryKey: ["recording-play", rec.file_path],
    queryFn: async () => {
      if (!rec.file_path) return null;
      const { data } = await supabase.storage
        .from("recordings")
        .createSignedUrl(rec.file_path, 3600);
      return data?.signedUrl ?? null;
    },
    enabled: playOpen && !!rec.file_path,
  });

  const isAudioOnly = rec.recording_type === "audio_only";
  const duration = formatDuration(rec.duration);
  const hasSummary = !!(rec.summary_md || rec.summary_file_url);

  const statusBadge = () => {
    if (rec.transcription) {
      return (
        <Badge variant="outline" className="text-green-600 border-green-600 bg-background/90">
          <CheckCircle2 className="h-3 w-3 ml-1" />תומלל
        </Badge>
      );
    }
    if (rec.transcription_status === "processing") {
      return (
        <Badge variant="outline" className="text-blue-600 border-blue-600 bg-background/90">
          <Loader2 className="h-3 w-3 ml-1 animate-spin" />מתמלל
        </Badge>
      );
    }
    if (rec.transcription_status === "failed") {
      return (
        <Badge variant="outline" className="text-destructive border-destructive bg-background/90">
          <AlertCircle className="h-3 w-3 ml-1" />נכשל
        </Badge>
      );
    }
    return null;
  };

  const handlePlayClick = () => {
    if (rec.file_path) {
      setPlayOpen(true);
    } else if (rec.recording_url) {
      window.open(rec.recording_url, "_blank");
    }
  };

  return (
    <>
      <Card className="overflow-hidden group hover:shadow-lg transition-all">
        {/* Thumbnail */}
        <button
          type="button"
          className="relative block w-full aspect-video bg-muted focus:outline-none"
          onClick={handlePlayClick}
          title="נגן הקלטה"
        >
          {thumbnailUrl ? (
            <img src={thumbnailUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
          ) : (
            <div className={cn(
              "w-full h-full flex items-center justify-center",
              "bg-gradient-to-br from-primary/15 via-primary/5 to-muted"
            )}>
              {isAudioOnly
                ? <Mic className="h-10 w-10 text-primary/50" />
                : <Video className="h-10 w-10 text-primary/50" />}
            </div>
          )}
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/25">
            <div className="rounded-full bg-background/90 p-3 shadow">
              <Play className="h-6 w-6 text-primary" />
            </div>
          </div>
          {duration && (
            <span className="absolute bottom-1.5 left-1.5 rounded bg-black/75 text-white text-[11px] px-1.5 py-0.5 font-medium">
              {duration}
            </span>
          )}
          <span className="absolute top-1.5 right-1.5">{statusBadge()}</span>
        </button>

        {/* Body */}
        <div className="p-3 space-y-2">
          <div className="flex items-start justify-between gap-1">
            <div className="min-w-0">
              <div className="font-medium text-sm leading-snug line-clamp-2">
                {rec.meeting_topic || "ללא נושא"}
              </div>
              <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2 flex-wrap">
                {rec.start_time && <span>{format(new Date(rec.start_time), "dd/MM/yy HH:mm")}</span>}
                <span>{sourceLabel(rec.source)}</span>
              </div>
            </div>

            <DropdownMenu dir="rtl">
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <UserRound className="h-4 w-4 ml-2" />
                    שייך ללקוח
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="max-h-72 overflow-y-auto">
                    <DropdownMenuItem onClick={() => onAssignClient(rec, null)}>
                      — ללא שיוך —
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {clients.map((c) => (
                      <DropdownMenuItem
                        key={c.id}
                        onClick={() => onAssignClient(rec, c.id)}
                        className={cn(rec.client_id === c.id && "font-semibold text-primary")}
                      >
                        {c.name}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>

                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <Folder className="h-4 w-4 ml-2" />
                    העבר לתיקייה
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="max-h-72 overflow-y-auto">
                    <DropdownMenuItem onClick={() => onMoveToFolder(rec, null)}>
                      — ללא תיקייה —
                    </DropdownMenuItem>
                    {folders.length > 0 && <DropdownMenuSeparator />}
                    {folders.map((f) => (
                      <DropdownMenuItem
                        key={f.id}
                        onClick={() => onMoveToFolder(rec, f.id)}
                        className={cn(rec.folder_id === f.id && "font-semibold text-primary")}
                      >
                        {f.icon ? `${f.icon} ` : ""}{f.name}
                      </DropdownMenuItem>
                    ))}
                    {folders.length === 0 && (
                      <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
                        אין תיקיות — צור תיקייה בסרגל הצד
                      </DropdownMenuLabel>
                    )}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>

                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeleteOpen(true)}>
                  <Trash2 className="h-4 w-4 ml-2" />
                  מחק הקלטה
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Client chip + actions */}
          <div className="flex items-center justify-between gap-2">
            {rec.clients?.name ? (
              <Badge variant="secondary" className="text-[11px] max-w-[45%] truncate">
                {rec.clients.name}
              </Badge>
            ) : (
              <span className="text-[11px] text-muted-foreground">ללא שיוך</span>
            )}
            <div className="flex gap-1">
              {hasSummary ? (
                <Button size="sm" variant="ghost" className="h-7 px-2 text-green-600" onClick={() => onOpenSummary(rec)}>
                  <FileText className="h-3.5 w-3.5 ml-1" />
                  סיכום
                </Button>
              ) : (
                <Button size="sm" variant="ghost" className="h-7 px-2 text-primary" onClick={() => onCreateSummary(rec)}>
                  <Sparkles className="h-3.5 w-3.5 ml-1" />
                  סכם
                </Button>
              )}
              {hasSummary && (
                <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => onShare(rec)}>
                  <Share2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Player */}
      <Dialog open={playOpen} onOpenChange={setPlayOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{rec.meeting_topic || "הקלטה"}</DialogTitle>
          </DialogHeader>
          {playbackUrl ? (
            isAudioOnly ? (
              <audio src={playbackUrl} controls autoPlay className="w-full" />
            ) : (
              <video src={playbackUrl} controls autoPlay className="w-full max-h-[70vh] rounded-md bg-black" />
            )
          ) : (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin ml-2" />טוען...
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>למחוק את ההקלטה?</AlertDialogTitle>
            <AlertDialogDescription>
              "{rec.meeting_topic || "ללא נושא"}" — ההקלטה, התמלול והקבצים יימחקו לצמיתות.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ביטול</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => onDelete(rec)}
            >
              מחק
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
