/**
 * SocialGanttVisualView — Full-month calendar Gantt
 *
 * Always shows every day of the current month.
 * - Days with posts: show post rows with platform icon + status
 * - Empty days: show a subtle "+ פוסט" click target
 * - Clicking any day (empty or post) opens the post panel / new-post flow
 * - Month navigation (prev / next)
 */

import { useState, useMemo } from "react";
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  getDay, isToday, parseISO, isSameDay, addMonths, subMonths,
} from "date-fns";
import { he } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  Instagram, Facebook, Linkedin, Twitter,
  ChevronLeft, ChevronRight, Plus, CalendarRange,
} from "lucide-react";
import type { SocialPost } from "@/pages/SocialDashboard";

// ─── Props ─────────────────────────────────────────────────────────────────
export interface SocialGanttVisualViewProps {
  posts: SocialPost[];
  selectedPostId: string | null;
  onSelectPost: (id: string) => void;
  onSelectDay: (date: Date) => void;   // click on empty day → open new-post panel
  isLoading: boolean;
}

// ─── Platform helpers ──────────────────────────────────────────────────────
const TikTokIcon = () => (
  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor">
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.88-2.88 2.89 2.89 0 0 1 2.88-2.88c.28 0 .56.04.82.12v-3.5a6.37 6.37 0 0 0-.82-.05A6.34 6.34 0 0 0 3.15 15.3 6.34 6.34 0 0 0 9.49 21.64a6.34 6.34 0 0 0 6.34-6.34V8.73a8.19 8.19 0 0 0 4.76 1.52V6.8a4.84 4.84 0 0 1-1-.11z" />
  </svg>
);

const platformIcons: Record<string, React.ElementType> = {
  instagram: Instagram,
  facebook: Facebook,
  linkedin: Linkedin,
  twitter: Twitter,
  tiktok: TikTokIcon,
};

const platformColors: Record<string, string> = {
  instagram: "bg-pink-500",
  facebook: "bg-blue-600",
  tiktok: "bg-neutral-800",
  linkedin: "bg-blue-700",
  twitter: "bg-sky-500",
};

const statusConfig: Record<string, { label: string; className: string }> = {
  draft:     { label: "טיוטה",  className: "bg-muted text-muted-foreground" },
  in_review: { label: "בבדיקה", className: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400" },
  approved:  { label: "מאושר",  className: "bg-primary/15 text-primary" },
  published: { label: "פורסם",  className: "bg-green-500/15 text-green-700 dark:text-green-400" },
  rejected:  { label: "נדחה",   className: "bg-destructive/15 text-destructive" },
};

// Hebrew day names (Sun→Sat)
const HE_DAYS = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];

// ─── Main export ───────────────────────────────────────────────────────────
export function SocialGanttVisualView({
  posts,
  selectedPostId,
  onSelectPost,
  onSelectDay,
  isLoading,
}: SocialGanttVisualViewProps) {
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()));

  const days = useMemo(
    () => eachDayOfInterval({ start: currentMonth, end: endOfMonth(currentMonth) }),
    [currentMonth],
  );

  // Index posts by date string for O(1) lookup
  const postsByDate = useMemo(() => {
    const map = new Map<string, SocialPost[]>();
    for (const p of posts) {
      const key = p.scheduled_date.slice(0, 10);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    }
    return map;
  }, [posts]);

  const monthLabel = format(currentMonth, "MMMM yyyy", { locale: he });
  const totalThisMonth = posts.filter((p) =>
    p.scheduled_date.startsWith(format(currentMonth, "yyyy-MM"))
  ).length;

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="space-y-3 w-full max-w-lg px-8">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-10 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden border-s" dir="rtl">
      {/* ── Sub-header ──────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/20 shrink-0 gap-3">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setCurrentMonth((m) => subMonths(m, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="text-sm font-semibold min-w-[120px] text-center">{monthLabel}</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setCurrentMonth((m) => addMonths(m, 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <CalendarRange className="h-3.5 w-3.5" />
          <span>{totalThisMonth} פרסומים החודש</span>
        </div>
        <div className="text-xs text-muted-foreground hidden sm:block">
          לחץ על יום ריק להוספת פוסט
        </div>
      </div>

      {/* ── Calendar table ──────────────────────────────────────── */}
      <ScrollArea className="flex-1">
        <table className="w-full border-collapse text-sm min-w-[700px]">
          <thead className="sticky top-0 z-10 bg-background border-b">
            <tr>
              <th className="text-right px-3 py-2 font-medium text-muted-foreground w-8 min-w-[36px]">יום</th>
              <th className="text-right px-2 py-2 font-medium text-muted-foreground w-8 min-w-[28px]"></th>
              <th className="text-right px-3 py-2 font-medium text-muted-foreground">פרסומים מתוכננים</th>
              <th className="text-right px-3 py-2 font-medium text-muted-foreground w-[100px]">פלטפורמה</th>
              <th className="text-right px-3 py-2 font-medium text-muted-foreground w-[80px]">סטטוס</th>
            </tr>
          </thead>
          <tbody>
            {days.map((day) => {
              const dateKey = format(day, "yyyy-MM-dd");
              const dayPosts = postsByDate.get(dateKey) || [];
              const isWeekend = getDay(day) === 6 || getDay(day) === 0;
              const isTodayDay = isToday(day);
              const dayName = HE_DAYS[getDay(day)];

              if (dayPosts.length === 0) {
                // ── Empty day row ──
                return (
                  <tr
                    key={dateKey}
                    onClick={() => onSelectDay(day)}
                    className={cn(
                      "border-b border-border/30 cursor-pointer group transition-colors",
                      isWeekend ? "bg-muted/20 hover:bg-muted/40" : "hover:bg-muted/30",
                      isTodayDay && "bg-primary/5 hover:bg-primary/10"
                    )}
                  >
                    {/* Day number */}
                    <td className="px-3 py-2.5 text-right">
                      <div className={cn(
                        "inline-flex items-center justify-center w-7 h-7 rounded-full text-sm font-medium",
                        isTodayDay
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground"
                      )}>
                        {format(day, "d")}
                      </div>
                    </td>
                    {/* Day name */}
                    <td className="px-2 py-2.5 text-[11px] text-muted-foreground/60">{dayName}</td>
                    {/* Empty slot */}
                    <td className="px-3 py-2.5" colSpan={3}>
                      <span className="text-xs text-muted-foreground/40 group-hover:text-primary/60 transition-colors flex items-center gap-1">
                        <Plus className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                        <span className="opacity-0 group-hover:opacity-100 transition-opacity">הוסף פוסט</span>
                      </span>
                    </td>
                  </tr>
                );
              }

              // ── Day with posts ── (one row per post, first row shows date)
              return dayPosts.map((post, pi) => {
                const PlatformIcon = platformIcons[post.platform] || Instagram;
                const status = statusConfig[post.status] || statusConfig.draft;
                const isSelected = selectedPostId === post.id;

                return (
                  <tr
                    key={post.id}
                    onClick={() => onSelectPost(post.id)}
                    className={cn(
                      "border-b border-border/40 cursor-pointer transition-colors",
                      isWeekend ? "bg-muted/20" : "",
                      isTodayDay && "bg-primary/5",
                      isSelected ? "bg-primary/10 hover:bg-primary/15" : "hover:bg-muted/50"
                    )}
                  >
                    {/* Day number — only on first post of the day */}
                    <td className="px-3 py-2.5 text-right align-top">
                      {pi === 0 && (
                        <div className={cn(
                          "inline-flex items-center justify-center w-7 h-7 rounded-full text-sm font-semibold",
                          isTodayDay
                            ? "bg-primary text-primary-foreground"
                            : "text-foreground"
                        )}>
                          {format(day, "d")}
                        </div>
                      )}
                    </td>
                    {/* Day name — only on first post */}
                    <td className="px-2 py-2.5 text-[11px] text-muted-foreground/60 align-top">
                      {pi === 0 && dayName}
                    </td>
                    {/* Topic + copy preview */}
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        {isSelected && (
                          <div className="w-1 h-5 rounded-full bg-primary shrink-0" />
                        )}
                        <span className={cn(
                          "font-medium text-sm line-clamp-1",
                          isSelected && "text-primary"
                        )}>
                          {post.topic}
                        </span>
                      </div>
                      {post.copy_text && (
                        <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5 ps-3">
                          {post.copy_text}
                        </p>
                      )}
                    </td>
                    {/* Platform */}
                    <td className="px-3 py-2.5">
                      <div className={cn(
                        "w-6 h-6 rounded flex items-center justify-center text-white",
                        platformColors[post.platform]
                      )}>
                        <PlatformIcon className="h-3.5 w-3.5" />
                      </div>
                    </td>
                    {/* Status */}
                    <td className="px-3 py-2.5">
                      <span className={cn(
                        "text-[10px] font-medium px-1.5 py-0.5 rounded-full whitespace-nowrap",
                        status.className
                      )}>
                        {status.label}
                      </span>
                    </td>
                  </tr>
                );
              });
            })}
          </tbody>
        </table>
      </ScrollArea>
    </div>
  );
}
