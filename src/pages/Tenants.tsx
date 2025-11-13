import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Building2, Users, Settings, Link as LinkIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AddTenantForm } from "@/components/forms/AddTenantForm";
import EditTenantAgenciesDialog from "@/components/forms/EditTenantAgenciesDialog";
import { useUserRole } from "@/hooks/useUserRole";
import { useTenant } from "@/contexts/TenantContext";

export default function Tenants() {
  const { toast } = useToast();
  const [selectedTenant, setSelectedTenant] = useState<string | null>(null);
  const [subTenantParentId, setSubTenantParentId] = useState<string | null>(null);
  const [agenciesDialogOpen, setAgenciesDialogOpen] = useState(false);
  const [selectedTenantForAgencies, setSelectedTenantForAgencies] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const { isSuperAdmin, isOwner } = useUserRole();
  const canManageTenants = isSuperAdmin || isOwner;

  const { currentTenantId, currentTenant } = useTenant();

  const { data: tenants, isLoading } = useQuery({
    queryKey: ["tenants"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("list-user-tenants", {});
      if (error) throw error as any;
      return (data as any)?.tenants || [];
    },
  });

  // שליפת מספר הסוכנויות המשותפות לכל tenant + פרטי הסוכנויות
  const { data: agencyCounts } = useQuery({
    queryKey: ["agency-tenant-access-counts", currentTenantId],
    queryFn: async () => {
      if (!currentTenantId) return {};

      const { data, error } = await supabase
        .from("agency_tenant_access")
        .select("accessing_tenant_id, agency_id, agencies(name)")
        .eq("source_tenant_id", currentTenantId);

      if (error) throw error;

      const countsWithDetails: Record<string, { count: number; agencies: any[] }> = {};
      data.forEach((item) => {
        if (!countsWithDetails[item.accessing_tenant_id]) {
          countsWithDetails[item.accessing_tenant_id] = { count: 0, agencies: [] };
        }
        countsWithDetails[item.accessing_tenant_id].count += 1;
        countsWithDetails[item.accessing_tenant_id].agencies.push(item.agencies);
      });

      return countsWithDetails;
    },
    enabled: !!currentTenantId,
  });

  const currentName = (tenants || []).find((t: any) => t.id === currentTenantId)?.name || (currentTenant as any)?.name;

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

    console.log("Switching to tenant:", tenantId);

    // Super admins can access any tenant
    if (isSuperAdmin) {
      // Ensure super admin appears in tenant dropdown by being a member
      const { data: existingMembership } = await supabase
        .from("tenant_users")
        .select("id")
        .eq("user_id", user.id)
        .eq("tenant_id", tenantId)
        .maybeSingle();

      if (!existingMembership) {
        await (supabase as any)
          .from("tenant_users")
          .insert({ user_id: user.id, tenant_id: tenantId, role: "member" });
      }

      // Update user_active_tenant in the database
      await (supabase as any)
        .from("user_active_tenant")
        .upsert({
          user_id: user.id,
          tenant_id: tenantId,
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id" });

      localStorage.setItem("selectedTenantId", tenantId);
      toast({
        title: "עובר לארגון...",
        description: "המערכת עוברת לארגון החדש",
      });
      window.location.href = "/";
      return;
    }

    // Check if user has access to this tenant
    const { data: access, error } = await supabase
      .from("tenant_users")
      .select("*")
      .eq("user_id", user.id)
      .eq("tenant_id", tenantId)
      .maybeSingle();

    console.log("Access check:", { access, error });

    if (error || !access) {
      toast({
        title: "אין הרשאה",
        description: "אין לך גישה לארגון זה",
        variant: "destructive",
      });
      return;
    }

    // Update user_active_tenant in the database
    await (supabase as any)
      .from("user_active_tenant")
      .upsert({
        user_id: user.id,
        tenant_id: tenantId,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: "user_id"
      });

    // Store selected tenant in localStorage for app to use
    localStorage.setItem("selectedTenantId", tenantId);
    
    toast({
      title: "עובר לארגון...",
      description: "המערכת עוברת לארגון החדש",
    });

    // Navigate to dashboard
    window.location.href = "/";
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
        {currentTenantId && (
          <p className="text-sm text-muted-foreground">
            ארגון נוכחי: <strong>{currentName}</strong>
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
          {currentTenantId && (
            <p className="text-muted-foreground mt-2">
              ארגון נוכחי: <strong>{currentName}</strong>
            </p>
          )}
        </div>
        {canManageTenants && <AddTenantForm />}
      </div>

      <div className="grid gap-3 md:gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {tenants?.map((tenant) => {
          const isCurrentTenant = currentTenantId === tenant.id;
          return (
          <Card
            key={tenant.id}
            className={`hover:shadow-lg transition-all cursor-pointer active:scale-95 ${
              isCurrentTenant ? 'ring-2 ring-primary shadow-xl border-primary' : ''
            }`}
            onClick={() => handleTenantClick(tenant.id)}
          >
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1 flex-1 min-w-0">
                  <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                    <Building2 className={`h-4 w-4 md:h-5 md:w-5 flex-shrink-0 ${isCurrentTenant ? 'text-primary' : ''}`} />
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
                {tenant.status && tenant.status !== "active" && (
                  <Badge variant="secondary" className="text-xs flex-shrink-0">
                    לא פעיל
                  </Badge>
                )}
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
                {agencyCounts && agencyCounts[tenant.id] && agencyCounts[tenant.id].count > 0 && (
                  <div className="flex flex-col gap-1 pt-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <LinkIcon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        <Badge variant="secondary" className="text-xs">
                          {agencyCounts[tenant.id].count} סוכנויות משותפות
                        </Badge>
                      </div>
                      {canManageTenants && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-2"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedTenantForAgencies({
                              id: tenant.id,
                              name: tenant.name,
                            });
                            setAgenciesDialogOpen(true);
                          }}
                        >
                          <LinkIcon className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mr-6">
                      {agencyCounts[tenant.id].agencies.map((a: any, idx: number) => (
                        <span key={idx}>
                          {a?.name || 'לא ידוע'}
                          {idx < agencyCounts[tenant.id].agencies.length - 1 && ', '}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              {canManageTenants && (
                <div className="mt-3 pt-3 border-t space-y-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSubTenantParentId(tenant.id);
                    }}
                  >
                    <Plus className="h-3 w-3 ml-1" />
                    צור תת-ארגון
                  </Button>
                  {tenant.id !== currentTenantId && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedTenantForAgencies({
                          id: tenant.id,
                          name: tenant.name,
                        });
                        setAgenciesDialogOpen(true);
                      }}
                    >
                      <LinkIcon className="h-3 w-3 ml-1" />
                      ניהול גישות לסוכנויות
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        );
        })}
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

      {/* Dialog for creating sub-tenant */}
      {subTenantParentId && (
        <AddTenantForm
          asDialog
          parentTenantId={subTenantParentId}
          open={true}
          onOpenChange={(open) => {
            if (!open) setSubTenantParentId(null);
          }}
          onSuccess={() => setSubTenantParentId(null)}
        />
      )}

      {/* Dialog for managing agency access */}
      {selectedTenantForAgencies && (
        <EditTenantAgenciesDialog
          open={agenciesDialogOpen}
          onOpenChange={setAgenciesDialogOpen}
          tenant={selectedTenantForAgencies}
        />
      )}
    </div>
  );
}
