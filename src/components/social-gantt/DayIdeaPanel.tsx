/**
 * DayIdeaPanel
 * Slide-in right panel that opens when the user clicks an empty day in the Gantt.
 *
 * Features:
 * - Shows the selected date prominently
 * - "Generate Ideas" button calls the AI edge function with generate_day_ideas action
 * - Displays 3-5 AI-generated post ideas based on current events / actuality
 * - Clicking an idea pre-fills the topic field
 * - Platform selector + quick "Create Post" button
 */

import { useState } from "react";
import { format } from "date-fns";
import { he } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Sparkles, X, Loader2, CalendarDays, Lightbulb, Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { SocialPost } from "@/pages/SocialDashboard";

// ─── Types ─────────────────────────────────────────────────────────────────
interface DayIdeaPanelProps {
  date: Date | null;
  tenantId: string | null;
  onCreatePost: (post: Omit<SocialPost, "id" | "created_at" | "updated_at">) => void;
  isCreating: boolean;
  onClose: () => void;
}

interface IdeaSuggestion {
  topic: string;
  rationale: string;
  platform: SocialPost["platform"];
  hook: string;
}

const PLATFORMS: { value: SocialPost["platform"]; label: string }[] = [
  { value: "instagram", label: "Instagram" },
  { value: "facebook", label: "Facebook" },
  { value: "tiktok", label: "TikTok" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "twitter", label: "X (Twitter)" },
];

// ─── Component ─────────────────────────────────────────────────────────────
export function DayIdeaPanel({
  date,
  tenantId,
  onCreatePost,
  isCreating,
  onClose,
}: DayIdeaPanelProps) {
  const [topic, setTopic] = useState("");
  const [platform, setPlatform] = useState<SocialPost["platform"]>("instagram");
  const [ideas, setIdeas] = useState<IdeaSuggestion[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedIdeaIdx, setSelectedIdeaIdx] = useState<number | null>(null);

  if (!date) return null;

  const dateLabel = format(date, "EEEE, d בMMMM yyyy", { locale: he });
  const dateKey = format(date, "yyyy-MM-dd");

  // ── Generate ideas via edge function ──
  const handleGenerateIdeas = async () => {
    setIsGenerating(true);
    setIdeas([]);
    setSelectedIdeaIdx(null);
    try {
      const { data, error } = await (supabase as any).functions.invoke(
        "social-gantt-generate",
        {
          body: {
            action: "generate_day_ideas",
            date: dateKey,
            tenant_id: tenantId,
          },
        }
      );
      if (error) throw error;
      const parsed: IdeaSuggestion[] = data?.ideas || [];
      setIdeas(parsed);
      if (parsed.length === 0) toast.info("לא הוחזרו רעיונות, נסה שוב");
    } catch (err: any) {
      toast.error("שגיאה בייצור רעיונות: " + (err?.message || ""));
    } finally {
      setIsGenerating(false);
    }
  };

  // ── Select an idea → fill form ──
  const handleSelectIdea = (idea: IdeaSuggestion, idx: number) => {
    setSelectedIdeaIdx(idx);
    setTopic(idea.topic);
    setPlatform(idea.platform);
  };

  // ── Create post ──
  const handleCreate = () => {
    if (!topic.trim() || !tenantId) return;
    const selectedIdea = selectedIdeaIdx !== null ? ideas[selectedIdeaIdx] : null;
    onCreatePost({
      tenant_id: tenantId,
      topic: topic.trim(),
      platform,
      scheduled_date: dateKey,
      status: "draft",
      copy_text: selectedIdea?.hook || null,
      creative_url: null,
      creative_prompt: null,
      copy_prompt: null,
      notes: null,
    });
  };

  return (
    <div className="w-[340px] shrink-0 border-s flex flex-col bg-background" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/20 shrink-0">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-primary" />
          <div>
            <p className="text-sm font-semibold">{dateLabel}</p>
            <p className="text-xs text-muted-foreground">הוסף פוסט חדש</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-5">
          {/* AI Ideas section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Lightbulb className="h-4 w-4 text-amber-500" />
                <span className="text-sm font-medium">רעיונות לפי אקטואליה</span>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1"
                onClick={handleGenerateIdeas}
                disabled={isGenerating}
              >
                {isGenerating ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Sparkles className="h-3 w-3" />
                )}
                {isGenerating ? "מייצר..." : "ייצר רעיונות"}
              </Button>
            </div>

            {ideas.length > 0 && (
              <div className="space-y-2">
                {ideas.map((idea, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSelectIdea(idea, idx)}
                    className={cn(
                      "w-full text-right rounded-lg border p-3 transition-all text-sm",
                      selectedIdeaIdx === idx
                        ? "border-primary bg-primary/5 shadow-sm"
                        : "border-border hover:border-primary/40 hover:bg-muted/30"
                    )}
                  >
                    <p className="font-medium line-clamp-1">{idea.topic}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{idea.rationale}</p>
                    {idea.hook && (
                      <p className="text-xs text-primary/70 mt-1 line-clamp-1 italic">"{idea.hook}"</p>
                    )}
                    <div className="mt-1.5 flex items-center gap-1">
                      <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded-full text-muted-foreground">
                        {idea.platform}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {!isGenerating && ideas.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-3 border border-dashed rounded-lg">
                לחץ "ייצר רעיונות" לקבלת הצעות AI<br />
                מבוססות אקטואליה ומגמות עדכניות
              </p>
            )}
          </div>

          <Separator />

          {/* Manual form */}
          <div className="space-y-3">
            <p className="text-sm font-medium">פרטי הפוסט</p>

            <div className="space-y-1.5">
              <Label className="text-xs">נושא</Label>
              <Input
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="מה נושא הפוסט?"
                dir="rtl"
                className="text-right h-9"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">פלטפורמה</Label>
              <Select value={platform} onValueChange={(v) => setPlatform(v as SocialPost["platform"])}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PLATFORMS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="p-4 border-t shrink-0 space-y-2">
        <Button
          className="w-full gap-2"
          onClick={handleCreate}
          disabled={!topic.trim() || isCreating}
        >
          {isCreating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          {isCreating ? "יוצר פוסט..." : "צור פוסט"}
        </Button>
        <Button variant="ghost" className="w-full text-muted-foreground" onClick={onClose}>
          ביטול
        </Button>
      </div>
    </div>
  );
}
