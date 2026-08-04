import { Navigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useUserPermissions, ModulePermission } from "@/hooks/useUserPermissions";
import { useTenantPath } from "@/hooks/useTenantPath";
import { shouldShowQueryError } from "@/lib/queryUi";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

interface ModulePermissionGateProps {
  children: React.ReactNode;
  permission?: ModulePermission;
  redirectTo?: string;
}

/**
 * Lightweight permission check for nested tenant routes.
 * Auth is handled by TenantAppShell; this only gates module access.
 */
export function ModulePermissionGate({
  children,
  permission,
  redirectTo = "my-profile",
}: ModulePermissionGateProps) {
  const { hasPermission, isLoading, isFetching, isError } = useUserPermissions();
  const { buildPath } = useTenantPath();
  const queryClient = useQueryClient();

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 p-8">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-96" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mt-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      </div>
    );
  }

  if (shouldShowQueryError(isError, isFetching, isLoading)) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-12 text-center" dir="rtl">
        <p className="text-muted-foreground">לא הצלחנו לטעון את ההרשאות שלך. נסה שוב.</p>
        <Button
          variant="outline"
          onClick={() => queryClient.invalidateQueries({ queryKey: ["user-permissions"] })}
        >
          נסה שוב
        </Button>
      </div>
    );
  }

  if (permission && !hasPermission(permission)) {
    return <Navigate to={buildPath(redirectTo)} replace />;
  }

  return <>{children}</>;
}
