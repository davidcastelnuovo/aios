import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useUserRole() {
  const { data: session } = useQuery({
    queryKey: ["session"],
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      return data.session;
    },
  });

  const { data: userRole, isLoading } = useQuery({
    queryKey: ["user-role", session?.user?.id],
    queryFn: async () => {
      if (!session?.user?.id) return null;

      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (error) {
        console.error("Error fetching user role:", error);
        return "user";
      }

      return data?.role || "user";
    },
    enabled: !!session?.user?.id,
  });

  return {
    role: userRole as "admin" | "user" | null,
    isAdmin: userRole === "admin",
    isUser: userRole === "user",
    isLoading,
    userId: session?.user?.id,
  };
}
