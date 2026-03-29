import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { he } from "date-fns/locale";
import { cn } from "@/lib/utils";
import type { SocialPost } from "@/pages/SocialGantt";

interface NewPostDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreatePost: (post: Omit<SocialPost, "id" | "created_at" | "updated_at">) => void;
  tenantId: string;
  isCreating: boolean;
}

export function NewPostDialog({ open, onOpenChange, onCreatePost, tenantId, isCreating }: NewPostDialogProps) {
  const [topic, setTopic] = useState("");
  const [platform, setPlatform] = useState<SocialPost["platform"]>("instagram");
  const [date, setDate] = useState<Date | undefined>(new Date());

  const handleCreate = () => {
    if (!topic.trim() || !date) return;

    onCreatePost({
      tenant_id: tenantId,
      topic: topic.trim(),
      platform,
      scheduled_date: format(date, "yyyy-MM-dd"),
      status: "draft",
      copy_text: null,
      creative_url: null,
      creative_prompt: null,
      copy_prompt: null,
      notes: null,
    });

    // Reset form
    setTopic("");
    setPlatform("instagram");
    setDate(new Date());
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right">פוסט חדש</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>נושא</Label>
            <Input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="מה נושא הפוסט?"
              dir="rtl"
              className="text-right"
            />
          </div>

          <div className="space-y-2">
            <Label>פלטפורמה</Label>
            <Select value={platform} onValueChange={(v) => setPlatform(v as SocialPost["platform"])}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="instagram">Instagram</SelectItem>
                <SelectItem value="facebook">Facebook</SelectItem>
                <SelectItem value="tiktok">TikTok</SelectItem>
                <SelectItem value="linkedin">LinkedIn</SelectItem>
                <SelectItem value="twitter">X (Twitter)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>תאריך פרסום</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-right",
                    !date && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="ml-2 h-4 w-4" />
                  {date ? format(date, "PPP", { locale: he }) : "בחר תאריך"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={setDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            ביטול
          </Button>
          <Button onClick={handleCreate} disabled={!topic.trim() || !date || isCreating}>
            {isCreating ? (
              <>
                <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                יוצר...
              </>
            ) : (
              "צור פוסט"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
