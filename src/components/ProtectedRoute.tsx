import { useEffect, useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUserPermissions, ModulePermission } from "@/hooks/useUserPermissions";
import { useUserRole } from "@/hooks/useUserRole";
import { useTenantPath } from "@/hooks/useTenantPath";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredPermission?: ModulePermission;
  redirectTo?: string;
}

export function ProtectedRoute({ children, requiredPermission, redirectTo = "my-profile" }: ProtectedRouteProps) {
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const { hasPermission, isLoading: permissionsLoading } = useUserPermissions();
  const { roles, isLoading: rolesLoading } = useUserRole();
  const { buildPath } = useTenantPath();
  const { tenantSlug } = useParams();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setAuthenticated(!!session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthenticated(!!session);
    });

    return () => subscription.unsubscribe();
  }, []);


  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // If not authenticated, redirect to auth
  if (!authenticated) {
    return <Navigate to="/auth" replace />;
  }

  // Only wait on permissions/roles once we know the user is authenticated
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
