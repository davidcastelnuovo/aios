import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Building2, Users, Settings } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AddTenantForm } from "@/components/forms/AddTenantForm";
import { useUserRole } from "@/hooks/useUserRole";

export default function Tenants() {
  const { toast } = useToast();
  const [selectedTenant, setSelectedTenant] = useState<string | null>(null);
  const { isSuperAdmin, isOwner } = useUserRole();
  const canManageTenants = isSuperAdmin || isOwner;

  const { data: tenants, isLoading } = useQuery({
    queryKey: ["tenants"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenants")
        .select("*, parent:tenants!parent_tenant_id(name)")
        .order("name");
      
      if (error) throw error;
      return data;
    },
  });

  const { data: currentTenant } = useQuery({
    queryKey: ["current-tenant"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from("tenant_users")
        .select("tenant_id, tenants(name)")
        .eq("user_id", user.id)
        .single();
      
      if (error) throw error;
      return data;
    },
  });

  const handleTenantClick = async (tenantId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast({
        title: "שגיאה",
        description: "יש להתחבר למערכת",
        variant: "destructive",
      });
      return;
    }

    // Super admins can access any tenant
    if (isSuperAdmin) {
      localStorage.setItem("selectedTenantId", tenantId);
      window.location.reload();
      return;
    }

    // Check if user has access to this tenant
    const { data: access } = await supabase
      .from("tenant_users")
      .select("*")
      .eq("user_id", user.id)
      .eq("tenant_id", tenantId)
      .single();

    if (!access) {
      toast({
        title: "אין הרשאה",
        description: "אין לך גישה לארגון זה",
        variant: "destructive",
      });
      return;
    }

    // Store selected tenant in localStorage for app to use
    localStorage.setItem("selectedTenantId", tenantId);
    
    // Reload to apply tenant context
    window.location.reload();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6 p-3 md:p-6">
      {/* Mobile Header */}
      <div className="block md:hidden space-y-3">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Building2 className="h-6 w-6" />
          ניהול ארגונים
        </h1>
        {currentTenant && (
          <p className="text-sm text-muted-foreground">
            ארגון נוכחי: <strong>{(currentTenant as any).tenants.name}</strong>
          </p>
        )}
        {canManageTenants && <AddTenantForm />}
      </div>

      {/* Desktop Header */}
      <div className="hidden md:flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Building2 className="h-8 w-8" />
            ניהול ארגונים
          </h1>
          {currentTenant && (
            <p className="text-muted-foreground mt-2">
              ארגון נוכחי: <strong>{(currentTenant as any).tenants.name}</strong>
            </p>
          )}
        </div>
        {canManageTenants && <AddTenantForm />}
      </div>

      <div className="grid gap-3 md:gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {tenants?.map((tenant) => (
          <Card
            key={tenant.id}
            className="hover:shadow-lg transition-shadow cursor-pointer active:scale-95"
            onClick={() => handleTenantClick(tenant.id)}
          >
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1 flex-1 min-w-0">
                  <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                    <Building2 className="h-4 w-4 md:h-5 md:w-5 flex-shrink-0" />
                    <span className="truncate">{tenant.name}</span>
                  </CardTitle>
                  {(tenant as any).parent && (
                    <CardDescription className="text-xs flex items-center gap-1">
                      <span>תת-ארגון של:</span>
                      <span className="font-medium">{(tenant as any).parent.name}</span>
                    </CardDescription>
                  )}
                  {tenant.subdomain && (
                    <CardDescription className="text-xs truncate">
                      {tenant.subdomain}.lovableproject.com
                    </CardDescription>
                  )}
                </div>
                <Badge
                  variant={tenant.status === "active" ? "default" : "secondary"}
                  className="text-xs flex-shrink-0"
                >
                  {tenant.status === "active" ? "פעיל" : "לא פעיל"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-2 text-sm">
                {tenant.contact_name && (
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span className="truncate">{tenant.contact_name}</span>
                  </div>
                )}
                {tenant.contact_email && (
                  <div className="text-muted-foreground text-xs md:text-sm truncate">
                    {tenant.contact_email}
                  </div>
                )}
                {tenant.trial_ends_at && (
                  <div className="text-xs text-muted-foreground">
                    תקופת נסיון עד: {new Date(tenant.trial_ends_at).toLocaleDateString("he-IL")}
                  </div>
                )}
                {tenant.notes && (
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {tenant.notes}
                  </p>
                )}
              </div>
              {canManageTenants && (
                <div className="mt-3 pt-3 border-t">
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    onClick={(e) => {
                      e.stopPropagation();
                      // TODO: Open AddTenantForm with parentTenantId={tenant.id}
                    }}
                  >
                    <Plus className="h-3 w-3 ml-1" />
                    צור תת-ארגון
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {tenants?.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">
              אין עדיין ארגונים במערכת
            </p>
            {canManageTenants && <AddTenantForm />}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
