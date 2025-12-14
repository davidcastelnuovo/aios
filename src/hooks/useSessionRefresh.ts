import { useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Hook that proactively refreshes the session when the user returns to the app.
 * This prevents automatic logout due to expired tokens after inactivity.
 */
export function useSessionRefresh() {
  const refreshSession = useCallback(async () => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error("Session check error:", error);
        return;
      }

      if (session) {
        // Check if token expires within the next 5 minutes
        const expiresAt = session.expires_at;
        const now = Math.floor(Date.now() / 1000);
        const fiveMinutes = 5 * 60;

        if (expiresAt && expiresAt - now < fiveMinutes) {
          console.log("Session expiring soon, refreshing...");
          const { error: refreshError } = await supabase.auth.refreshSession();
          if (refreshError) {
            console.error("Session refresh error:", refreshError);
          } else {
            console.log("Session refreshed successfully");
          }
        }
      }
    } catch (err) {
      console.error("Session refresh failed:", err);
    }
  }, []);

  useEffect(() => {
    // Refresh on visibility change (user returns to tab)
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refreshSession();
      }
    };

    // Refresh on window focus
    const handleFocus = () => {
      refreshSession();
    };

    // Initial check
    refreshSession();

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);

    // Periodic check every 4 minutes
    const interval = setInterval(refreshSession, 4 * 60 * 1000);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
      clearInterval(interval);
    };
  }, [refreshSession]);
}
