import { useState, useCallback, useMemo } from "react";
import { Calendar, dateFnsLocalizer, Event as BigCalendarEvent } from "react-big-calendar";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { he } from "date-fns/locale";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, Trash2 } from "lucide-react";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";

const locales = {
  'he': he,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  description?: string;
  calendarName?: string;
  calendarColor?: string;
}

export function InteractiveCalendar() {
  const { userId } = useCurrentUser();
  const queryClient = useQueryClient();
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editSummary, setEditSummary] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");

  // Reconnect Google Calendar flow (opens popup)
  const handleReconnect = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('google-calendar-auth', {
        body: { action: 'init' },
      });
      if (error) throw error;

      const authUrl = (data as any)?.authUrl;
      if (!authUrl) throw new Error('לא נמצאה כתובת התחברות');

      const popup = window.open(authUrl, 'calendar-auth', 'width=600,height=700');
      // Listen for success from the callback
      const handler = (event: MessageEvent) => {
        if (event.data?.type === 'calendar_connected') {
          toast.success('היומן התחבר בהצלחה');
          popup?.close();
          // Refetch events after reconnect
          queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
          window.removeEventListener('message', handler);
        }
      };
      window.addEventListener('message', handler);
    } catch (e: any) {
      toast.error(`שגיאה בהתחברות ליומן: ${e?.message || ''}`);
    }
  };
  // Fetch events
  const { data: eventsData, isLoading, error } = useQuery({
    queryKey: ['calendar-events', userId],
    queryFn: async () => {
      const now = new Date();
      const oneMonthAgo = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const twoMonthsLater = new Date(now.getFullYear(), now.getMonth() + 2, 0);

      const { data, error } = await supabase.functions.invoke('get-calendar-events', {
        body: {
          timeMin: oneMonthAgo.toISOString(),
          timeMax: twoMonthsLater.toISOString(),
        }
      });

      if (error) throw error;
      return data;
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 2, // Cache for 2 minutes
    refetchOnWindowFocus: false, // Don't refetch on window focus
  });

  // Update event mutation
  const updateMutation = useMutation({
    mutationFn: async (params: { eventId: string; summary: string; description: string; start: string; end: string }) => {
      const { data, error } = await supabase.functions.invoke('update-calendar-event', {
        body: params
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('האירוע עודכן בהצלחה');
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
      setIsEditing(false);
      setSelectedEvent(null);
    },
    onError: (error: Error) => {
      toast.error('שגיאה בעדכון האירוע: ' + error.message);
    },
  });

  // Delete event mutation
  const deleteMutation = useMutation({
    mutationFn: async (eventId: string) => {
      const { data, error } = await supabase.functions.invoke('delete-calendar-event', {
        body: { eventId }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('האירוע נמחק בהצלחה');
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
      setSelectedEvent(null);
    },
    onError: (error: Error) => {
      toast.error('שגיאה במחיקת האירוע: ' + error.message);
    },
  });

  // Transform Google Calendar events to react-big-calendar format
  const events: CalendarEvent[] = useMemo(() => {
    if (!eventsData?.events) return [];
    return (
      eventsData.events
        .map((event: any) => {
          const startStr = event?.start?.dateTime || event?.start?.date;
          const endStr = event?.end?.dateTime || event?.end?.date;
          if (!startStr) return null;
          const start = new Date(startStr);
          let end = endStr ? new Date(endStr) : new Date(start.getTime() + 60 * 60 * 1000);
          if (isNaN(start.getTime())) return null;
          if (isNaN(end.getTime()) || end <= start) {
            end = new Date(start.getTime() + 60 * 60 * 1000);
          }
          return {
            id: event.id,
            title: event.summary || 'ללא כותרת',
            start,
            end,
            description: event.description || '',
            calendarName: event.calendarName,
            calendarColor: event.calendarColor,
          } as CalendarEvent;
        })
        .filter(Boolean) as CalendarEvent[]
    );
  }, [eventsData]);

  const calendars = useMemo(() => {
    return eventsData?.calendars || [];
  }, [eventsData]);

  const handleSelectEvent = useCallback((event: CalendarEvent) => {
    setSelectedEvent(event);
    setEditSummary(event.title as string);
    setEditDescription(event.description || '');
    setEditStart(format(event.start, "yyyy-MM-dd'T'HH:mm"));
    setEditEnd(format(event.end, "yyyy-MM-dd'T'HH:mm"));
  }, []);

  const handleUpdateEvent = () => {
    if (!selectedEvent || !editSummary || !editStart) {
      toast.error('נא למלא את כל השדות הנדרשים');
      return;
    }

    updateMutation.mutate({
      eventId: selectedEvent.id,
      summary: editSummary,
      description: editDescription,
      start: new Date(editStart).toISOString(),
      end: new Date(editEnd).toISOString(),
    });
  };

  const handleDeleteEvent = () => {
    if (!selectedEvent) return;
    if (window.confirm('האם אתה בטוח שברצונך למחוק את האירוע?')) {
      deleteMutation.mutate(selectedEvent.id);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {calendars.length > 0 && (
        <Alert>
          <AlertTitle>יומנים מחוברים ({calendars.length})</AlertTitle>
          <AlertDescription>
            <div className="flex flex-wrap gap-2 mt-2">
              {calendars.map((cal: any) => (
                <div 
                  key={cal.id} 
                  className="flex items-center gap-2 px-3 py-1 rounded-full border bg-background"
                  style={{ borderColor: cal.color }}
                >
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: cal.color }}
                  />
                  <span className="text-sm">{cal.name}</span>
                </div>
              ))}
            </div>
          </AlertDescription>
        </Alert>
      )}
      {(error as any)?.message && (((error as any).message || '').includes('invalid_grant') || ((error as any).message || '').includes('401')) && (
        <Alert>
          <AlertTitle>נדרש להתחבר מחדש ליומן</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-2">
            חיבור Google Calendar פג תוקף או בוטל. התחברו מחדש כדי להציג אירועים.
            <Button size="sm" onClick={handleReconnect}>התחברות מחדש</Button>
          </AlertDescription>
        </Alert>
      )}
      <div className="bg-background rounded-lg border p-2 md:p-4 overflow-hidden" style={{ height: 'calc(100vh - 200px)', minHeight: 500, maxHeight: 800 }}>
        <Calendar
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          onSelectEvent={handleSelectEvent}
          views={['month', 'week', 'day']}
          defaultView="week"
          rtl
          messages={{
            next: 'הבא',
            previous: 'הקודם',
            today: 'היום',
            month: 'חודש',
            week: 'שבוע',
            day: 'יום',
            agenda: 'סדר יום',
            date: 'תאריך',
            time: 'שעה',
            event: 'אירוע',
            noEventsInRange: 'אין אירועים בטווח זה',
          }}
        />
      </div>

      <Dialog open={selectedEvent !== null && !isEditing} onOpenChange={() => setSelectedEvent(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedEvent?.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {selectedEvent?.calendarName && (
              <div>
                <Label>יומן</Label>
                <div className="flex items-center gap-2 mt-1">
                  {selectedEvent.calendarColor && (
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: selectedEvent.calendarColor }}
                    />
                  )}
                  <p className="text-sm">{selectedEvent.calendarName}</p>
                </div>
              </div>
            )}
            {selectedEvent?.description && (
              <div>
                <Label>תיאור</Label>
                <p className="text-sm text-muted-foreground">{selectedEvent.description}</p>
              </div>
            )}
            <div>
              <Label>התחלה</Label>
              <p className="text-sm">{selectedEvent?.start && format(selectedEvent.start, 'dd/MM/yyyy HH:mm')}</p>
            </div>
            <div>
              <Label>סיום</Label>
              <p className="text-sm">{selectedEvent?.end && format(selectedEvent.end, 'dd/MM/yyyy HH:mm')}</p>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="destructive" onClick={handleDeleteEvent} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : <Trash2 className="h-4 w-4 ml-2" />}
              מחק אירוע
            </Button>
            <Button onClick={() => setIsEditing(true)}>
              ערוך אירוע
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditing} onOpenChange={() => setIsEditing(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>עריכת אירוע</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-summary">כותרת *</Label>
              <Input
                id="edit-summary"
                value={editSummary}
                onChange={(e) => setEditSummary(e.target.value)}
                placeholder="כותרת האירוע"
              />
            </div>
            <div>
              <Label htmlFor="edit-description">תיאור</Label>
              <Textarea
                id="edit-description"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="תיאור האירוע"
              />
            </div>
            <div>
              <Label htmlFor="edit-start">תאריך ושעת התחלה *</Label>
              <Input
                id="edit-start"
                type="datetime-local"
                value={editStart}
                onChange={(e) => setEditStart(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="edit-end">תאריך ושעת סיום *</Label>
              <Input
                id="edit-end"
                type="datetime-local"
                value={editEnd}
                onChange={(e) => setEditEnd(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditing(false)}>
              ביטול
            </Button>
            <Button onClick={handleUpdateEvent} disabled={updateMutation.isPending}>
              {updateMutation.isPending && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
              שמור שינויים
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
