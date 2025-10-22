import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUserPermissions, ModulePermission } from "@/hooks/useUserPermissions";
import { useUserRole } from "@/hooks/useUserRole";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredPermission?: ModulePermission;
  redirectTo?: string;
}

export function ProtectedRoute({ children, requiredPermission, redirectTo = "/clients" }: ProtectedRouteProps) {
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const { hasPermission, isLoading: permissionsLoading } = useUserPermissions();
  const { roles, isLoading: rolesLoading } = useUserRole();

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

  // If user authenticated but has no roles in the system, force sign-out and block access
  useEffect(() => {
    if (authenticated && !rolesLoading && (!roles || roles.length === 0)) {
      supabase.auth.signOut();
    }
  }, [authenticated, rolesLoading, roles]);

  if (loading || permissionsLoading || rolesLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (authenticated && !rolesLoading && (!roles || roles.length === 0)) {
    return <Navigate to="/auth" replace />;
  }

  if (!authenticated) {
    return <Navigate to="/auth" replace />;
  }

  if (requiredPermission && !hasPermission(requiredPermission)) {
    return <Navigate to={redirectTo} replace />;
  }

  return <>{children}</>;
}
