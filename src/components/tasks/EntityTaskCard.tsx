import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, CheckCheck, CheckCircle2, Circle, Pencil, UserRound, Building2, Megaphone } from "lucide-react";
import { format } from "date-fns";
import { he } from "date-fns/locale";
import { describeTaskAssignment, type TaskAssignmentSource } from "@/lib/taskAssignment";
import { cn } from "@/lib/utils";

type EntityTask = TaskAssignmentSource & {
  id: string;
  title: string;
  priority: number;
  due_date?: string | null;
  notes?: string | null;
};

function priorityBadge(priority: number) {
  if (priority >= 8) return "גבוהה";
  if (priority >= 4) return "בינונית";
  return "נמוכה";
}

function priorityTone(priority: number) {
  if (priority >= 8) return "bg-red-50 border-red-200 text-red-700";
  if (priority >= 4) return "bg-yellow-50 border-yellow-200 text-yellow-700";
  return "bg-green-50 border-green-200 text-green-700";
}

export function EntityTaskCard({
  task,
  isCompleted,
  clientName,
  compact,
  tintByPriority,
  onEdit,
  onToggleComplete,
}: {
  task: EntityTask;
  isCompleted: boolean;
  clientName?: string;
  compact?: boolean;
  tintByPriority?: boolean;
  onEdit: () => void;
  onToggleComplete: (completed: boolean) => void;
}) {
  const labels = describeTaskAssignment(task, clientName);
  const related = labels.client || labels.lead;

  return (
    <Card
      className={cn(
        "cursor-pointer hover:shadow-md transition-shadow",
        tintByPriority && priorityTone(task.priority),
      )}
      onClick={onEdit}
    >
      <CardContent className={cn("space-y-2", compact ? "p-3" : "p-4")}>
        <div className="flex items-start justify-between gap-2">
          <h4 className="font-semibold text-sm flex-1">{task.title}</h4>
          <div className="flex items-center gap-1 shrink-0">
            {isCompleted ? (
              <Badge variant="outline" className={cn("bg-green-100 text-green-700 border-green-300", compact && "text-xs")}>
                <CheckCheck className="h-3 w-3 mr-1" />
                הושלמה
              </Badge>
            ) : (
              <Badge variant="outline" className={cn(compact ? "bg-blue-100 text-blue-700 border-blue-300 text-xs" : undefined)}>
                {compact ? priorityBadge(task.priority) : `דחיפות: ${priorityBadge(task.priority)}`}
              </Badge>
            )}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              aria-label="ערוך משימה"
              onClick={(event) => {
                event.stopPropagation();
                onEdit();
              }}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {labels.assignedTo && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Megaphone className="h-3 w-3 shrink-0" />
            שויכה ל: {labels.assignedTo}
          </div>
        )}
        {related && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Building2 className="h-3 w-3 shrink-0" />
            {labels.client ? `לקוח: ${labels.client}` : `ליד: ${labels.lead}`}
          </div>
        )}
        {labels.givenBy && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <UserRound className="h-3 w-3 shrink-0" />
            ניתנה על ידי {labels.givenBy}
          </div>
        )}

        {task.due_date && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3" />
            {format(new Date(task.due_date), "d בMMMM yyyy", { locale: he })}
          </div>
        )}

        {!compact && task.notes && (
          <p className="text-xs text-muted-foreground line-clamp-2">{task.notes}</p>
        )}

        <Button
          type="button"
          size="sm"
          variant="outline"
          className={cn("w-full mt-2", compact && "h-7 text-xs")}
          onClick={(event) => {
            event.stopPropagation();
            onToggleComplete(!isCompleted);
          }}
        >
          {isCompleted ? (
            <>
              <Circle className={cn(compact ? "h-3 w-3 mr-1" : "h-4 w-4 mr-2")} />
              פתח שוב
            </>
          ) : (
            <>
              <CheckCircle2 className={cn(compact ? "h-3 w-3 mr-1" : "h-4 w-4 mr-2")} />
              {compact ? "סיים" : "סיים משימה"}
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
