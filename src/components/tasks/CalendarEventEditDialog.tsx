import { useState, useEffect } from "react";
import { format, parseISO, differenceInMinutes } from "date-fns";
import { he } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar, Clock, Trash2, ListTodo } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  description?: string;
  colorId?: string;
  calendarId?: string;
}

interface CalendarEventEditDialogProps {
  event: CalendarEvent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (eventId: string, data: {
    summary: string;
    description: string;
    start: string;
    end: string;
  }) => void;
  onDelete: (eventId: string) => void;
  onCreateTask?: (data: {
    title: string;
    notes: string;
    dueDate: string;
    dueTime: string;
    durationMinutes: number;
  }) => void;
  isLoading?: boolean;
}

export function CalendarEventEditDialog({
  event,
  open,
  onOpenChange,
  onSave,
  onDelete,
  onCreateTask,
  isLoading,
}: CalendarEventEditDialogProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("");

  useEffect(() => {
    if (event) {
      setTitle(event.title || "");
      setDescription(event.description || "");
      
      try {
        const start = parseISO(event.start);
        const end = parseISO(event.end);
        setStartDate(format(start, "yyyy-MM-dd"));
        setStartTime(format(start, "HH:mm"));
        setEndDate(format(end, "yyyy-MM-dd"));
        setEndTime(format(end, "HH:mm"));
      } catch {
        setStartDate("");
        setStartTime("");
        setEndDate("");
        setEndTime("");
      }
    }
  }, [event]);

  const handleSave = () => {
    if (!event) return;
    
    const startDateTime = `${startDate}T${startTime}:00`;
    const endDateTime = `${endDate}T${endTime}:00`;
    
    onSave(event.id, {
      summary: title,
      description,
      start: startDateTime,
      end: endDateTime,
    });
  };

  const handleDelete = () => {
    if (!event) return;
    onDelete(event.id);
  };

  const handleCreateTask = () => {
    if (!event || !onCreateTask) return;
    
    try {
      const start = parseISO(event.start);
      const end = parseISO(event.end);
      const durationMinutes = differenceInMinutes(end, start);
      
      onCreateTask({
        title,
        notes: description,
        dueDate: startDate,
        dueTime: startTime,
        durationMinutes: durationMinutes > 0 ? durationMinutes : 30,
      });
      onOpenChange(false);
    } catch {
      // Use current form values if parsing fails
      onCreateTask({
        title,
        notes: description,
        dueDate: startDate,
        dueTime: startTime,
        durationMinutes: 30,
      });
      onOpenChange(false);
    }
  };

  if (!event) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            עריכת אירוע יומן
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">כותרת</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="כותרת האירוע"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">תיאור</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="תיאור האירוע (אופציונלי)"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">תאריך התחלה</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="startTime">שעת התחלה</Label>
              <Input
                id="startTime"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="endDate">תאריך סיום</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endTime">שעת סיום</Label>
              <Input
                id="endTime"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>
        </div>

        <DialogFooter className="flex justify-between sm:justify-between">
          <div className="flex gap-2">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" className="gap-1">
                  <Trash2 className="h-4 w-4" />
                  מחק
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent dir="rtl">
                <AlertDialogHeader>
                  <AlertDialogTitle>האם למחוק את האירוע?</AlertDialogTitle>
                  <AlertDialogDescription>
                    פעולה זו תמחק את האירוע מיומן Google שלך ולא ניתן יהיה לשחזר אותו.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>ביטול</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete}>מחק</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            
            {onCreateTask && (
              <Button variant="outline" size="sm" className="gap-1" onClick={handleCreateTask}>
                <ListTodo className="h-4 w-4" />
                צור משימה
              </Button>
            )}
          </div>
          
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              ביטול
            </Button>
            <Button onClick={handleSave} disabled={isLoading}>
              {isLoading ? "שומר..." : "שמור"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
