import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  PenLine,
  ArrowRight,
  Loader2,
  Check,
  X,
  RefreshCw,
  Sparkles,
  Wand2,
  Copy,
} from "lucide-react";
import { toast } from "sonner";
import type { SocialPost } from "@/pages/SocialGantt";

interface CopyAgentProps {
  post: SocialPost;
  onUpdatePost: (updates: Partial<SocialPost> & { id: string }) => void;
  onBack: () => void;
  tenantId: string | null;
}

interface GeneratedCopy {
  text: string;
  tone: string;
}

export function CopyAgent({ post, onUpdatePost, onBack, tenantId }: CopyAgentProps) {
  const [prompt, setPrompt] = useState(post.copy_prompt || "");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedOptions, setGeneratedOptions] = useState<GeneratedCopy[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [tone, setTone] = useState("professional");
  const [targetAudience, setTargetAudience] = useState("");
  const [callToAction, setCallToAction] = useState("");

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error("נא להזין תיאור לקופי");
      return;
    }

    setIsGenerating(true);
    setGeneratedOptions([]);
    setSelectedIndex(null);

    try {
      // Simulate AI copy generation - in production this calls an LLM
      await new Promise((resolve) => setTimeout(resolve, 1500));

      const toneLabels: Record<string, string> = {
        professional: "מקצועי",
        casual: "קז׳ואל",
        bold: "נועז",
        emotional: "רגשי",
        humorous: "הומוריסטי",
      };

      const ctaText = callToAction ? `\n\n${callToAction}` : "";
      const audienceNote = targetAudience ? ` (קהל יעד: ${targetAudience})` : "";

      const options: GeneratedCopy[] = [
        {
          text: `🔥 ${post.topic}\n\nזה הזמן לדבר על מה שחשוב באמת. אנחנו כאן כדי להביא לכם את הערך הכי גבוה בתחום.${audienceNote}\n\nמה אתם חושבים? ספרו לנו בתגובות 👇${ctaText}\n\n#${post.topic.replace(/\s+/g, "")} #socialmedia #content`,
          tone: toneLabels[tone] || tone,
        },
        {
          text: `✨ ${post.topic}\n\nהגיע הזמן לשינוי. כל יום הוא הזדמנות חדשה ליצור משהו מדהים.\n\nאנחנו מאמינים שכל אחד יכול להגיע לשם - וזה מתחיל עכשיו.${ctaText}\n\n#${post.topic.replace(/\s+/g, "")} #inspiration #growth`,
          tone: toneLabels[tone] || tone,
        },
        {
          text: `💡 ${post.topic}\n\nידעתם ש-80% מהעסקים שמשקיעים בתוכן סושיאל רואים עלייה במכירות?\n\nאנחנו לא מפתיעים. תוכן טוב = תוצאות טובות. נקודה.${ctaText}\n\n#${post.topic.replace(/\s+/g, "")} #marketing #results`,
          tone: toneLabels[tone] || tone,
        },
      ];

      setGeneratedOptions(options);
      toast.success("3 אפשרויות קופי נוצרו!");
    } catch {
      toast.error("שגיאה ביצירת הקופי");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleApprove = () => {
    if (selectedIndex === null) {
      toast.error("נא לבחור קופי");
      return;
    }

    const selected = generatedOptions[selectedIndex];
    onUpdatePost({
      id: post.id,
      copy_text: selected.text,
      copy_prompt: prompt,
    });
    toast.success("הקופי אושר ונשמר!");
    onBack();
  };

  const handleReject = () => {
    setGeneratedOptions([]);
    setSelectedIndex(null);
    toast.info("הקופי נדחה. אפשר לנסח מחדש ולייצר שוב");
  };

  const handleCopyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("הקופי הועתק!");
  };

  const suggestedPrompt = `כתוב קופי ל-${post.platform} בנושא "${post.topic}"`;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowRight className="h-4 w-4 ml-1" />
          חזרה לתצוגה
        </Button>
        <div className="flex items-center gap-2">
          <PenLine className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">סוכן קופי AI</h3>
        </div>
      </div>

      {/* Prompt Input */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">תיאור הקופי</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!prompt && (
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start text-muted-foreground"
              onClick={() => setPrompt(suggestedPrompt)}
            >
              <Wand2 className="h-3.5 w-3.5 ml-2" />
              הצעה: {suggestedPrompt}
            </Button>
          )}

          <div className="space-y-2">
            <Label>על מה הקופי?</Label>
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="תאר את המסר שאתה רוצה להעביר... למשל: פוסט שמדבר על יתרונות המוצר שלנו..."
              rows={3}
              dir="rtl"
              className="text-right"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>טון</Label>
              <select
                value={tone}
                onChange={(e) => setTone(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="professional">מקצועי</option>
                <option value="casual">קז׳ואל</option>
                <option value="bold">נועז</option>
                <option value="emotional">רגשי</option>
                <option value="humorous">הומוריסטי</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>קהל יעד</Label>
              <Input
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value)}
                placeholder="למשל: בעלי עסקים"
                dir="rtl"
                className="text-right"
              />
            </div>
            <div className="space-y-2">
              <Label>קריאה לפעולה</Label>
              <Input
                value={callToAction}
                onChange={(e) => setCallToAction(e.target.value)}
                placeholder="למשל: לפרטים בלינק 🔗"
                dir="rtl"
                className="text-right"
              />
            </div>
          </div>

          <Button
            onClick={handleGenerate}
            disabled={isGenerating || !prompt.trim()}
            className="w-full"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                מייצר קופי...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 ml-2" />
                צור קופי
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Generated Options */}
      {generatedOptions.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleApprove}
                  disabled={selectedIndex === null}
                >
                  <Check className="h-3.5 w-3.5 ml-1" />
                  אשר בחירה
                </Button>
                <Button variant="destructive" size="sm" onClick={handleReject}>
                  <X className="h-3.5 w-3.5 ml-1" />
                  דחה הכל
                </Button>
                <Button variant="outline" size="sm" onClick={handleGenerate}>
                  <RefreshCw className="h-3.5 w-3.5 ml-1" />
                  ייצר מחדש
                </Button>
              </div>
              <CardTitle className="text-base">
                תוצאות ({generatedOptions.length} אפשרויות)
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {generatedOptions.map((option, index) => (
              <button
                key={index}
                onClick={() => setSelectedIndex(index)}
                className={`w-full text-right rounded-lg border-2 p-4 transition-all ${
                  selectedIndex === index
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCopyToClipboard(option.text);
                      }}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                    {selectedIndex === index && (
                      <div className="bg-primary text-primary-foreground rounded-full p-1">
                        <Check className="h-3 w-3" />
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-[10px]">
                      אפשרות {String.fromCharCode(65 + index)}
                    </Badge>
                    <Badge variant="outline" className="text-[10px]">
                      {option.tone}
                    </Badge>
                  </div>
                </div>
                <div className="whitespace-pre-wrap text-sm leading-relaxed" dir="rtl">
                  {option.text}
                </div>
              </button>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
