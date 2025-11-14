import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Building2, Users, Settings, Link as LinkIcon, RefreshCw, Trash2, ArrowRightLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AddTenantForm } from "@/components/forms/AddTenantForm";
import EditTenantAgenciesDialog from "@/components/forms/EditTenantAgenciesDialog";
import { DeleteTenantDialog } from "@/components/forms/DeleteTenantDialog";
import { ConvertTenantTypeDialog } from "@/components/forms/ConvertTenantTypeDialog";
import { useUserRole } from "@/hooks/useUserRole";
import { useTenant } from "@/contexts/TenantContext";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useUserTenants } from "@/hooks/useUserTenants";
import { Skeleton } from "@/components/ui/skeleton";

export default function Tenants() {
  const { toast } = useToast();
  const [selectedTenant, setSelectedTenant] = useState<string | null>(null);
  const [subTenantParentId, setSubTenantParentId] = useState<string | null>(null);
  const [agenciesDialogOpen, setAgenciesDialogOpen] = useState(false);
  const [selectedTenantForAgencies, setSelectedTenantForAgencies] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [convertDialogOpen, setConvertDialogOpen] = useState(false);
  const [selectedTenantForDelete, setSelectedTenantForDelete] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [selectedTenantForConvert, setSelectedTenantForConvert] = useState<{
    id: string;
    name: string;
    org_type: string;
  } | null>(null);
  const { isSuperAdmin, isOwner } = useUserRole();
  const canManageTenants = isSuperAdmin || isOwner;

  const { currentTenantId, currentTenant } = useTenant();
  const { userId } = useCurrentUser();
  const { userTenants: tenants, isLoading, refetch } = useUserTenants(userId);

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

    // Super admins can access tenant only if allowed or if they are owners of that tenant
    if (isSuperAdmin) {
      // Fetch allow flag and ownership
      const [{ data: tenantRow }, { data: ownerRow }] = await Promise.all([
        supabase.from("tenants").select("id, allow_super_admin_access").eq("id", tenantId).maybeSingle(),
        supabase.from("tenant_users").select("role").eq("tenant_id", tenantId).eq("user_id", user.id).eq("role", "owner").maybeSingle(),
      ]);

      const allow = tenantRow?.allow_super_admin_access === true;
      const isOwnerOfThis = !!ownerRow;

      if (!allow && !isOwnerOfThis) {
        toast({
          title: "אין הרשאה",
          description: "בעלים חסם גישת Super Admin לארגון זה",
          variant: "destructive",
        });
        return;
      }

      // Ensure super admin appears in tenant dropdown by being a member (only when allowed or owner)
      const { data: existingMembership } = await supabase
        .from("tenant_users")
        .select("id")
        .eq("user_id", user.id)
        .eq("tenant_id", tenantId)
        .maybeSingle();

      if (!existingMembership) {
        await (supabase as any)
          .from("tenant_users")
          .insert({ user_id: user.id, tenant_id: tenantId, role: isOwnerOfThis ? "owner" : "member" });
      }

      // Update user_active_tenant in the database
      await (supabase as any)
        .from("user_active_tenant")
        .upsert({
          user_id: user.id,
          tenant_id: tenantId,
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id" });

      // Get tenant slug for navigation
      const { data: tenantData } = await supabase
        .from("tenants")
        .select("slug")
        .eq("id", tenantId)
        .single();
      
      const slug = tenantData?.slug;
      
      localStorage.setItem("selectedTenantId", tenantId);
      toast({
        title: "עובר לארגון...",
        description: "המערכת עוברת לארגון החדש",
      });
      
      if (slug) {
        window.location.href = `/t/${slug}/dashboard`;
      } else {
        window.location.href = "/";
      }
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

    // Get tenant slug for navigation
    const clickedTenant = tenants?.find((t: any) => t.id === tenantId);
    const slug = clickedTenant?.slug;
    
    // Store selected tenant in localStorage for app to use
    localStorage.setItem("selectedTenantId", tenantId);
    
    toast({
      title: "עובר לארגון...",
      description: "המערכת עוברת לארגון החדש",
    });

    // Navigate to dashboard with slug
    if (slug) {
      window.location.href = `/t/${slug}/dashboard`;
    } else {
      window.location.href = "/";
    }
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
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Building2 className="h-6 w-6" />
            ניהול ארגונים
          </h1>
          <Button
            onClick={() => refetch()}
            variant="ghost"
            size="sm"
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
        {currentTenantId && (
          <p className="text-sm text-muted-foreground">
            ארגון נוכחי: <strong>{currentName}</strong>
          </p>
        )}
        {canManageTenants && <AddTenantForm />}
      </div>

      {/* Desktop Header */}
      <div className="hidden md:flex justify-between items-center">
        <div className="flex items-center gap-3">
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
          <Button
            onClick={() => refetch()}
            variant="ghost"
            size="sm"
            disabled={isLoading}
          >
            <RefreshCw className={`h-5 w-5 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
        {canManageTenants && <AddTenantForm />}
      </div>

      {isLoading ? (
        <div className="grid gap-3 md:gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-3/4 mb-2" />
                <Skeleton className="h-4 w-1/2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : tenants.length === 0 ? (
        <div className="text-center text-muted-foreground py-12">
          <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>לא נמצאו ארגונים</p>
        </div>
      ) : (
        <div className="grid gap-3 md:gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {tenants.map((tenant) => {
            const isCurrentTenant = currentTenantId === tenant.id;
            const orgType = (tenant as any).org_type ?? ((tenant as any).parent ? 'sub_organization' : 'organization');
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
                  <div className="flex items-center gap-2 flex-wrap">
                    <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                      <Building2 className={`h-4 w-4 md:h-5 md:w-5 flex-shrink-0 ${isCurrentTenant ? 'text-primary' : ''}`} />
                      <span className="truncate">{tenant.name}</span>
                    </CardTitle>
                    <Badge 
                      variant={orgType === 'root' ? 'default' : orgType === 'organization' ? 'secondary' : 'outline'}
                      className="text-xs"
                    >
                      {orgType === 'root' ? 'ארגון שורש' :
                       orgType === 'organization' ? 'ארגון' :
                       'תת-ארגון'}
                    </Badge>
                  </div>
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
                  {(tenant as any).org_type !== 'sub_organization' && (
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
                      {(tenant as any).org_type === 'root' ? 'צור ארגון' : 'צור תת-ארגון'}
                    </Button>
                  )}
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
                  {isSuperAdmin && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedTenantForConvert({
                            id: tenant.id,
                            name: tenant.name,
                            org_type: (tenant as any).org_type,
                          });
                          setConvertDialogOpen(true);
                        }}
                      >
                        <ArrowRightLeft className="h-3 w-3 ml-1" />
                        שנה סוג ארגון
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="w-full"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedTenantForDelete({
                            id: tenant.id,
                            name: tenant.name,
                          });
                          setDeleteDialogOpen(true);
                        }}
                      >
                        <Trash2 className="h-3 w-3 ml-1" />
                        מחק ארגון
                      </Button>
                    </>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        );
        })}
      </div>
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

      {/* Dialog for deleting tenant */}
      <DeleteTenantDialog
        tenant={selectedTenantForDelete}
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
      />

      {/* Dialog for converting tenant type */}
      <ConvertTenantTypeDialog
        tenant={selectedTenantForConvert}
        availableParents={tenants.filter((t: any) => t.org_type !== 'sub_organization')}
        open={convertDialogOpen}
        onOpenChange={setConvertDialogOpen}
      />
    </div>
  );
}
