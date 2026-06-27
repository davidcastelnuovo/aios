import { useState, useMemo } from "react";
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

// ─── Types ────────────────────────────────────────────────────────────────────

type ViewMode = "month" | "week" | "list";

interface WorkItem {
  id: string;
  title: string;
  status: string;
  scheduled_date: string | null;
  payload: Record<string, any>;
  current_stage_id: string | null;
  marketing_pipeline_stages?: { name: string; stage_type: string } | null;
}

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

const channelConfig: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  instagram: { label: "Instagram", icon: <Instagram className="h-3 w-3" />, color: "text-pink-600" },
  facebook: { label: "Facebook", icon: <Facebook className="h-3 w-3" />, color: "text-blue-600" },
  twitter: { label: "Twitter/X", icon: <Twitter className="h-3 w-3" />, color: "text-sky-500" },
  linkedin: { label: "LinkedIn", icon: <Globe className="h-3 w-3" />, color: "text-blue-700" },
  tiktok: { label: "TikTok", icon: <Globe className="h-3 w-3" />, color: "text-gray-800" },
  general: { label: "כללי", icon: <Globe className="h-3 w-3" />, color: "text-gray-500" },
};

// ─── Post chip (inside calendar cell) ────────────────────────────────────────

function PostChip({ item, onClick }: { item: WorkItem; onClick: () => void }) {
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
        cfg.color
      )}
    >
      <div className="flex items-center gap-1.5">
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
  const cfg = statusConfig[item.status] ?? statusConfig.draft;

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
          {/* Channel + Stage */}
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span className={cn("flex items-center gap-1", chCfg.color)}>
              {chCfg.icon} {chCfg.label}
            </span>
            <span>·</span>
            <span>{item.marketing_pipeline_stages?.name ?? "—"}</span>
          </div>

          {/* Copy text */}
          {copyText && (
            <div className="rounded-lg bg-muted/50 p-3 text-sm whitespace-pre-wrap leading-relaxed">
              {copyText}
            </div>
          )}

          {/* Status + Date edit */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">סטטוס</label>
              <Select
                value={editStatus || item.status}
                onValueChange={(v) => setEditStatus(v)}
              >
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

// ─── New item dialog ──────────────────────────────────────────────────────────

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
  const [channel, setChannel] = useState("instagram");
  const [copy, setCopy] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      // Get the target_organic stage
      const { data: stage } = await supabase
        .from("marketing_pipeline_stages")
        .select("id")
        .eq("pipeline_id", pipelineId)
        .eq("stage_type", "target_organic")
        .maybeSingle();

      await supabase.from("marketing_work_items").insert({
        pipeline_id: pipelineId,
        tenant_id: tenantId,
        client_id: clientId,
        current_stage_id: stage?.id ?? null,
        title: title.trim(),
        status: "draft",
        scheduled_date: date || null,
        target_channel: channel,
        payload: {
          channel,
          copy_text: copy.trim() || null,
        },
      });
      toast.success("פריט תוכן נוצר");
      onCreated();
      onClose();
      setTitle("");
      setCopy("");
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
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">כותרת</label>
            <Input
              placeholder="כותרת הפוסט..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">ערוץ</label>
              <Select value={channel} onValueChange={setChannel}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(channelConfig).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      <span className="flex items-center gap-1.5">
                        <span className={v.color}>{v.icon}</span>
                        {v.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">תאריך</label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="h-9"
              />
            </div>
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
          <Button className="w-full" onClick={handleSave} disabled={saving || !title.trim()}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : <Plus className="h-4 w-4 ml-2" />}
            צור פריט
          </Button>
        </div>
      </DialogContent>
    </Dialog>
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

  // ─── Calendar days ────────────────────────────────────────────────────────

  const days = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const itemsByDate = useMemo(() => {
    const map: Record<string, WorkItem[]> = {};
    items.forEach((item) => {
      if (item.scheduled_date) {
        const key = item.scheduled_date.slice(0, 10);
        if (!map[key]) map[key] = [];
        map[key].push(item);
      }
    });
    return map;
  }, [items]);

  const unscheduled = useMemo(() => items.filter((i) => !i.scheduled_date), [items]);

  // ─── Stats ────────────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const total = items.length;
    const published = items.filter((i) => i.status === "published").length;
    const approved = items.filter((i) => i.status === "approved").length;
    const draft = items.filter((i) => i.status === "draft" || i.status === "in_progress").length;
    return { total, published, approved, draft };
  }, [items]);

  // ─── Render ───────────────────────────────────────────────────────────────

  const dayNames = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];
  const firstDayOffset = days[0].getDay(); // 0=Sun

  return (
    <div className="flex h-full flex-col gap-0" dir="rtl">
      {/* ── Header ── */}
      <div className="flex items-center gap-3 border-b px-4 py-3">
        {/* Month nav */}
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="min-w-[120px] text-center text-sm font-semibold">
            {format(currentMonth, "MMMM yyyy", { locale: he })}
          </span>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
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
          onClick={() => { setNewItemDate(format(new Date(), "yyyy-MM-dd")); setNewItemOpen(true); }}
        >
          <Plus className="h-3.5 w-3.5" />
          פוסט חדש
        </Button>
      </div>

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
                {dayNames.map((d) => (
                  <div key={d} className="py-1 text-center text-xs font-medium text-muted-foreground">
                    {d}
                  </div>
                ))}
              </div>

              {/* Days grid */}
              <div className="grid grid-cols-7 gap-1">
                {/* Empty cells for offset */}
                {Array.from({ length: firstDayOffset }).map((_, i) => (
                  <div key={`empty-${i}`} />
                ))}

                {days.map((day) => {
                  const key = format(day, "yyyy-MM-dd");
                  const dayItems = itemsByDate[key] ?? [];
                  const today = isToday(day);

                  return (
                    <div
                      key={key}
                      className={cn(
                        "group min-h-[90px] rounded-lg border p-1.5 transition-colors",
                        today ? "border-primary/30 bg-primary/5" : "border-border hover:border-muted-foreground/30",
                      )}
                    >
                      {/* Day number */}
                      <div className="mb-1 flex items-center justify-between">
                        <span
                          className={cn(
                            "flex h-5 w-5 items-center justify-center rounded-full text-xs font-medium",
                            today ? "bg-primary text-primary-foreground" : "text-muted-foreground",
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
                          statusConfig[item.status]?.color ?? "text-gray-600",
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

      {/* ── List view ── */}
      {viewMode === "list" && (
        <div className="flex-1 overflow-auto p-4">
          {isLoading ? (
            <div className="flex h-40 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : items.length === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-8 w-8 opacity-30" />
              אין פריטי תוכן עדיין
            </div>
          ) : (
            <div className="space-y-2">
              {items.map((item) => {
                const cfg = statusConfig[item.status] ?? statusConfig.draft;
                const channel = item.payload?.channel ?? item.target_channel ?? "general";
                const chCfg = channelConfig[channel] ?? channelConfig.general;
                const imageUrl = item.payload?.image_url;
                return (
                  <div
                    key={item.id}
                    className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-all hover:shadow-sm"
                    onClick={() => setSelectedItem(item)}
                  >
                    {imageUrl ? (
                      <img src={imageUrl} alt="" className="h-12 w-12 rounded-lg object-cover shrink-0" />
                    ) : (
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-muted">
                        <ImageIcon className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium text-sm">{item.title || "ללא כותרת"}</span>
                        <Badge
                          variant="outline"
                          className={cn("shrink-0 text-[10px] px-1.5 py-0", cfg.bg, cfg.color)}
                        >
                          {cfg.label}
                        </Badge>
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
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
                    <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

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
