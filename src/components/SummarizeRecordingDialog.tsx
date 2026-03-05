import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

  const handleTranscribe = async () => {
    if (!recording?.id) return;
    setIsTranscribing(true);
    try {
      const { data, error } = await supabase.functions.invoke("transcribe-recording", {
        body: { recording_id: recording.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data?.text) {
        setTranscript(data.text);
        toast({ title: "התמלול הושלם בהצלחה!" });
      }
    } catch (err: any) {
      toast({
        title: "שגיאה בתמלול",
        description: err.message || "נסה שוב או הדבק תמלול ידנית",
        variant: "destructive",
      });
    } finally {
      setIsTranscribing(false);
    }
  };

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
    // Reset after animation
    setTimeout(() => {
      setTranscript("");
      setCustomFocus("");
      setResult(null);
      setFocusPoints(["decisions", "action_items", "next_steps"]);
    }, 300);
  };

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
                  onClick={handleTranscribe}
                  disabled={isTranscribing}
                >
                  {isTranscribing ? (
                    <>
                      <Loader2 className="h-3 w-3 ml-1 animate-spin" />
                      מתמלל...
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
            <p className="text-sm text-muted-foreground">
              {hasAudioSource
                ? "לחץ על ״תמלל אוטומטית״ או הדבק תמלול ידנית"
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
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))
                    : leads.map((l: any) => (
                        <SelectItem key={l.id} value={l.id}>
                          {l.company_name}
                        </SelectItem>
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
