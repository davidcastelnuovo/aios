import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

// Who may open the Carmen Command Center. Temporary allowlist until per-user
// API keys land (then every user brings their own key and the gate opens).
// Mirrored server-side in supabase/functions/carmen-realtime-session.
export const COMMAND_CENTER_ALLOWLIST = ["david.castelnuovo@gmail.com"];

export function useCommandCenterAccess(): { allowed: boolean; loading: boolean } {
  const [state, setState] = useState({ allowed: false, loading: true });
  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return;
      const email = data.user?.email?.toLowerCase() ?? "";
      setState({ allowed: COMMAND_CENTER_ALLOWLIST.includes(email), loading: false });
    }).catch(() => { if (mounted) setState({ allowed: false, loading: false }); });
    return () => { mounted = false; };
  }, []);
  return state;
}
