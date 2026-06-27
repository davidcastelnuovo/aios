import { useState, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  isToday,
  addMonths,
  subMonths,
  parseISO,
} from "date-fns";
import { he } from "date-fns/locale";
import {
  ChevronRight,
  ChevronLeft,
  Plus,
  Instagram,
  Facebook,
  Twitter,
  Globe,
  ImageIcon,
  Sparkles,
  Clock,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Loader2,
  Calendar,
  LayoutGrid,
  List,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  GripVertical,
  Send,
  Pencil,
  Square,
  CheckSquare,
  Linkedin,
  Music2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

// ─── Types ────────────────────────────────────────────────────────────────────

type ViewMode = "month" | "week" | "list";

interface WorkItem {
  id: string;
  title: string;
  status: string;
  scheduled_date: string | null;
  payload: Record<string, any>;
  current_stage_id: string | null;
  target_channel?: string | null;
  marketing_pipeline_stages?: { name: string; stage_type: string } | null;
}

// ─── Platform best practices ─────────────────────────────────────────────────

const PLATFORM_TIPS: Record<string, { tip: string; bestTime: string; format: string; emoji: string; peakDays: number[] }> = {
  instagram: {
    emoji: "📸",
    tip: "תוכן ויזואלי גבוה ← Reels מקבלים 3× יותר reach",
    bestTime: "ימים א׳-ג׳ | 18:00-21:00",
    format: "Reel 9:16 → Story → פוסט 1:1",
    peakDays: [0, 1, 2], // Sun, Mon, Tue
  },
  facebook: {
    emoji: "👥",
    tip: "פוסטים עם שאלה מקבלים 2× יותר תגובות",
    bestTime: "ימים ג׳-ה׳ | 13:00-15:00",
    format: "וידאו קצר → לינק → תמונה",
    peakDays: [2, 3, 4], // Tue, Wed, Thu
  },
  linkedin: {
    emoji: "💼",
    tip: "תוכן מקצועי עם insight אישי מקבל הכי הרבה engagement",
    bestTime: "ימים ב׳-ד׳ | 08:00-10:00",
    format: "טקסט ארוך → PDF carousel → תמונה",
    peakDays: [1, 2, 3], // Mon, Tue, Wed
  },
  tiktok: {
    emoji: "🎵",
    tip: "Hook ב-3 שניות הראשונות קובע הכל",
    bestTime: "ימים ו׳-ש׳ | 19:00-23:00",
    format: "וידאו 15-60 שניות בלבד",
    peakDays: [5, 6], // Fri, Sat
  },
  twitter: {
    emoji: "𝕏",
    tip: "Threads מקבלים 5× יותר impressions מטוויט בודד",
    bestTime: "ימים ב׳-ה׳ | 09:00-11:00",
    format: "Thread → Single tweet → Quote RT",
    peakDays: [1, 2, 3, 4], // Mon–Thu
  },
};

// ─── Status config ────────────────────────────────────────────────────────────

const statusConfig: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode; dot: string }> = {
  draft: {
    label: "טיוטה",
    color: "text-gray-600",
    bg: "bg-gray-100 border-gray-200",
    icon: <Clock className="h-3 w-3" />,
    dot: "bg-gray-400",
  },
  in_progress: {
    label: "בעבודה",
    color: "text-blue-700",
    bg: "bg-blue-50 border-blue-200",
    icon: <Loader2 className="h-3 w-3 animate-spin" />,
    dot: "bg-blue-500",
  },
  review: {
    label: "לאישור",
    color: "text-amber-700",
    bg: "bg-amber-50 border-amber-200",
    icon: <AlertCircle className="h-3 w-3" />,
    dot: "bg-amber-500",
  },
  approved: {
    label: "מאושר",
    color: "text-emerald-700",
    bg: "bg-emerald-50 border-emerald-200",
    icon: <CheckCircle2 className="h-3 w-3" />,
    dot: "bg-emerald-500",
  },
  published: {
    label: "פורסם",
    color: "text-green-700",
    bg: "bg-green-50 border-green-200",
    icon: <CheckCircle2 className="h-3 w-3" />,
    dot: "bg-green-600",
  },
  failed: {
    label: "נכשל",
    color: "text-red-700",
    bg: "bg-red-50 border-red-200",
    icon: <XCircle className="h-3 w-3" />,
    dot: "bg-red-500",
  },
};

// ─── Channel config ───────────────────────────────────────────────────────────

const channelConfig: Record<string, { label: string; icon: React.ReactNode; color: string; bg: string }> = {
  instagram: {
    label: "Instagram",
    icon: <Instagram className="h-3 w-3" />,
    color: "text-pink-600",
    bg: "bg-pink-50",
  },
  facebook: {
    label: "Facebook",
    icon: <Facebook className="h-3 w-3" />,
    color: "text-blue-600",
    bg: "bg-blue-50",
  },
  twitter: {
    label: "Twitter/X",
    icon: <Twitter className="h-3 w-3" />,
    color: "text-sky-500",
    bg: "bg-sky-50",
  },
  linkedin: {
    label: "LinkedIn",
    icon: <Linkedin className="h-3 w-3" />,
    color: "text-blue-700",
    bg: "bg-blue-50",
  },
  tiktok: {
    label: "TikTok",
    icon: <Music2 className="h-3 w-3" />,
    color: "text-gray-800",
    bg: "bg-gray-100",
  },
  general: {
    label: "כללי",
    icon: <Globe className="h-3 w-3" />,
    color: "text-gray-500",
    bg: "bg-gray-50",
  },
};

// ─── Peak hours by channel (Israel timezone, best practices) ────────────────

const PEAK_HOURS: Record<string, number[]> = {
  instagram: [8, 12, 17, 20],
  facebook:  [9, 13, 19],
  twitter:   [8, 12, 17],
  linkedin:  [8, 12, 17],
  tiktok:    [7, 12, 19, 21],
  general:   [9, 12, 18],
};

function getSmartScheduleDate(channel: string): string {
  const now = new Date();
  const hours = PEAK_HOURS[channel] ?? PEAK_HOURS.general;
  for (let dayOffset = 0; dayOffset <= 7; dayOffset++) {
    const candidate = new Date(now);
    candidate.setDate(now.getDate() + dayOffset);
    for (const h of hours) {
      candidate.setHours(h, 0, 0, 0);
      if (candidate > now) {
        const dow = candidate.getDay();
        if (dayOffset === 0 || [0, 1, 2, 3, 4].includes(dow)) {
          return candidate.toISOString().slice(0, 10);
        }
      }
    }
  }
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  tomorrow.setHours(hours[0], 0, 0, 0);
  return tomorrow.toISOString().slice(0, 10);
}

// ─── Platform tips banner ─────────────────────────────────────────────────────

function PlatformTipsBanner({ platformFilter }: { platformFilter: string }) {
  const [open, setOpen] = useState(true);
  const tip = PLATFORM_TIPS[platformFilter];
  if (!tip) return null;

  return (
    <div className="mx-4 mt-3">
      <div
        className={cn(
          "rounded-2xl border bg-card/60 shadow backdrop-blur-sm overflow-hidden transition-all duration-300",
          "border-primary/10"
        )}
      >
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center gap-3 px-4 py-2.5 text-right hover:bg-muted/30 transition-colors"
        >
          <span className="text-xl">{tip.emoji}</span>
          <span className="flex-1 text-sm font-semibold text-foreground">{tip.tip}</span>
          <span className="text-xs text-muted-foreground ml-2">{channelConfig[platformFilter]?.label}</span>
          {open ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
          )}
        </button>
        {open && (
          <div className="grid grid-cols-2 gap-3 px-4 pb-3 pt-1 border-t border-border/50">
            <div className="rounded-xl bg-muted/40 p-2.5">
              <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">שעת פיק</div>
              <div className="text-xs font-medium text-foreground">{tip.bestTime}</div>
            </div>
            <div className="rounded-xl bg-muted/40 p-2.5">
              <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">פורמט מועדף</div>
              <div className="text-xs font-medium text-foreground">{tip.format}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Post chip (inside calendar cell) ────────────────────────────────────────

function PostChip({ item, onClick, selected, onSelect }: { item: WorkItem; onClick: () => void; selected?: boolean; onSelect?: (e: React.MouseEvent) => void }) {
  const cfg = statusConfig[item.status] ?? statusConfig.draft;
  const channel = item.payload?.channel ?? item.target_channel ?? "general";
  const chCfg = channelConfig[channel] ?? channelConfig.general;
  const imageUrl = item.payload?.image_url;

  return (
    <button
      onClick={onClick}
      className={cn(
        "group w-full rounded-md border px-2 py-1 text-right transition-all hover:shadow-md",
        cfg.bg,
        cfg.color,
        selected && "ring-2 ring-primary/50"
      )}
    >
      <div className="flex items-center gap-1.5">
        <GripVertical className="h-2.5 w-2.5 shrink-0 text-muted-foreground/30 cursor-grab" />
        <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", cfg.dot)} />
        {imageUrl && (
          <img src={imageUrl} alt="" className="h-4 w-4 rounded object-cover shrink-0" />
        )}
        <span className="truncate text-xs font-medium leading-tight">{item.title || "ללא כותרת"}</span>
        <span className={cn("mr-auto shrink-0", chCfg.color)}>{chCfg.icon}</span>
      </div>
    </button>
  );
}

// ─── Post detail dialog ───────────────────────────────────────────────────────

function PostDetailDialog({
  item,
  open,
  onClose,
  onUpdate,
}: {
  item: WorkItem | null;
  open: boolean;
  onClose: () => void;
  onUpdate: (id: string, patch: Partial<WorkItem>) => void;
}) {
  const [editDate, setEditDate] = useState("");
  const [editStatus, setEditStatus] = useState("");

  if (!item) return null;

  const imageUrl = item.payload?.image_url;
  const copyText = item.payload?.copy_text ?? item.payload?.brief_text;
  const channel = item.payload?.channel ?? item.target_channel ?? "general";
  const chCfg = channelConfig[channel] ?? channelConfig.general;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className={cn("h-2 w-2 rounded-full", statusConfig[item.status]?.dot ?? "bg-gray-400")} />
            {item.title || "ללא כותרת"}
          </DialogTitle>
        </DialogHeader>

        {imageUrl && (
          <img src={imageUrl} alt={item.title} className="w-full rounded-lg object-cover max-h-48" />
        )}

        <div className="space-y-3">
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span className={cn("flex items-center gap-1", chCfg.color)}>
              {chCfg.icon} {chCfg.label}
            </span>
            <span>·</span>
            <span>{item.marketing_pipeline_stages?.name ?? "—"}</span>
          </div>

          {copyText && (
            <div className="rounded-lg bg-muted/50 p-3 text-sm whitespace-pre-wrap leading-relaxed">
              {copyText}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">סטטוס</label>
              <Select value={editStatus || item.status} onValueChange={(v) => setEditStatus(v)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(statusConfig).map(([k, v]) => (
                    <SelectItem key={k} value={k} className="text-xs">
                      <span className="flex items-center gap-1.5">
                        <span className={cn("h-1.5 w-1.5 rounded-full", v.dot)} />
                        {v.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">תאריך פרסום</label>
              <Input
                type="date"
                className="h-8 text-xs"
                defaultValue={item.scheduled_date ?? ""}
                onChange={(e) => setEditDate(e.target.value)}
              />
            </div>
          </div>

          <Button
            size="sm"
            variant="outline"
            className="w-full border-violet-300 text-violet-700 hover:bg-violet-50"
            onClick={() => {
              const smartDate = getSmartScheduleDate(channel);
              setEditDate(smartDate);
              toast.success(`שעת פיק ל-${chCfg.label}: ${smartDate}`);
            }}
          >
            <Sparkles className="ml-1 h-3.5 w-3.5" />
            תזמן בשעת פיק אוטומטית
          </Button>

          <Button
            size="sm"
            className="w-full"
            onClick={() => {
              const patch: Partial<WorkItem> = {};
              if (editStatus) patch.status = editStatus;
              if (editDate) patch.scheduled_date = editDate;
              if (Object.keys(patch).length > 0) {
                onUpdate(item.id, patch);
                onClose();
              }
            }}
          >
            שמור שינויים
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── New item dialog (enhanced) ───────────────────────────────────────────────

function NewItemDialog({
  open,
  defaultDate,
  pipelineId,
  tenantId,
  clientId,
  onClose,
  onCreated,
}: {
  open: boolean;
  defaultDate: string;
  pipelineId: string;
  tenantId: string;
  clientId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(defaultDate);
  const [channels, setChannels] = useState<string[]>(["instagram"]);
  const [copy, setCopy] = useState("");
  const [autoRun, setAutoRun] = useState(false);
  const [saving, setSaving] = useState(false);

  const toggleChannel = (ch: string) => {
    setChannels((prev) =>
      prev.includes(ch) ? prev.filter((c) => c !== ch) : [...prev, ch]
    );
  };

  const handleSave = async () => {
    if (!title.trim() || channels.length === 0) return;
    setSaving(true);
    try {
      const { data: stage } = await supabase
        .from("marketing_pipeline_stages")
        .select("id")
        .eq("pipeline_id", pipelineId)
        .eq("stage_type", "target_organic")
        .maybeSingle();

      // Create one item per selected platform
      const inserts = channels.map((ch) => ({
        pipeline_id: pipelineId,
        tenant_id: tenantId,
        client_id: clientId,
        current_stage_id: stage?.id ?? null,
        title: channels.length > 1 ? `${title.trim()} – ${channelConfig[ch]?.label ?? ch}` : title.trim(),
        status: "draft",
        scheduled_date: date || null,
        target_channel: ch,
        payload: {
          channel: ch,
          copy_text: copy.trim() || null,
          auto_run: autoRun,
        },
      }));

      const { error } = await supabase.from("marketing_work_items").insert(inserts);
      if (error) throw error;

      toast.success(`${inserts.length} פריטי תוכן נוצרו`);

      if (autoRun) {
        toast.info("הפייפליין יורץ אוטומטית...");
      }

      onCreated();
      onClose();
      setTitle("");
      setCopy("");
      setChannels(["instagram"]);
      setAutoRun(false);
    } catch (e: any) {
      toast.error("שגיאה ביצירת פריט");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle>פריט תוכן חדש</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">כותרת</label>
            <Input
              placeholder="כותרת הפוסט..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
          </div>

          {/* Platform checkboxes */}
          <div>
            <label className="mb-2 block text-xs text-muted-foreground">פלטפורמות</label>
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(channelConfig)
                .filter(([k]) => k !== "general")
                .map(([k, v]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => toggleChannel(k)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-lg border px-2.5 py-2 text-xs font-medium transition-all",
                      channels.includes(k)
                        ? cn("border-primary/50 bg-primary/10 text-primary shadow-sm")
                        : "border-border hover:border-muted-foreground/30 text-muted-foreground"
                    )}
                  >
                    <span className={channels.includes(k) ? "text-primary" : v.color}>{v.icon}</span>
                    {v.label}
                  </button>
                ))}
            </div>
          </div>

          {/* Date picker */}
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">תאריך פרסום</label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-9"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-muted-foreground">טקסט / קופי (אופציונלי)</label>
            <Textarea
              placeholder="כתוב את הקופי כאן..."
              value={copy}
              onChange={(e) => setCopy(e.target.value)}
              rows={3}
            />
          </div>

          {/* Auto-run checkbox */}
          <div className="flex items-center gap-2 rounded-lg border border-violet-200 bg-violet-50/50 px-3 py-2">
            <Checkbox
              id="auto-run"
              checked={autoRun}
              onCheckedChange={(v) => setAutoRun(!!v)}
            />
            <label htmlFor="auto-run" className="cursor-pointer text-xs font-medium text-violet-700">
              הרץ אוטומטית את הפייפליין לאחר יצירה
            </label>
            <Sparkles className="h-3.5 w-3.5 text-violet-500 mr-auto" />
          </div>

          <Button className="w-full" onClick={handleSave} disabled={saving || !title.trim() || channels.length === 0}>
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin ml-2" />
            ) : (
              <Plus className="h-4 w-4 ml-2" />
            )}
            צור {channels.length > 1 ? `${channels.length} פריטים` : "פריט"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── List item row (enhanced) ─────────────────────────────────────────────────

function ListItemRow({
  item,
  selected,
  onSelect,
  onClick,
  onUpdate,
  onPublish,
}: {
  item: WorkItem;
  selected: boolean;
  onSelect: () => void;
  onClick: () => void;
  onUpdate: (id: string, patch: Partial<WorkItem>) => void;
  onPublish: (id: string) => void;
}) {
  const [editingCopy, setEditingCopy] = useState(false);
  const [copyDraft, setCopyDraft] = useState(item.payload?.copy_text ?? item.payload?.brief_text ?? "");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const cfg = statusConfig[item.status] ?? statusConfig.draft;
  const channel = item.payload?.channel ?? item.target_channel ?? "general";
  const chCfg = channelConfig[channel] ?? channelConfig.general;
  const imageUrl = item.payload?.image_url;
  const copyText = item.payload?.copy_text ?? item.payload?.brief_text ?? "";
  const preview = copyText.length > 100 ? copyText.slice(0, 100) + "…" : copyText;

  const handleCopySave = () => {
    setEditingCopy(false);
    if (copyDraft !== copyText) {
      const newPayload = { ...(item.payload ?? {}), copy_text: copyDraft };
      onUpdate(item.id, { payload: newPayload });
    }
  };

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-2xl border p-3 transition-all hover:shadow-lg hover:border-primary/30 hover:scale-[1.005] bg-card/60 backdrop-blur-sm",
        selected && "border-primary/40 bg-primary/5"
      )}
    >
      {/* Checkbox */}
      <button
        onClick={(e) => { e.stopPropagation(); onSelect(); }}
        className="mt-1 shrink-0 text-muted-foreground hover:text-foreground transition-colors"
      >
        {selected ? (
          <CheckSquare className="h-4 w-4 text-primary" />
        ) : (
          <Square className="h-4 w-4" />
        )}
      </button>

      {/* Thumbnail */}
      {imageUrl ? (
        <img src={imageUrl} alt="" className="h-10 w-10 rounded-lg object-cover shrink-0 mt-0.5" />
      ) : (
        <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg mt-0.5", chCfg.bg)}>
          <span className={chCfg.color}>{chCfg.icon}</span>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={onClick}
            className="truncate font-bold text-sm hover:text-primary transition-colors text-right"
          >
            {item.title || "ללא כותרת"}
          </button>
          <Badge
            variant="outline"
            className={cn("shrink-0 text-[10px] px-1.5 py-0 flex items-center gap-1", cfg.bg, cfg.color)}
          >
            {cfg.icon}
            {cfg.label}
          </Badge>
        </div>

        {/* Copy preview / edit */}
        {editingCopy ? (
          <Textarea
            ref={textareaRef}
            value={copyDraft}
            onChange={(e) => setCopyDraft(e.target.value)}
            onBlur={handleCopySave}
            autoFocus
            rows={3}
            className="text-xs mt-1"
            placeholder="כתוב קופי כאן..."
          />
        ) : (
          preview && (
            <p className="text-xs text-muted-foreground leading-relaxed">{preview}</p>
          )
        )}

        {/* Meta row */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap mt-0.5">
          <span className={cn("flex items-center gap-1", chCfg.color)}>
            {chCfg.icon} {chCfg.label}
          </span>
          {item.scheduled_date && (
            <>
              <span>·</span>
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {format(parseISO(item.scheduled_date), "dd/MM/yyyy")}
              </span>
            </>
          )}
          {item.marketing_pipeline_stages?.name && (
            <>
              <span>·</span>
              <span>{item.marketing_pipeline_stages.name}</span>
            </>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
        {/* Edit copy */}
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 text-muted-foreground hover:text-foreground"
          title="ערוך קופי"
          onClick={(e) => {
            e.stopPropagation();
            setEditingCopy(true);
            setTimeout(() => textareaRef.current?.focus(), 50);
          }}
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>

        {/* Publish button (approved only) */}
        {item.status === "approved" && (
          <Button
            size="sm"
            className="h-7 px-2.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
            onClick={(e) => { e.stopPropagation(); onPublish(item.id); }}
          >
            <Send className="h-3 w-3 ml-1" />
            פרסם
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── Bulk actions bar ─────────────────────────────────────────────────────────

function BulkActionsBar({
  count,
  onApprove,
  onSchedule,
  onClear,
}: {
  count: number;
  onApprove: () => void;
  onSchedule: () => void;
  onClear: () => void;
}) {
  if (count === 0) return null;
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-card border rounded-2xl shadow-xl px-6 py-3 flex items-center gap-4 z-50 backdrop-blur-sm">
      <span className="text-sm font-medium">{count} פריטים נבחרו</span>
      <Button size="sm" onClick={onApprove} className="bg-emerald-600 hover:bg-emerald-700 text-white">
        <CheckCircle2 className="h-3.5 w-3.5 ml-1" />
        אשר הכל
      </Button>
      <Button size="sm" variant="outline" onClick={onSchedule}>
        <Calendar className="h-3.5 w-3.5 ml-1" />
        תזמן
      </Button>
      <Button size="sm" variant="ghost" onClick={onClear}>
        ביטול
      </Button>
    </div>
  );
}

// ─── Platform filter chips ────────────────────────────────────────────────────

const ALL_PLATFORMS = ["all", ...Object.keys(channelConfig).filter((k) => k !== "general")];

function PlatformFilterChips({
  active,
  onChange,
}: {
  active: string;
  onChange: (p: string) => void;
}) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap px-4 pt-3">
      {ALL_PLATFORMS.map((p) => {
        const ch = channelConfig[p];
        const isActive = active === p;
        return (
          <button
            key={p}
            onClick={() => onChange(p)}
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-all",
              isActive
                ? "border-primary bg-primary text-primary-foreground shadow-sm"
                : "border-border bg-card hover:border-muted-foreground/40 text-muted-foreground"
            )}
          >
            {ch ? (
              <>
                <span className={isActive ? "text-primary-foreground" : ch.color}>{ch.icon}</span>
                {ch.label}
              </>
            ) : (
              "הכל"
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  pipelineId: string;
  tenantId: string;
  clientId: string;
  onSelectItem?: (id: string) => void;
}

export function SocialContentGantt({ pipelineId, tenantId, clientId, onSelectItem }: Props) {
  const qc = useQueryClient();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [selectedItem, setSelectedItem] = useState<WorkItem | null>(null);
  const [newItemDate, setNewItemDate] = useState("");
  const [newItemOpen, setNewItemOpen] = useState(false);
  const [platformFilter, setPlatformFilter] = useState("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // ─── Data ─────────────────────────────────────────────────────────────────

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["social-gantt-items", pipelineId],
    queryFn: async () => {
      const { data } = await supabase
        .from("marketing_work_items")
        .select("*, marketing_pipeline_stages(name, stage_type)")
        .eq("pipeline_id", pipelineId)
        .order("scheduled_date", { ascending: true, nullsFirst: false });
      return (data ?? []) as WorkItem[];
    },
  });

  const updateItem = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<WorkItem> }) => {
      const { error } = await supabase
        .from("marketing_work_items")
        .update(patch)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["social-gantt-items", pipelineId] });
      toast.success("עודכן");
    },
    onError: () => toast.error("שגיאה בעדכון"),
  });

  const publishItem = async (id: string) => {
    await updateItem.mutateAsync({ id, patch: { status: "published" } });
    toast.success("פורסם!");
  };

  // ─── Filtered items ───────────────────────────────────────────────────────

  const filteredItems = useMemo(() => {
    if (platformFilter === "all") return items;
    return items.filter((item) => {
      const ch = item.payload?.channel ?? item.target_channel ?? "general";
      return ch === platformFilter;
    });
  }, [items, platformFilter]);

  // ─── Calendar days ────────────────────────────────────────────────────────

  const days = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const itemsByDate = useMemo(() => {
    const map: Record<string, WorkItem[]> = {};
    filteredItems.forEach((item) => {
      if (item.scheduled_date) {
        const key = item.scheduled_date.slice(0, 10);
        if (!map[key]) map[key] = [];
        map[key].push(item);
      }
    });
    return map;
  }, [filteredItems]);

  const unscheduled = useMemo(() => filteredItems.filter((i) => !i.scheduled_date), [filteredItems]);

  // ─── Peak days for current filter ────────────────────────────────────────

  const peakDays: number[] = useMemo(() => {
    if (platformFilter === "all") return [];
    return PLATFORM_TIPS[platformFilter]?.peakDays ?? [];
  }, [platformFilter]);

  // ─── Stats ────────────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const total = items.length;
    const published = items.filter((i) => i.status === "published").length;
    const approved = items.filter((i) => i.status === "approved").length;
    const draft = items.filter((i) => i.status === "draft" || i.status === "in_progress").length;
    return { total, published, approved, draft };
  }, [items]);

  // ─── Bulk actions ─────────────────────────────────────────────────────────

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const bulkApprove = async () => {
    await Promise.all(
      selectedIds.map((id) => updateItem.mutateAsync({ id, patch: { status: "approved" } }))
    );
    setSelectedIds([]);
    toast.success("אושרו");
  };

  const bulkSchedule = () => {
    const smartDate = getSmartScheduleDate(platformFilter !== "all" ? platformFilter : "general");
    Promise.all(
      selectedIds.map((id) => updateItem.mutateAsync({ id, patch: { scheduled_date: smartDate } }))
    ).then(() => {
      setSelectedIds([]);
      toast.success(`תוזמן ל-${smartDate}`);
    });
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  const dayNames = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];
  const firstDayOffset = days[0].getDay();

  return (
    <div className="flex h-full flex-col gap-0" dir="rtl">
      {/* ── Header ── */}
      <div className="flex items-center gap-3 border-b px-4 py-3">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="min-w-[120px] text-center text-sm font-semibold">
            {format(currentMonth, "MMMM yyyy", { locale: he })}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-gray-400" />
            {stats.draft} טיוטות
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            {stats.approved} מאושרים
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-green-600" />
            {stats.published} פורסמו
          </span>
        </div>

        {/* View toggle */}
        <div className="mr-auto flex items-center gap-1 rounded-lg border p-0.5">
          {(["month", "list"] as ViewMode[]).map((v) => (
            <Button
              key={v}
              variant={viewMode === v ? "secondary" : "ghost"}
              size="sm"
              className="h-6 gap-1 px-2 text-xs"
              onClick={() => setViewMode(v)}
            >
              {v === "month" ? <LayoutGrid className="h-3 w-3" /> : <List className="h-3 w-3" />}
              {v === "month" ? "חודש" : "רשימה"}
            </Button>
          ))}
        </div>

        <Button
          size="sm"
          className="h-7 gap-1 text-xs"
          onClick={() => {
            setNewItemDate(format(new Date(), "yyyy-MM-dd"));
            setNewItemOpen(true);
          }}
        >
          <Plus className="h-3.5 w-3.5" />
          פוסט חדש
        </Button>
      </div>

      {/* ── Platform filter chips ── */}
      <PlatformFilterChips active={platformFilter} onChange={setPlatformFilter} />

      {/* ── Platform tips banner ── */}
      {platformFilter !== "all" && <PlatformTipsBanner platformFilter={platformFilter} />}

      {/* ── Calendar grid ── */}
      {viewMode === "month" && (
        <div className="flex-1 overflow-auto p-4">
          {isLoading ? (
            <div className="flex h-40 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {/* Day names */}
              <div className="mb-1 grid grid-cols-7 gap-1">
                {dayNames.map((d, i) => (
                  <div
                    key={d}
                    className={cn(
                      "py-1 text-center text-xs font-medium",
                      peakDays.includes(i) ? "text-primary font-bold" : "text-muted-foreground"
                    )}
                  >
                    {d}
                    {peakDays.includes(i) && (
                      <span className="block mx-auto mt-0.5 h-1 w-4 rounded-full bg-primary/30" />
                    )}
                  </div>
                ))}
              </div>

              {/* Days grid */}
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: firstDayOffset }).map((_, i) => (
                  <div key={`empty-${i}`} />
                ))}

                {days.map((day) => {
                  const key = format(day, "yyyy-MM-dd");
                  const dayItems = itemsByDate[key] ?? [];
                  const today = isToday(day);
                  const dow = day.getDay();
                  const isPeak = peakDays.includes(dow);

                  return (
                    <div
                      key={key}
                      className={cn(
                        "group min-h-[90px] rounded-lg border p-1.5 transition-colors",
                        today
                          ? "border-primary/30 bg-primary/5"
                          : isPeak
                          ? "border-primary/20 bg-primary/[0.03] hover:border-primary/30"
                          : "border-border hover:border-muted-foreground/30"
                      )}
                    >
                      {/* Day number */}
                      <div className="mb-1 flex items-center justify-between">
                        <span
                          className={cn(
                            "flex h-5 w-5 items-center justify-center rounded-full text-xs font-medium",
                            today
                              ? "bg-primary text-primary-foreground"
                              : isPeak
                              ? "text-primary font-bold"
                              : "text-muted-foreground"
                          )}
                        >
                          {format(day, "d")}
                        </span>
                        <button
                          className="hidden h-4 w-4 items-center justify-center rounded text-muted-foreground hover:text-foreground group-hover:flex"
                          onClick={() => { setNewItemDate(key); setNewItemOpen(true); }}
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>

                      {/* Post chips */}
                      <div className="flex flex-col gap-0.5">
                        {dayItems.slice(0, 3).map((item) => (
                          <PostChip
                            key={item.id}
                            item={item}
                            onClick={() => setSelectedItem(item)}
                            selected={selectedIds.includes(item.id)}
                          />
                        ))}
                        {dayItems.length > 3 && (
                          <button
                            className="text-right text-[10px] text-muted-foreground hover:text-foreground"
                            onClick={() => setSelectedItem(dayItems[3])}
                          >
                            +{dayItems.length - 3} עוד
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Unscheduled */}
              {unscheduled.length > 0 && (
                <div className="mt-4 rounded-lg border border-dashed p-3">
                  <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5" />
                    לא מתוזמן ({unscheduled.length})
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {unscheduled.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => setSelectedItem(item)}
                        className={cn(
                          "rounded-md border px-2 py-1 text-xs transition-all hover:shadow-sm",
                          statusConfig[item.status]?.bg ?? "bg-gray-100",
                          statusConfig[item.status]?.color ?? "text-gray-600"
                        )}
                      >
                        {item.title || "ללא כותרת"}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── List view (enhanced) ── */}
      {viewMode === "list" && (
        <div className="flex-1 overflow-auto p-4">
          {isLoading ? (
            <div className="flex h-40 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-8 w-8 opacity-30" />
              אין פריטי תוכן עדיין
            </div>
          ) : (
            <div className="space-y-2 pb-20">
              {/* Select all */}
              <div className="flex items-center gap-2 pb-1">
                <button
                  onClick={() => {
                    if (selectedIds.length === filteredItems.length) {
                      setSelectedIds([]);
                    } else {
                      setSelectedIds(filteredItems.map((i) => i.id));
                    }
                  }}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  {selectedIds.length === filteredItems.length && filteredItems.length > 0 ? (
                    <CheckSquare className="h-3.5 w-3.5 text-primary" />
                  ) : (
                    <Square className="h-3.5 w-3.5" />
                  )}
                  בחר הכל ({filteredItems.length})
                </button>
              </div>

              {filteredItems.map((item) => (
                <ListItemRow
                  key={item.id}
                  item={item}
                  selected={selectedIds.includes(item.id)}
                  onSelect={() => toggleSelect(item.id)}
                  onClick={() => {
                    setSelectedItem(item);
                    onSelectItem?.(item.id);
                  }}
                  onUpdate={(id, patch) => updateItem.mutate({ id, patch })}
                  onPublish={publishItem}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Bulk actions bar ── */}
      <BulkActionsBar
        count={selectedIds.length}
        onApprove={bulkApprove}
        onSchedule={bulkSchedule}
        onClear={() => setSelectedIds([])}
      />

      {/* ── Dialogs ── */}
      <PostDetailDialog
        item={selectedItem}
        open={!!selectedItem}
        onClose={() => setSelectedItem(null)}
        onUpdate={(id, patch) => updateItem.mutate({ id, patch })}
      />

      <NewItemDialog
        open={newItemOpen}
        defaultDate={newItemDate}
        pipelineId={pipelineId}
        tenantId={tenantId}
        clientId={clientId}
        onClose={() => setNewItemOpen(false)}
        onCreated={() => qc.invalidateQueries({ queryKey: ["social-gantt-items", pipelineId] })}
      />
    </div>
  );
}
