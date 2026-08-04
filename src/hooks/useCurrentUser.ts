import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useCurrentUser() {
  const { data: session, isPending } = useQuery({
    queryKey: ["session"],
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      return data.session;
    },
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  return {
    userId: session?.user?.id,
    user: session?.user,
    isLoading: isPending,
  };
}
