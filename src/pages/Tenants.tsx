import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Building2, Building, Users, Settings, Link as LinkIcon, RefreshCw, Trash2, ArrowRightLeft, ChevronDown, ChevronLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AddTenantForm } from "@/components/forms/AddTenantForm";
import EditTenantAgenciesDialog from "@/components/forms/EditTenantAgenciesDialog";
import { DeleteTenantDialog } from "@/components/forms/DeleteTenantDialog";
import { ConvertTenantTypeDialog } from "@/components/forms/ConvertTenantTypeDialog";
import { useUserRole } from "@/hooks/useUserRole";
import { useTenant } from "@/contexts/TenantContext";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useUserTenants } from "@/hooks/useUserTenants";

export default function Tenants() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [selectedTenant, setSelectedTenant] = useState<string | null>(null);
  const [subTenantParentId, setSubTenantParentId] = useState<string | null>(null);
  const [agenciesDialogOpen, setAgenciesDialogOpen] = useState(false);
  const [expandedOrgs, setExpandedOrgs] = useState<Record<string, boolean>>({});
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

  const queryClient = useQueryClient();

  // Organize tenants into organizations and sub-organizations
  const organizeTenants = () => {
    const orgs: any[] = [];
    const subs: Record<string, any[]> = {};

    (tenants || []).forEach((tenant: any) => {
      if (tenant.org_type === "organization" || tenant.org_type === "root") {
        orgs.push(tenant);
      } else if (tenant.org_type === "sub_organization" && tenant.parent_tenant_id) {
        if (!subs[tenant.parent_tenant_id]) {
          subs[tenant.parent_tenant_id] = [];
        }
        subs[tenant.parent_tenant_id].push(tenant);
      }
    });

    // Sort: MarketingCaptain first, then alphabetically
    const sorted = orgs.sort((a, b) => {
      if (a.name === "MarketingCaptain") return -1;
      if (b.name === "MarketingCaptain") return 1;
      return a.name.localeCompare(b.name, "he");
    });

    return { organizations: sorted, subOrganizations: subs };
  };

  const { organizations, subOrganizations } = organizeTenants();

  const toggleExpanded = (orgId: string) => {
    setExpandedOrgs((prev) => ({
      ...prev,
      [orgId]: !prev[orgId],
    }));
  };

  const switchTenantMutation = useMutation({
    mutationFn: async (tenantId: string) => {
      if (!userId) throw new Error("User not authenticated");

      const { error } = await supabase
        .from("user_active_tenant")
        .upsert(
          {
            user_id: userId,
            tenant_id: tenantId,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: "user_id",
          }
        );

      if (error) throw error;
      return tenantId;
    },
    onSuccess: (tenantId: string) => {
      // Find the slug of the new tenant
      const selectedTenant = tenants?.find((t: any) => t.id === tenantId);
      const newSlug = selectedTenant?.slug;
      
      queryClient.invalidateQueries({ queryKey: ["current-tenant"] });
      
      if (newSlug) {
        // Navigate to the new tenant's tenants page
        navigate(`/t/${newSlug}/tenants`);
      } else {
        // Fallback if no slug found
        window.location.reload();
      }
    },
    onError: (error: any) => {
      toast({
        title: "שגיאה",
        description: error.message || "Failed to switch tenant",
        variant: "destructive",
      });
    },
  });

  const handleTenantClick = async (tenantId: string) => {
    if (tenantId === currentTenantId) {
      toast({
        title: "כבר פעיל",
        description: "ארגון זה כבר פעיל",
      });
      return;
    }

    const tenant = tenants?.find((t: any) => t.id === tenantId);
    if (!tenant) return;

    // Check if user has permission to access this tenant
    const { data: tenantUser } = await supabase
      .from("tenant_users")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("user_id", userId)
      .maybeSingle();

    // Super admins can access if allowed, or if they're the owner
    if (isSuperAdmin && !tenantUser) {
      const { data: ownerCheck } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("tenant_id", tenantId)
        .eq("role", "owner")
        .maybeSingle();

      if (!ownerCheck && !tenant.allow_super_admin_access) {
        toast({
          title: "אין הרשאה",
          description: "אין לך הרשאה לגשת לארגון זה",
          variant: "destructive",
        });
        return;
      }
    } else if (!tenantUser && !isSuperAdmin) {
      toast({
        title: "אין הרשאה",
        description: "אין לך הרשאה לגשת לארגון זה",
        variant: "destructive",
      });
      return;
    }

    switchTenantMutation.mutate(tenantId);
  };

  const renderOrgActions = (org: any) => {
    return (
      <>
        {/* רק לארגון שורש (root) - כפתור "הוסף ארגון" */}
        {canManageTenants && org.org_type === "root" && (
          <AddTenantForm asDialog={true} />
        )}
        
        {/* לארגון רגיל (organization) - כפתור "צור תת-ארגון" */}
        {canManageTenants && org.org_type === "organization" && (
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              setSubTenantParentId(org.id);
            }}
            title="צור תת-ארגון"
          >
            <Plus className="h-4 w-4" />
          </Button>
        )}
        
        {/* תת-ארגון (sub_organization) - אין כפתור יצירה */}
        
        {canManageTenants && (
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedTenantForAgencies({
                id: org.id,
                name: org.name,
              });
              setAgenciesDialogOpen(true);
            }}
            title="נהל שיתוף סוכנויות"
          >
            <LinkIcon className="h-4 w-4" />
          </Button>
        )}
        {canManageTenants && (
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedTenantForConvert({
                id: org.id,
                name: org.name,
                org_type: org.org_type,
              });
              setConvertDialogOpen(true);
            }}
            title="המר סוג ארגון"
          >
            <ArrowRightLeft className="h-4 w-4" />
          </Button>
        )}
        {canManageTenants && org.id !== currentTenantId && (
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedTenantForDelete({
                id: org.id,
                name: org.name,
              });
              setDeleteDialogOpen(true);
            }}
            title="מחק ארגון"
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        )}
      </>
    );
  };

  const renderSubOrgActions = (sub: any) => {
    return (
      <>
        {canManageTenants && sub.id !== currentTenantId && (
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedTenantForAgencies({
                id: sub.id,
                name: sub.name,
              });
              setAgenciesDialogOpen(true);
            }}
            title="נהל שיתוף סוכנויות"
          >
            <LinkIcon className="h-4 w-4" />
          </Button>
        )}
        {canManageTenants && sub.id !== currentTenantId && (
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedTenantForConvert({
                id: sub.id,
                name: sub.name,
                org_type: sub.org_type,
              });
              setConvertDialogOpen(true);
            }}
            title="המר סוג ארגון"
          >
            <ArrowRightLeft className="h-4 w-4" />
          </Button>
        )}
        {canManageTenants && sub.id !== currentTenantId && (
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedTenantForDelete({
                id: sub.id,
                name: sub.name,
              });
              setDeleteDialogOpen(true);
            }}
            title="מחק ארגון"
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        )}
      </>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Building2 className="h-8 w-8" />
            ניהול ארגונים
          </h1>
          {currentTenant && (
            <p className="text-muted-foreground mt-2">
              ארגון נוכחי: <strong>{(currentTenant as any)?.name}</strong>
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button onClick={() => refetch()} variant="ghost" size="sm" disabled={isLoading}>
            <RefreshCw className={`h-5 w-5 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {tenants.length === 0 ? (
        <div className="text-center text-muted-foreground py-12">
          <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>לא נמצאו ארגונים</p>
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>הארגונים שלי</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">שם ארגון</TableHead>
                    <TableHead className="text-right">סוג</TableHead>
                    <TableHead className="text-right">סטטוס</TableHead>
                    <TableHead className="text-right">תת-ארגונים</TableHead>
                    <TableHead className="text-right">פעולות</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {organizations.map((org: any) => (
                    <>
                      <TableRow
                        key={org.id}
                        className={
                          currentTenantId === org.id
                            ? "bg-green-50 dark:bg-green-950/20 border-r-4 border-r-green-500"
                            : "hover:bg-muted/50 cursor-pointer"
                        }
                        onClick={() => handleTenantClick(org.id)}
                      >
                        <TableCell className="text-right">
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 flex-shrink-0" />
                            <span className="font-medium">{org.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant="outline">ארגון</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge
                            variant={
                              org.status === "active"
                                ? "default"
                                : org.status === "trial"
                                  ? "secondary"
                                  : "destructive"
                            }
                          >
                            {org.status === "active"
                              ? "פעיל"
                              : org.status === "trial"
                                ? "ניסיון"
                                : org.status === "suspended"
                                  ? "מושעה"
                                  : "לא פעיל"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {subOrganizations[org.id] && subOrganizations[org.id].length > 0 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleExpanded(org.id);
                              }}
                            >
                              {expandedOrgs[org.id] ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronLeft className="h-4 w-4" />
                              )}
                              <span className="mr-2">{subOrganizations[org.id].length}</span>
                            </Button>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-2 justify-end" onClick={(e) => e.stopPropagation()}>
                            {renderOrgActions(org)}
                          </div>
                        </TableCell>
                      </TableRow>

                      {expandedOrgs[org.id] &&
                        subOrganizations[org.id]?.map((sub: any) => (
                          <TableRow
                            key={sub.id}
                            className={
                              currentTenantId === sub.id
                                ? "bg-green-50 dark:bg-green-950/20 border-r-4 border-r-green-500 bg-muted/20"
                                : "bg-muted/20 hover:bg-muted/50 cursor-pointer"
                            }
                            onClick={() => handleTenantClick(sub.id)}
                          >
                            <TableCell className="text-right">
                              <div className="flex items-center gap-2 pr-8">
                                <Building className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                                <span className="text-muted-foreground">└─</span>
                                <span className="font-medium">{sub.name}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <Badge variant="secondary">תת-ארגון</Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <Badge
                                variant={
                                  sub.status === "active"
                                    ? "default"
                                    : sub.status === "trial"
                                      ? "secondary"
                                      : "destructive"
                                }
                              >
                                {sub.status === "active"
                                  ? "פעיל"
                                  : sub.status === "trial"
                                    ? "ניסיון"
                                    : sub.status === "suspended"
                                      ? "מושעה"
                                      : "לא פעיל"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">-</TableCell>
                            <TableCell className="text-right">
                              <div className="flex gap-2 justify-end" onClick={(e) => e.stopPropagation()}>
                                {renderSubOrgActions(sub)}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                    </>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {selectedTenantForAgencies && (
        <EditTenantAgenciesDialog
          open={agenciesDialogOpen}
          onOpenChange={setAgenciesDialogOpen}
          tenant={selectedTenantForAgencies}
        />
      )}

      {selectedTenantForDelete && (
        <DeleteTenantDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          tenant={selectedTenantForDelete}
        />
      )}

      {selectedTenantForConvert && (
        <ConvertTenantTypeDialog
          open={convertDialogOpen}
          onOpenChange={setConvertDialogOpen}
          tenant={selectedTenantForConvert}
          availableParents={organizations}
        />
      )}
    </div>
  );
}
