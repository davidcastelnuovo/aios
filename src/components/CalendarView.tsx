import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarIcon, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function CalendarView() {
  const { data: calendarStatus, isLoading } = useQuery({
    queryKey: ["calendar-status"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { connected: false };

      const { data, error } = await supabase
        .from("calendar_tokens")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        console.error("Error checking calendar status:", error);
        return { connected: false };
      }

      return { connected: !!data };
    },
  });

  const handleConnect = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("google-calendar-auth", {
        body: { action: "init" },
      });

      if (error) throw error;

      if (data.authUrl) {
        window.location.href = data.authUrl;
      }
    } catch (error) {
      console.error("Error connecting calendar:", error);
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
          <h3 className="text-xl font-semibold">התחבר ליומן Google</h3>
          <p className="text-muted-foreground text-center max-w-md">
            כדי לצפות ביומן שלך, עליך להתחבר תחילה ל-Google Calendar
          </p>
          <Button onClick={handleConnect} size="lg">
            <CalendarIcon className="mr-2 h-5 w-5" />
            התחבר ל-Google Calendar
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
          היומן מחובר ל-Google Calendar שלך. כאן תוכל לצפות ביומן שלך בעתיד.
        </AlertDescription>
      </Alert>

      <Card className="shadow-card">
        <CardContent className="p-6">
          <iframe
            src={`https://calendar.google.com/calendar/embed?src=primary&mode=WEEK&showTitle=0&showNav=1&showDate=1&showPrint=0&showTabs=1&showCalendars=0&showTz=0&hl=he`}
            className="w-full h-[600px] border-0 rounded-lg"
            title="Google Calendar"
          />
        </CardContent>
      </Card>
    </div>
  );
}
