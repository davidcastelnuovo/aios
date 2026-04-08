/**
 * SocialGanttVisualView — Full-month calendar grid (whiteboard style)
 *
 * Shows a 7-column grid for every day of the month.
 * Each cell shows mini-cards for scheduled posts.
 * Clicking a day calls onSelectDay to open a dialog.
 */

import { useState, useMemo } from "react";
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  getDay, isToday, addMonths, subMonths,
} from "date-fns";
import { he } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Instagram, Facebook, Linkedin, Twitter,
  ChevronLeft, ChevronRight, Plus, CalendarRange,
} from "lucide-react";
import type { SocialPost } from "@/pages/SocialDashboard";

// ─── Platform helpers ──────────────────────────────────────────────────────
const TikTokIcon = () => (
  <svg viewBox="0 0 24 24" className="h-3 w-3" fill="currentColor">
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

const statusBarColors: Record<string, string> = {
  draft: "bg-muted-foreground/40",
  in_review: "bg-yellow-500",
  approved: "bg-primary",
  published: "bg-green-500",
  rejected: "bg-destructive",
};

// Hebrew day names (Sun→Sat)
const HE_DAYS = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];

// ─── Props ─────────────────────────────────────────────────────────────────
export interface SocialGanttVisualViewProps {
  posts: SocialPost[];
  selectedPostId: string | null;
  onSelectPost: (id: string) => void;
  onSelectDay: (date: Date) => void;
  isLoading: boolean;
}

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

  // Build grid with leading empty cells for alignment
  const firstDayOfWeek = getDay(currentMonth); // 0=Sun

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
        <div className="grid grid-cols-7 gap-2 w-full max-w-4xl px-8">
          {Array.from({ length: 35 }).map((_, i) => (
            <div key={i} className="h-24 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden" dir="rtl">
      {/* ── Month navigation header ─────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b bg-muted/20 shrink-0 gap-3">
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
      </div>

      {/* ── Day names header ────────────────────────────────────── */}
      <div className="grid grid-cols-7 border-b bg-muted/10 shrink-0">
        {HE_DAYS.map((name) => (
          <div key={name} className="text-center py-1.5 text-xs font-medium text-muted-foreground border-e last:border-e-0">
            {name}
          </div>
        ))}
      </div>

      {/* ── Calendar grid ───────────────────────────────────────── */}
      <div className="flex-1 grid grid-cols-7 auto-rows-fr overflow-y-auto min-h-0">
        {/* Leading empty cells */}
        {Array.from({ length: firstDayOfWeek }).map((_, i) => (
          <div key={`empty-${i}`} className="border-e border-b bg-muted/5" />
        ))}

        {/* Day cells */}
        {days.map((day) => {
          const dateKey = format(day, "yyyy-MM-dd");
          const dayPosts = postsByDate.get(dateKey) || [];
          const isTodayDay = isToday(day);
          const isWeekend = getDay(day) === 6 || getDay(day) === 0;

          return (
            <div
              key={dateKey}
              onClick={() => onSelectDay(day)}
              className={cn(
                "border-e border-b p-1.5 cursor-pointer transition-colors group flex flex-col min-h-[90px]",
                isWeekend ? "bg-muted/15" : "bg-background",
                isTodayDay && "bg-primary/5",
                "hover:bg-accent/50"
              )}
            >
              {/* Day number */}
              <div className="flex items-center justify-between mb-1">
                <span
                  className={cn(
                    "inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-semibold",
                    isTodayDay
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground"
                  )}
                >
                  {format(day, "d")}
                </span>
                {dayPosts.length === 0 && (
                  <Plus className="h-3.5 w-3.5 text-muted-foreground/30 opacity-0 group-hover:opacity-100 transition-opacity" />
                )}
              </div>

              {/* Post mini-cards */}
              <div className="flex-1 space-y-1 overflow-hidden">
                {dayPosts.slice(0, 3).map((post) => {
                  const PlatformIcon = platformIcons[post.platform] || Instagram;
                  const statusColor = statusBarColors[post.status] || statusBarColors.draft;

                  return (
                    <div
                      key={post.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectDay(day);
                      }}
                      className={cn(
                        "flex items-center gap-1 px-1.5 py-1 rounded text-[11px] leading-tight transition-colors",
                        "bg-card border border-border/50 hover:border-border",
                        selectedPostId === post.id && "ring-1 ring-primary border-primary"
                      )}
                    >
                      {/* Status bar */}
                      <div className={cn("w-0.5 h-4 rounded-full shrink-0", statusColor)} />
                      {/* Platform icon */}
                      <div className={cn(
                        "w-4 h-4 rounded flex items-center justify-center text-white shrink-0",
                        platformColors[post.platform]
                      )}>
                        <PlatformIcon className="h-2.5 w-2.5" />
                      </div>
                      {/* Title */}
                      <span className="truncate text-foreground/80 font-medium">
                        {post.topic}
                      </span>
                    </div>
                  );
                })}
                {dayPosts.length > 3 && (
                  <span className="text-[10px] text-muted-foreground px-1">
                    +{dayPosts.length - 3} נוספים
                  </span>
                )}
              </div>
            </div>
          );
        })}

        {/* Trailing empty cells to complete the last row */}
        {(() => {
          const totalCells = firstDayOfWeek + days.length;
          const remainder = totalCells % 7;
          if (remainder === 0) return null;
          return Array.from({ length: 7 - remainder }).map((_, i) => (
            <div key={`trail-${i}`} className="border-e border-b bg-muted/5" />
          ));
        })()}
      </div>
    </div>
  );
}
