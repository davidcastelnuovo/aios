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
import { ChevronRight, ChevronLeft, Upload, X, ImageIcon, Loader2, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useSocialMediaPosts, SocialMediaPost, useUpdatePostStatus } from "@/hooks/useSocialMedia";
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

// ─── Full Post Card (shown in dialog) ────────────────────────────────────────
function PostCard({
  post,
  onClose,
  onImageUploaded,
}: {
  post: SocialMediaPost;
  onClose: () => void;
  onImageUploaded: (postId: string, url: string) => void;
}) {
  const { tenantId } = useCurrentTenant();
  const [uploading, setUploading] = useState(false);
  const [localImage, setLocalImage] = useState<string | null>(
    post.media_urls?.[0] ?? null
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cfg = statusConfig[post.status] ?? statusConfig.draft;

  const dateStr = post.scheduled_at || post.published_at || post.created_at;
  const formattedDate = dateStr
    ? format(new Date(dateStr), "dd בMMMM yyyy, HH:mm", { locale: he })
    : "—";

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
        // Create a local preview immediately
        const preview = URL.createObjectURL(file);
        setLocalImage(preview);

        // Sanitize filename
        const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
        const safeName = `${Date.now()}.${ext}`;
        const filePath = `${tenantId}/social-posts/${post.id}/${safeName}`;

        const { error: uploadError } = await supabase.storage
          .from("entity-attachments")
          .upload(filePath, file, { upsert: true });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from("entity-attachments")
          .getPublicUrl(filePath);

        const publicUrl = urlData.publicUrl;
        setLocalImage(publicUrl);
        onImageUploaded(post.id, publicUrl);
        toast.success("התמונה הועלתה בהצלחה");
      } catch (err: any) {
        toast.error("שגיאה בהעלאת התמונה: " + err.message);
        setLocalImage(post.media_urls?.[0] ?? null);
      } finally {
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    },
    [post.id, post.media_urls, tenantId, onImageUploaded]
  );

  return (
    <div className="flex flex-col gap-0" dir="rtl">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-bold leading-tight text-foreground">
            {post.title || "ללא כותרת"}
          </h2>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="text-sm text-muted-foreground flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              {formattedDate}
            </span>
            <Badge
              className={cn(
                "text-xs px-2 py-0.5 border",
                cfg.bg,
                cfg.color
              )}
              variant="outline"
            >
              <span className={cn("h-1.5 w-1.5 rounded-full ml-1.5", cfg.dot)} />
              {cfg.label}
            </Badge>
          </div>
        </div>
      </div>

      {/* Body: image left, text right */}
      <div className="flex gap-4 min-h-[160px]">
        {/* Text — right side */}
        <div className="flex-1 min-w-0">
          <p className="text-sm text-foreground whitespace-pre-line leading-relaxed">
            {post.content}
          </p>
        </div>

        {/* Image — left side */}
        <div className="shrink-0 w-[180px]">
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
                {/* Replace image overlay */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center rounded-xl"
                >
                  <div className="flex flex-col items-center gap-1 text-white">
                    <Upload className="h-5 w-5" />
                    <span className="text-xs font-medium">החלף תמונה</span>
                  </div>
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

          <p className="text-[10px] text-muted-foreground text-center mt-1.5">
            {localImage ? "לחץ על התמונה להחלפה" : "JPG, PNG, GIF עד 10MB"}
          </p>
        </div>
      </div>

      {/* Error message */}
      {post.error_message && (
        <div className="mt-3 p-2 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
          {post.error_message}
        </div>
      )}
    </div>
  );
}

// ─── Main VisualPostCalendar ──────────────────────────────────────────────────
export function VisualPostCalendar() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedPost, setSelectedPost] = useState<SocialMediaPost | null>(null);
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
  const startDayOfWeek = monthStart.getDay(); // 0=Sun

  const getPostsForDay = (day: Date) =>
    scheduledPosts.filter((post) => {
      const date = post.scheduled_at || post.published_at;
      return date && isSameDay(new Date(date), day);
    });

  const handleImageUploaded = useCallback(
    async (postId: string, url: string) => {
      // Update the post's media_urls in the DB
      const post = posts.find((p) => p.id === postId);
      if (!post) return;
      const updatedUrls = [url, ...(post.media_urls || []).filter((u) => u !== url)];

      const { error } = await (supabase as any)
        .from("social_media_posts")
        .update({ media_urls: updatedUrls, updated_at: new Date().toISOString() })
        .eq("id", postId);

      if (error) {
        toast.error("שגיאה בשמירת התמונה");
      } else {
        queryClient.invalidateQueries({ queryKey: ["social-media-posts", tenantId] });
      }
    },
    [posts, tenantId, queryClient]
  );

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
        <div className="grid grid-cols-7 h-full" style={{ minHeight: "calc(100vh - 260px)" }}>
          {/* Empty cells before month start */}
          {Array.from({ length: startDayOfWeek }).map((_, i) => (
            <div
              key={`empty-${i}`}
              className="border-b border-l bg-muted/10 min-h-[120px]"
            />
          ))}

          {/* Day cells */}
          {days.map((day, idx) => {
            const dayPosts = getPostsForDay(day);
            const today = isToday(day);
            const isLastRow =
              Math.floor((startDayOfWeek + idx) / 7) ===
              Math.floor((startDayOfWeek + days.length - 1) / 7);

            return (
              <div
                key={day.toISOString()}
                className={cn(
                  "border-b border-l min-h-[120px] p-1.5 flex flex-col gap-1",
                  today ? "bg-primary/5" : "bg-background hover:bg-muted/20",
                  "transition-colors"
                )}
              >
                {/* Day number */}
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
                  {dayPosts.length > 0 && (
                    <span className="text-[10px] text-muted-foreground font-medium">
                      {dayPosts.length} פוסטים
                    </span>
                  )}
                </div>

                {/* Post chips */}
                <div className="flex flex-col gap-1 overflow-hidden">
                  {dayPosts.slice(0, 3).map((post) => (
                    <PostChip
                      key={post.id}
                      post={post}
                      onClick={() => setSelectedPost(post)}
                    />
                  ))}
                  {dayPosts.length > 3 && (
                    <button
                      className="text-[10px] text-primary font-medium hover:underline text-right px-1"
                      onClick={() => setSelectedPost(dayPosts[3])}
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

      {/* ── Post Detail Dialog ───────────────────────────────────────── */}
      <Dialog
        open={selectedPost !== null}
        onOpenChange={(open) => !open && setSelectedPost(null)}
      >
        <DialogContent
          className="max-w-2xl w-full"
          dir="rtl"
        >
          <DialogHeader>
            <DialogTitle className="sr-only">פרטי פוסט</DialogTitle>
          </DialogHeader>
          {selectedPost && (
            <PostCard
              post={selectedPost}
              onClose={() => setSelectedPost(null)}
              onImageUploaded={handleImageUploaded}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
