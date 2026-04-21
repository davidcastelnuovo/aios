/**
 * SocialGanttVisualView — Full-month calendar Gantt
 *
 * - Month selector dropdown (3 months back + 12 months ahead)
 * - Important dates highlighted: Israeli holidays, international days, Black Friday, etc.
 * - Month overview banner showing upcoming important dates
 * - All days shown; empty days clickable → DayIdeaPanel
 */

import { useState, useMemo } from "react";
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  getDay, isToday, addMonths, subMonths,
} from "date-fns";
import { he } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  Instagram, Facebook, Linkedin, Twitter,
  ChevronLeft, ChevronRight, Plus, CalendarRange, Star,
} from "lucide-react";
import type { SocialPost } from "@/pages/SocialDashboard";

// ─── Props ─────────────────────────────────────────────────────────────────
export interface SocialGanttVisualViewProps {
  posts: SocialPost[];
  selectedPostId: string | null;
  onSelectPost: (id: string) => void;
  onSelectDay: (date: Date) => void;
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

const HE_DAYS = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];

// ─── Important dates database ──────────────────────────────────────────────
type ImportantDateCategory = "holiday_il" | "holiday_intl" | "commerce" | "awareness";

interface ImportantDate {
  date: string; // "MM-DD" annual or "YYYY-MM-DD" one-time
  name: string;
  emoji: string;
  category: ImportantDateCategory;
  tip?: string;
}

const IMPORTANT_DATES: ImportantDate[] = [
  // ── ישראל ──
  { date: "04-23", name: "יום הזיכרון", emoji: "🕯️", category: "holiday_il", tip: "תוכן מכבד ומרגש" },
  { date: "04-24", name: "יום העצמאות", emoji: "🇮🇱", category: "holiday_il", tip: "תוכן חגיגי ופטריוטי" },
  { date: "05-14", name: "ל״ג בעומר", emoji: "🔥", category: "holiday_il", tip: "מדורות, חגיגות, משפחה" },
  { date: "06-02", name: "שבועות", emoji: "🌸", category: "holiday_il", tip: "חג מתן תורה, חלב ודבש" },
  { date: "10-07", name: "יום 7 באוקטובר", emoji: "🕯️", category: "holiday_il", tip: "יום זיכרון — תוכן מכבד בלבד" },
  { date: "09-22", name: "ראש השנה", emoji: "🍎", category: "holiday_il", tip: "ברכות לשנה טובה ומתוקה" },
  { date: "10-01", name: "יום כיפור", emoji: "✡️", category: "holiday_il", tip: "תוכן מכבד, צום קל" },
  { date: "10-06", name: "סוכות", emoji: "🌿", category: "holiday_il", tip: "חג האסיף, שמחה ואחדות" },
  { date: "12-14", name: "חנוכה", emoji: "🕎", category: "holiday_il", tip: "נרות, סופגניות, מתנות" },
  // ── בינלאומי ──
  { date: "02-14", name: "ולנטיין", emoji: "❤️", category: "holiday_intl", tip: "תוכן רומנטי ומתנות" },
  { date: "03-08", name: "יום האישה", emoji: "👩", category: "awareness", tip: "העצמת נשים, שוויון" },
  { date: "04-22", name: "יום כדור הארץ", emoji: "🌍", category: "awareness", tip: "קיימות, סביבה, ירוק" },
  { date: "05-01", name: "יום העבודה", emoji: "👷", category: "holiday_intl", tip: "תוכן על עבודה וקריירה" },
  { date: "05-11", name: "יום האם", emoji: "💐", category: "holiday_intl", tip: "ברכות לאמהות, מתנות" },
  { date: "06-01", name: "חודש גאווה", emoji: "🌈", category: "awareness", tip: "תוכן מכיל ותומך" },
  { date: "06-15", name: "יום האב", emoji: "👨‍👧", category: "holiday_intl", tip: "ברכות לאבות, מתנות" },
  { date: "07-04", name: "יום העצמאות האמריקאי", emoji: "🎆", category: "holiday_intl", tip: "רלוונטי לקהל בינלאומי" },
  { date: "10-31", name: "האלווין", emoji: "🎃", category: "holiday_intl", tip: "קמפיין כיפי ויצירתי" },
  { date: "12-25", name: "חג המולד", emoji: "🎄", category: "holiday_intl", tip: "רלוונטי לקהל בינלאומי" },
  { date: "12-31", name: "סילבסטר", emoji: "🎉", category: "holiday_intl", tip: "ברכות לשנה האזרחית החדשה" },
  // ── מסחר ──
  { date: "11-11", name: "יום הרווקים 11.11", emoji: "🛍️", category: "commerce", tip: "מבצעי ענק, קמפיין מכירות" },
  { date: "11-28", name: "Black Friday", emoji: "🖤", category: "commerce", tip: "מבצעי ענק! תכנן 2 שבועות מראש" },
  { date: "12-01", name: "Cyber Monday", emoji: "💻", category: "commerce", tip: "מבצעי אונליין — המשך ל-Black Friday" },
  { date: "08-01", name: "Back to School", emoji: "🎒", category: "commerce", tip: "קמפיין חזרה לבית ספר" },
  // ── ימי מודעות ──
  { date: "06-01", name: "יום הילד הבינ״ל", emoji: "👶", category: "awareness", tip: "תוכן על ילדים ומשפחה" },
  { date: "10-10", name: "יום בריאות הנפש", emoji: "🧠", category: "awareness", tip: "תוכן תומך ומעצים" },
  { date: "11-14", name: "יום הסוכרת הבינ״ל", emoji: "💙", category: "awareness", tip: "מודעות לבריאות" },
];

function getImportantDatesForDay(dateKey: string): ImportantDate[] {
  const monthDay = dateKey.slice(5); // "MM-DD"
  return IMPORTANT_DATES.filter((d) => d.date === dateKey || d.date === monthDay);
}

const categoryColors: Record<ImportantDateCategory, string> = {
  holiday_il:   "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20",
  holiday_intl: "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20",
  commerce:     "bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/20",
  awareness:    "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20",
};

const categoryRowBg: Record<ImportantDateCategory, string> = {
  holiday_il:   "bg-blue-500/5",
  holiday_intl: "bg-purple-500/5",
  commerce:     "bg-orange-500/5",
  awareness:    "bg-green-500/5",
};

// ─── Month selector ────────────────────────────────────────────────────────
function buildMonthOptions() {
  const options = [];
  const base = startOfMonth(new Date());
  for (let i = -3; i <= 12; i++) {
    const m = addMonths(base, i);
    options.push({
      value: format(m, "yyyy-MM"),
      label: format(m, "MMMM yyyy", { locale: he }),
    });
  }
  return options;
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

  const monthOptions = useMemo(() => buildMonthOptions(), []);

  const days = useMemo(
    () => eachDayOfInterval({ start: currentMonth, end: endOfMonth(currentMonth) }),
    [currentMonth],
  );

  const postsByDate = useMemo(() => {
    const map = new Map<string, SocialPost[]>();
    for (const p of posts) {
      const key = p.scheduled_date.slice(0, 10);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    }
    return map;
  }, [posts]);

  const totalThisMonth = posts.filter((p) =>
    p.scheduled_date.startsWith(format(currentMonth, "yyyy-MM"))
  ).length;

  const importantDatesThisMonth = useMemo(() => {
    return days
      .flatMap((day) => {
        const key = format(day, "yyyy-MM-dd");
        return getImportantDatesForDay(key).map((d) => ({ ...d, day }));
      })
      .slice(0, 7);
  }, [days]);

  const currentMonthValue = format(currentMonth, "yyyy-MM");

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
      <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/20 shrink-0 gap-3 flex-wrap">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost" size="icon" className="h-7 w-7"
            onClick={() => setCurrentMonth((m) => subMonths(m, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>

          <Select
            value={currentMonthValue}
            onValueChange={(v) => setCurrentMonth(startOfMonth(new Date(v + "-01")))}
          >
            <SelectTrigger className="h-8 w-[155px] text-sm font-semibold border-0 bg-transparent focus:ring-0 px-2">
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="start">
              {monthOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="ghost" size="icon" className="h-7 w-7"
            onClick={() => setCurrentMonth((m) => addMonths(m, 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <CalendarRange className="h-3.5 w-3.5" />
            {totalThisMonth} פרסומים
          </span>
          <span className="hidden sm:block">לחץ על יום להוספת פוסט</span>
        </div>
      </div>

      {/* ── Important dates banner ───────────────────────────────── */}
      {importantDatesThisMonth.length > 0 && (
        <div className="px-4 py-2 border-b bg-amber-500/5 shrink-0">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-400 shrink-0">
              <Star className="h-3.5 w-3.5 fill-current" />
              <span>תאריכים חשובים:</span>
            </div>
            {importantDatesThisMonth.map((d, i) => (
              <button
                key={i}
                onClick={() => onSelectDay(d.day)}
                title={d.tip}
                className={cn(
                  "inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border transition-all hover:opacity-80 cursor-pointer",
                  categoryColors[d.category]
                )}
              >
                <span>{d.emoji}</span>
                <span>{format(d.day, "d/M")}</span>
                <span className="hidden sm:inline">— {d.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Calendar table ──────────────────────────────────────── */}
      <ScrollArea className="flex-1">
        <table className="w-full border-collapse text-sm min-w-[580px]">
          <thead className="sticky top-0 z-10 bg-background border-b">
            <tr>
              <th className="text-right px-3 py-2 font-medium text-muted-foreground w-8 min-w-[36px]">יום</th>
              <th className="text-right px-2 py-2 font-medium text-muted-foreground w-8 min-w-[28px]"></th>
              <th className="text-right px-3 py-2 font-medium text-muted-foreground">פרסומים מתוכננים</th>
              <th className="text-right px-3 py-2 font-medium text-muted-foreground w-[100px]">אירוע</th>
              <th className="text-right px-3 py-2 font-medium text-muted-foreground w-[90px]">פלטפורמה</th>
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
              const importantDays = getImportantDatesForDay(dateKey);
              const hasImportant = importantDays.length > 0;
              const mainImportant = importantDays[0];
              const importantBg = hasImportant ? categoryRowBg[mainImportant.category] : "";

              if (dayPosts.length === 0) {
                return (
                  <tr
                    key={dateKey}
                    onClick={() => onSelectDay(day)}
                    className={cn(
                      "border-b border-border/30 cursor-pointer group transition-colors",
                      importantBg,
                      !hasImportant && (isWeekend ? "bg-muted/20 hover:bg-muted/40" : "hover:bg-muted/30"),
                      hasImportant && "hover:opacity-80",
                      isTodayDay && "bg-primary/5 hover:bg-primary/10"
                    )}
                  >
                    <td className="px-3 py-2.5 text-right">
                      <div className={cn(
                        "inline-flex items-center justify-center w-7 h-7 rounded-full text-sm font-medium",
                        isTodayDay
                          ? "bg-primary text-primary-foreground"
                          : hasImportant ? "font-semibold text-foreground" : "text-muted-foreground"
                      )}>
                        {format(day, "d")}
                      </div>
                    </td>
                    <td className="px-2 py-2.5 text-[11px] text-muted-foreground/60">{dayName}</td>
                    <td className="px-3 py-2.5">
                      <span className="text-xs text-muted-foreground/40 group-hover:text-primary/60 transition-colors flex items-center gap-1">
                        <Plus className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                        <span className="opacity-0 group-hover:opacity-100 transition-opacity">הוסף פוסט</span>
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      {hasImportant && (
                        <span
                          title={mainImportant.tip}
                          className={cn(
                            "inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full border whitespace-nowrap",
                            categoryColors[mainImportant.category]
                          )}
                        >
                          <span>{mainImportant.emoji}</span>
                          <span className="hidden md:inline truncate max-w-[75px]">{mainImportant.name}</span>
                        </span>
                      )}
                    </td>
                    <td /><td />
                  </tr>
                );
              }

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
                      pi === 0 && importantBg,
                      !hasImportant && isWeekend && "bg-muted/20",
                      isTodayDay && "bg-primary/5",
                      isSelected ? "bg-primary/10 hover:bg-primary/15" : "hover:bg-muted/50"
                    )}
                  >
                    <td className="px-3 py-2.5 text-right align-top">
                      {pi === 0 && (
                        <div className={cn(
                          "inline-flex items-center justify-center w-7 h-7 rounded-full text-sm font-semibold",
                          isTodayDay ? "bg-primary text-primary-foreground" : "text-foreground"
                        )}>
                          {format(day, "d")}
                        </div>
                      )}
                    </td>
                    <td className="px-2 py-2.5 text-[11px] text-muted-foreground/60 align-top">
                      {pi === 0 && dayName}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        {isSelected && <div className="w-1 h-5 rounded-full bg-primary shrink-0" />}
                        <span className={cn("font-medium text-sm line-clamp-1", isSelected && "text-primary")}>
                          {post.topic}
                        </span>
                      </div>
                      {post.copy_text && (
                        <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5 ps-3">
                          {post.copy_text}
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-2.5 align-top">
                      {pi === 0 && hasImportant && (
                        <span
                          title={mainImportant.tip}
                          className={cn(
                            "inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full border whitespace-nowrap",
                            categoryColors[mainImportant.category]
                          )}
                        >
                          <span>{mainImportant.emoji}</span>
                          <span className="hidden md:inline truncate max-w-[75px]">{mainImportant.name}</span>
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className={cn("w-6 h-6 rounded flex items-center justify-center text-white", platformColors[post.platform])}>
                        <PlatformIcon className="h-3.5 w-3.5" />
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded-full whitespace-nowrap", status.className)}>
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
