import { useState, useRef, useCallback } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Users, GripVertical, GripHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

interface ResizableTaskItemProps {
  task: {
    id: string;
    title: string;
    status: string;
    client_id: string | null;
    duration_minutes?: number;
    clients?: { name: string } | null;
    task_updates?: { id: string }[];
    task_collaborators?: { id: string }[];
  };
  onToggleComplete: (taskId: string, completed: boolean) => void;
  onClick: () => void;
  onDurationChange?: (taskId: string, newDuration: number) => void;
  compact?: boolean;
  slotHeight?: number;
  taskIndex?: number;
  totalTasksInSlot?: number;
}

export function ResizableTaskItem({ 
  task, 
  onToggleComplete, 
  onClick, 
  onDurationChange,
  compact = false, 
  slotHeight = 40,
  taskIndex = 0,
  totalTasksInSlot = 1
}: ResizableTaskItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const [isResizing, setIsResizing] = useState(false);
  const [resizeHeight, setResizeHeight] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const startYRef = useRef<number>(0);
  const startHeightRef = useRef<number>(0);
  const currentHeightRef = useRef<number>(0);

  // Calculate height based on duration (30 min = 1 slot)
  const durationMinutes = task.duration_minutes || 30;
  const baseHeight = compact ? (durationMinutes / 30) * slotHeight : undefined;
  const displayHeight = resizeHeight ?? baseHeight;

  // Calculate z-index: resizing gets highest, then longer tasks, then by index
  const baseZIndex = isResizing ? 100 : (durationMinutes > 30 ? 20 : 10);
  const zIndex = baseZIndex - taskIndex;

  // Calculate width for side-by-side layout (max 4 per row)
  const tasksPerRow = Math.min(4, totalTasksInSlot);
  const widthPercent = 100 / tasksPerRow;
  const leftPercent = (taskIndex % tasksPerRow) * widthPercent;

  const style = {
    transform: isResizing ? undefined : CSS.Transform.toString(transform),
    transition: isResizing ? undefined : transition,
    ...(compact ? { 
      position: "absolute" as const,
      top: 0,
      left: `${leftPercent}%`,
      width: `${widthPercent}%`,
      height: `${(displayHeight || slotHeight) - 4}px`,
      zIndex,
    } : {}),
  };

  const isCompleted = task.status === "done";
  const updatesCount = task.task_updates?.length || 0;
  const collaboratorsCount = task.task_collaborators?.length || 0;

  const handleResizeStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    setIsResizing(true);
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    startYRef.current = clientY;
    startHeightRef.current = baseHeight || slotHeight;
    currentHeightRef.current = startHeightRef.current;
    setResizeHeight(startHeightRef.current);

    const handleMove = (moveEvent: MouseEvent | TouchEvent) => {
      const currentY = 'touches' in moveEvent ? moveEvent.touches[0].clientY : moveEvent.clientY;
      const delta = currentY - startYRef.current;
      const newHeight = Math.max(slotHeight, startHeightRef.current + delta);
      // Snap to slot increments (each slot = slotHeight), minimum 1 slot
      const snappedHeight = Math.max(slotHeight, Math.round(newHeight / slotHeight) * slotHeight);
      currentHeightRef.current = snappedHeight;
      setResizeHeight(snappedHeight);
    };

    const handleEnd = () => {
      setIsResizing(false);
      if (currentHeightRef.current > 0 && onDurationChange) {
        // Convert height back to minutes
        const newDurationMinutes = Math.max(30, Math.round((currentHeightRef.current / slotHeight) * 30));
        // Clamp to valid values
        const clampedDuration = Math.min(180, Math.max(30, Math.round(newDurationMinutes / 30) * 30));
        onDurationChange(task.id, clampedDuration);
      }
      setResizeHeight(null);
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleEnd);
      document.removeEventListener('touchmove', handleMove);
      document.removeEventListener('touchend', handleEnd);
    };

    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleEnd);
    document.addEventListener('touchmove', handleMove);
    document.addEventListener('touchend', handleEnd);
  }, [baseHeight, slotHeight, resizeHeight, onDurationChange, task.id]);

  if (compact) {
    return (
      <div
        ref={(node) => {
          setNodeRef(node);
          (containerRef as any).current = node;
        }}
        style={style}
        className={cn(
          "group flex items-start gap-1 px-1 py-0.5 rounded border bg-card hover:bg-accent/50 cursor-pointer transition-colors text-[11px]",
          isDragging && "opacity-50 shadow-lg",
          isCompleted && "opacity-60",
          isResizing && "shadow-lg ring-2 ring-primary",
          durationMinutes > 30 && "flex-col"
        )}
      >
        <div className="flex items-start gap-1 w-full">
          <button
            {...attributes}
            {...listeners}
            className="opacity-100 md:opacity-0 md:group-hover:opacity-100 cursor-grab active:cursor-grabbing transition-opacity shrink-0 touch-none"
          >
            <GripVertical className="h-3 w-3 text-muted-foreground" />
          </button>
          
          <Checkbox
            checked={isCompleted}
            onCheckedChange={(checked) => {
              onToggleComplete(task.id, checked as boolean);
            }}
            onClick={(e) => e.stopPropagation()}
            className="h-3 w-3 shrink-0"
          />
          
          <div className="flex-1 min-w-0 whitespace-normal break-words" onClick={onClick}>
            <span
              className={cn(
                "font-medium",
                isCompleted && "line-through text-muted-foreground"
              )}
            >
              {task.title}
            </span>
            {task.clients?.name && (
              <span className="text-muted-foreground mx-1">•</span>
            )}
            {task.clients?.name && (
              <span className="text-muted-foreground">{task.clients.name}</span>
            )}
          </div>

          {(updatesCount > 0 || collaboratorsCount > 0) && (
            <div className="flex items-center gap-0.5 shrink-0">
              {updatesCount > 0 && (
                <MessageSquare className="h-2.5 w-2.5 text-muted-foreground" />
              )}
              {collaboratorsCount > 0 && (
                <Users className="h-2.5 w-2.5 text-muted-foreground" />
              )}
            </div>
          )}
        </div>

        {/* Resize handle at bottom */}
        <div
          onMouseDown={handleResizeStart}
          onTouchStart={handleResizeStart}
          className={cn(
            "absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize flex items-center justify-center",
            "opacity-0 group-hover:opacity-100 transition-opacity",
            "hover:bg-primary/20 rounded-b"
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <GripHorizontal className="h-2.5 w-2.5 text-muted-foreground" />
        </div>
      </div>
    );
  }

  // Non-compact (backlog) version - no resize handle
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={cn(
        "group flex items-start gap-2 p-2 rounded-lg border bg-card hover:bg-accent/50 cursor-pointer transition-all",
        isDragging && "opacity-50 shadow-lg z-50",
        isCompleted && "opacity-60"
      )}
    >
      <button
        {...attributes}
        {...listeners}
        className="mt-0.5 opacity-100 md:opacity-0 md:group-hover:opacity-100 cursor-grab active:cursor-grabbing transition-opacity touch-none"
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </button>
      
      <Checkbox
        checked={isCompleted}
        onCheckedChange={(checked) => {
          onToggleComplete(task.id, checked as boolean);
        }}
        onClick={(e) => e.stopPropagation()}
        className="mt-0.5"
      />
      
      <div className="flex-1 min-w-0" onClick={onClick}>
        <p
          className={cn(
            "text-sm font-medium leading-tight break-words",
            isCompleted && "line-through text-muted-foreground"
          )}
        >
          {task.title}
        </p>
        
        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
          {task.clients?.name && (
            <Badge variant="secondary" className="text-xs px-1.5 py-0 h-5">
              {task.clients.name}
            </Badge>
          )}
          
          {updatesCount > 0 && (
            <Badge variant="outline" className="text-xs px-1.5 py-0 h-5 gap-0.5">
              <MessageSquare className="h-3 w-3" />
              {updatesCount}
            </Badge>
          )}
          
          {collaboratorsCount > 0 && (
            <Badge variant="outline" className="text-xs px-1.5 py-0 h-5 gap-0.5">
              <Users className="h-3 w-3" />
              {collaboratorsCount}
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}