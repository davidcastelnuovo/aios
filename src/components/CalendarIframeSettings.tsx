import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import {
  checkCalendarConnection,
  addCalendarEvent,
  initDirectGoogleAuth,
  disconnectDirectGoogleCalendar,
  CalendarProvider,
} from "@/lib/calendarApi";
import { findUnifiedCalendarConnectionId, listenForUnifiedConnection, openUnifiedCalendarConnection } from "@/lib/unifiedCalendarConnection";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Calendar, Plus, Unplug, Loader2, ArrowRightLeft } from "lucide-react";
import { InteractiveCalendar } from "./InteractiveCalendar";
import { Switch } from "@/components/ui/switch";

const PROVIDER_STORAGE_KEY = "calendar_provider_mode";

export function CalendarIframeSettings() {
  const { userId, user } = useCurrentUser();
  const { tenantId } = useCurrentTenant();
  const queryClient = useQueryClient();
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [eventSummary, setEventSummary] = useState("");
  const [eventDescription, setEventDescription] = useState("");
  const [eventStart, setEventStart] = useState("");
  const [eventEnd, setEventEnd] = useState("");

  // Provider toggle state
  const [provider, setProvider] = useState<CalendarProvider>(() => {
    return (localStorage.getItem(PROVIDER_STORAGE_KEY) as CalendarProvider) || "direct";
  });

  const calendarRef = useRef<HTMLDivElement | null>(null);
  const listenerCleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => listenerCleanupRef.current?.();
  }, []);

  const handleProviderChange = (useUnified: boolean) => {
    const newProvider: CalendarProvider = useUnified ? "unified" : "direct";
    setProvider(newProvider);
    localStorage.setItem(PROVIDER_STORAGE_KEY, newProvider);
    queryClient.invalidateQueries({ queryKey: ["calendar-status"] });
    queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
  };

  // Check connection status
  const { data: connectionStatus, isLoading: statusLoading } = useQuery({
    queryKey: ["calendar-status", userId, tenantId, provider],
    queryFn: async () => {
      if (!userId || !tenantId) return null;
      return await checkCalendarConnection({ tenantId, provider });
    },
    enabled: !!userId && !!tenantId,
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  // Connect – Unified
  const connectUnifiedMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId) throw new Error("לא נמצא ארגון פעיל.");
      listenerCleanupRef.current?.();
      listenerCleanupRef.current = listenForUnifiedConnection(() => {
        listenerCleanupRef.current = null;
        queryClient.invalidateQueries({ queryKey: ["calendar-status"] });
        queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
        toast.success("היומן חובר בהצלחה דרך Unified!");
      });
      await openUnifiedCalendarConnection({ tenantId });
    },
    onError: (error) => {
      listenerCleanupRef.current?.();
      listenerCleanupRef.current = null;
      toast.error("שגיאה בהתחברות: " + (error as Error).message);
    },
  });

  // Connect – Direct Google
  const connectDirectMutation = useMutation({
    mutationFn: async () => {
      const { authUrl } = await initDirectGoogleAuth();
      // Open popup for OAuth
      const popup = window.open(authUrl, "google-calendar-auth", "width=600,height=700");
      return new Promise<void>((resolve, reject) => {
        const handler = (event: MessageEvent) => {
          if (event.data?.type === "calendar_connected") {
            window.removeEventListener("message", handler);
            queryClient.invalidateQueries({ queryKey: ["calendar-status"] });
            queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
            toast.success("היומן חובר בהצלחה ישירות לגוגל!");
            resolve();
          }
        };
        window.addEventListener("message", handler);
        // Timeout after 5 minutes
        setTimeout(() => {
          window.removeEventListener("message", handler);
          reject(new Error("Timeout"));
        }, 5 * 60 * 1000);
      });
    },
    onError: (error) => {
      toast.error("שגיאה בהתחברות ישירה לגוגל: " + (error as Error).message);
    },
  });

  // Disconnect – Unified
  const disconnectUnifiedMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId) throw new Error("לא נמצא ארגון פעיל.");
      const integrationId = await findUnifiedCalendarConnectionId(tenantId);
      if (!integrationId) throw new Error("לא נמצא חיבור יומן פעיל לניתוק.");
      const { error } = await supabase.functions.invoke("unified-connections", {
        body: { action: "delete", tenant_id: tenantId, connection_id: integrationId },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar-status"] });
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
      toast.success("הלוח השנה נותק בהצלחה");
    },
    onError: (error) => {
      toast.error("שגיאה בניתוק: " + (error as Error).message);
    },
  });

  // Disconnect – Direct Google
  const disconnectDirectMutation = useMutation({
    mutationFn: async () => {
      await disconnectDirectGoogleCalendar();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar-status"] });
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
      toast.success("הלוח השנה נותק בהצלחה");
    },
    onError: (error) => {
      toast.error("שגיאה בניתוק: " + (error as Error).message);
    },
  });

  // Add event mutation
  const addEventMutation = useMutation({
    mutationFn: async (eventData: { summary: string; description?: string; start: string; end?: string }) => {
      if (!tenantId) throw new Error("No tenant");
      return await addCalendarEvent(eventData, { tenantId, provider });
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
      toast.error(error.message || "שגיאה בהוספת אירוע");
    },
  });

  const handleAddEvent = () => {
    if (!eventSummary || !eventStart) {
      toast.error("יש למלא כותרת ותאריך התחלה");
      return;
    }
    const startISO = new Date(eventStart).toISOString();
    const endISO = eventEnd
      ? new Date(eventEnd).toISOString()
      : new Date(new Date(eventStart).getTime() + 60 * 60 * 1000).toISOString();
    addEventMutation.mutate({ summary: eventSummary, description: eventDescription, start: startISO, end: endISO });
  };

  const isConnected = connectionStatus?.connected === true;
  const isConnecting = provider === "unified" ? connectUnifiedMutation.isPending : connectDirectMutation.isPending;
  const isDisconnecting = provider === "unified" ? disconnectUnifiedMutation.isPending : disconnectDirectMutation.isPending;

  useEffect(() => {
    if (isConnected && calendarRef.current) {
      calendarRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [isConnected]);

  const handleConnect = () => {
    if (provider === "unified") {
      connectUnifiedMutation.mutate();
    } else {
      connectDirectMutation.mutate();
    }
  };

  const handleDisconnect = () => {
    if (provider === "unified") {
      disconnectUnifiedMutation.mutate();
    } else {
      disconnectDirectMutation.mutate();
    }
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Google Calendar
        </CardTitle>
        <CardDescription>
          {provider === "direct"
            ? "חבר את Google Calendar שלך ישירות דרך גוגל"
            : "חבר את Google Calendar שלך דרך Unified"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Provider Toggle */}
        <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
          <div className="flex items-center gap-2">
            <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">שיטת חיבור:</span>
            <span className="text-sm text-muted-foreground">
              {provider === "direct" ? "ישירות לגוגל" : "דרך Unified"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">גוגל ישיר</span>
            <Switch
              checked={provider === "unified"}
              onCheckedChange={handleProviderChange}
              disabled={isConnected}
            />
            <span className="text-xs text-muted-foreground">Unified</span>
          </div>
        </div>

        {isConnected && (
          <p className="text-xs text-muted-foreground text-center">
            כדי להחליף שיטת חיבור, נתק קודם את היומן הנוכחי.
          </p>
        )}

        {!isConnected ? (
          <div className="text-center py-8 space-y-4">
            <p className="text-muted-foreground">
              {provider === "direct"
                ? "חבר את חשבון Google שלך ישירות כדי להוסיף אירועים ללוח השנה"
                : "חבר את חשבון Google שלך דרך Unified כדי להוסיף אירועים ללוח השנה"}
            </p>
            <Button onClick={handleConnect} disabled={isConnecting}>
              {isConnecting && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
              <Calendar className="h-4 w-4 ml-2" />
              {provider === "direct" ? "התחבר ישירות לגוגל" : "התחבר דרך Unified"}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <Alert>
              <Calendar className="h-4 w-4" />
              <AlertDescription>
                היומן שלך מחובר בהצלחה{" "}
                {connectionStatus?.type === "direct"
                  ? `ישירות לגוגל${connectionStatus.google_email ? ` (${connectionStatus.google_email})` : ""}`
                  : "דרך Unified"}
                . תוכל להוסיף, לערוך ולמחוק אירועים מכאן.
              </AlertDescription>
            </Alert>

            <div className="flex gap-2">
              <Button variant="destructive" onClick={handleDisconnect} disabled={isDisconnecting}>
                {isDisconnecting && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
                <Unplug className="h-4 w-4 ml-2" />
                נתק יומן
              </Button>
            </div>

            {/* Interactive Calendar */}
            <div ref={calendarRef} className="space-y-2">
              <h3 className="text-base font-semibold">היומן שלי</h3>
              <InteractiveCalendar />
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
                    <Input id="event-start" type="datetime-local" value={eventStart} onChange={(e) => setEventStart(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="event-end">תאריך והשעה סיום</Label>
                    <Input id="event-end" type="datetime-local" value={eventEnd} onChange={(e) => setEventEnd(e.target.value)} />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleAddEvent} disabled={addEventMutation.isPending}>
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
