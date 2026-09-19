import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Keeps the React Query session cache aligned with Supabase auth (localStorage).
 * Mount once at the app root so restored sessions are visible before route guards run.
 */
export function useAuthSessionSync() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      queryClient.setQueryData(["session"], session);
      queryClient.setQueryData(["session-ready"], true);
    });

    void supabase.auth.getSession().then(({ data: { session } }) => {
      queryClient.setQueryData(["session"], session);
      queryClient.setQueryData(["session-ready"], true);
    });

    return () => subscription.unsubscribe();
  }, [queryClient]);
}
