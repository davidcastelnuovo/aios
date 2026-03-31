import { useState, useMemo, useRef, useCallback } from "react";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  isToday,
  addMonths,
  subMonths,
} from "date-fns";
import { he } from "date-fns/locale";
import {
  ChevronRight,
  ChevronLeft,
  Upload,
  X,
  ImageIcon,
  Loader2,
  Calendar,
  Plus,
  Sparkles,
  Pencil,
  Save,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  useSocialMediaPosts,
  SocialMediaPost,
  useCreatePost,
  useUpdatePostStatus,
} from "@/hooks/useSocialMedia";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ─── Status config ────────────────────────────────────────────────────────────
const statusConfig: Record<
  string,
  { label: string; color: string; bg: string; dot: string }
> = {
  draft: {
    label: "טיוטה",
    color: "text-gray-600",
    bg: "bg-gray-100 border-gray-200",
    dot: "bg-gray-400",
  },
  scheduled: {
    label: "מתוזמן",
    color: "text-blue-700",
    bg: "bg-blue-50 border-blue-200",
    dot: "bg-blue-500",
  },
  publishing: {
    label: "מפרסם",
    color: "text-yellow-700",
    bg: "bg-yellow-50 border-yellow-200",
    dot: "bg-yellow-500",
  },
  published: {
    label: "פורסם",
    color: "text-green-700",
    bg: "bg-green-50 border-green-200",
    dot: "bg-green-500",
  },
  failed: {
    label: "נכשל",
    color: "text-red-700",
    bg: "bg-red-50 border-red-200",
    dot: "bg-red-500",
  },
  cancelled: {
    label: "בוטל",
    color: "text-gray-500",
    bg: "bg-gray-50 border-gray-200",
    dot: "bg-gray-300",
  },
};

// ─── Mini Post Chip (shown inside calendar cell) ──────────────────────────────
function PostChip({
  post,
  onClick,
}: {
  post: SocialMediaPost;
  onClick: () => void;
}) {
  const cfg = statusConfig[post.status] ?? statusConfig.draft;
  const hasImage = post.media_urls && post.media_urls.length > 0;

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        "w-full text-right flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[11px] border transition-all",
        "hover:shadow-md hover:scale-[1.02] cursor-pointer",
        cfg.bg,
        cfg.color
      )}
    >
      {hasImage && (
        <img
          src={post.media_urls[0]}
          alt=""
          className="h-5 w-5 rounded object-cover shrink-0"
        />
      )}
      {!hasImage && (
        <span className={cn("h-2 w-2 rounded-full shrink-0", cfg.dot)} />
      )}
      <span className="truncate font-medium leading-tight">
        {post.title || post.content.slice(0, 22)}
      </span>
    </button>
  );
}

// ─── Post Editor Dialog ─────────────────────────────────────────────────────
function PostEditorDialog({
  post,
  selectedDate,
  onClose,
  onSaved,
}: {
  post: SocialMediaPost | null;
  selectedDate: Date;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { tenantId } = useCurrentTenant();
  const queryClient = useQueryClient();
  const createPost = useCreatePost();
  const isNew = !post;

  const [title, setTitle] = useState(post?.title ?? "");
  const [content, setContent] = useState(post?.content ?? "");
  const [localImage, setLocalImage] = useState<string | null>(
    post?.media_urls?.[0] ?? null
  );
  const [uploading, setUploading] = useState(false);
  const [generatingAI, setGeneratingAI] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [showAiPrompt, setShowAiPrompt] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const cfg = post ? (statusConfig[post.status] ?? statusConfig.draft) : statusConfig.draft;

  const dateStr = post
    ? post.scheduled_at || post.published_at || post.created_at
    : selectedDate.toISOString();
  const formattedDate = dateStr
    ? format(new Date(dateStr), "dd בMMMM yyyy", { locale: he })
    : "—";

  // ── Upload image ──
  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !tenantId) return;

      if (file.size > 10 * 1024 * 1024) {
        toast.error("הקובץ גדול מדי (מקסימום 10MB)");
        return;
      }

      setUploading(true);
      try {
        const preview = URL.createObjectURL(file);
        setLocalImage(preview);

        const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
        const safeName = `${Date.now()}.${ext}`;
        const postId = post?.id ?? "new";
        const filePath = `${tenantId}/social-posts/${postId}/${safeName}`;

        const { error: uploadError } = await supabase.storage
          .from("entity-attachments")
          .upload(filePath, file, { upsert: true });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from("entity-attachments")
          .getPublicUrl(filePath);

        setLocalImage(urlData.publicUrl);
        toast.success("התמונה הועלתה בהצלחה");
      } catch (err: any) {
        toast.error("שגיאה בהעלאת התמונה: " + err.message);
        setLocalImage(post?.media_urls?.[0] ?? null);
      } finally {
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    },
    [post, tenantId]
  );

  // ── Generate AI image ──
  const handleGenerateAI = useCallback(async () => {
    if (!aiPrompt.trim() || !tenantId) return;

    setGeneratingAI(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-generate-social-image", {
        body: {
          prompt: aiPrompt,
          tenant_id: tenantId,
          post_id: post?.id ?? "new",
        },
      });

      if (error) throw error;
      if (data?.image_url) {
        setLocalImage(data.image_url);
        setShowAiPrompt(false);
        setAiPrompt("");
        toast.success("התמונה נוצרה בהצלחה!");
      } else {
        throw new Error("לא התקבלה תמונה");
      }
    } catch (err: any) {
      toast.error("שגיאה ביצירת תמונה: " + err.message);
    } finally {
      setGeneratingAI(false);
    }
  }, [aiPrompt, tenantId, post]);

  // ── Save ──
  const handleSave = useCallback(async () => {
    if (!content.trim()) {
      toast.error("יש להזין תוכן לפוסט");
      return;
    }

    setSaving(true);
    try {
      if (isNew) {
        await createPost.mutateAsync({
          title: title || undefined,
          content,
          media_urls: localImage ? [localImage] : [],
          post_type: localImage ? "image" : "text",
          status: "scheduled",
          scheduled_at: selectedDate.toISOString(),
          channel_ids: [],
        });
      } else {
        // Update existing post
        const updateData: Record<string, unknown> = {
          title,
          content,
          updated_at: new Date().toISOString(),
        };
        if (localImage) {
          updateData.media_urls = [localImage];
          updateData.post_type = "image";
        }

        const { error } = await (supabase as any)
          .from("social_media_posts")
          .update(updateData)
          .eq("id", post!.id);

        if (error) throw error;
        queryClient.invalidateQueries({ queryKey: ["social-media-posts", tenantId] });
        toast.success("הפוסט עודכן בהצלחה");
      }
      onSaved();
      onClose();
    } catch (err: any) {
      toast.error("שגיאה בשמירה: " + err.message);
    } finally {
      setSaving(false);
    }
  }, [isNew, title, content, localImage, selectedDate, post, createPost, queryClient, tenantId, onSaved, onClose]);

  return (
    <div className="flex flex-col gap-4" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-muted-foreground flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              {formattedDate}
            </span>
            {!isNew && (
              <Badge
                className={cn("text-xs px-2 py-0.5 border", cfg.bg, cfg.color)}
                variant="outline"
              >
                <span className={cn("h-1.5 w-1.5 rounded-full ml-1.5", cfg.dot)} />
                {cfg.label}
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Title */}
      <Input
        placeholder="כותרת הפוסט (אופציונלי)"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="text-base font-semibold"
        dir="rtl"
      />

      {/* Body: text + image side by side */}
      <div className="flex gap-4 min-h-[200px]">
        {/* Text — right side */}
        <div className="flex-1 min-w-0 flex flex-col">
          <Textarea
            placeholder="כתוב את תוכן הפוסט כאן..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="flex-1 min-h-[180px] text-sm leading-relaxed resize-none"
            dir="rtl"
          />
        </div>

        {/* Image — left side */}
        <div className="shrink-0 w-[200px] flex flex-col gap-2">
          <div
            className={cn(
              "relative w-full aspect-square rounded-xl overflow-hidden border-2 border-dashed",
              localImage
                ? "border-transparent"
                : "border-muted-foreground/30 bg-muted/20"
            )}
          >
            {localImage ? (
              <>
                <img
                  src={localImage}
                  alt="תמונת פוסט"
                  className="w-full h-full object-cover"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center rounded-xl"
                >
                  <div className="flex flex-col items-center gap-1 text-white">
                    <Upload className="h-5 w-5" />
                    <span className="text-xs font-medium">החלף תמונה</span>
                  </div>
                </button>
                {/* Remove image */}
                <button
                  onClick={() => setLocalImage(null)}
                  className="absolute top-1 left-1 bg-black/60 rounded-full p-1 text-white hover:bg-black/80 transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              </>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full h-full flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-primary transition-colors p-3"
              >
                {uploading ? (
                  <Loader2 className="h-8 w-8 animate-spin" />
                ) : (
                  <>
                    <ImageIcon className="h-8 w-8" />
                    <span className="text-xs text-center leading-tight">
                      לחץ להעלאת תמונה
                    </span>
                  </>
                )}
              </button>
            )}

            {uploading && localImage && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-xl">
                <Loader2 className="h-6 w-6 animate-spin text-white" />
              </div>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />

          {/* AI Generate button */}
          <Button
            variant="outline"
            size="sm"
            className="w-full text-xs gap-1.5"
            onClick={() => setShowAiPrompt(!showAiPrompt)}
            disabled={generatingAI}
          >
            <Sparkles className="h-3.5 w-3.5" />
            צור תמונה עם AI
          </Button>

          {showAiPrompt && (
            <div className="flex flex-col gap-1.5">
              <Textarea
                placeholder="תאר את התמונה שתרצה ליצור..."
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                className="text-xs min-h-[60px] resize-none"
                dir="rtl"
              />
              <Button
                size="sm"
                className="w-full text-xs gap-1.5"
                onClick={handleGenerateAI}
                disabled={generatingAI || !aiPrompt.trim()}
              >
                {generatingAI ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                {generatingAI ? "יוצר..." : "צור תמונה"}
              </Button>
            </div>
          )}

          <p className="text-[10px] text-muted-foreground text-center">
            JPG, PNG, GIF עד 10MB
          </p>
        </div>
      </div>

      {/* Error message */}
      {post?.error_message && (
        <div className="p-2 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
          {post.error_message}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-2 border-t">
        <Button variant="ghost" size="sm" onClick={onClose}>
          ביטול
        </Button>
        <Button
          size="sm"
          className="gap-1.5"
          onClick={handleSave}
          disabled={saving || !content.trim()}
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {isNew ? "צור פוסט" : "שמור שינויים"}
        </Button>
      </div>
    </div>
  );
}

// ─── Main VisualPostCalendar ──────────────────────────────────────────────────
export function VisualPostCalendar() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedPost, setSelectedPost] = useState<SocialMediaPost | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [dialogMode, setDialogMode] = useState<"view" | "edit" | "create" | null>(null);
  const { data: posts = [] } = useSocialMediaPosts();
  const { tenantId } = useCurrentTenant();
  const queryClient = useQueryClient();

  const scheduledPosts = useMemo(
    () => posts.filter((p) => p.scheduled_at || p.published_at),
    [posts]
  );

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startDayOfWeek = monthStart.getDay();

  const getPostsForDay = (day: Date) =>
    scheduledPosts.filter((post) => {
      const date = post.scheduled_at || post.published_at;
      return date && isSameDay(new Date(date), day);
    });

  const handleDayClick = (day: Date) => {
    const dayPosts = getPostsForDay(day);
    if (dayPosts.length === 0) {
      // Open create dialog
      setSelectedDate(day);
      setSelectedPost(null);
      setDialogMode("create");
    }
  };

  const handlePostClick = (post: SocialMediaPost) => {
    setSelectedPost(post);
    const dateStr = post.scheduled_at || post.published_at || post.created_at;
    setSelectedDate(dateStr ? new Date(dateStr) : new Date());
    setDialogMode("edit");
  };

  const handleDialogClose = () => {
    setSelectedPost(null);
    setSelectedDate(null);
    setDialogMode(null);
  };

  const handleSaved = () => {
    queryClient.invalidateQueries({ queryKey: ["social-media-posts", tenantId] });
  };

  const dayHeaders = ["א'", "ב'", "ג'", "ד'", "ה'", "ו'", "ש'"];

  return (
    <div className="flex flex-col h-full" dir="rtl">
      {/* ── Calendar Header ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-background shrink-0">
        <h2 className="text-lg font-bold text-foreground">לוח שנה</h2>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setCurrentMonth((m) => addMonths(m, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="font-semibold text-base min-w-[130px] text-center">
            {format(currentMonth, "MMMM yyyy", { locale: he })}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setCurrentMonth((m) => subMonths(m, 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="text-xs"
          onClick={() => setCurrentMonth(new Date())}
        >
          היום
        </Button>
      </div>

      {/* ── Day-of-week headers ──────────────────────────────────────── */}
      <div className="grid grid-cols-7 border-b shrink-0 bg-muted/30">
        {dayHeaders.map((d) => (
          <div
            key={d}
            className="text-center text-xs font-semibold text-muted-foreground py-2"
          >
            {d}
          </div>
        ))}
      </div>

      {/* ── Calendar Grid ────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto">
        <div className="grid grid-cols-7 h-full">
          {/* Empty cells before month start */}
          {Array.from({ length: startDayOfWeek }).map((_, i) => (
            <div
              key={`empty-${i}`}
              className="border-b border-l bg-muted/10 min-h-[100px]"
            />
          ))}

          {/* Day cells */}
          {days.map((day) => {
            const dayPosts = getPostsForDay(day);
            const today = isToday(day);

            return (
              <div
                key={day.toISOString()}
                onClick={() => handleDayClick(day)}
                className={cn(
                  "border-b border-l min-h-[100px] p-1.5 flex flex-col gap-1 cursor-pointer group",
                  today ? "bg-primary/5" : "bg-background hover:bg-muted/20",
                  "transition-colors"
                )}
              >
                {/* Day number + add button */}
                <div className="flex items-center justify-between mb-0.5">
                  <span
                    className={cn(
                      "text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full",
                      today
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground"
                    )}
                  >
                    {format(day, "d")}
                  </span>
                  <div className="flex items-center gap-1">
                    {dayPosts.length > 0 && (
                      <span className="text-[10px] text-muted-foreground font-medium">
                        {dayPosts.length}
                      </span>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedDate(day);
                        setSelectedPost(null);
                        setDialogMode("create");
                      }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity h-5 w-5 flex items-center justify-center rounded-full bg-primary/10 hover:bg-primary/20 text-primary"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                </div>

                {/* Post chips */}
                <div className="flex flex-col gap-1 overflow-hidden">
                  {dayPosts.slice(0, 3).map((post) => (
                    <PostChip
                      key={post.id}
                      post={post}
                      onClick={() => handlePostClick(post)}
                    />
                  ))}
                  {dayPosts.length > 3 && (
                    <button
                      className="text-[10px] text-primary font-medium hover:underline text-right px-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePostClick(dayPosts[3]);
                      }}
                    >
                      +{dayPosts.length - 3} נוספים
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Post Editor Dialog ───────────────────────────────────────── */}
      <Dialog
        open={dialogMode !== null}
        onOpenChange={(open) => !open && handleDialogClose()}
      >
        <DialogContent className="max-w-2xl w-full" dir="rtl">
          <DialogHeader>
            <DialogTitle>
              {dialogMode === "create" ? "פוסט חדש" : "עריכת פוסט"}
            </DialogTitle>
          </DialogHeader>
          {(dialogMode === "create" || dialogMode === "edit") && selectedDate && (
            <PostEditorDialog
              post={selectedPost}
              selectedDate={selectedDate}
              onClose={handleDialogClose}
              onSaved={handleSaved}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
