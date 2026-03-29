import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useSocialMediaPosts } from "@/hooks/useSocialMedia";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday } from "date-fns";
import { he } from "date-fns/locale";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronRight, ChevronLeft } from "lucide-react";

export function ScheduleCalendar() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const { data: posts = [] } = useSocialMediaPosts();

  const scheduledPosts = useMemo(
    () => posts.filter((p) => p.scheduled_at || p.published_at),
    [posts]
  );

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const getPostsForDay = (day: Date) =>
    scheduledPosts.filter((post) => {
      const date = post.scheduled_at || post.published_at;
      return date && isSameDay(new Date(date), day);
    });

  const prevMonth = () => {
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };
  const nextMonth = () => {
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  // Day of week headers (Sunday first for Hebrew)
  const dayHeaders = ["א'", "ב'", "ג'", "ד'", "ה'", "ו'", "ש'"];

  // Pad beginning of month
  const startDayOfWeek = monthStart.getDay();

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>לוח שנה</CardTitle>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={nextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="font-medium min-w-[120px] text-center">
            {format(currentMonth, "MMMM yyyy", { locale: he })}
          </span>
          <Button variant="ghost" size="icon" onClick={prevMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 gap-1">
          {dayHeaders.map((d) => (
            <div key={d} className="text-center text-xs font-medium text-muted-foreground p-2">
              {d}
            </div>
          ))}
          {Array.from({ length: startDayOfWeek }).map((_, i) => (
            <div key={`empty-${i}`} />
          ))}
          {days.map((day) => {
            const dayPosts = getPostsForDay(day);
            const today = isToday(day);
            return (
              <div
                key={day.toISOString()}
                className={`min-h-[60px] p-1 rounded border text-xs ${
                  today ? "border-primary bg-primary/5" : "border-transparent"
                }`}
              >
                <div className={`font-medium mb-1 ${today ? "text-primary" : ""}`}>
                  {format(day, "d")}
                </div>
                {dayPosts.slice(0, 2).map((post) => (
                  <div
                    key={post.id}
                    className="truncate text-[10px] rounded px-1 py-0.5 mb-0.5"
                    style={{
                      backgroundColor:
                        post.status === "published"
                          ? "rgb(34 197 94 / 0.2)"
                          : post.status === "scheduled"
                          ? "rgb(59 130 246 / 0.2)"
                          : post.status === "failed"
                          ? "rgb(239 68 68 / 0.2)"
                          : "rgb(156 163 175 / 0.2)",
                    }}
                  >
                    {post.title || post.content.slice(0, 20)}
                  </div>
                ))}
                {dayPosts.length > 2 && (
                  <Badge variant="secondary" className="text-[10px] h-4">
                    +{dayPosts.length - 2}
                  </Badge>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
