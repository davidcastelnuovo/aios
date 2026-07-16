import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { useTenant } from "@/contexts/TenantContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Video,
  Search,
  Download,
  Loader2,
  Upload,
  FileVideo,
  Folder,
  FolderPlus,
  Users,
  LayoutGrid,
  MoreVertical,
  Pencil,
  Trash2,
} from "lucide-react";
import SummarizeRecordingDialog from "@/components/SummarizeRecordingDialog";
import { SummaryViewerDialog } from "@/components/recordings/SummaryViewerDialog";
import { ShareSummaryDialog } from "@/components/recordings/ShareSummaryDialog";
import { RecordingCard, type FeedRecording, type FolderOption } from "@/components/recordings/RecordingCard";
import { cn } from "@/lib/utils";

type SidebarSelection =
  | { kind: "all" }
  | { kind: "unassigned" }
  | { kind: "client"; clientId: string }
  | { kind: "folder"; folderId: string };

export default function Recordings() {
  const { currentTenantId } = useTenant();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState("");
  const [selection, setSelection] = useState<SidebarSelection>({ kind: "all" });

  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadTopic, setUploadTopic] = useState("");
  const [uploadDate, setUploadDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [uploadClientId, setUploadClientId] = useState<string>("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  const [fetchFromDate, setFetchFromDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split("T")[0];
  });
  const [fetchToDate, setFetchToDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [zoomFetchOpen, setZoomFetchOpen] = useState(false);

  const [summarizeRec, setSummarizeRec] = useState<FeedRecording | null>(null);
  const [summaryViewRec, setSummaryViewRec] = useState<FeedRecording | null>(null);
  const [shareRec, setShareRec] = useState<FeedRecording | null>(null);

  const [newFolderName, setNewFolderName] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  // ── Data ──────────────────────────────────────────────────────

  const { data: zoomIntegration } = useQuery({
    queryKey: ["zoom-integration", currentTenantId],
    queryFn: async () => {
      if (!currentTenantId) return null;
      const { data } = await supabase
        .from("tenant_integrations")
        .select("id, is_active")
        .eq("tenant_id", currentTenantId)
        .eq("integration_type", "zoom")
        .maybeSingle();
      return data;
    },
    enabled: !!currentTenantId,
  });

  const { data: recordings = [] } = useQuery({
    queryKey: ["recordings", currentTenantId],
    queryFn: async () => {
      if (!currentTenantId) return [];
      const { data } = await supabase
        .from("zoom_recordings")
        .select("*, clients(name), leads(company_name)")
        .eq("tenant_id", currentTenantId)
        .order("start_time", { ascending: false, nullsFirst: false });
      const list = data || [];

      // Auto-cleanup: mark stale "processing" recordings as failed (no update for >10min)
      const stale = list.filter((r: any) =>
        r.transcription_status === "processing" &&
        !r.transcription &&
        Date.now() - new Date(r.updated_at || r.created_at).getTime() > 10 * 60 * 1000
      );
      if (stale.length > 0) {
        await supabase
          .from("zoom_recordings")
          .update({
            transcription_status: "failed",
            transcription_error: "תהליך התמלול נתקע (timeout)",
          } as any)
          .in("id", stale.map((r: any) => r.id));
        stale.forEach((r: any) => {
          r.transcription_status = "failed";
          r.transcription_error = "תהליך התמלול נתקע (timeout)";
        });
      }
      return list;
    },
    enabled: !!currentTenantId,
    refetchInterval: (query) =>
      ((query.state.data as any[]) ?? []).some((r) => r.transcription_status === "processing") ? 8000 : false,
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["clients-for-recordings", currentTenantId],
    queryFn: async () => {
      if (!currentTenantId) return [];
      const { data } = await supabase.from("clients").select("id, name").eq("tenant_id", currentTenantId).order("name");
      return data || [];
    },
    enabled: !!currentTenantId,
  });

  const { data: folders = [] } = useQuery({
    queryKey: ["recording-folders", currentTenantId],
    queryFn: async () => {
      if (!currentTenantId) return [];
      const { data } = await (supabase as any)
        .from("recording_folders")
        .select("id, name, icon, position")
        .eq("tenant_id", currentTenantId)
        .order("position")
        .order("name");
      return (data || []) as FolderOption[];
    },
    enabled: !!currentTenantId,
  });

  // ── Mutations ─────────────────────────────────────────────────

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["recordings", currentTenantId] });

  const assignMutation = useMutation({
    mutationFn: async ({ recordingIds, clientId }: { recordingIds: string[]; clientId: string | null }) => {
      const { error } = await supabase
        .from("zoom_recordings")
        .update({ client_id: clientId, lead_id: null })
        .in("id", recordingIds);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast({ title: "השיוך עודכן" });
    },
    onError: (err: any) => toast({ title: "שגיאה בשיוך", description: err.message, variant: "destructive" }),
  });

  const moveFolderMutation = useMutation({
    mutationFn: async ({ recordingIds, folderId }: { recordingIds: string[]; folderId: string | null }) => {
      const { error } = await (supabase as any)
        .from("zoom_recordings")
        .update({ folder_id: folderId })
        .in("id", recordingIds);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast({ title: "ההקלטה הועברה" });
    },
    onError: (err: any) => toast({ title: "שגיאה בהעברה", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ recordingIds, filePaths }: { recordingIds: string[]; filePaths: string[] }) => {
      if (filePaths.length > 0) {
        await supabase.storage.from("recordings").remove(filePaths);
        // Extension recordings also leave sampled screen frames ({ts}_frame_N.jpg)
        // used for speaker naming — sweep them by the shared timestamp prefix.
        const framePrefixes = new Set<string>();
        for (const p of filePaths) {
          const m = p.match(/^(.+)\/(\d+)(?:_[a-z_0-9]+)?\.webm$/);
          if (m) framePrefixes.add(`${m[1]}|${m[2]}`);
        }
        for (const key of framePrefixes) {
          const [folder, ts] = key.split("|");
          const { data: frames } = await supabase.storage
            .from("recordings")
            .list(folder, { limit: 300, search: `${ts}_frame_` });
          if (frames && frames.length > 0) {
            await supabase.storage.from("recordings").remove(frames.map((f) => `${folder}/${f.name}`));
          }
        }
      }
      const { error } = await supabase.from("zoom_recordings").delete().in("id", recordingIds);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast({ title: "ההקלטה נמחקה בהצלחה" });
    },
    onError: (err: any) => toast({ title: "שגיאה במחיקה", description: err.message, variant: "destructive" }),
  });

  const fetchRecordingsMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("fetch-zoom-recordings", {
        body: { tenant_id: currentTenantId, from_date: fetchFromDate, to_date: fetchToDate },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      invalidate();
      setZoomFetchOpen(false);
      toast({ title: "הקלטות נמשכו בהצלחה", description: `נמצאו ${data.meetings_found} פגישות, עובדו ${data.recordings_processed} הקלטות` });
    },
    onError: (err: any) => toast({ title: "שגיאה במשיכת הקלטות", description: err.message, variant: "destructive" }),
  });

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!currentTenantId) throw new Error("No tenant");
      let filePath: string | null = null;
      if (uploadFile) {
        const ext = uploadFile.name.split(".").pop();
        const fileName = `${currentTenantId}/${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage.from("recordings").upload(fileName, uploadFile);
        if (uploadError) throw uploadError;
        filePath = fileName;
      }
      const { error } = await supabase
        .from("zoom_recordings")
        .insert({
          tenant_id: currentTenantId,
          meeting_topic: uploadTopic || "הקלטה ידנית",
          start_time: new Date(uploadDate).toISOString(),
          source: "manual",
          file_path: filePath,
          client_id: uploadClientId || null,
          folder_id: selection.kind === "folder" ? selection.folderId : null,
          meeting_id: `manual_${Date.now()}`,
          recording_type: "manual",
        } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast({ title: "ההקלטה הועלתה בהצלחה" });
      setUploadOpen(false);
      setUploadTopic("");
      setUploadFile(null);
      setUploadClientId("");
    },
    onError: (err: any) => toast({ title: "שגיאה בהעלאה", description: err.message, variant: "destructive" }),
  });

  const createFolderMutation = useMutation({
    mutationFn: async (name: string) => {
      const { error } = await (supabase as any)
        .from("recording_folders")
        .insert({ tenant_id: currentTenantId, name });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recording-folders", currentTenantId] });
      setNewFolderName("");
      setCreatingFolder(false);
    },
    onError: (err: any) => toast({ title: "שגיאה ביצירת תיקייה", description: err.message, variant: "destructive" }),
  });

  const renameFolderMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await (supabase as any).from("recording_folders").update({ name }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recording-folders", currentTenantId] });
      setRenamingFolderId(null);
    },
  });

  const deleteFolderMutation = useMutation({
    mutationFn: async (id: string) => {
      // folder_id on recordings is ON DELETE SET NULL — recordings survive.
      const { error } = await (supabase as any).from("recording_folders").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recording-folders", currentTenantId] });
      invalidate();
      setSelection({ kind: "all" });
      toast({ title: "התיקייה נמחקה (ההקלטות נשמרו)" });
    },
  });

  // ── Grouping (one card per meeting_id) ───────────────────────

  const groupedRecordings: FeedRecording[] = useMemo(() => {
    const groups = new Map<string, any[]>();
    recordings.forEach((rec: any) => {
      const key = rec.meeting_id || rec.id;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(rec);
    });

    return Array.from(groups.values()).map((group) => {
      const videoRec = group.find((r: any) => r.recording_type === "shared_screen_with_speaker_view")
        || group.find((r: any) => r.recording_type === "speaker_view")
        || group.find((r: any) => r.recording_type === "screen_capture");
      const audioRec = group.find((r: any) => r.recording_type === "audio_only");
      const primary = videoRec || audioRec || group[0];
      const transcribedRec = group.find((r: any) => r.transcription_status === "completed" && r.transcription);

      return {
        ...primary,
        transcription_status: group.find((r: any) => r.transcription_status === "completed")?.transcription_status
          || group.find((r: any) => r.transcription_status === "processing")?.transcription_status
          || group.find((r: any) => r.transcription_status === "failed")?.transcription_status
          || null,
        transcription: transcribedRec?.transcription || null,
        summary_file_url: group.find((r: any) => r.summary_file_url)?.summary_file_url || null,
        summary_md: group.find((r: any) => r.summary_md)?.summary_md || null,
        thumbnail_path: group.find((r: any) => r.thumbnail_path)?.thumbnail_path || null,
        _group: group,
      } as FeedRecording;
    });
  }, [recordings]);

  // Virtual client folders: clients that actually have recordings
  const clientFolders = useMemo(() => {
    const counts = new Map<string, { name: string; count: number }>();
    for (const rec of groupedRecordings) {
      if (!rec.client_id) continue;
      const name = rec.clients?.name || "לקוח";
      const entry = counts.get(rec.client_id) || { name, count: 0 };
      entry.count += 1;
      counts.set(rec.client_id, entry);
    }
    return Array.from(counts.entries())
      .map(([clientId, v]) => ({ clientId, ...v }))
      .sort((a, b) => a.name.localeCompare(b.name, "he"));
  }, [groupedRecordings]);

  const folderCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const rec of groupedRecordings) {
      if (rec.folder_id) counts.set(rec.folder_id, (counts.get(rec.folder_id) || 0) + 1);
    }
    return counts;
  }, [groupedRecordings]);

  const filtered = groupedRecordings.filter((rec) => {
    if (selection.kind === "unassigned" && (rec.client_id || rec.folder_id)) return false;
    if (selection.kind === "client" && rec.client_id !== selection.clientId) return false;
    if (selection.kind === "folder" && rec.folder_id !== selection.folderId) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      const clientName = rec.clients?.name?.toLowerCase() || "";
      const topic = (rec.meeting_topic || "").toLowerCase();
      return topic.includes(q) || clientName.includes(q);
    }
    return true;
  });

  // ── Card action handlers ─────────────────────────────────────

  const groupIds = (rec: FeedRecording) => (rec._group || [rec]).map((r) => r.id);

  const handleDelete = (rec: FeedRecording) => {
    const filePaths = (rec._group || [rec])
      .flatMap((r: any) => [r.file_path, r.audio_file_path, r.thumbnail_path, ...(r.audio_file_paths || [])])
      .filter(Boolean);
    deleteMutation.mutate({ recordingIds: groupIds(rec), filePaths });
  };

  const sidebarItem = (
    active: boolean,
    onClick: () => void,
    icon: React.ReactNode,
    label: string,
    count?: number,
    actions?: React.ReactNode,
  ) => (
    <div
      className={cn(
        "group/item flex items-center gap-2 rounded-md px-2 py-1.5 text-sm cursor-pointer",
        active ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted"
      )}
      onClick={onClick}
    >
      {icon}
      <span className="flex-1 truncate">{label}</span>
      {actions}
      {typeof count === "number" && (
        <span className="text-xs text-muted-foreground">{count}</span>
      )}
    </div>
  );

  return (
    <div className="container mx-auto p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <FileVideo className="h-8 w-8" />
          הקלטות
        </h1>
        <div className="flex gap-2">
          {zoomIntegration?.is_active && (
            <Button variant="outline" onClick={() => setZoomFetchOpen(true)}>
              <Download className="h-4 w-4 ml-2" />
              משוך מ-Zoom
            </Button>
          )}
          <Button onClick={() => setUploadOpen(true)}>
            <Upload className="h-4 w-4 ml-2" />
            העלה הקלטה
          </Button>
        </div>
      </div>

      <div className="flex gap-5 items-start">
        {/* Sidebar */}
        <aside className="w-60 shrink-0 space-y-4 sticky top-4">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="חיפוש..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pr-9" />
          </div>

          <div className="space-y-0.5">
            {sidebarItem(selection.kind === "all", () => setSelection({ kind: "all" }), <LayoutGrid className="h-4 w-4" />, "כל ההקלטות", groupedRecordings.length)}
            {sidebarItem(
              selection.kind === "unassigned",
              () => setSelection({ kind: "unassigned" }),
              <Video className="h-4 w-4" />,
              "ללא שיוך",
              groupedRecordings.filter((r) => !r.client_id && !r.folder_id).length,
            )}
          </div>

          {clientFolders.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 px-2 mb-1 text-xs font-semibold text-muted-foreground">
                <Users className="h-3.5 w-3.5" />
                לקוחות
              </div>
              <div className="space-y-0.5 max-h-64 overflow-y-auto">
                {clientFolders.map((cf) =>
                  <div key={cf.clientId}>
                    {sidebarItem(
                      selection.kind === "client" && selection.clientId === cf.clientId,
                      () => setSelection({ kind: "client", clientId: cf.clientId }),
                      <Folder className="h-4 w-4 text-blue-500" />,
                      cf.name,
                      cf.count,
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between px-2 mb-1">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                <Folder className="h-3.5 w-3.5" />
                תיקיות
              </div>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setCreatingFolder(true)} title="תיקייה חדשה">
                <FolderPlus className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="space-y-0.5">
              {folders.map((f) => (
                <div key={f.id}>
                  {renamingFolderId === f.id ? (
                    <div className="flex items-center gap-1 px-2 py-1">
                      <Input
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        className="h-7 text-sm"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && renameValue.trim()) {
                            renameFolderMutation.mutate({ id: f.id, name: renameValue.trim() });
                          }
                          if (e.key === "Escape") setRenamingFolderId(null);
                        }}
                        onBlur={() => setRenamingFolderId(null)}
                      />
                    </div>
                  ) : (
                    sidebarItem(
                      selection.kind === "folder" && selection.folderId === f.id,
                      () => setSelection({ kind: "folder", folderId: f.id }),
                      <Folder className="h-4 w-4 text-amber-500" />,
                      `${f.icon ? f.icon + " " : ""}${f.name}`,
                      folderCounts.get(f.id) || 0,
                      <DropdownMenu dir="rtl">
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-5 w-5 opacity-0 group-hover/item:opacity-100">
                            <MoreVertical className="h-3 w-3" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setRenamingFolderId(f.id); setRenameValue(f.name); }}>
                            <Pencil className="h-3.5 w-3.5 ml-2" />שנה שם
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={(e) => { e.stopPropagation(); deleteFolderMutation.mutate(f.id); }}
                          >
                            <Trash2 className="h-3.5 w-3.5 ml-2" />מחק תיקייה
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>,
                    )
                  )}
                </div>
              ))}
              {creatingFolder && (
                <div className="px-2 py-1">
                  <Input
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    placeholder="שם התיקייה..."
                    className="h-7 text-sm"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && newFolderName.trim()) createFolderMutation.mutate(newFolderName.trim());
                      if (e.key === "Escape") { setCreatingFolder(false); setNewFolderName(""); }
                    }}
                    onBlur={() => { if (!newFolderName.trim()) setCreatingFolder(false); }}
                  />
                </div>
              )}
              {folders.length === 0 && !creatingFolder && (
                <div className="px-2 py-1 text-xs text-muted-foreground">
                  אין תיקיות עדיין — למשל "הדרכות מערכת"
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* Feed */}
        <main className="flex-1 min-w-0">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground border rounded-xl">
              <Video className="h-10 w-10" />
              <div className="font-medium">אין הקלטות להצגה</div>
              <div className="text-sm">הקלט פגישה עם התוסף, העלה קובץ, או משוך הקלטות מ-Zoom</div>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
              {filtered.map((rec) => (
                <RecordingCard
                  key={rec.id}
                  rec={rec}
                  clients={clients}
                  folders={folders}
                  onOpenSummary={setSummaryViewRec}
                  onCreateSummary={(r) => {
                    const audioRec = r._group?.find((g: any) => g.recording_type === "audio_only") || r;
                    setSummarizeRec({ ...audioRec, _group: r._group });
                  }}
                  onShare={setShareRec}
                  onAssignClient={(r, clientId) => assignMutation.mutate({ recordingIds: groupIds(r), clientId })}
                  onMoveToFolder={(r, folderId) => moveFolderMutation.mutate({ recordingIds: groupIds(r), folderId })}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </main>
      </div>

      {/* Upload dialog */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>העלאת הקלטה</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>נושא</Label>
              <Input value={uploadTopic} onChange={(e) => setUploadTopic(e.target.value)} placeholder="נושא ההקלטה..." />
            </div>
            <div>
              <Label>תאריך</Label>
              <Input type="date" value={uploadDate} onChange={(e) => setUploadDate(e.target.value)} />
            </div>
            <div>
              <Label>שיוך ללקוח (אופציונלי)</Label>
              <Select value={uploadClientId || "none"} onValueChange={(v) => setUploadClientId(v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— ללא —</SelectItem>
                  {clients.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>קובץ הקלטה</Label>
              <Input type="file" accept="audio/*,video/*" onChange={(e) => setUploadFile(e.target.files?.[0] || null)} />
            </div>
            <Button className="w-full" onClick={() => uploadMutation.mutate()} disabled={uploadMutation.isPending || !uploadFile}>
              {uploadMutation.isPending ? <Loader2 className="h-4 w-4 ml-2 animate-spin" /> : <Upload className="h-4 w-4 ml-2" />}
              העלה
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Zoom fetch dialog */}
      <Dialog open={zoomFetchOpen} onOpenChange={setZoomFetchOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>משיכת הקלטות מ-Zoom</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>מתאריך</Label>
              <Input type="date" value={fetchFromDate} onChange={(e) => setFetchFromDate(e.target.value)} />
            </div>
            <div>
              <Label>עד תאריך</Label>
              <Input type="date" value={fetchToDate} onChange={(e) => setFetchToDate(e.target.value)} />
            </div>
            <Button className="w-full" onClick={() => fetchRecordingsMutation.mutate()} disabled={fetchRecordingsMutation.isPending}>
              {fetchRecordingsMutation.isPending ? <Loader2 className="h-4 w-4 ml-2 animate-spin" /> : <Download className="h-4 w-4 ml-2" />}
              משוך הקלטות
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {summarizeRec && (
        <SummarizeRecordingDialog
          open={!!summarizeRec}
          onOpenChange={(open: boolean) => !open && setSummarizeRec(null)}
          recording={summarizeRec}
        />
      )}

      {summaryViewRec && currentTenantId && (
        <SummaryViewerDialog
          open={!!summaryViewRec}
          onOpenChange={(open) => !open && setSummaryViewRec(null)}
          recording={summaryViewRec as any}
          tenantId={currentTenantId}
        />
      )}

      {shareRec && currentTenantId && (
        <ShareSummaryDialog
          open={!!shareRec}
          onOpenChange={(open) => !open && setShareRec(null)}
          recording={shareRec as any}
          tenantId={currentTenantId}
        />
      )}
    </div>
  );
}
