import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles,
  ArrowRight,
  Loader2,
  Check,
  X,
  RefreshCw,
  Image,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";
import type { SocialPost } from "@/pages/SocialGantt";

interface CreativeAgentProps {
  post: SocialPost;
  onUpdatePost: (updates: Partial<SocialPost> & { id: string }) => void;
  onBack: () => void;
  tenantId: string | null;
}

interface GeneratedCreative {
  url: string;
  prompt: string;
}

export function CreativeAgent({ post, onUpdatePost, onBack, tenantId }: CreativeAgentProps) {
  const [prompt, setPrompt] = useState(post.creative_prompt || "");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedOptions, setGeneratedOptions] = useState<GeneratedCreative[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [style, setStyle] = useState("modern");
  const [additionalNotes, setAdditionalNotes] = useState("");

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error("נא להזין תיאור לקריאייטיב");
      return;
    }

    setIsGenerating(true);
    setGeneratedOptions([]);
    setSelectedIndex(null);

    try {
      // Simulate AI creative generation - in production this would call an AI image generation API
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Generate placeholder options for demo
      const options: GeneratedCreative[] = [
        {
          url: `https://placehold.co/1080x1080/6366f1/white?text=${encodeURIComponent(post.topic)}&font=heebo`,
          prompt: `${prompt} - Style: ${style} - Option A`,
        },
        {
          url: `https://placehold.co/1080x1080/ec4899/white?text=${encodeURIComponent(post.topic)}&font=heebo`,
          prompt: `${prompt} - Style: ${style} - Option B`,
        },
        {
          url: `https://placehold.co/1080x1080/f59e0b/white?text=${encodeURIComponent(post.topic)}&font=heebo`,
          prompt: `${prompt} - Style: ${style} - Option C`,
        },
      ];

      setGeneratedOptions(options);
      toast.success("3 אפשרויות קריאייטיב נוצרו!");
    } catch {
      toast.error("שגיאה ביצירת הקריאייטיב");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleApprove = () => {
    if (selectedIndex === null) {
      toast.error("נא לבחור קריאייטיב");
      return;
    }

    const selected = generatedOptions[selectedIndex];
    onUpdatePost({
      id: post.id,
      creative_url: selected.url,
      creative_prompt: selected.prompt,
    });
    toast.success("הקריאייטיב אושר ונשמר!");
    onBack();
  };

  const handleReject = () => {
    setGeneratedOptions([]);
    setSelectedIndex(null);
    toast.info("הקריאייטיב נדחה. אפשר לנסח מחדש ולייצר שוב");
  };

  const suggestedPrompt = `צור קריאייטיב ל-${post.platform} בנושא "${post.topic}"`;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowRight className="h-4 w-4 ml-1" />
          חזרה לתצוגה
        </Button>
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">סוכן קריאייטיב AI</h3>
        </div>
      </div>

      {/* Prompt Input */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">תיאור הקריאייטיב</CardTitle>
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
            <Label>מה תרצה שהקריאייטיב יציג?</Label>
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="תאר את הקריאייטיב שאתה רוצה... למשל: תמונה מודרנית עם רקע סגול, טקסט גדול באמצע..."
              rows={4}
              dir="rtl"
              className="text-right"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>הערות נוספות</Label>
              <Input
                value={additionalNotes}
                onChange={(e) => setAdditionalNotes(e.target.value)}
                placeholder="צבעים, סגנון, מותג..."
                dir="rtl"
                className="text-right"
              />
            </div>
            <div className="space-y-2">
              <Label>סגנון</Label>
              <select
                value={style}
                onChange={(e) => setStyle(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="modern">מודרני</option>
                <option value="minimal">מינימליסטי</option>
                <option value="bold">בולט</option>
                <option value="elegant">אלגנטי</option>
                <option value="playful">שובב</option>
                <option value="corporate">עסקי</option>
              </select>
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
                מייצר קריאייטיב...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 ml-2" />
                צור קריאייטיב
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
          <CardContent>
            <div className="grid grid-cols-3 gap-3">
              {generatedOptions.map((option, index) => (
                <button
                  key={index}
                  onClick={() => setSelectedIndex(index)}
                  className={`relative rounded-lg overflow-hidden border-2 transition-all ${
                    selectedIndex === index
                      ? "border-primary ring-2 ring-primary/20"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <img
                    src={option.url}
                    alt={`Option ${index + 1}`}
                    className="w-full aspect-square object-cover"
                  />
                  {selectedIndex === index && (
                    <div className="absolute top-2 left-2 bg-primary text-primary-foreground rounded-full p-1">
                      <Check className="h-3 w-3" />
                    </div>
                  )}
                  <Badge
                    variant="secondary"
                    className="absolute bottom-2 right-2 text-[10px]"
                  >
                    אפשרות {String.fromCharCode(65 + index)}
                  </Badge>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
