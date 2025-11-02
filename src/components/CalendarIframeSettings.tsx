import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { toast } from "sonner";
import { Calendar, Plus, Unplug } from "lucide-react";

export function CalendarIframeSettings() {
  const { userId } = useCurrentUser();
  const queryClient = useQueryClient();
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [eventSummary, setEventSummary] = useState("");
  const [eventDescription, setEventDescription] = useState("");
  const [eventStart, setEventStart] = useState("");
  const [eventEnd, setEventEnd] = useState("");

  // Check connection status
  const { data: connectionStatus, isLoading: statusLoading } = useQuery({
    queryKey: ["calendar-status", userId],
    queryFn: async () => {
      if (!userId) return null;
      
      const { data, error } = await supabase.functions.invoke('google-calendar-auth', {
        body: { action: 'status' }
      });

      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });

  // Connect to Google Calendar
  const connectMutation = useMutation({
    mutationFn: async () => {
      console.log('Starting Google Calendar connection...');
      const { data, error } = await supabase.functions.invoke('google-calendar-auth', {
        body: { action: 'init' }
      });

      console.log('Response from google-calendar-auth:', { data, error });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      console.log('Success! Auth URL:', data?.authUrl);
      if (data.authUrl) {
        const popup = window.open(data.authUrl, '_blank', 'width=600,height=700,noopener');
        if (!popup) {
          toast.error("אנא אפשר חלונות קופצים (popup) בדפדפן");
        } else {
          // Listen for the popup to close or send a message
          window.addEventListener('message', (event) => {
            if (event.data.type === 'calendar_connected') {
              console.log('Calendar connected successfully!');
              queryClient.invalidateQueries({ queryKey: ["calendar-status", userId] });
              toast.success("היומן מחובר בהצלחה!");
            }
          });
        }
      }
    },
    onError: (error) => {
      console.error("Error connecting calendar:", error);
      toast.error("שגיאה בהתחברות ללוח השנה: " + error.message);
    },
  });

  // Disconnect calendar
  const disconnectMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.functions.invoke('google-calendar-auth', {
        body: { action: 'disconnect' }
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar-status", userId] });
      toast.success("הלוח השנה נותק בהצלחה");
    },
    onError: (error) => {
      console.error("Error disconnecting calendar:", error);
      toast.error("שגיאה בניתוק לוח השנה");
    },
  });

  // Add event mutation
  const addEventMutation = useMutation({
    mutationFn: async (eventData: { summary: string; description?: string; start: string; end?: string }) => {
      const { data, error } = await supabase.functions.invoke('add-calendar-event', {
        body: eventData
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("האירוע נוסף בהצלחה ללוח השנה");
      setShowAddEvent(false);
      setEventSummary("");
      setEventDescription("");
      setEventStart("");
      setEventEnd("");
    },
    onError: (error: any) => {
      console.error("Error adding event:", error);
      toast.error(error.message || "שגיאה בהוספת אירוע");
    },
  });

  const handleAddEvent = () => {
    if (!eventSummary || !eventStart) {
      toast.error("יש למלא כותרת ותאריך התחלה");
      return;
    }

    // Convert datetime-local to ISO string
    const startISO = new Date(eventStart).toISOString();
    const endISO = eventEnd ? new Date(eventEnd).toISOString() : new Date(new Date(eventStart).getTime() + 60 * 60 * 1000).toISOString();

    addEventMutation.mutate({
      summary: eventSummary,
      description: eventDescription,
      start: startISO,
      end: endISO,
    });
  };

  if (statusLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Google Calendar
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">טוען...</p>
        </CardContent>
      </Card>
    );
  }

  const isConnected = connectionStatus?.connected;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Google Calendar
        </CardTitle>
        <CardDescription>
          חבר את Google Calendar שלך כדי להוסיף משימות ישירות ללוח השנה
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isConnected ? (
          <div className="text-center py-8 space-y-4">
            <p className="text-muted-foreground">
              חבר את חשבון Google שלך כדי להוסיף אירועים ישירות ללוח השנה
            </p>
            <Button 
              onClick={() => connectMutation.mutate()}
              disabled={connectMutation.isPending}
            >
              <Calendar className="h-4 w-4 ml-2" />
              התחבר ל-Google Calendar
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-green-600" />
                <span className="font-medium">מחובר ל-Google Calendar</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => disconnectMutation.mutate()}
                disabled={disconnectMutation.isPending}
              >
                <Unplug className="h-4 w-4 ml-2" />
                נתק
              </Button>
            </div>

            {!showAddEvent ? (
              <Button onClick={() => setShowAddEvent(true)} className="w-full">
                <Plus className="h-4 w-4 ml-2" />
                הוסף אירוע ללוח השנה
              </Button>
            ) : (
              <div className="space-y-4 p-4 border rounded-lg">
                <div className="space-y-2">
                  <Label htmlFor="event-summary">כותרת האירוע *</Label>
                  <Input
                    id="event-summary"
                    value={eventSummary}
                    onChange={(e) => setEventSummary(e.target.value)}
                    placeholder="פגישה עם לקוח"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="event-description">תיאור</Label>
                  <Input
                    id="event-description"
                    value={eventDescription}
                    onChange={(e) => setEventDescription(e.target.value)}
                    placeholder="פרטים נוספים..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="event-start">תאריך והשעה התחלה *</Label>
                    <Input
                      id="event-start"
                      type="datetime-local"
                      value={eventStart}
                      onChange={(e) => setEventStart(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="event-end">תאריך והשעה סיום</Label>
                    <Input
                      id="event-end"
                      type="datetime-local"
                      value={eventEnd}
                      onChange={(e) => setEventEnd(e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button 
                    onClick={handleAddEvent}
                    disabled={addEventMutation.isPending}
                  >
                    <Plus className="h-4 w-4 ml-2" />
                    הוסף אירוע
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setShowAddEvent(false);
                      setEventSummary("");
                      setEventDescription("");
                      setEventStart("");
                      setEventEnd("");
                    }}
                  >
                    ביטול
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
