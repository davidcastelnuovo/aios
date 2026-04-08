/**
 * SocialGanttVisualView
 * Visual Gantt chart replacing the old sidebar-only list.
 * Matches after-lead design system: deep-blue sidebar, turquoise primary, shadcn/ui.
 */

import { useState, useMemo } from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isToday, parseISO, isSameDay } from "date-fns";
import { he } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { Instagram, Facebook, Linkedin, Twitter, LayoutGrid, CalendarRange, ChevronLeft, ChevronRight } from "lucide-react";
import type { SocialPost } from "@/pages/SocialDashboard";

interface SocialGanttVisualViewProps {
  posts: SocialPost[];
  selectedPostId: string | null;
  onSelectPost: (id: string) => void;
  isLoading: boolean;
}

// ─── Platform helpers ──────────────────────────────────────────────────────
const platformIcons: Record<string, React.ElementType> = {
  instagram: Instagram,
  facebook: Facebook,
  linkedin: Linkedin,
  twitter: Twitter,
  tiktok: () => (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor">
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.88-2.88 2.89 2.89 0 0 1 2.88-2.88c.28 0 .56.04.82.12v-3.5a6.37 6.37 0 0 0-.82-.05A6.34 6.34 0 0 0 3.15 15.3 6.34 6.34 0 0 0 9.49 21.64a6.34 6.34 0 0 0 6.34-6.34V8.73a8.19 8.19 0 0 0 4.76 1.52V6.8a4.84 4.84 0 0 1-1-.11z" />
    </svg>
  ),
};

const platformColors: Record<string, string> = {
  instagram: "bg-pink-500",
  facebook: "bg-blue-600",
  tiktok: "bg-neutral-800",
  linkedin: "bg-blue-700",
  twitter: "bg-sky-500",
};

// Turquoise-aligned week colors matching after-lead primary palette
const weekColors = [
  { bar: "bg-primary/80", border: "border-primary", text: "text-primary", light: "bg-primary/10" },
  { bar: "bg-accent/80", border: "border-accent", text: "text-accent", light: "bg-accent/10" },
  { bar: "bg-blue-500/80", border: "border-blue-500", text: "text-blue-500", light: "bg-blue-500/10" },
  { bar: "bg-violet-500/80", border: "border-violet-500", text: "text-violet-500", light: "bg-violet-500/10" },
  { bar: "bg-amber-500/80", border: "border-amber-500", text: "text-amber-500", light: "bg-amber-500/10" },
];

const statusConfig: Record<string, { label: string; className: string }> = {
  draft:      { label: "טיוטה",   className: "bg-muted text-muted-foreground" },
  in_review:  { label: "בבדיקה",  className: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400" },
  approved:   { label: "מאושר",   className: "bg-primary/15 text-primary" },
  published:  { label: "פורסם",   className: "bg-green-500/15 text-green-700 dark:text-green-400" },
  rejected:   { label: "נדחה",    className: "bg-destructive/15 text-destructive" },
};

// ─── Week grouping helper ──────────────────────────────────────────────────
function groupByWeek(posts: SocialPost[]) {
  const weeks: { label: string; weekNum: number; posts: SocialPost[] }[] = [];
  const seen = new Map<number, number>(); // weekNum → index

  for (const post of posts) {
    const d = parseISO(post.scheduled_date);
    const dayOfWeek = getDay(d); // 0=Sun
    const weekStart = new Date(d);
    weekStart.setDate(d.getDate() - dayOfWeek);
    const weekNum = Math.floor(weekStart.getTime() / (7 * 24 * 60 * 60 * 1000));

    if (!seen.has(weekNum)) {
      seen.set(weekNum, weeks.length);
      weeks.push({
        label: `שבוע ${format(weekStart, "d", { locale: he })}–${format(new Date(weekStart.getTime() + 6 * 86400000), "d MMM", { locale: he })}`,
        weekNum,
        posts: [],
      });
    }
    weeks[seen.get(weekNum)!].posts.push(post);
  }
  return weeks;
}

// ─── Gantt bar view ────────────────────────────────────────────────────────
function GanttView({ posts, selectedPostId, onSelectPost }: Pick<SocialGanttVisualViewProps, "posts" | "selectedPostId" | "onSelectPost">) {
  const weeks = useMemo(() => groupByWeek(posts), [posts]);

  // Build 30-day calendar from first post date or today
  const firstDate = posts.length > 0 ? parseISO(posts[0].scheduled_date) : new Date();
  const monthStart = startOfMonth(firstDate);
  const monthEnd = endOfMonth(firstDate);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  if (posts.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground py-20">
        <div className="text-center space-y-2">
          <CalendarRange className="h-12 w-12 mx-auto opacity-20" />
          <p className="text-base font-medium">אין פוסטים לתצוגה</p>
          <p className="text-sm">צור פוסט חדש כדי להתחיל</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto">
      <table className="w-full border-collapse text-sm" dir="rtl">
        <thead className="sticky top-0 z-10 bg-background border-b">
          <tr>
            <th className="text-right px-4 py-2.5 font-medium text-muted-foreground w-[220px] min-w-[220px]">פרסום</th>
            <th className="text-right px-3 py-2.5 font-medium text-muted-foreground w-[90px]">פלטפורמה</th>
            <th className="text-right px-3 py-2.5 font-medium text-muted-foreground w-[80px]">סטטוס</th>
            {days.map((d) => (
              <th
                key={d.toISOString()}
                className={cn(
                  "px-0 py-2 text-center font-medium text-[11px] w-8 min-w-[32px]",
                  isToday(d) ? "text-primary font-bold" : "text-muted-foreground",
                  getDay(d) === 6 || getDay(d) === 0 ? "bg-muted/30" : ""
                )}
              >
                <div>{format(d, "d")}</div>
                <div className="text-[9px] opacity-60">{format(d, "EEE", { locale: he })}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week, wi) => {
            const color = weekColors[wi % weekColors.length];
            return (
              <>
                {/* Week separator row */}
                <tr key={`week-${week.weekNum}`} className="bg-muted/40">
                  <td colSpan={3 + days.length} className="px-4 py-1.5">
                    <span className={cn("text-xs font-semibold", color.text)}>{week.label}</span>
                  </td>
                </tr>
                {week.posts.map((post) => {
                  const postDate = parseISO(post.scheduled_date);
                  const PlatformIcon = platformIcons[post.platform] || Instagram;
                  const status = statusConfig[post.status] || statusConfig.draft;
                  const isSelected = selectedPostId === post.id;

                  return (
                    <tr
                      key={post.id}
                      onClick={() => onSelectPost(post.id)}
                      className={cn(
                        "border-b border-border/50 cursor-pointer transition-colors hover:bg-muted/50",
                        isSelected && "bg-primary/5"
                      )}
                    >
                      {/* Topic */}
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          {isSelected && <div className="w-1 h-6 rounded-full bg-primary shrink-0" />}
                          <span className={cn("font-medium text-sm line-clamp-1", isSelected && "text-primary")}>
                            {post.topic}
                          </span>
                        </div>
                        {post.copy_text && (
                          <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5 pr-3">
                            {post.copy_text}
                          </p>
                        )}
                      </td>
                      {/* Platform */}
                      <td className="px-3 py-2.5">
                        <div className={cn("w-6 h-6 rounded flex items-center justify-center text-white", platformColors[post.platform])}>
                          <PlatformIcon className="h-3.5 w-3.5" />
                        </div>
                      </td>
                      {/* Status */}
                      <td className="px-3 py-2.5">
                        <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded-full", status.className)}>
                          {status.label}
                        </span>
                      </td>
                      {/* Day cells */}
                      {days.map((d) => {
                        const isPostDay = isSameDay(d, postDate);
                        const isWeekend = getDay(d) === 6 || getDay(d) === 0;
                        return (
                          <td
                            key={d.toISOString()}
                            className={cn(
                              "px-0 py-2.5 text-center",
                              isWeekend && "bg-muted/20"
                            )}
                          >
                            {isPostDay && (
                              <div className={cn("mx-auto w-5 h-5 rounded-full flex items-center justify-center", color.bar)}>
                                <span className="text-[9px] text-white font-bold">✓</span>
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Week cards view ───────────────────────────────────────────────────────
function WeekView({ posts, selectedPostId, onSelectPost }: Pick<SocialGanttVisualViewProps, "posts" | "selectedPostId" | "onSelectPost">) {
  const weeks = useMemo(() => groupByWeek(posts), [posts]);

  if (posts.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground py-20">
        <div className="text-center space-y-2">
          <LayoutGrid className="h-12 w-12 mx-auto opacity-20" />
          <p className="text-base font-medium">אין פוסטים לתצוגה</p>
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1">
      <div className="p-4 space-y-6" dir="rtl">
        {weeks.map((week, wi) => {
          const color = weekColors[wi % weekColors.length];
          return (
            <div key={week.weekNum}>
              <div className={cn("flex items-center gap-2 mb-3")}>
                <div className={cn("w-1 h-5 rounded-full", color.bar)} />
                <h3 className={cn("text-sm font-semibold", color.text)}>{week.label}</h3>
                <span className="text-xs text-muted-foreground">({week.posts.length} פרסומים)</span>
              </div>
              <div className="grid grid-cols-1 gap-2">
                {week.posts.map((post) => {
                  const PlatformIcon = platformIcons[post.platform] || Instagram;
                  const status = statusConfig[post.status] || statusConfig.draft;
                  const isSelected = selectedPostId === post.id;

                  return (
                    <button
                      key={post.id}
                      onClick={() => onSelectPost(post.id)}
                      className={cn(
                        "w-full text-right rounded-lg border p-3 transition-all hover:shadow-sm cursor-pointer",
                        isSelected
                          ? `border-primary bg-primary/5 shadow-sm`
                          : "border-border bg-card hover:border-primary/40"
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded-full", status.className)}>
                            {status.label}
                          </span>
                          <div className={cn("w-6 h-6 rounded flex items-center justify-center text-white shrink-0", platformColors[post.platform])}>
                            <PlatformIcon className="h-3.5 w-3.5" />
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={cn("font-medium text-sm truncate", isSelected && "text-primary")}>
                            {post.topic}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {format(parseISO(post.scheduled_date), "EEEE, d MMM", { locale: he })}
                          </p>
                        </div>
                      </div>
                      {post.copy_text && (
                        <p className="text-xs text-muted-foreground mt-2 line-clamp-2 text-right">
                          {post.copy_text}
                        </p>
                      )}
                      {post.creative_url && (
                        <div className="mt-2 rounded overflow-hidden border">
                          <img src={post.creative_url} alt={post.topic} className="w-full h-20 object-cover" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}

// ─── Main export ───────────────────────────────────────────────────────────
export function SocialGanttVisualView({ posts, selectedPostId, onSelectPost, isLoading }: SocialGanttVisualViewProps) {
  const [viewMode, setViewMode] = useState<"gantt" | "weeks">("gantt");

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="space-y-3 w-full max-w-lg px-8">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-12 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden border-s">
      {/* Sub-header with view toggle */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/20 shrink-0">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <CalendarRange className="h-3.5 w-3.5" />
          <span>{posts.length} פרסומים</span>
        </div>
        <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "gantt" | "weeks")}>
          <TabsList className="h-7">
            <TabsTrigger value="gantt" className="h-6 px-2.5 text-xs gap-1">
              <CalendarRange className="h-3 w-3" />
              גאנט
            </TabsTrigger>
            <TabsTrigger value="weeks" className="h-6 px-2.5 text-xs gap-1">
              <LayoutGrid className="h-3 w-3" />
              שבועות
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* View content */}
      <div className="flex-1 overflow-auto">
        {viewMode === "gantt" ? (
          <GanttView posts={posts} selectedPostId={selectedPostId} onSelectPost={onSelectPost} />
        ) : (
          <WeekView posts={posts} selectedPostId={selectedPostId} onSelectPost={onSelectPost} />
        )}
      </div>
    </div>
  );
}
