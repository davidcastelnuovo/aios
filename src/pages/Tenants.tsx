import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Plus, Building2, Users, Settings, Link as LinkIcon, RefreshCw, Trash2, ArrowRightLeft, ChevronDown, ChevronLeft } from "lucide-react";
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
  const [expandedOrgs, setExpandedOrgs] = useState<Set<string>>(new Set());
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

  // קיבוץ ארגונים ותת-ארגונים
  const organizeTenants = () => {
    const orgs: any[] = [];
    const subs: Record<string, any[]> = {};
    
    (tenants || []).forEach((tenant: any) => {
      const orgType = tenant.org_type || (tenant.parent_tenant_id ? 'sub_organization' : 'organization');
      
      if (orgType === 'sub_organization' && tenant.parent_tenant_id) {
        if (!subs[tenant.parent_tenant_id]) {
          subs[tenant.parent_tenant_id] = [];
        }
        subs[tenant.parent_tenant_id].push(tenant);
      } else {
        orgs.push(tenant);
      }
    });
    
    return { organizations: orgs, subOrganizations: subs };
  };

  const { organizations, subOrganizations } = organizeTenants();

  const toggleOrgExpansion = (orgId: string) => {
    const newExpanded = new Set(expandedOrgs);
    if (newExpanded.has(orgId)) {
      newExpanded.delete(orgId);
    } else {
      newExpanded.add(orgId);
    }
    setExpandedOrgs(newExpanded);
  };

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
        <div className="border rounded-lg overflow-hidden bg-card" dir="rtl">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">שם הארגון</TableHead>
                <TableHead className="text-right w-[200px]">סוג</TableHead>
                <TableHead className="text-right w-[120px]">סטטוס</TableHead>
                <TableHead className="text-right w-[200px]">איש קשר</TableHead>
                <TableHead className="text-right w-[180px]">פעולות</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {organizations.map((org: any) => {
                const isCurrentOrg = currentTenantId === org.id;
                const orgType = org.org_type || (org.parent_tenant_id ? 'sub_organization' : 'organization');
                const hasSubs = subOrganizations[org.id]?.length > 0;
                const isExpanded = expandedOrgs.has(org.id);
                
                return (
                  <Collapsible key={org.id} open={isExpanded} onOpenChange={() => hasSubs && toggleOrgExpansion(org.id)}>
                    <TableRow 
                      className={`${isCurrentOrg ? 'bg-primary/5 border-l-4 border-l-primary' : ''} hover:bg-muted/50 cursor-pointer`}
                      onClick={() => handleTenantClick(org.id)}
                    >
                      <TableCell className="text-right">
                        <div className="flex items-center gap-2">
                          {hasSubs && (
                            <CollapsibleTrigger asChild onClick={(e) => e.stopPropagation()}>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                {isExpanded ? (
                                  <ChevronDown className="h-4 w-4" />
                                ) : (
                                  <ChevronLeft className="h-4 w-4" />
                                )}
                              </Button>
                            </CollapsibleTrigger>
                          )}
                          <Building2 className={`h-4 w-4 flex-shrink-0 ${isCurrentOrg ? 'text-primary' : ''}`} />
                          <div className="flex-1">
                            <div className="font-medium">{org.name}</div>
                            {org.subdomain && (
                              <div className="text-xs text-muted-foreground">
                                {org.subdomain}.lovableproject.com
                              </div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center gap-1 justify-start">
                          <Badge 
                            variant={orgType === 'root' ? 'default' : 'secondary'}
                            className="text-xs"
                          >
                            {orgType === 'root' ? 'ארגון שורש' : 'ארגון'}
                          </Badge>
                          {hasSubs && (
                            <Badge variant="outline" className="text-xs">
                              {subOrganizations[org.id].length} תת-ארגון
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {org.status && org.status !== "active" ? (
                          <Badge variant="secondary" className="text-xs">לא פעיל</Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs text-green-600 border-green-600">פעיל</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {org.contact_name && (
                          <div className="text-sm">
                            <div>{org.contact_name}</div>
                            {org.contact_email && (
                              <div className="text-xs text-muted-foreground">{org.contact_email}</div>
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center gap-1">
                          {canManageTenants && orgType !== 'sub_organization' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 px-2"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSubTenantParentId(org.id);
                              }}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          )}
                          {canManageTenants && org.id !== currentTenantId && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 px-2"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedTenantForAgencies({
                                  id: org.id,
                                  name: org.name,
                                });
                                setAgenciesDialogOpen(true);
                              }}
                            >
                              <LinkIcon className="h-3 w-3" />
                            </Button>
                          )}
                          {isSuperAdmin && (
                            <>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 px-2"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedTenantForConvert({
                                    id: org.id,
                                    name: org.name,
                                    org_type: orgType,
                                  });
                                  setConvertDialogOpen(true);
                                }}
                              >
                                <ArrowRightLeft className="h-3 w-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 px-2 text-destructive hover:text-destructive"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedTenantForDelete({
                                    id: org.id,
                                    name: org.name,
                                  });
                                  setDeleteDialogOpen(true);
                                }}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                    
                    {hasSubs && (
                      <CollapsibleContent asChild>
                        <>
                          {subOrganizations[org.id].map((sub: any) => {
                            const isCurrentSub = currentTenantId === sub.id;
                            return (
                              <TableRow
                                key={sub.id}
                                className={`${isCurrentSub ? 'bg-primary/5 border-l-4 border-l-primary' : ''} hover:bg-muted/50 cursor-pointer bg-muted/20`}
                                onClick={() => handleTenantClick(sub.id)}
                              >
                                <TableCell className="text-right">
                                  <div className="flex items-center gap-2 pr-12">
                                    <Building2 className={`h-4 w-4 flex-shrink-0 ${isCurrentSub ? 'text-primary' : 'text-muted-foreground'}`} />
                                    <div className="flex-1">
                                      <div className="font-medium text-sm">{sub.name}</div>
                                      {sub.subdomain && (
                                        <div className="text-xs text-muted-foreground">
                                          {sub.subdomain}.lovableproject.com
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell className="text-right">
                                  <Badge variant="outline" className="text-xs">תת-ארגון</Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                  {sub.status && sub.status !== "active" ? (
                                    <Badge variant="secondary" className="text-xs">לא פעיל</Badge>
                                  ) : (
                                    <Badge variant="outline" className="text-xs text-green-600 border-green-600">פעיל</Badge>
                                  )}
                                </TableCell>
                                <TableCell className="text-right">
                                  {sub.contact_name && (
                                    <div className="text-sm">
                                      <div>{sub.contact_name}</div>
                                      {sub.contact_email && (
                                        <div className="text-xs text-muted-foreground">{sub.contact_email}</div>
                                      )}
                                    </div>
                                  )}
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex items-center gap-1">
                                    {canManageTenants && sub.id !== currentTenantId && (
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-8 px-2"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSelectedTenantForAgencies({
                                            id: sub.id,
                                            name: sub.name,
                                          });
                                          setAgenciesDialogOpen(true);
                                        }}
                                      >
                                        <LinkIcon className="h-3 w-3" />
                                      </Button>
                                    )}
                                    {isSuperAdmin && (
                                      <>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          className="h-8 px-2"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedTenantForConvert({
                                              id: sub.id,
                                              name: sub.name,
                                              org_type: 'sub_organization',
                                            });
                                            setConvertDialogOpen(true);
                                          }}
                                        >
                                          <ArrowRightLeft className="h-3 w-3" />
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          className="h-8 px-2 text-destructive hover:text-destructive"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedTenantForDelete({
                                              id: sub.id,
                                              name: sub.name,
                                            });
                                            setDeleteDialogOpen(true);
                                          }}
                                        >
                                          <Trash2 className="h-3 w-3" />
                                        </Button>
                                      </>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </>
                      </CollapsibleContent>
                    )}
                  </Collapsible>
                );
              })}
            </TableBody>
          </Table>
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
