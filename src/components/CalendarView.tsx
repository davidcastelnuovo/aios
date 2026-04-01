import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { checkCalendarConnection } from "@/lib/calendarApi";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarIcon, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useRef } from "react";

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

  const popupRef = useRef<Window | null>(null);

  const handleConnect = async () => {
    try {
      // Pre-open a blank popup to avoid popup blockers
      try {
        popupRef.current = window.open('', 'google-calendar-auth', 'width=600,height=700,left=100,top=100,noopener,noreferrer');
      } catch {}

      const { data, error } = await supabase.functions.invoke("google-calendar-auth", {
        body: { action: "init" },
      });

      if (error) throw error;

      if (data?.authUrl) {
        if (popupRef.current && !popupRef.current.closed) {
          popupRef.current.location.href = data.authUrl;
        } else {
          const popup = window.open(
            data.authUrl,
            'google-calendar-auth',
            'width=600,height=700,left=100,top=100,noopener,noreferrer'
          );
          if (!popup) {
            alert('חלון הקופץ נחסם. אנא אפשר חלונות קופצים עבור אתר זה.');
            return;
          }
          popupRef.current = popup;
        }

        const messageHandler = (event: MessageEvent) => {
          if (event.data?.type === 'calendar_connected') {
            window.removeEventListener('message', messageHandler);
            window.location.reload();
            try { popupRef.current?.close(); } catch {}
            popupRef.current = null;
          }
        };
        window.addEventListener('message', messageHandler);
      } else {
        alert('לא התקבל קישור התחברות מהשרת. נסה שוב.');
        try { popupRef.current?.close(); } catch {}
        popupRef.current = null;
      }
    } catch (error) {
      console.error("Error connecting calendar:", error);
      alert('שגיאה בהתחברות ליומן. אנא נסה שוב.');
      try { popupRef.current?.close(); } catch {}
      popupRef.current = null;
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
            כדי לצפות ביומן שלך, עליך להתחבר תחילה ליומן דרך הגדרות האינטגרציות או ישירות ל-Google Calendar
          </p>
          <Button onClick={handleConnect} size="lg">
            <CalendarIcon className="mr-2 h-5 w-5" />
            התחבר ליומן
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
