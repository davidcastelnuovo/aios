import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTenant } from "@/contexts/TenantContext";
import { checkCalendarConnection } from "@/lib/calendarApi";
import { listenForUnifiedConnection, openUnifiedCalendarConnection } from "@/lib/unifiedCalendarConnection";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarIcon, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function CalendarView() {
  const { currentTenantId } = useTenant();

  const { data: calendarStatus, isLoading } = useQuery({
    queryKey: ["calendar-status", currentTenantId],
    queryFn: async () => {
      if (!currentTenantId) return { connected: false, type: 'none' as const };
      return await checkCalendarConnection({ tenantId: currentTenantId });
    },
    enabled: !!currentTenantId,
  });

  const listenerCleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => listenerCleanupRef.current?.();
  }, []);

  const handleConnect = async () => {
    if (!currentTenantId) return;

    try {
      listenerCleanupRef.current?.();
      listenerCleanupRef.current = listenForUnifiedConnection(() => {
        listenerCleanupRef.current = null;
        window.location.reload();
      });

      await openUnifiedCalendarConnection({ tenantId: currentTenantId });
    } catch (error) {
      listenerCleanupRef.current?.();
      listenerCleanupRef.current = null;
      console.error("Error connecting calendar:", error);
      alert((error as Error).message || 'שגיאה בהתחברות ליומן. אנא נסה שוב.');
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-[600px]">
        <div>טוען...</div>
      </div>
    );
  }

  if (!calendarStatus?.connected) {
    return (
      <Card className="shadow-card">
        <CardContent className="flex flex-col items-center justify-center py-12 space-y-4">
          <CalendarIcon className="h-16 w-16 text-muted-foreground" />
          <h3 className="text-xl font-semibold">התחבר ליומן</h3>
          <p className="text-muted-foreground text-center max-w-md">
            כדי לצפות ביומן שלך, עליך לחבר תחילה את Google Calendar דרך Unified
          </p>
          <Button onClick={handleConnect} size="lg">
            <CalendarIcon className="mr-2 h-5 w-5" />
            התחבר דרך Unified
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          היומן מחובר. כאן תוכל לצפות ביומן שלך בעתיד.
        </AlertDescription>
      </Alert>

      <Card className="shadow-card">
        <CardContent className="p-6">
          <iframe
            src={`https://calendar.google.com/calendar/embed?src=primary&mode=WEEK&showTitle=0&showNav=1&showDate=1&showPrint=0&showTabs=1&showCalendars=0&showTz=0&hl=he`}
            className="w-full h-[600px] border-0 rounded-lg"
            title="Google Calendar"
            referrerPolicy="no-referrer"
          />
        </CardContent>
      </Card>
    </div>
  );
}
