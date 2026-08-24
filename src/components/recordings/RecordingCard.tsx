import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Users,
  Building2,
  Link2,
  Sparkles,
  Mic,
  Pencil,
} from "lucide-react";
import { format } from "date-fns";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  EntityAssignmentDialog,
  type EntityAssignmentSelection,
} from "@/components/shared/EntityAssignmentDialog";
import { useTenantPath } from "@/hooks/useTenantPath";

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
  agency_id?: string | null;
  lead_id: string | null;
  summary_scope?: "auto" | "client" | "lead" | "campaigner" | "agency" | null;
  transcription: string | null;
  transcription_status: string | null;
  summary_md: string | null;
  summary_file_url: string | null;
  suggested_client_id: string | null;
  campaigner_ids: string[] | null;
  clients?: { name: string } | null;
  agencies?: { name: string } | null;
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
  clients: { id: string; name: string; agency_id?: string | null }[];
  campaigners: { id: string; full_name: string; email?: string | null }[];
  agencies: { id: string; name: string }[];
  folders: FolderOption[];
  campaignerNames?: string[];
  onOpenTranscript: (rec: FeedRecording) => void;
  onOpenSummary: (rec: FeedRecording) => void;
  onCreateSummary: (rec: FeedRecording) => void;
  onShare: (rec: FeedRecording) => void;
  onAssignTarget: (rec: FeedRecording, selection: EntityAssignmentSelection) => void | Promise<void>;
  onMoveToFolder: (rec: FeedRecording, folderId: string | null) => void;
  onRename: (rec: FeedRecording, name: string) => Promise<void>;
  onDelete: (rec: FeedRecording) => void;
  onAcceptSuggestion?: (rec: FeedRecording) => void;
  onRejectSuggestion?: (rec: FeedRecording) => void;
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

function formatDuration(minutes: number | null): string | null {
  if (!minutes) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, "0")} ש׳` : `${m} דק׳`;
}

export function RecordingCard({
  rec,
  clients,
  campaigners,
  agencies,
  folders,
  campaignerNames = [],
  onOpenTranscript,
  onOpenSummary,
  onCreateSummary,
  onShare,
  onAssignTarget,
  onMoveToFolder,
  onRename,
  onDelete,
  onAcceptSuggestion,
  onRejectSuggestion,
}: RecordingCardProps) {
  const { buildPath } = useTenantPath();
  const suggestedClientName = rec.suggested_client_id && !rec.client_id
    ? clients.find((c) => c.id === rec.suggested_client_id)?.name ?? null
    : null;
  const [playOpen, setPlayOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [isRenaming, setIsRenaming] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [assignmentOpen, setAssignmentOpen] = useState(false);
  const assignedAgencyName = rec.agency_id
    ? agencies.find((agency) => agency.id === rec.agency_id)?.name
    : null;
  const currentAssignment: EntityAssignmentSelection = rec.client_id
    ? { type: "client", ids: [rec.client_id] }
    : (rec.campaigner_ids || []).length > 0
    ? { type: "team", ids: rec.campaigner_ids || [] }
    : rec.agency_id
    ? { type: "agency", ids: [rec.agency_id] }
    : null;

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

  const handleRename = async () => {
    const nextName = renameValue.trim();
    if (!nextName || nextName === (rec.meeting_topic || "").trim()) return;
    setIsRenaming(true);
    try {
      await onRename(rec, nextName);
      setRenameOpen(false);
    } catch {
      // The parent mutation shows the error toast; keep the dialog open.
    } finally {
      setIsRenaming(false);
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
                <DropdownMenuItem
                  onClick={() => {
                    setRenameValue(rec.meeting_topic || "");
                    setRenameOpen(true);
                  }}
                >
                  <Pencil className="h-4 w-4 ml-2" />
                  שנה שם
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setAssignmentOpen(true)}>
                  <Link2 className="h-4 w-4 ml-2" />
                  ניהול שיוך
                </DropdownMenuItem>
                {rec.transcription && (
                  <DropdownMenuItem onClick={() => onCreateSummary(rec)}>
                    <Sparkles className="h-4 w-4 ml-2" />
                    {hasSummary ? "צור סיכום מפורט מחדש" : "צור סיכום מפורט"}
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />

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

          {/* AI suggestion: assign only after human confirmation */}
          {suggestedClientName && (
            <div className="flex items-center gap-1.5 rounded-md bg-primary/5 border border-primary/20 px-2 py-1">
              <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />
              <span className="text-[11px] flex-1 truncate">הצעה: {suggestedClientName}</span>
              <Button size="sm" variant="ghost" className="h-5 px-1.5 text-[11px] text-green-600" onClick={() => onAcceptSuggestion?.(rec)}>
                אשר
              </Button>
              <Button size="sm" variant="ghost" className="h-5 px-1.5 text-[11px] text-muted-foreground" onClick={() => onRejectSuggestion?.(rec)}>
                דחה
              </Button>
            </div>
          )}

          {/* Client chip + actions */}
          <div className="flex items-center justify-between gap-2">
            {rec.clients?.name && rec.client_id ? (
              <Badge variant="secondary" className="text-[11px] max-w-[45%] truncate p-0">
                <Link
                  to={buildPath(`/clients?clientId=${rec.client_id}&tab=recordings`)}
                  className="block truncate px-2.5 py-0.5"
                  title="פתח בכרטיס הלקוח"
                >
                  {rec.clients.name}
                </Link>
              </Badge>
            ) : rec.clients?.name ? (
              <Badge variant="secondary" className="text-[11px] max-w-[45%] truncate">
                {rec.clients.name}
              </Badge>
            ) : campaignerNames.length > 0 ? (
              <Badge variant="outline" className="text-[11px] max-w-[55%] truncate" title={campaignerNames.join(", ")}>
                פנימי · {campaignerNames.join(", ")}
              </Badge>
            ) : assignedAgencyName || rec.agencies?.name ? (
              <Badge variant="outline" className="text-[11px] max-w-[55%] truncate">
                סוכנות · {assignedAgencyName || rec.agencies?.name}
              </Badge>
            ) : (
              <span className="text-[11px] text-muted-foreground">ללא שיוך</span>
            )}
            <div className="flex gap-1">
              {rec.transcription && (
                <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => onOpenTranscript(rec)}>
                  <Mic className="h-3.5 w-3.5 ml-1" />
                  תמלול
                </Button>
              )}
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

      <EntityAssignmentDialog
        open={assignmentOpen}
        onOpenChange={setAssignmentOpen}
        title={`שיוך הקלטה — ${rec.meeting_topic || "ללא נושא"}`}
        currentSelection={currentAssignment}
        groups={[
          {
            type: "client",
            label: "לקוחות",
            icon: UserRound,
            options: clients.map((client) => ({
              id: client.id,
              label: client.name,
              description: agencies.find((agency) => agency.id === client.agency_id)?.name,
            })),
            emptyLabel: "לא נמצאו לקוחות",
          },
          {
            type: "team",
            label: "אנשי צוות",
            icon: Users,
            multiple: true,
            options: campaigners.map((campaigner) => ({
              id: campaigner.id,
              label: campaigner.full_name,
              description: campaigner.email,
            })),
            emptyLabel: "לא נמצאו אנשי צוות",
          },
          {
            type: "agency",
            label: "סוכנויות",
            icon: Building2,
            options: agencies.map((agency) => ({
              id: agency.id,
              label: agency.name,
            })),
            emptyLabel: "לא נמצאו סוכנויות",
          },
        ]}
        onSave={(selection) => onAssignTarget(rec, selection)}
      />

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>שינוי שם ההקלטה</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void handleRename();
            }}
          >
            <Input
              value={renameValue}
              onChange={(event) => setRenameValue(event.target.value)}
              placeholder="שם ההקלטה"
              autoFocus
              maxLength={200}
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setRenameOpen(false)}>
                ביטול
              </Button>
              <Button
                type="submit"
                disabled={
                  isRenaming ||
                  !renameValue.trim() ||
                  renameValue.trim() === (rec.meeting_topic || "").trim()
                }
              >
                {isRenaming && <Loader2 className="h-4 w-4 ml-2 animate-spin" />}
                שמור
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

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
