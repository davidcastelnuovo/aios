import { useEffect, useState } from "react";
import { Navigate, useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUserPermissions, ModulePermission } from "@/hooks/useUserPermissions";
import { useUserRole } from "@/hooks/useUserRole";
import { useTenantPath } from "@/hooks/useTenantPath";
import { resolveTenantSlug } from "@/hooks/useResolveTenant";
import { useCurrentUser } from "@/hooks/useCurrentUser";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredPermission?: ModulePermission;
  redirectTo?: string;
}

export function ProtectedRoute({ children, requiredPermission, redirectTo = "my-profile" }: ProtectedRouteProps) {
  // Use the cached session from React Query (useCurrentUser) to avoid a blocking
  // async getSession() call on every navigation — this removes the per-route spinner flash.
  const { userId, isLoading: sessionLoading } = useCurrentUser();
  const authenticated = !sessionLoading && !!userId;

  const { hasPermission, isLoading: permissionsLoading } = useUserPermissions();
  const { roles, isLoading: rolesLoading } = useUserRole();
  const { buildPath } = useTenantPath();
  const { tenantSlug } = useParams();
  const navigate = useNavigate();
  const [resolvingTenant, setResolvingTenant] = useState(false);

  // If user is authenticated but URL lacks tenant slug, resolve and redirect
  useEffect(() => {
    const goToTenant = async () => {
      if (!authenticated || tenantSlug || resolvingTenant) return;
      setResolvingTenant(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const slug = await resolveTenantSlug(user.id);
        if (slug) {
          const { data: roleData } = await (supabase as any)
            .from("user_roles")
            .select("role")
            .eq("user_id", user.id)
            .in("role", ["owner", "admin"])
            .maybeSingle();

          const landingPage = roleData ? "dashboard" : "my-profile";
          navigate(`/t/${slug}/${landingPage}`, { replace: true });
        }
      }
      setResolvingTenant(false);
    };
    goToTenant();
  }, [authenticated, tenantSlug, navigate, resolvingTenant]);

  // Show spinner only while the cached session is resolving (usually instant on repeat visits)
  if (sessionLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!authenticated) {
    return <Navigate to="/auth" replace />;
  }

  if (permissionsLoading || rolesLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (requiredPermission && !hasPermission(requiredPermission)) {
    return <Navigate to={buildPath(redirectTo)} replace />;
  }

  return <>{children}</>;
}
