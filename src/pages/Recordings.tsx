import { useState, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useTenant } from "@/contexts/TenantContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Video, Search, Download, Loader2, ExternalLink, Upload, FileVideo, FileText, Plus, Sparkles, CheckCircle2, AlertCircle, Trash2, Pencil, Check, X } from "lucide-react";
import { format } from "date-fns";
import SummarizeRecordingDialog from "@/components/SummarizeRecordingDialog";

export default function Recordings() {
  const { currentTenantId } = useTenant();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"all" | "client" | "lead" | "unassigned">("all");
  const [filterSource, setFilterSource] = useState<"all" | "zoom" | "manual">("all");
  const [fetchFromDate, setFetchFromDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [fetchToDate, setFetchToDate] = useState(() => new Date().toISOString().split('T')[0]);

  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadTopic, setUploadTopic] = useState("");
  const [uploadDate, setUploadDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [uploadClientId, setUploadClientId] = useState<string>("");
  const [uploadLeadId, setUploadLeadId] = useState<string>("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  const [summarizeOpen, setSummarizeOpen] = useState(false);
  const [selectedRecording, setSelectedRecording] = useState<any>(null);

  const { data: zoomIntegration } = useQuery({
    queryKey: ['zoom-integration', currentTenantId],
    queryFn: async () => {
      if (!currentTenantId) return null;
      const { data } = await supabase
        .from('tenant_integrations')
        .select('id, is_active')
        .eq('tenant_id', currentTenantId)
        .eq('integration_type', 'zoom')
        .maybeSingle();
      return data;
    },
    enabled: !!currentTenantId,
  });

  const { data: recordings = [] } = useQuery({
    queryKey: ['recordings', currentTenantId],
    queryFn: async () => {
      if (!currentTenantId) return [];
      const { data } = await supabase
        .from('zoom_recordings')
        .select('*, clients(name), leads(company_name)')
        .eq('tenant_id', currentTenantId)
        .order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!currentTenantId,
  });

  const { data: clients = [] } = useQuery({
    queryKey: ['clients-for-recordings', currentTenantId],
    queryFn: async () => {
      if (!currentTenantId) return [];
      const { data } = await supabase.from('clients').select('id, name').eq('tenant_id', currentTenantId).order('name');
      return data || [];
    },
    enabled: !!currentTenantId,
  });

  const { data: leads = [] } = useQuery({
    queryKey: ['leads-for-recordings', currentTenantId],
    queryFn: async () => {
      if (!currentTenantId) return [];
      const { data } = await supabase.from('leads').select('id, company_name').eq('tenant_id', currentTenantId).order('company_name');
      return data || [];
    },
    enabled: !!currentTenantId,
  });

  const [editingTopicId, setEditingTopicId] = useState<string | null>(null);
  const [editingTopicValue, setEditingTopicValue] = useState("");

  const assignMutation = useMutation({
    mutationFn: async ({ recordingId, clientId, leadId }: { recordingId: string; clientId?: string | null; leadId?: string | null }) => {
      const { error } = await supabase
        .from('zoom_recordings')
        .update({ client_id: clientId || null, lead_id: leadId || null })
        .eq('id', recordingId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recordings'] });
      toast({ title: "שויך בהצלחה" });
    },
  });

  const updateTopicMutation = useMutation({
    mutationFn: async ({ recordingIds, topic }: { recordingIds: string[]; topic: string }) => {
      const { error } = await supabase
        .from('zoom_recordings')
        .update({ meeting_topic: topic })
        .in('id', recordingIds);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recordings'] });
      setEditingTopicId(null);
      toast({ title: "הנושא עודכן בהצלחה" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ recordingIds, filePaths }: { recordingIds: string[]; filePaths: string[] }) => {
      // Delete files from storage if they exist
      if (filePaths.length > 0) {
        await supabase.storage.from('recordings').remove(filePaths);
      }
      // Delete from DB
      const { error } = await supabase
        .from('zoom_recordings')
        .delete()
        .in('id', recordingIds);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recordings'] });
      toast({ title: "ההקלטה נמחקה בהצלחה" });
    },
    onError: (err: any) => {
      toast({ title: "שגיאה במחיקה", description: err.message, variant: "destructive" });
    },
  });

  const fetchRecordingsMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('fetch-zoom-recordings', {
        body: { tenant_id: currentTenantId, from_date: fetchFromDate, to_date: fetchToDate },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['recordings'] });
      toast({ title: "הקלטות נמשכו בהצלחה", description: `נמצאו ${data.meetings_found} פגישות, עובדו ${data.recordings_processed} הקלטות` });
    },
    onError: (err: any) => {
      toast({ title: "שגיאה במשיכת הקלטות", description: err.message, variant: "destructive" });
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!currentTenantId) throw new Error("No tenant");
      
      let filePath: string | null = null;
      
      if (uploadFile) {
        const ext = uploadFile.name.split('.').pop();
        const fileName = `${currentTenantId}/${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from('recordings')
          .upload(fileName, uploadFile);
        if (uploadError) throw uploadError;
        filePath = fileName;
      }

      const { error } = await supabase
        .from('zoom_recordings')
        .insert({
          tenant_id: currentTenantId,
          meeting_topic: uploadTopic || 'הקלטה ידנית',
          start_time: new Date(uploadDate).toISOString(),
          source: 'manual',
          file_path: filePath,
          client_id: uploadClientId || null,
          lead_id: uploadLeadId || null,
          meeting_id: `manual_${Date.now()}`,
          recording_type: 'manual',
        } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recordings'] });
      toast({ title: "ההקלטה הועלתה בהצלחה" });
      setUploadOpen(false);
      setUploadTopic("");
      setUploadFile(null);
      setUploadClientId("");
      setUploadLeadId("");
    },
    onError: (err: any) => {
      toast({ title: "שגיאה בהעלאה", description: err.message, variant: "destructive" });
    },
  });

  const sourceLabel = (source: string) => {
    switch (source) {
      case 'zoom': return 'Zoom';
      case 'manual': return 'העלאה ידנית';
      case 'google_meet': return 'Google Meet';
      default: return source || 'Zoom';
    }
  };

  const transcriptionStatusBadge = (rec: any) => {
    const status = rec.transcription_status;
    if (!status) return null;
    switch (status) {
      case 'processing':
        return <Badge variant="outline" className="text-yellow-600 border-yellow-600"><Loader2 className="h-3 w-3 ml-1 animate-spin" />מתמלל...</Badge>;
      case 'completed':
        return <Badge variant="outline" className="text-green-600 border-green-600"><CheckCircle2 className="h-3 w-3 ml-1" />תומלל</Badge>;
      case 'failed':
        return <Badge variant="outline" className="text-destructive border-destructive"><AlertCircle className="h-3 w-3 ml-1" />נכשל</Badge>;
      default:
        return null;
    }
  };

  // Group recordings by meeting_id to avoid visual duplicates
  const groupedRecordings = (() => {
    const groups = new Map<string, any[]>();
    recordings.forEach((rec: any) => {
      const key = rec.meeting_id || rec.id;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(rec);
    });

    return Array.from(groups.values()).map((group) => {
      // Pick the best representative record
      const videoRec = group.find((r: any) => r.recording_type === 'shared_screen_with_speaker_view') 
        || group.find((r: any) => r.recording_type === 'speaker_view');
      const audioRec = group.find((r: any) => r.recording_type === 'audio_only');
      const primary = videoRec || audioRec || group[0];

      return {
        ...primary,
        // Keep video URL for playback, audio URL for transcription
        video_url: videoRec?.recording_url || null,
        audio_url: audioRec?.recording_url || null,
        audio_recording_id: audioRec?.id || primary.id,
        // Merge transcription status from any file in the group
        transcription_status: group.find((r: any) => r.transcription_status === 'completed')?.transcription_status
          || group.find((r: any) => r.transcription_status === 'processing')?.transcription_status
          || group.find((r: any) => r.transcription_status === 'failed')?.transcription_status
          || null,
        // Merge summary_file_url from any file in the group
        summary_file_url: group.find((r: any) => r.summary_file_url)?.summary_file_url || null,
        _group: group,
      };
    });
  })();

  const filtered = groupedRecordings.filter((rec: any) => {
    if (filterType === "client" && !rec.client_id) return false;
    if (filterType === "lead" && !rec.lead_id) return false;
    if (filterType === "unassigned" && (rec.client_id || rec.lead_id)) return false;
    if (filterSource !== "all" && (rec.source || 'zoom') !== filterSource) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      const clientName = rec.clients?.name?.toLowerCase() || "";
      const leadName = rec.leads?.company_name?.toLowerCase() || "";
      const topic = (rec.meeting_topic || "").toLowerCase();
      const host = (rec.host_email || "").toLowerCase();
      return topic.includes(q) || host.includes(q) || clientName.includes(q) || leadName.includes(q);
    }
    return true;
  });

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <FileVideo className="h-8 w-8" />
            הקלטות
          </h1>
          <p className="text-muted-foreground mt-1">ניהול הקלטות מכל המקורות</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
            <DialogTrigger asChild>
              <Button>
                <Upload className="h-4 w-4 ml-2" />
                העלאת הקלטה
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>העלאת הקלטה ידנית</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>נושא</Label>
                  <Input value={uploadTopic} onChange={(e) => setUploadTopic(e.target.value)} placeholder="נושא ההקלטה" />
                </div>
                <div className="space-y-2">
                  <Label>תאריך</Label>
                  <Input type="date" dir="ltr" value={uploadDate} onChange={(e) => setUploadDate(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>שיוך ללקוח</Label>
                  <Select value={uploadClientId || "none"} onValueChange={(val) => setUploadClientId(val === "none" ? "" : val)}>
                    <SelectTrigger><SelectValue placeholder="בחר לקוח" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">ללא</SelectItem>
                      {clients.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>שיוך לליד</Label>
                  <Select value={uploadLeadId || "none"} onValueChange={(val) => setUploadLeadId(val === "none" ? "" : val)}>
                    <SelectTrigger><SelectValue placeholder="בחר ליד" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">ללא</SelectItem>
                      {leads.map((l: any) => <SelectItem key={l.id} value={l.id}>{l.company_name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>קובץ הקלטה (אופציונלי)</Label>
                  <Input
                    ref={fileInputRef}
                    type="file"
                    accept="audio/*,video/*"
                    onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  />
                </div>
                <Button onClick={() => uploadMutation.mutate()} disabled={uploadMutation.isPending} className="w-full">
                  {uploadMutation.isPending ? <Loader2 className="h-4 w-4 ml-2 animate-spin" /> : <Plus className="h-4 w-4 ml-2" />}
                  {uploadMutation.isPending ? "מעלה..." : "העלה הקלטה"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {zoomIntegration?.is_active && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Video className="h-5 w-5" />
              משיכה מ-Zoom
            </CardTitle>
            <CardDescription>משוך הקלטות ישנות מחשבון Zoom שלך</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-3 items-end">
              <div className="space-y-2">
                <Label>מתאריך</Label>
                <Input type="date" dir="ltr" value={fetchFromDate} onChange={(e) => setFetchFromDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>עד תאריך</Label>
                <Input type="date" dir="ltr" value={fetchToDate} onChange={(e) => setFetchToDate(e.target.value)} />
              </div>
              <Button onClick={() => fetchRecordingsMutation.mutate()} disabled={fetchRecordingsMutation.isPending}>
                {fetchRecordingsMutation.isPending ? <Loader2 className="h-4 w-4 ml-2 animate-spin" /> : <Download className="h-4 w-4 ml-2" />}
                {fetchRecordingsMutation.isPending ? "מושך הקלטות..." : "משוך הקלטות"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>כל ההקלטות</CardTitle>
          <CardDescription>{groupedRecordings.length} פגישות ({recordings.length} קבצים)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="חיפוש..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pr-9" />
            </div>
            <Select value={filterSource} onValueChange={(val: any) => setFilterSource(val)}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">כל המקורות</SelectItem>
                <SelectItem value="zoom">Zoom</SelectItem>
                <SelectItem value="manual">העלאה ידנית</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterType} onValueChange={(val: any) => setFilterType(val)}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">הכל</SelectItem>
                <SelectItem value="client">משויך ללקוח</SelectItem>
                <SelectItem value="lead">משויך לליד</SelectItem>
                <SelectItem value="unassigned">לא משויך</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {groupedRecordings.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">עדיין אין הקלטות</p>
          ) : filtered.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">לא נמצאו הקלטות תואמות</p>
          ) : (
            <>
              {(searchQuery || filterType !== "all" || filterSource !== "all") && (
                <p className="text-sm text-muted-foreground mb-2">מציג {filtered.length} מתוך {groupedRecordings.length}</p>
              )}
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>נושא</TableHead>
                      <TableHead>מקור</TableHead>
                      <TableHead>תאריך</TableHead>
                      <TableHead>משך (דק')</TableHead>
                      <TableHead>תמלול</TableHead>
                      <TableHead>שיוך ללקוח</TableHead>
                      <TableHead>שיוך לליד</TableHead>
                      <TableHead>קישור</TableHead>
                      <TableHead>סיכום</TableHead>
                      <TableHead>מחיקה</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((rec: any) => (
                      <TableRow key={rec.id}>
                        <TableCell className="font-medium">
                          {editingTopicId === rec.id ? (
                            <div className="flex items-center gap-1">
                              <Input
                                value={editingTopicValue}
                                onChange={(e) => setEditingTopicValue(e.target.value)}
                                className="h-7 text-sm"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    const allIds = rec._group?.map((r: any) => r.id) || [rec.id];
                                    updateTopicMutation.mutate({ recordingIds: allIds, topic: editingTopicValue });
                                  }
                                  if (e.key === 'Escape') setEditingTopicId(null);
                                }}
                              />
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
                                const allIds = rec._group?.map((r: any) => r.id) || [rec.id];
                                updateTopicMutation.mutate({ recordingIds: allIds, topic: editingTopicValue });
                              }}>
                                <Check className="h-3 w-3" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingTopicId(null)}>
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 group">
                              <span>{rec.meeting_topic || "-"}</span>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => {
                                  setEditingTopicId(rec.id);
                                  setEditingTopicValue(rec.meeting_topic || "");
                                }}
                              >
                                <Pencil className="h-3 w-3" />
                              </Button>
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{sourceLabel(rec.source)}</Badge>
                        </TableCell>
                        <TableCell>{rec.start_time ? format(new Date(rec.start_time), "dd/MM/yyyy HH:mm") : "-"}</TableCell>
                        <TableCell>{rec.duration || "-"}</TableCell>
                        <TableCell>{transcriptionStatusBadge(rec)}</TableCell>
                        <TableCell>
                          <Select
                            value={rec.client_id || "none"}
                            onValueChange={(val) => assignMutation.mutate({ recordingId: rec.id, clientId: val === "none" ? null : val, leadId: rec.lead_id })}
                          >
                            <SelectTrigger className="w-[140px]"><SelectValue placeholder="בחר לקוח" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">ללא</SelectItem>
                              {clients.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={rec.lead_id || "none"}
                            onValueChange={(val) => assignMutation.mutate({ recordingId: rec.id, clientId: rec.client_id, leadId: val === "none" ? null : val })}
                          >
                            <SelectTrigger className="w-[140px]"><SelectValue placeholder="בחר ליד" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">ללא</SelectItem>
                              {leads.map((l: any) => <SelectItem key={l.id} value={l.id}>{l.company_name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          {(rec.video_url || rec.recording_url) ? (
                            <Button variant="ghost" size="icon" asChild>
                              <a href={rec.video_url || rec.recording_url} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="h-4 w-4" />
                              </a>
                            </Button>
                          ) : rec.file_path ? (
                            <Button variant="ghost" size="icon" onClick={async () => {
                              const { data } = supabase.storage.from('recordings').getPublicUrl(rec.file_path);
                              window.open(data.publicUrl, '_blank');
                            }}>
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          ) : "-"}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {rec.summary_file_url ? (
                              <Button variant="ghost" size="sm" asChild className="text-green-600 hover:text-green-700">
                                <a href={rec.summary_file_url} target="_blank" rel="noopener noreferrer">
                                  <FileText className="h-4 w-4 ml-1" />
                                  הורד
                                </a>
                              </Button>
                            ) : null}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                const audioRec = rec._group?.find((r: any) => r.recording_type === 'audio_only') || rec;
                                setSelectedRecording(audioRec);
                                setSummarizeOpen(true);
                              }}
                              className="text-primary hover:text-primary/80"
                            >
                              <Sparkles className="h-4 w-4 ml-1" />
                              {rec.summary_file_url ? "סכם מחדש" : "סכם"}
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive/80">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>מחיקת הקלטה</AlertDialogTitle>
                                <AlertDialogDescription>
                                  האם אתה בטוח שברצונך למחוק את ההקלטה "{rec.meeting_topic}"? פעולה זו לא ניתנת לביטול.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>ביטול</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => {
                                    const allIds = rec._group?.map((r: any) => r.id) || [rec.id];
                                    const filePaths = (rec._group || [rec])
                                      .map((r: any) => r.file_path)
                                      .filter(Boolean);
                                    deleteMutation.mutate({ recordingIds: allIds, filePaths });
                                  }}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  מחק
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <SummarizeRecordingDialog
        open={summarizeOpen}
        onOpenChange={setSummarizeOpen}
        recording={selectedRecording}
      />
    </div>
  );
}
