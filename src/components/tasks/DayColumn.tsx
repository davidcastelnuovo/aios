import { useDroppable, useDraggable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { format, isToday, isSameDay, parseISO } from "date-fns";
import { he } from "date-fns/locale";
import { ResizableTaskItem } from "./ResizableTaskItem";
import { cn } from "@/lib/utils";
import { useEffect, useRef } from "react";

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
  sort_order?: number;
  duration_minutes?: number;
  clients?: { name: string } | null;
  task_updates?: { id: string }[];
  task_collaborators?: { id: string }[];
}

interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  colorId?: string;
  calendarId?: string;
}

interface DayColumnProps {
  date: Date;
  tasks: Task[];
  onAddTask: (title: string, date: Date, time?: string) => void;
  onToggleComplete: (taskId: string, completed: boolean) => void;
  onTaskClick: (task: Task) => void;
  onDurationChange?: (taskId: string, newDuration: number) => void;
  onCalendarEventClick?: (event: CalendarEvent) => void;
  isLoading?: boolean;
  isCurrentDay?: boolean;
  calendarEvents?: CalendarEvent[];
}

// Generate half-hour time slots for full 24 hours
const TIME_SLOTS = [
  "00:00", "00:30", "01:00", "01:30", "02:00", "02:30",
  "03:00", "03:30", "04:00", "04:30", "05:00", "05:30",
  "06:00", "06:30", "07:00", "07:30", "08:00", "08:30",
  "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
  "12:00", "12:30", "13:00", "13:30", "14:00", "14:30",
  "15:00", "15:30", "16:00", "16:30", "17:00", "17:30",
  "18:00", "18:30", "19:00", "19:30", "20:00", "20:30",
  "21:00", "21:30", "22:00", "22:30", "23:00", "23:30"
];

const SLOT_HEIGHT = 40; // Height in pixels for each half-hour slot

// Get slot index for a given time
function getSlotIndex(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 2 + (minutes >= 30 ? 1 : 0);
}

// Draggable calendar event block component
function DraggableCalendarEventBlock({ 
  event, 
  slotHeight, 
  onClick 
}: { 
  event: CalendarEvent; 
  slotHeight: number;
  onClick?: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `calendar-event-${event.id}`,
    data: { type: 'calendar-event', event }
  });

  const startTime = new Date(event.start);
  const endTime = new Date(event.end);
  const durationMinutes = (endTime.getTime() - startTime.getTime()) / (1000 * 60);
  const slots = Math.max(1, Math.ceil(durationMinutes / 30));
  const height = slots * slotHeight - 4;
  
  const startHours = startTime.getHours().toString().padStart(2, "0");
  const startMins = startTime.getMinutes().toString().padStart(2, "0");
  const endHours = endTime.getHours().toString().padStart(2, "0");
  const endMins = endTime.getMinutes().toString().padStart(2, "0");

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    height: `${height}px`,
    zIndex: isDragging ? 50 : 5,
  } : {
    height: `${height}px`,
    zIndex: 5,
  };
  
  return (
    <div 
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      className={cn(
        "absolute left-8 right-1 bg-blue-100 dark:bg-blue-900/40 border-r-2 border-blue-500 rounded px-2 py-0.5 text-xs overflow-hidden cursor-pointer hover:bg-blue-200 dark:hover:bg-blue-800/50 transition-colors",
        isDragging && "opacity-50 shadow-lg"
      )}
      style={style}
    >
      <div className="flex items-center gap-1 truncate">
        <span className="text-muted-foreground text-[10px]">
          {startHours}:{startMins}-{endHours}:{endMins}
        </span>
        <span className="font-medium truncate">{event.title}</span>
      </div>
    </div>
  );
}

function TimeSlotDroppable({
  date,
  time,
  tasks,
  onToggleComplete,
  onTaskClick,
  onDurationChange,
  onCalendarEventClick,
  calendarEvents = [],
}: {
  date: Date;
  time: string;
  tasks: Task[];
  onToggleComplete: (taskId: string, completed: boolean) => void;
  onTaskClick: (task: Task) => void;
  onDurationChange?: (taskId: string, newDuration: number) => void;
  onCalendarEventClick?: (event: CalendarEvent) => void;
  calendarEvents?: CalendarEvent[];
}) {
  const droppableId = `${date.toISOString()}_${time}`;
  const { setNodeRef, isOver } = useDroppable({ id: droppableId });

  const slotTasks = tasks.filter((t) => {
    if (!t.due_time) return false;
    return t.due_time.startsWith(time);
  });

  // Filter calendar events that start at this time slot
  const slotEvents = calendarEvents.filter((event) => {
    const eventStart = new Date(event.start);
    const eventTime = `${eventStart.getHours().toString().padStart(2, "0")}:${eventStart.getMinutes() >= 30 ? "30" : "00"}`;
    return eventTime === time;
  });

  const taskIds = slotTasks.map((t) => t.id);

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex items-start gap-1 py-0.5 px-1 border-b border-dashed border-muted",
        isOver && "bg-accent/50"
      )}
      style={{ minHeight: `${SLOT_HEIGHT}px`, position: "relative" }}
    >
      <span className="text-[10px] text-muted-foreground w-8 shrink-0 pt-1">
        {time}
      </span>
      <div className="flex-1 min-w-0 relative" style={{ minHeight: `${SLOT_HEIGHT - 8}px` }}>
        {/* Calendar events (draggable) */}
        {slotEvents.map((event) => (
          <DraggableCalendarEventBlock 
            key={event.id} 
            event={event} 
            slotHeight={SLOT_HEIGHT}
            onClick={() => onCalendarEventClick?.(event)}
          />
        ))}
        
        {/* Tasks (foreground) */}
        <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
          {slotTasks.map((task, index) => (
            <ResizableTaskItem
              key={task.id}
              task={task}
              onToggleComplete={onToggleComplete}
              onClick={() => onTaskClick(task)}
              onDurationChange={onDurationChange}
              compact
              slotHeight={SLOT_HEIGHT}
              taskIndex={index}
            />
          ))}
        </SortableContext>
      </div>
    </div>
  );
}

export function DayColumn({
  date,
  tasks,
  onAddTask,
  onToggleComplete,
  onTaskClick,
  onDurationChange,
  onCalendarEventClick,
  isLoading,
  isCurrentDay,
  calendarEvents = [],
}: DayColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: date.toISOString(),
  });
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Only show tasks with time
  const dayTasks = tasks.filter(
    (task) => task.due_date && task.due_time && isSameDay(new Date(task.due_date), date)
  );

  // Filter calendar events for this day
  const dayEvents = calendarEvents.filter((event) => {
    const eventDate = new Date(event.start);
    return isSameDay(eventDate, date);
  });

  const today = isToday(date);

  // Auto-scroll to current time on mount (only for today)
  useEffect(() => {
    if (today && scrollContainerRef.current) {
      const now = new Date();
      const currentSlotIndex = now.getHours() * 2 + (now.getMinutes() >= 30 ? 1 : 0);
      // Scroll to 2 slots before current time for context
      const scrollToIndex = Math.max(0, currentSlotIndex - 2);
      const scrollPosition = scrollToIndex * SLOT_HEIGHT;
      scrollContainerRef.current.scrollTop = scrollPosition;
    }
  }, [today]);

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex flex-col rounded-xl border bg-muted/30",
        isCurrentDay ? "min-w-[300px] flex-[1.5]" : "min-w-[200px] flex-1",
        today && "ring-2 ring-primary/50 bg-primary/5",
        isOver && "bg-accent/50"
      )}
    >
      {/* Header */}
      <div
        className={cn(
          "p-3 border-b text-center",
          today && "bg-primary/10"
        )}
      >
        <p className="text-xs text-muted-foreground">
          {format(date, "EEEE", { locale: he })}
        </p>
        <p
          className={cn(
            "text-lg font-bold",
            today && "text-primary"
          )}
        >
          {format(date, "dd/MM")}
        </p>
      </div>

      {/* Time Slots */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto">
        {TIME_SLOTS.map((time) => (
          <TimeSlotDroppable
            key={time}
            date={date}
            time={time}
            tasks={dayTasks}
            onToggleComplete={onToggleComplete}
            onTaskClick={onTaskClick}
            onDurationChange={onDurationChange}
            onCalendarEventClick={onCalendarEventClick}
            calendarEvents={dayEvents}
          />
        ))}
      </div>
    </div>
  );
}
