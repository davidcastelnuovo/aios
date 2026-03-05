import { useState, useEffect, useRef, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { Loader2, FileText, Sparkles, Download, ExternalLink, Mic, RotateCcw } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

interface SummarizeRecordingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recording: any;
}

const FOCUS_OPTIONS = [
  { key: "decisions", label: "החלטות שהתקבלו" },
  { key: "action_items", label: "משימות ופעולות נדרשות" },
  { key: "pain_points", label: "נקודות כאב של הלקוח" },
  { key: "pricing", label: "הצעות מחיר ותמחור" },
  { key: "next_steps", label: "שלבים הבאים" },
  { key: "key_quotes", label: "ציטוטים מרכזיים" },
];

// ── Audio chunking utilities ──────────────────────────────────

function float32ToWav(samples: Float32Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }
  return new Blob([buffer], { type: 'audio/wav' });
}

async function transcribeChunked(
  audioBlob: Blob,
  onProgress: (current: number, total: number) => void,
): Promise<string> {
  const SAMPLE_RATE = 16000;
  const CHUNK_DURATION_SEC = 8 * 60;

  const arrayBuffer = await audioBlob.arrayBuffer();
  const audioCtx = new AudioContext({ sampleRate: SAMPLE_RATE });
  const decoded = await audioCtx.decodeAudioData(arrayBuffer);
  await audioCtx.close();

  const mono = decoded.getChannelData(0);
  const chunkSamples = SAMPLE_RATE * CHUNK_DURATION_SEC;
  const totalChunks = Math.ceil(mono.length / chunkSamples);

  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData?.session?.access_token;
  if (!accessToken) throw new Error('לא מחובר – נא להתחבר מחדש');

  const transcriptions: string[] = [];

  for (let i = 0; i < totalChunks; i++) {
    onProgress(i + 1, totalChunks);
    const start = i * chunkSamples;
    const end = Math.min(start + chunkSamples, mono.length);
    const chunk = mono.slice(start, end);
    const wavBlob = float32ToWav(chunk, SAMPLE_RATE);

    const formData = new FormData();
    formData.append('audio', wavBlob, `chunk_${i}.wav`);

    const resp = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/transcribe-voice`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: formData,
      },
    );

    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`שגיאה בתמלול חלק ${i + 1}: ${errText}`);
    }

    const result = await resp.json();
    if (result.text) transcriptions.push(result.text);
  }

  return transcriptions.join(' ');
}

// ── Component ─────────────────────────────────────────────────

export default function SummarizeRecordingDialog({
  open,
  onOpenChange,
  recording,
}: SummarizeRecordingDialogProps) {
  const { currentTenantId } = useTenant();
  const { toast } = useToast();

  const [transcript, setTranscript] = useState("");
  const [focusPoints, setFocusPoints] = useState<string[]>(["decisions", "action_items", "next_steps"]);
  const [customFocus, setCustomFocus] = useState("");
  const [targetType, setTargetType] = useState<"client" | "lead">(
    recording?.client_id ? "client" : recording?.lead_id ? "lead" : "client"
  );
  const [targetId, setTargetId] = useState<string>(recording?.client_id || recording?.lead_id || "");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [transcribeProgress, setTranscribeProgress] = useState<{ current: number; total: number } | null>(null);
  const [failedError, setFailedError] = useState<string | null>(null);
  const [result, setResult] = useState<{ summary: string; file_url: string; file_name: string } | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Auto-populate transcript from DB on open ──
  useEffect(() => {
    if (open && recording?.id) {
      // Check if recording already has a completed transcription
      const checkExisting = async () => {
        const { data } = await supabase
          .from('zoom_recordings')
          .select('transcription, transcription_status')
          .eq('id', recording.id)
          .single();
        
        if (data?.transcription_status === 'completed' && data?.transcription && !transcript) {
          setTranscript(data.transcription);
          toast({ title: "תמלול קיים נטען אוטומטית" });
        } else if (data?.transcription_status === 'processing') {
          // Resume polling
          setIsTranscribing(true);
          setIsPolling(true);
          startPolling(recording.id);
        }
      };
      checkExisting();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, recording?.id]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    setIsPolling(false);
    setIsTranscribing(false);
  }, []);

  const handleRetryTranscription = useCallback(async (recordingId: string) => {
    // Reset status in DB and restart
    await supabase
      .from('zoom_recordings')
      .update({ transcription_status: null, transcription_error: null } as any)
      .eq('id', recordingId);
    stopPolling();
    // Re-trigger transcription
    handleTranscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stopPolling]);

  const startPolling = useCallback((recordingId: string) => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    const startedAt = Date.now();
    
    pollingRef.current = setInterval(async () => {
      try {
        const { data } = await supabase
          .from('zoom_recordings')
          .select('transcription, transcription_status, transcription_error, updated_at')
          .eq('id', recordingId)
          .single();

        if (data?.transcription_status === 'completed' && data?.transcription) {
          setTranscript(data.transcription);
          stopPolling();
          toast({ title: "התמלול הושלם בהצלחה!" });
        } else if (data?.transcription_status === 'failed') {
          stopPolling();
          setFailedError(data.transcription_error || "שגיאה לא ידועה");
          toast({
            title: "התמלול נכשל",
            description: data.transcription_error || "נסה שוב או הדבק תמלול ידנית",
            variant: "destructive",
          });
        } else if (data?.transcription_status === 'processing') {
          // Stale detection: if processing for >5 minutes, assume crash
          const updatedAt = data.updated_at ? new Date(data.updated_at).getTime() : startedAt;
          const elapsed = Date.now() - updatedAt;
          if (elapsed > 5 * 60 * 1000) {
            stopPolling();
            const errMsg = 'התמלול נתקע (timeout - מעל 5 דקות)';
            setFailedError(errMsg);
            // Mark as failed in DB
            await supabase
              .from('zoom_recordings')
              .update({ transcription_status: 'failed', transcription_error: errMsg } as any)
              .eq('id', recordingId);
            toast({
              title: "נראה שהתמלול נתקע",
              description: "ניתן לנסות שוב",
              variant: "destructive",
            });
          }
        }
      } catch {
        // Silently ignore polling errors
      }
    }, 5000);
  }, [toast, stopPolling]);

  const { data: clients = [] } = useQuery({
    queryKey: ["clients-summary", currentTenantId],
    queryFn: async () => {
      if (!currentTenantId) return [];
      const { data } = await supabase.from("clients").select("id, name").eq("tenant_id", currentTenantId).order("name");
      return data || [];
    },
    enabled: !!currentTenantId && open,
  });

  const { data: leads = [] } = useQuery({
    queryKey: ["leads-summary", currentTenantId],
    queryFn: async () => {
      if (!currentTenantId) return [];
      const { data } = await supabase.from("leads").select("id, company_name").eq("tenant_id", currentTenantId).order("company_name");
      return data || [];
    },
    enabled: !!currentTenantId && open,
  });

  const toggleFocus = (key: string) => {
    setFocusPoints((prev) =>
      prev.includes(key) ? prev.filter((f) => f !== key) : [...prev, key]
    );
  };

  const hasAudioSource = !!(recording?.file_path || recording?.recording_url || recording?.download_url);

  // ── Download + chunk helper ──────────────────────────────────
  const attemptDownloadAndChunk = async (recordingId: string) => {
    toast({ title: "הקובץ גדול – מתחיל תמלול מחולק..." });
    const { data: dlData, error: dlError } = await supabase.functions.invoke("transcribe-recording", {
      body: { recording_id: recordingId, mode: 'download' },
    });
    if (dlError) throw dlError;
    if (dlData?.error) throw new Error(dlData.message || dlData.error);
    if (!dlData?.audio_base64) throw new Error('Failed to download audio');

    const binary = atob(dlData.audio_base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const audioBlob = new Blob([bytes], { type: dlData.content_type || 'audio/mp4' });

    const fullText = await transcribeChunked(audioBlob, (current, total) => {
      setTranscribeProgress({ current, total });
    });

    setTranscript(fullText);
    toast({ title: "התמלול הושלם בהצלחה!" });
    setIsTranscribing(false);
  };

  // ── Transcribe handler (supports large files + background polling) ─────────────

  const handleTranscribe = async () => {
    if (!recording?.id) return;
    setIsTranscribing(true);
    setTranscribeProgress(null);
    setIsPolling(false);
    setFailedError(null);

    try {
      const { data, error } = await supabase.functions.invoke("transcribe-recording", {
        body: { recording_id: recording.id },
      });

      if (error) {
        const errMsg = typeof error === 'object' && error.message ? error.message : String(error);
        // Network timeout / "Failed to fetch" / non-2xx (server timeout) → try download+chunking
        const isTimeoutLike = errMsg.includes('Failed to fetch') || errMsg.includes('network') || errMsg.includes('timeout') || errMsg.includes('AbortError') || errMsg.includes('non-2xx');
        if (isTimeoutLike) {
          console.log('⏳ Direct transcription failed/timed out, attempting download+chunking...');
          try {
            await attemptDownloadAndChunk(recording.id);
            return;
          } catch (chunkErr: any) {
            // If chunking also fails, fall back to polling
            console.log('⏳ Chunking also failed, switching to polling mode...');
            setIsPolling(true);
            startPolling(recording.id);
            toast({ title: "התמלול רץ ברקע", description: "ניתן להמשיך לעבוד, התוצאה תופיע כשתהיה מוכנה" });
            return;
          }
        }
        throw new Error(errMsg);
      }

      if (data?.error === 'invalid_media') {
        toast({
          title: "תוכן לא תקין",
          description: data.message || "ייתכן שפג תוקף הקישור להקלטה. נסה למשוך הקלטות מחדש.",
          variant: "destructive",
        });
        setIsTranscribing(false);
        return;
      }

      if (data?.error && data.error !== 'file_too_large') {
        throw new Error(typeof data.message === 'string' ? data.message : data.error);
      }

      if (data?.text) {
        setTranscript(data.text);
        const fallbackNote = data.used_fallback
          ? ` (שימוש בהקלטת ${data.fallback_recording_type || 'audio'} חלופית)`
          : "";
        toast({ title: "התמלול הושלם בהצלחה!" + fallbackNote });
        setIsTranscribing(false);
        return;
      }

      if (data?.error === 'file_too_large' && data?.no_alternative) {
        toast({
          title: "הקובץ גדול מדי לתמלול אוטומטי",
          description: data.message || `${data.size_mb}MB — נא להדביק תמלול ידנית`,
          variant: "destructive",
        });
        setIsTranscribing(false);
        return;
      }

      if (data?.error === 'file_too_large' && !data?.no_alternative) {
        await attemptDownloadAndChunk(recording.id);
        return;
      }
    } catch (err: any) {
      // Final fallback — check if maybe it's a timeout
      const errMsg = err.message || '';
      if (errMsg.includes('Failed to fetch') || errMsg.includes('network') || errMsg.includes('timeout')) {
        setIsPolling(true);
        startPolling(recording.id);
        toast({ title: "התמלול רץ ברקע", description: "ניתן להמשיך לעבוד, התוצאה תופיע כשתהיה מוכנה" });
        return;
      }
      setFailedError(err.message || "שגיאה לא ידועה");
      toast({
        title: "שגיאה בתמלול",
        description: err.message || "נסה שוב או הדבק תמלול ידנית",
        variant: "destructive",
      });
      setIsTranscribing(false);
    } finally {
      setTranscribeProgress(null);
    }
  };

  const handleTranscribeFromStorage = async () => {
    if (!recording?.file_path) return handleTranscribe();

    setIsTranscribing(true);
    setTranscribeProgress(null);

    try {
      const { data: fileData, error: dlError } = await supabase.storage
        .from('recordings')
        .download(recording.file_path);

      if (dlError || !fileData) throw new Error('Failed to download: ' + (dlError?.message || 'unknown'));

      const fileSizeMB = fileData.size / (1024 * 1024);

      if (fileSizeMB <= 25) {
        return handleTranscribe();
      }

      toast({ title: "הקובץ גדול – מתחיל תמלול מחולק...", description: `${fileSizeMB.toFixed(0)}MB` });

      const fullText = await transcribeChunked(fileData, (current, total) => {
        setTranscribeProgress({ current, total });
      });

      setTranscript(fullText);
      toast({ title: "התמלול הושלם בהצלחה!" });
    } catch (err: any) {
      toast({
        title: "שגיאה בתמלול",
        description: err.message || "נסה שוב או הדבק תמלול ידנית",
        variant: "destructive",
      });
    } finally {
      setIsTranscribing(false);
      setTranscribeProgress(null);
    }
  };

  const onTranscribeClick = () => {
    if (recording?.file_path) {
      handleTranscribeFromStorage();
    } else {
      handleTranscribe();
    }
  };

  // ── Generate summary ──────────────────────────────────────

  const handleGenerate = async () => {
    if (!transcript.trim()) {
      toast({ title: "נא להזין תמלול או הערות מהפגישה", variant: "destructive" });
      return;
    }
    if (!targetId) {
      toast({ title: "נא לבחור לקוח או ליד", variant: "destructive" });
      return;
    }

    setIsGenerating(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke("summarize-recording", {
        body: {
          recording_id: recording?.id,
          transcript,
          focus_points: focusPoints,
          custom_focus: customFocus,
          target_type: targetType,
          target_id: targetId,
          tenant_id: currentTenantId,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setResult({
        summary: data.summary,
        file_url: data.file_url,
        file_name: data.file_name,
      });

      toast({ title: "הסיכום נוצר בהצלחה!", description: "הקובץ נשמר ושויך" });
    } catch (err: any) {
      toast({
        title: "שגיאה ביצירת סיכום",
        description: err.message || "נסה שוב",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleClose = () => {
    // If transcription is running in background, notify
    if (isPolling && isTranscribing) {
      toast({ title: "התמלול ממשיך ברקע", description: "כשתפתח שוב את הדיאלוג, התוצאה תיטען אוטומטית" });
    }
    
    // Stop polling when closing
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    
    onOpenChange(false);
    setTimeout(() => {
      setTranscript("");
      setCustomFocus("");
      setResult(null);
      setTranscribeProgress(null);
      setIsTranscribing(false);
      setIsPolling(false);
      setFailedError(null);
      setFocusPoints(["decisions", "action_items", "next_steps"]);
    }, 300);
  };

  const progressPct = transcribeProgress
    ? Math.round((transcribeProgress.current / transcribeProgress.total) * 100)
    : 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            סיכום פגישה עם AI
          </DialogTitle>
        </DialogHeader>

        {recording && (
          <div className="bg-muted/50 rounded-lg p-3 text-sm">
            <span className="font-medium">{recording.meeting_topic || "הקלטה"}</span>
            {recording.start_time && (
              <span className="text-muted-foreground mr-2">
                • {new Date(recording.start_time).toLocaleDateString("he-IL")}
              </span>
            )}
            {recording.duration && (
              <span className="text-muted-foreground mr-2">• {recording.duration} דק׳</span>
            )}
          </div>
        )}

        <div className="space-y-5">
          {/* Transcript Input */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-base font-medium">תמלול / הערות מהפגישה *</Label>
              {hasAudioSource && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onTranscribeClick}
                  disabled={isTranscribing}
                >
                  {isTranscribing ? (
                    <>
                      <Loader2 className="h-3 w-3 ml-1 animate-spin" />
                      {isPolling
                        ? "מתמלל ברקע..."
                        : transcribeProgress
                        ? `מתמלל חלק ${transcribeProgress.current}/${transcribeProgress.total}...`
                        : "מתמלל..."}
                    </>
                  ) : (
                    <>
                      <Mic className="h-3 w-3 ml-1" />
                      תמלל אוטומטית
                    </>
                  )}
                </Button>
              )}
            </div>

            {/* Progress bar for chunked transcription */}
            {isTranscribing && transcribeProgress && !isPolling && (
              <div className="space-y-1">
                <Progress value={progressPct} className="h-2" />
                <p className="text-xs text-muted-foreground text-center">
                  מתמלל חלק {transcribeProgress.current} מתוך {transcribeProgress.total} ({progressPct}%)
                </p>
              </div>
            )}

            {/* Background polling indicator */}
            {isPolling && (
              <div className="bg-primary/10 rounded-lg p-3 flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <p className="text-sm text-primary">
                  התמלול רץ ברקע... ניתן להמשיך לעבוד. התוצאה תופיע אוטומטית.
                </p>
              </div>
            )}

            {/* Failed with Retry button */}
            {failedError && !isTranscribing && (
              <div className="bg-destructive/10 rounded-lg p-3 space-y-2">
                <p className="text-sm text-destructive font-medium">התמלול נכשל: {failedError}</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleRetryTranscription(recording?.id)}
                  className="text-destructive border-destructive hover:bg-destructive/10"
                >
                  <RotateCcw className="h-3 w-3 ml-1" />
                  נסה שוב
                </Button>
              </div>
            )}

            <p className="text-sm text-muted-foreground">
              {hasAudioSource
                ? "לחץ על ״תמלל אוטומטית״ או הדבק תמלול ידנית. תומך בקבצים גדולים."
                : "הדבק את התמלול מ-Zoom, או כתוב הערות ונקודות מרכזיות מהפגישה"}
            </p>
            <Textarea
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder="הדבק כאן את התמלול או כתוב הערות מהפגישה..."
              className="min-h-[150px]"
              dir="rtl"
            />
          </div>

          {/* Focus Points */}
          <div className="space-y-3">
            <Label className="text-base font-medium">דגשים לסיכום</Label>
            <div className="grid grid-cols-2 gap-2">
              {FOCUS_OPTIONS.map((opt) => (
                <label
                  key={opt.key}
                  className="flex items-center gap-2 p-2 rounded-md border cursor-pointer hover:bg-muted/50 transition-colors"
                >
                  <Checkbox
                    checked={focusPoints.includes(opt.key)}
                    onCheckedChange={() => toggleFocus(opt.key)}
                  />
                  <span className="text-sm">{opt.label}</span>
                </label>
              ))}
            </div>
            <Textarea
              value={customFocus}
              onChange={(e) => setCustomFocus(e.target.value)}
              placeholder="דגשים נוספים (אופציונלי)..."
              className="min-h-[60px]"
              dir="rtl"
            />
          </div>

          {/* Target Assignment */}
          <div className="space-y-3">
            <Label className="text-base font-medium">שיוך הסיכום</Label>
            <div className="flex gap-3">
              <Select value={targetType} onValueChange={(val: "client" | "lead") => { setTargetType(val); setTargetId(""); }}>
                <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="client">לקוח</SelectItem>
                  <SelectItem value="lead">ליד</SelectItem>
                </SelectContent>
              </Select>
              <Select value={targetId || "none"} onValueChange={(val) => setTargetId(val === "none" ? "" : val)}>
                <SelectTrigger className="flex-1"><SelectValue placeholder="בחר..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">בחר...</SelectItem>
                  {targetType === "client"
                    ? clients.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)
                    : leads.map((l: any) => <SelectItem key={l.id} value={l.id}>{l.company_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Generate Button */}
          <Button onClick={handleGenerate} disabled={isGenerating || !transcript.trim()} className="w-full" size="lg">
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                יוצר סיכום...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 ml-2" />
                צור סיכום עם AI
              </>
            )}
          </Button>

          {/* Result */}
          {result && (
            <div className="space-y-3 border-t pt-4">
              <h3 className="font-medium flex items-center gap-2">
                <FileText className="h-4 w-4" />
                סיכום הפגישה
              </h3>
              <div
                className="bg-muted/50 rounded-lg p-4 text-sm leading-relaxed max-h-[300px] overflow-y-auto"
                dir="rtl"
                dangerouslySetInnerHTML={{ __html: result.summary }}
              />
              {result.file_url && (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <a href={result.file_url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-3 w-3 ml-1" />
                      פתח קובץ
                    </a>
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <a href={result.file_url} download={result.file_name}>
                      <Download className="h-3 w-3 ml-1" />
                      הורד
                    </a>
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
