import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

type AppRole = "admin" | "user" | "owner" | "agency_manager";

export function useUserRole() {
  const { data: session } = useQuery({
    queryKey: ["session"],
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      return data.session;
    },
  });

  const { data: rolesData, isLoading } = useQuery({
    queryKey: ["user-roles", session?.user?.id],
    queryFn: async () => {
      if (!session?.user?.id) return [] as AppRole[];

      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id);

      if (error) {
        console.error("Error fetching user roles:", error);
        return ["user"] as AppRole[];
      }

      const roles = (data?.map((r: { role: AppRole }) => r.role) ?? []) as AppRole[];
      return roles.length ? roles : (["user"] as AppRole[]);
    },
    enabled: !!session?.user?.id,
  });

  const roles = rolesData ?? ([] as AppRole[]);
  const isAdmin = roles.includes("admin");
  const isOwner = roles.includes("owner");
  const isAgencyManager = roles.includes("agency_manager");
  const isUser = roles.includes("user") || roles.length === 0;

  const primaryRole: AppRole =
    (isAdmin && "admin") ||
    (isOwner && "owner") ||
    (isAgencyManager && "agency_manager") ||
    "user";

  return {
    role: primaryRole,
    roles,
    isAdmin,
    isOwner,
    isAgencyManager,
    isUser,
    isLoading,
    userId: session?.user?.id,
  };
}

