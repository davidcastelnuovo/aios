import { useState } from "react";
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
import { Loader2, FileText, Sparkles, Download, ExternalLink, Mic } from "lucide-react";
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
  view.setUint16(22, 1, true); // mono
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
  const CHUNK_DURATION_SEC = 8 * 60; // 8 minutes per chunk → ~15MB WAV each

  const arrayBuffer = await audioBlob.arrayBuffer();
  const audioCtx = new AudioContext({ sampleRate: SAMPLE_RATE });
  const decoded = await audioCtx.decodeAudioData(arrayBuffer);
  await audioCtx.close();

  // Mix down to mono
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
  const [transcribeProgress, setTranscribeProgress] = useState<{ current: number; total: number } | null>(null);
  const [result, setResult] = useState<{ summary: string; file_url: string; file_name: string } | null>(null);

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

  // ── Transcribe handler (supports large files) ─────────────

  const handleTranscribe = async () => {
    if (!recording?.id) return;
    setIsTranscribing(true);
    setTranscribeProgress(null);

    try {
      // Step 1 – Try direct transcription via edge function
      const { data, error } = await supabase.functions.invoke("transcribe-recording", {
        body: { recording_id: recording.id },
      });

      if (error) {
        const detailedMsg = typeof error === 'object' && error.message ? error.message : String(error);
        throw new Error(detailedMsg);
      }

      // Handle invalid media content (HTML instead of audio)
      if (data?.error === 'invalid_media') {
        toast({
          title: "תוכן לא תקין",
          description: data.message || "ייתכן שפג תוקף הקישור להקלטה. נסה למשוך הקלטות מחדש.",
          variant: "destructive",
        });
        return;
      }

      // If the edge function returned an error in data (non-throw)
      if (data?.error && data.error !== 'file_too_large') {
        throw new Error(typeof data.message === 'string' ? data.message : data.error);
      }

      // Small file transcribed successfully (possibly via audio-only fallback)
      if (data?.text) {
        setTranscript(data.text);
        const fallbackNote = data.used_fallback
          ? ` (שימוש בהקלטת ${data.fallback_recording_type || 'audio'} חלופית)`
          : "";
        toast({ title: "התמלול הושלם בהצלחה!" + fallbackNote });
        return;
      }

      // Large file with no alternative — tell user to paste manually
      if (data?.error === 'file_too_large' && data?.no_alternative) {
        toast({
          title: "הקובץ גדול מדי לתמלול אוטומטי",
          description: data.message || `${data.size_mb}MB — נא להדביק תמלול ידנית`,
          variant: "destructive",
        });
        return;
      }

      // Large file but has potential for client-side chunking (storage files only, not Zoom)
      if (data?.error === 'file_too_large' && !data?.no_alternative) {
        toast({ title: "הקובץ גדול – מתחיל תמלול מחולק...", description: `${data.size_mb?.toFixed?.(0) || data.size_mb}MB` });

        const { data: dlData, error: dlError } = await supabase.functions.invoke("transcribe-recording", {
          body: { recording_id: recording.id, mode: 'download' },
        });

        if (dlError) throw dlError;
        if (dlData?.error === 'file_too_large' && dlData?.no_alternative) {
          // Download mode also failed — file is truly too large
          toast({
            title: "הקובץ גדול מדי",
            description: dlData.message || "נא להדביק תמלול ידנית",
            variant: "destructive",
          });
          return;
        }
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
        return;
      }
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

  // ── Storage-only shortcut: if file is in storage, download directly ──

  const handleTranscribeFromStorage = async () => {
    if (!recording?.file_path) return handleTranscribe();

    setIsTranscribing(true);
    setTranscribeProgress(null);

    try {
      // Download directly from storage (faster, no edge function needed for download)
      const { data: fileData, error: dlError } = await supabase.storage
        .from('recordings')
        .download(recording.file_path);

      if (dlError || !fileData) throw new Error('Failed to download: ' + (dlError?.message || 'unknown'));

      const fileSizeMB = fileData.size / (1024 * 1024);

      if (fileSizeMB <= 25) {
        // Small file – send directly to transcribe-recording
        return handleTranscribe();
      }

      // Large file – chunk on client
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
    onOpenChange(false);
    setTimeout(() => {
      setTranscript("");
      setCustomFocus("");
      setResult(null);
      setTranscribeProgress(null);
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
                      {transcribeProgress
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
            {isTranscribing && transcribeProgress && (
              <div className="space-y-1">
                <Progress value={progressPct} className="h-2" />
                <p className="text-xs text-muted-foreground text-center">
                  מתמלל חלק {transcribeProgress.current} מתוך {transcribeProgress.total} ({progressPct}%)
                </p>
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
          </div>

          {/* Custom Focus */}
          <div className="space-y-2">
            <Label>דגשים נוספים (אופציונלי)</Label>
            <Textarea
              value={customFocus}
              onChange={(e) => setCustomFocus(e.target.value)}
              placeholder="דגשים מיוחדים שחשוב לך שיופיעו בסיכום..."
              className="min-h-[60px]"
              dir="rtl"
            />
          </div>

          {/* Target Selection */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>שייך ל</Label>
              <Select value={targetType} onValueChange={(val: "client" | "lead") => {
                setTargetType(val);
                setTargetId("");
              }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="client">לקוח</SelectItem>
                  <SelectItem value="lead">ליד</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{targetType === "client" ? "בחר לקוח" : "בחר ליד"} *</Label>
              <Select value={targetId || "none"} onValueChange={(val) => setTargetId(val === "none" ? "" : val)}>
                <SelectTrigger>
                  <SelectValue placeholder="בחר..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">בחר...</SelectItem>
                  {targetType === "client"
                    ? clients.map((c: any) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))
                    : leads.map((l: any) => (
                        <SelectItem key={l.id} value={l.id}>{l.company_name}</SelectItem>
                      ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Generate Button */}
          <Button
            onClick={handleGenerate}
            disabled={isGenerating || !transcript.trim() || !targetId}
            className="w-full"
            size="lg"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                מייצר סיכום...
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
              <div className="flex items-center justify-between">
                <h3 className="font-medium flex items-center gap-2">
                  <FileText className="h-4 w-4 text-green-500" />
                  הסיכום נוצר בהצלחה!
                </h3>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <a href={result.file_url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-3 w-3 ml-1" />
                      פתח
                    </a>
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <a href={result.file_url} download={result.file_name}>
                      <Download className="h-3 w-3 ml-1" />
                      הורד
                    </a>
                  </Button>
                </div>
              </div>
              <div className="bg-muted/50 rounded-lg p-4 max-h-[300px] overflow-y-auto text-sm whitespace-pre-wrap">
                {result.summary}
              </div>
              <p className="text-xs text-muted-foreground">
                הקובץ נשמר בקבצים של ה{targetType === "client" ? "לקוח" : "ליד"} הנבחר
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
