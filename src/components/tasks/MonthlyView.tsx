import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday, isSameMonth } from "date-fns";
import { he } from "date-fns/locale";
import { useDroppable } from "@dnd-kit/core";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface Task {
  id: string;
  title: string;
  notes: string | null;
  status: string;
  priority: number;
  due_date: string | null;
  due_time: string | null;
  client_id: string | null;
  lead_id: string | null;
  agency_id: string | null;
  campaigner_id: string | null;
  tenant_id: string | null;
  clients?: { name: string } | null;
  task_updates?: { id: string }[];
  task_collaborators?: { id: string }[];
}

interface MonthlyViewProps {
  currentDate: Date;
  tasks: Task[];
  onDayClick: (date: Date) => void;
  onTaskClick: (task: Task) => void;
}

const WEEKDAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

function DayCell({
  date,
  tasks,
  currentMonth,
  onDayClick,
  onTaskClick,
}: {
  date: Date;
  tasks: Task[];
  currentMonth: Date;
  onDayClick: (date: Date) => void;
  onTaskClick: (task: Task) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: date.toISOString(),
  });

  const dayTasks = tasks.filter(
    (task) => task.due_date && isSameDay(new Date(task.due_date), date)
  );

  const isCurrentMonth = isSameMonth(date, currentMonth);
  const today = isToday(date);
  const completedCount = dayTasks.filter((t) => t.status === "done").length;
  const pendingCount = dayTasks.length - completedCount;

  return (
    <div
      ref={setNodeRef}
      onClick={() => onDayClick(date)}
      className={cn(
        "min-h-[100px] p-2 border-b border-l cursor-pointer transition-colors hover:bg-accent/30",
        !isCurrentMonth && "bg-muted/50 text-muted-foreground",
        today && "bg-primary/10 ring-2 ring-primary/50",
        isOver && "bg-accent/50"
      )}
    >
      <div className="flex items-center justify-between mb-1">
        <span
          className={cn(
            "text-sm font-medium",
            today && "text-primary font-bold"
          )}
        >
          {format(date, "d")}
        </span>
        {dayTasks.length > 0 && (
          <div className="flex gap-1">
            {pendingCount > 0 && (
              <Badge variant="secondary" className="text-xs h-5 px-1.5">
                {pendingCount}
              </Badge>
            )}
            {completedCount > 0 && (
              <Badge variant="outline" className="text-xs h-5 px-1.5 text-muted-foreground">
                ✓{completedCount}
              </Badge>
            )}
          </div>
        )}
      </div>
      <ScrollArea className="h-[60px]">
        <div className="space-y-1">
          {dayTasks.slice(0, 3).map((task) => (
            <div
              key={task.id}
              onClick={(e) => {
                e.stopPropagation();
                onTaskClick(task);
              }}
              className={cn(
                "text-xs p-1 rounded truncate cursor-pointer hover:bg-accent",
                task.status === "done"
                  ? "bg-muted text-muted-foreground line-through"
                  : "bg-primary/10"
              )}
            >
              {task.due_time && (
                <span className="text-muted-foreground mr-1">
                  {task.due_time.substring(0, 5)}
                </span>
              )}
              {task.title}
            </div>
          ))}
          {dayTasks.length > 3 && (
            <p className="text-xs text-muted-foreground text-center">
              +{dayTasks.length - 3} נוספות
            </p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

export function MonthlyView({
  currentDate,
  tasks,
  onDayClick,
  onTaskClick,
}: MonthlyViewProps) {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Pad the beginning of the month to start on Sunday
  const startDay = monthStart.getDay();
  const paddingDays = startDay;

  // Create array with padding
  const calendarDays = [...Array(paddingDays).fill(null), ...days];

  // Pad end to complete the last week
  const remainingDays = (7 - (calendarDays.length % 7)) % 7;
  for (let i = 0; i < remainingDays; i++) {
    calendarDays.push(null);
  }

  return (
    <div className="flex-1 flex flex-col rounded-xl border bg-muted/30 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b bg-primary/10 text-center">
        <p className="text-lg font-bold">
          {format(currentDate, "MMMM yyyy", { locale: he })}
        </p>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 border-b">
        {WEEKDAYS.map((day) => (
          <div
            key={day}
            className="p-2 text-center text-sm font-medium text-muted-foreground border-l first:border-l-0"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <ScrollArea className="flex-1">
        <div className="grid grid-cols-7">
          {calendarDays.map((date, index) =>
            date ? (
              <DayCell
                key={date.toISOString()}
                date={date}
                tasks={tasks}
                currentMonth={currentDate}
                onDayClick={onDayClick}
                onTaskClick={onTaskClick}
              />
            ) : (
              <div
                key={`empty-${index}`}
                className="min-h-[100px] p-2 border-b border-l bg-muted/30"
              />
            )
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
