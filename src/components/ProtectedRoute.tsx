import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: ("admin" | "user" | "owner" | "agency_manager")[];
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const { role, roles, isLoading: roleLoading, isUser } = useUserRole();

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

  if (loading || roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!authenticated) {
    return <Navigate to="/auth" replace />;
  }

  // Check if role restrictions are specified and if user has required role
  if (allowedRoles && roles && roles.length > 0) {
    const hasAllowedRole = roles.some(userRole => allowedRoles.includes(userRole));
    if (!hasAllowedRole) {
      // Regular users should go to their profile, others to tasks
      if (isUser && roles.length === 1 && roles[0] === "user") {
        return <Navigate to="/my-profile" replace />;
      }
      return <Navigate to="/tasks" replace />;
    }
  }

  return <>{children}</>;
}