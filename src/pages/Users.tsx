import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole, UserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AddTenantForm } from "@/components/forms/AddTenantForm";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Shield, UserPlus, Trash2, Settings, Lock, Mail, Building2 } from "lucide-react";
import { useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { EditUserAgenciesDialog } from "@/components/forms/EditUserAgenciesDialog";
import { EditUserPermissionsDialog } from "@/components/forms/EditUserPermissionsDialog";
import { EditUserCampaignerDialog } from "@/components/forms/EditUserCampaignerDialog";
import { EditUserSalesPersonDialog } from "@/components/forms/EditUserSalesPersonDialog";
import { EditUserNameDialog } from "@/components/forms/EditUserNameDialog";
import EditSalesPersonAgenciesDialog from "@/components/forms/EditSalesPersonAgenciesDialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

const roleLabels: Record<UserRole, string> = {
  owner: "בעלים",
  team_manager: "מנהל צוות",
  campaigner: "קמפיינר",
  sales_person: "איש מכירות",
  super_admin: "סופר אדמין",
};

const roleBadgeColors: Record<UserRole, string> = {
  owner: "bg-purple-500",
  team_manager: "bg-green-500",
  campaigner: "bg-orange-500",
  sales_person: "bg-blue-500",
  super_admin: "bg-red-500",
};

export default function Users() {
  const { isOwner, isSuperAdmin, userId: currentUserId } = useUserRole();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [isTenantDialogOpen, setIsTenantDialogOpen] = useState(false);
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteFullName, setInviteFullName] = useState("");
  const [inviteRole, setInviteRole] = useState<UserRole>("campaigner");
  const [selectedAgencies, setSelectedAgencies] = useState<string[]>([]);
  const [selectedModules, setSelectedModules] = useState<string[]>([]);
  const [selectedCampaignerId, setSelectedCampaignerId] = useState<string>("");
  const [selectedSalesPersonId, setSelectedSalesPersonId] = useState<string>("");
  const [editAgenciesUserId, setEditAgenciesUserId] = useState<string | null>(null);
  const [editAgenciesUserEmail, setEditAgenciesUserEmail] = useState<string>("");
  const [editPermissionsUserId, setEditPermissionsUserId] = useState<string | null>(null);
  const [editPermissionsUserEmail, setEditPermissionsUserEmail] = useState<string>("");
  const [editCampaignerUserId, setEditCampaignerUserId] = useState<string | null>(null);
  const [editCampaignerUserEmail, setEditCampaignerUserEmail] = useState<string>("");
  const [editSalesPersonUserId, setEditSalesPersonUserId] = useState<string | null>(null);
  const [editSalesPersonUserEmail, setEditSalesPersonUserEmail] = useState<string>("");
  const [editNameUserId, setEditNameUserId] = useState<string | null>(null);
  const [editNameUserEmail, setEditNameUserEmail] = useState<string>("");
  const [editNameUserFullName, setEditNameUserFullName] = useState<string>("");
  const [editSalesPersonAgencies, setEditSalesPersonAgencies] = useState<{
    id: string;
    full_name: string;
    agencies: Array<{ id: string; name: string }>;
  } | null>(null);
  const [selectedTenantId, setSelectedTenantId] = useState<string>("");
  const [agencyFilter, setAgencyFilter] = useState<string>("all");

  const { data: agencies } = useQuery({
    queryKey: ["agencies-for-invite", currentUserId],
    queryFn: async () => {
      // Get current user's roles
      const { data: userRoles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", currentUserId);
      
      const roles = userRoles?.map(r => r.role) || [];
      const isOwnerRole = roles.includes("owner");
      
      if (isOwnerRole) {
        // Owner sees all agencies
        const { data, error } = await supabase
          .from("agencies")
          .select("id, name")
          .order("name");
        if (error) throw error;
        return data;
      }
      return [];
    },
  });

  const { data: campaigners } = useQuery({
    queryKey: ["campaigners-for-invite"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaigners")
        .select("id, full_name")
        .eq("active", true)
        .order("full_name");
      if (error) throw error;
      return data;
    },
  });

  const { data: salesPeople } = useQuery({
    queryKey: ["sales-people-for-invite"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales_people")
        .select("id, full_name")
        .eq("active", true)
        .order("full_name");
      if (error) throw error;
      return data;
    },
  });

  const { data: salesPeopleWithAgencies } = useQuery({
    queryKey: ["sales-people-with-agencies"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales_people")
        .select(`
          id,
          full_name,
          sales_person_agencies(
            agency_id,
            agencies(id, name)
          )
        `);
      
      if (error) throw error;
      
      return data.map((sp: any) => ({
        id: sp.id,
        full_name: sp.full_name,
        agencies: sp.sales_person_agencies.map((spa: any) => spa.agencies).filter(Boolean),
      }));
    },
  });

  const { data: tenants } = useQuery({
    queryKey: ["tenants"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenants")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: isSuperAdmin,
  });

  const { data: users, isLoading } = useQuery({
    queryKey: ["users-with-roles"],
    queryFn: async () => {
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, email, full_name, campaigner_id, sales_person_id, campaigners(full_name), sales_people(full_name)");

      if (profilesError) throw profilesError;

      const { data: userRoles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role");

      if (rolesError) throw rolesError;

      // Get campaigner agencies
      const { data: campaignerAgencies } = await supabase
        .from("campaigner_agencies")
        .select("campaigner_id, agency_id");

      // Get sales person agencies
      const { data: salesPersonAgencies } = await supabase
        .from("sales_person_agencies")
        .select("sales_person_id, agency_id");

      return profiles.map((profile: any) => {
        const userRole = userRoles.find((r) => r.user_id === profile.id);
        
        // Get agencies for this user
        const userAgencyIds: string[] = [];
        if (profile.campaigner_id) {
          const campaignerAgencyIds = campaignerAgencies
            ?.filter(ca => ca.campaigner_id === profile.campaigner_id)
            .map(ca => ca.agency_id) || [];
          userAgencyIds.push(...campaignerAgencyIds);
        }
        if (profile.sales_person_id) {
          const salesAgencyIds = salesPersonAgencies
            ?.filter(spa => spa.sales_person_id === profile.sales_person_id)
            .map(spa => spa.agency_id) || [];
          userAgencyIds.push(...salesAgencyIds);
        }

        return {
          ...profile,
          role: userRole?.role as UserRole | undefined,
          campaigner_name: profile.campaigners?.full_name,
          sales_person_name: profile.sales_people?.full_name,
          agency_ids: [...new Set(userAgencyIds)], // Remove duplicates
        };
      });
    },
  });

  // Filter users by selected agency
  const filteredUsers = users?.filter(user => {
    if (agencyFilter === "all") return true;
    return user.agency_ids?.includes(agencyFilter);
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({
      userId,
      role,
    }: {
      userId: string;
      role: UserRole;
    }) => {
      const { data, error } = await supabase.functions.invoke("update-user-role", {
        body: { userId, role },
      });
      
      if (error) throw error;
      if (!data.success) throw new Error(data.error);
      return data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["users-with-roles"] });
      await queryClient.refetchQueries({ queryKey: ["users-with-roles"] });
      toast.success("התפקיד עודכן בהצלחה");
    },
    onError: (error: Error) => {
      toast.error("שגיאה בעדכון תפקיד: " + error.message);
    },
  });


  const { data: currentUserTenant } = useQuery({
    queryKey: ["current-user-tenant", currentUserId],
    queryFn: async () => {
      if (!currentUserId) return null;
      
      const { data, error } = await supabase
        .from("tenant_users")
        .select("tenant_id, tenants(name)")
        .eq("user_id", currentUserId)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!currentUserId && !isSuperAdmin,
  });

  const inviteUserMutation = useMutation({
    mutationFn: async ({ 
      email, 
      fullName,
      role, 
      agencyIds, 
      modulePermissions,
      campaignerId,
      salesPersonId 
    }: { 
      email: string;
      fullName?: string; 
      role: UserRole; 
      agencyIds: string[]; 
      modulePermissions: string[];
      campaignerId?: string;
      salesPersonId?: string;
    }) => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error("No active session");
      }

      // Get tenant_id for non-super-admin users
      let tenantId = undefined;
      if (isSuperAdmin) {
        // Super admin must select a tenant
        if (!selectedTenantId) {
          throw new Error("יש לבחור ארגון למשתמש");
        }
        tenantId = selectedTenantId;
      } else if (currentUserTenant?.tenant_id) {
        // Regular owner uses their own tenant
        tenantId = currentUserTenant.tenant_id;
      }

      const { data, error } = await supabase.functions.invoke("invite-user", {
        body: { 
          email,
          fullName,
          role,
          agencyIds,
          modulePermissions,
          campaignerId,
          salesPersonId,
          tenantId,
          baseUrl: "https://after-lead.lovable.app",
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      
      if (error) throw error;
      if (!data.success) {
        // Check if error is about existing email
        if (data.error === "EMAIL_EXISTS") {
          throw new Error("EMAIL_EXISTS");
        }
        throw new Error(data.error || data.message || "שגיאה לא ידועה");
      }
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["users-with-roles"] });
      
      // Show success message with invitation link if available
      if (data.invitationLink) {
        toast.success(`הזמנה נשלחה בהצלחה! לינק ההזמנה: ${data.invitationLink}`);
      } else {
        toast.success("הזמנה נשלחה בהצלחה למייל המשתמש");
      }
      
      setIsInviteDialogOpen(false);
      setInviteEmail("");
      setInviteFullName("");
      setInviteRole("campaigner");
      setSelectedAgencies([]);
      setSelectedModules([]);
      setSelectedCampaignerId("");
      setSelectedSalesPersonId("");
      setSelectedTenantId("");
    },
    onError: (error: Error) => {
      if (error.message === "EMAIL_EXISTS") {
        toast.error("המשתמש כבר רשום במערכת", {
          action: {
            label: "מחק משתמש קיים",
            onClick: () => {
              if (window.confirm(`האם אתה בטוח שברצונך למחוק את המשתמש ${inviteEmail}? זה ימחק אותו לגמרי מהמערכת.`)) {
                deleteUserMutation.mutate({ email: inviteEmail });
              }
            },
          },
        });
      } else {
        toast.error("שגיאה בשליחת הזמנה: " + error.message);
      }
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async ({ userId, email }: { userId?: string; email?: string }) => {
      const { data, error } = await supabase.functions.invoke("delete-user", {
        body: { userId, email },
      });
      if (error) throw error;
      if (!data.success) throw new Error(data.error);
      return data;
    },
    onSuccess: async () => {
      // Force refetch both queries
      await queryClient.invalidateQueries({ queryKey: ["users-with-roles"] });
      await queryClient.refetchQueries({ queryKey: ["users-with-roles"] });
      toast.success("המשתמש נמחק בהצלחה");
    },
    onError: (error: Error) => {
      toast.error("שגיאה במחיקת משתמש: " + error.message);
    },
  });

  const resendInviteMutation = useMutation({
    mutationFn: async ({ email }: { email: string }) => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error("No active session");
      }

      const { data, error } = await supabase.functions.invoke("invite-user", {
        body: { 
          email,
          resend: true,
          baseUrl: "https://after-lead.lovable.app",
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      
      if (error) throw error;
      if (!data.success) throw new Error(data.error);
      
      return data;
    },
    onSuccess: (data) => {
      // Show success message with invitation link if available
      if (data.invitationLink) {
        toast.success(`הזמנה נשלחה מחדש! לינק ההזמנה: ${data.invitationLink}`);
      } else {
        toast.success("הזמנה נשלחה מחדש בהצלחה");
      }
    },
    onError: (error: Error) => {
      toast.error("שגיאה בשליחת הזמנה מחדש: " + error.message);
    },
  });

  if (!isOwner) {
    return (
      <div className="container mx-auto py-6">
        <Card className="p-6">
          <div className="text-center">
            <Shield className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-semibold mb-2">אין הרשאה</h2>
            <p className="text-muted-foreground">
              רק בעלים ומנהלי סוכנות יכולים לגשת לדף זה
            </p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-4 md:py-6 px-4 md:px-6 space-y-4 md:space-y-6" dir="rtl">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">ניהול משתמשים בארגון</h1>
          <p className="text-xs md:text-sm text-muted-foreground mt-1">
            {isSuperAdmin 
              ? "ניהול ארגונים ומשתמשים במערכת SaaS" 
              : isMobile 
                ? `ארגון: ${currentUserTenant?.tenants?.name || "שלך"}`
                : `כל המשתמשים שמוזמנים כאן ישתייכו לארגון "${currentUserTenant?.tenants?.name || "שלך"}" ולא יקבלו חשבון נפרד`}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
          {isSuperAdmin && (
            <Dialog open={isTenantDialogOpen} onOpenChange={setIsTenantDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="w-full sm:w-auto">
                  <Building2 className="h-4 w-4 ml-2" />
                  הוסף ארגון
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>הוסף ארגון חדש</DialogTitle>
                  <DialogDescription>
                    צור ארגון חדש במערכת. יהיה צורך ליצור משתמשים עבורו בנפרד.
                  </DialogDescription>
                </DialogHeader>
                <AddTenantForm asDialog={false} onSuccess={() => setIsTenantDialogOpen(false)} />
              </DialogContent>
            </Dialog>
          )}
          <Dialog open={isInviteDialogOpen} onOpenChange={setIsInviteDialogOpen}>
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto">
              <UserPlus className="h-4 w-4 ml-2" />
              הזמן משתמש חדש
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>הזמן משתמש חדש לארגון שלך</DialogTitle>
              <DialogDescription>
                המשתמש יקבל מייל עם קישור ליצירת חשבון והצטרפות לארגון שלך (MarketingCaptain).
              </DialogDescription>
            </DialogHeader>
            <ScrollArea className="max-h-[calc(90vh-180px)] pl-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pr-4" dir="rtl">
                {isSuperAdmin && (
                  <div className="md:col-span-2 p-3 border border-amber-500 bg-amber-50 dark:bg-amber-950 rounded-md">
                    <Label htmlFor="tenant-select" className="text-amber-900 dark:text-amber-100 font-semibold">בחר ארגון (Tenant)</Label>
                    <Select
                      value={selectedTenantId}
                      onValueChange={setSelectedTenantId}
                    >
                      <SelectTrigger className="mt-2">
                        <SelectValue placeholder="בחר ארגון למשתמש החדש" />
                      </SelectTrigger>
                      <SelectContent>
                        {tenants?.map((tenant) => (
                          <SelectItem key={tenant.id} value={tenant.id}>
                            {tenant.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                      המשתמש ישוייך לארגון הנבחר
                    </p>
                  </div>
                )}
                <div>
                  <Label htmlFor="invite-email">אימייל משתמש</Label>
                  <Input
                    id="invite-email"
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="user@example.com"
                  />
                </div>
                <div>
                  <Label htmlFor="invite-full-name">שם מלא (אופציונלי)</Label>
                  <Input
                    id="invite-full-name"
                    type="text"
                    value={inviteFullName}
                    onChange={(e) => setInviteFullName(e.target.value)}
                    placeholder="שם מלא של המשתמש"
                  />
                </div>
                <div>
                  <Label htmlFor="campaigner">קמפיינר משויך (אופציונלי)</Label>
                  <Select
                    value={selectedCampaignerId || "none"}
                    onValueChange={(value) => setSelectedCampaignerId(value === "none" ? "" : value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="בחר קמפיינר" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">ללא שיוך</SelectItem>
                      {campaigners?.map((campaigner) => (
                        <SelectItem key={campaigner.id} value={campaigner.id}>
                          {campaigner.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="invite-role">תפקיד</Label>
                  <Select
                    value={inviteRole}
                    onValueChange={(value) => {
                      setInviteRole(value as UserRole);
                      // Reset agencies when role changes
                      setSelectedAgencies([]);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(roleLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Sales Person Selection */}
                <div>
                  <Label htmlFor="sales-person">איש מכירות משויך (אופציונלי)</Label>
                  <Select
                    value={selectedSalesPersonId || "none"}
                    onValueChange={(value) => setSelectedSalesPersonId(value === "none" ? "" : value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="בחר איש מכירות" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">ללא שיוך</SelectItem>
                      {salesPeople?.map((salesPerson) => (
                        <SelectItem key={salesPerson.id} value={salesPerson.id}>
                          {salesPerson.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="md:col-span-2">
                  <Label>סוכנויות</Label>
                  <div className="border rounded-md p-3 space-y-2 max-h-32 overflow-y-auto">
                  {agencies?.length === 0 ? (
                    <p className="text-sm text-muted-foreground">אין סוכנויות זמינות</p>
                  ) : (
                    agencies?.map((agency) => (
                      <div key={agency.id} className="flex items-center space-x-2 space-x-reverse">
                        <input
                          type="checkbox"
                          id={`agency-${agency.id}`}
                          checked={selectedAgencies.includes(agency.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedAgencies([...selectedAgencies, agency.id]);
                            } else {
                              setSelectedAgencies(selectedAgencies.filter((id) => id !== agency.id));
                            }
                          }}
                          className="rounded border-gray-300 text-primary focus:ring-primary"
                        />
                        <label
                          htmlFor={`agency-${agency.id}`}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                        >
                          {agency.name}
                        </label>
                      </div>
                    ))
                  )}
                  </div>
                  {selectedAgencies.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      נבחרו {selectedAgencies.length} סוכנויות
                    </p>
                  )}
                </div>
                <div className="md:col-span-2">
                  <Label>הרשאות מודולים</Label>
                  <div className="border rounded-md p-3 space-y-2 max-h-32 overflow-y-auto">
                  {[
                    { id: "leads", name: "ניהול לידים" },
                    { id: "clients", name: "ניהול לקוחות" },
                    { id: "client_onboarding", name: "קליטת לקוחות" },
                    { id: "campaigners", name: "ניהול קמפיינרים" },
                    { id: "agencies", name: "ניהול סוכנויות" },
                    { id: "sales_people", name: "ניהול אנשי מכירות" },
                    { id: "suppliers", name: "ניהול ספקים" },
                    { id: "tasks", name: "משימות" },
                    { id: "finance", name: "פיננסים" },
                    { id: "reports", name: "דוחות" },
                    { id: "time_tracking", name: "מעקב זמן" },
                  ].map((module) => (
                    <div key={module.id} className="flex items-center space-x-2 space-x-reverse">
                      <input
                        type="checkbox"
                        id={`module-${module.id}`}
                        checked={selectedModules.includes(module.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedModules([...selectedModules, module.id]);
                          } else {
                            setSelectedModules(selectedModules.filter((id) => id !== module.id));
                          }
                        }}
                        className="rounded border-gray-300 text-primary focus:ring-primary"
                      />
                      <label
                        htmlFor={`module-${module.id}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        {module.name}
                      </label>
                    </div>
                  ))}
                  </div>
                  {selectedModules.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      נבחרו {selectedModules.length} מודולים
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    מודולים שלא נבחרו יהיו נעולים למשתמש
                  </p>
                </div>
              </div>
            </ScrollArea>
            <div className="pt-4 border-t">
              <Button
                onClick={() =>
                  inviteUserMutation.mutate({
                    email: inviteEmail,
                    fullName: inviteFullName || undefined,
                    role: inviteRole,
                    agencyIds: selectedAgencies,
                    modulePermissions: selectedModules,
                    campaignerId: selectedCampaignerId || undefined,
                    salesPersonId: selectedSalesPersonId || undefined,
                  })
                }
                disabled={!inviteEmail || inviteUserMutation.isPending}
                className="w-full"
              >
                {inviteUserMutation.isPending ? "שולח..." : "שלח הזמנה"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {isSuperAdmin ? (
        <Tabs defaultValue="users" dir="rtl">
          <TabsList className="grid w-full grid-cols-2 h-auto">
            <TabsTrigger value="users" className="text-xs md:text-sm py-2">ניהול משתמשים</TabsTrigger>
            <TabsTrigger value="tenants" className="text-xs md:text-sm py-2">ניהול ארגונים (SaaS)</TabsTrigger>
          </TabsList>
          
          <TabsContent value="users" className="mt-4 md:mt-6">
            <div className="mb-4 flex gap-4 items-center">
              <Label className="text-sm font-medium">סנן לפי סוכנות:</Label>
              <Select value={agencyFilter} onValueChange={setAgencyFilter}>
                <SelectTrigger className="w-[250px]">
                  <SelectValue placeholder="כל הסוכנויות" />
                </SelectTrigger>
                <SelectContent align="end">
                  <SelectItem value="all">כל הסוכנויות</SelectItem>
                  {agencies?.map((agency) => (
                    <SelectItem key={agency.id} value={agency.id}>
                      {agency.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {isLoading ? (
              <Card className="p-6 text-center">טוען...</Card>
            ) : isMobile ? (
              <div className="space-y-4">
                {filteredUsers?.map((user: any) => (
                  <Card key={user.id} className="p-4">
                    <div className="space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-medium">{user.full_name || "-"}</div>
                          <div className="text-sm text-muted-foreground">{user.email}</div>
                        </div>
                        {user.role && (
                          <Badge className={roleBadgeColors[user.role]}>
                            {roleLabels[user.role]}
                          </Badge>
                        )}
                      </div>
                      
                      {user.campaigner_name && (
                        <div className="text-sm">
                          <span className="text-muted-foreground">קמפיינר: </span>
                          <span>{user.campaigner_name}</span>
                        </div>
                      )}
                      
                      {user.sales_person_name && (
                        <div className="text-sm">
                          <span className="text-muted-foreground">איש מכירות: </span>
                          <span>{user.sales_person_name}</span>
                        </div>
                      )}
                      
                      <div className="flex flex-wrap gap-2 pt-2 border-t">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setEditNameUserId(user.id);
                            setEditNameUserEmail(user.email);
                            setEditNameUserFullName(user.full_name || "");
                          }}
                          className="flex-1"
                        >
                          ערוך שם
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setEditAgenciesUserId(user.id);
                            setEditAgenciesUserEmail(user.email);
                          }}
                          className="flex-1"
                        >
                          <Settings className="h-3 w-3 ml-1" />
                          סוכנויות
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setEditPermissionsUserId(user.id);
                            setEditPermissionsUserEmail(user.email);
                          }}
                          className="flex-1"
                        >
                          <Lock className="h-3 w-3 ml-1" />
                          הרשאות
                        </Button>
                        <Select
                          value={user.role || ""}
                          onValueChange={(role) =>
                            updateRoleMutation.mutate({
                              userId: user.id,
                              role: role as UserRole,
                            })
                          }
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="שנה תפקיד" />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(roleLabels).map(([value, label]) => (
                              <SelectItem key={value} value={value}>
                                {label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <div className="flex gap-2 w-full">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => resendInviteMutation.mutate({ email: user.email })}
                            disabled={resendInviteMutation.isPending}
                            className="flex-1"
                          >
                            <Mail className="h-3 w-3 ml-1" />
                            שלח מחדש
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => {
                              if (confirm(`האם למחוק את ${user.email}? פעולה זו תמחק את המשתמש לחלוטין מהמערכת.`)) {
                                deleteUserMutation.mutate({ userId: user.id });
                              }
                            }}
                            disabled={deleteUserMutation.isPending}
                            className="flex-1"
                            title="מחק משתמש"
                          >
                            <Trash2 className="h-3 w-3 ml-1" />
                            מחק
                          </Button>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <div className="overflow-x-auto">
                  <Table className="min-w-[1200px] whitespace-nowrap">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right">שם מלא</TableHead>
                        <TableHead className="text-right">אימייל</TableHead>
                        <TableHead className="text-right">תפקידים</TableHead>
                        <TableHead className="text-right">קמפיינר משויך</TableHead>
                        <TableHead className="text-right">איש מכירות</TableHead>
                        <TableHead className="text-right">סוכנויות איש מכירות</TableHead>
                        <TableHead className="text-right">פעולות</TableHead>
                      </TableRow>
                    </TableHeader>
              <TableBody>
                {filteredUsers?.map((user: any) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{user.full_name || "-"}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditNameUserId(user.id);
                            setEditNameUserEmail(user.email);
                            setEditNameUserFullName(user.full_name || "");
                          }}
                          className="h-6 px-2 text-xs"
                        >
                          ערוך
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      {user.role ? (
                        <Badge className={roleBadgeColors[user.role]}>
                          {roleLabels[user.role]}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">
                          אין תפקיד
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="text-sm">
                          {user.campaigner_name || "-"}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditCampaignerUserId(user.id);
                            setEditCampaignerUserEmail(user.email);
                          }}
                          className="h-6 px-2 text-xs"
                        >
                          ערוך
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="text-sm">
                          {user.sales_person_name || "-"}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditSalesPersonUserId(user.id);
                            setEditSalesPersonUserEmail(user.email);
                          }}
                          className="h-6 px-2 text-xs"
                        >
                          ערוך
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      {user.sales_person_id ? (
                        <div className="flex items-center gap-2">
                          <span className="text-sm">
                            {salesPeopleWithAgencies?.find(sp => sp.id === user.sales_person_id)?.agencies.map(a => a.name).join(", ") || "אין סוכנויות"}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const salesPerson = salesPeopleWithAgencies?.find(sp => sp.id === user.sales_person_id);
                              if (salesPerson) {
                                setEditSalesPersonAgencies(salesPerson);
                              }
                            }}
                            className="h-6 px-2 text-xs"
                          >
                            ערוך סוכנויות
                          </Button>
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Select
                          value={user.role || ""}
                          onValueChange={(role) =>
                            updateRoleMutation.mutate({
                              userId: user.id,
                              role: role as UserRole,
                            })
                          }
                        >
                          <SelectTrigger className="w-[140px]">
                            <SelectValue placeholder="בחר תפקיד" />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(roleLabels).map(([value, label]) => (
                              <SelectItem key={value} value={value}>
                                {label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => {
                            setEditAgenciesUserId(user.id);
                            setEditAgenciesUserEmail(user.email);
                          }}
                          title="ערוך סוכנויות"
                        >
                          <Settings className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => {
                            setEditPermissionsUserId(user.id);
                            setEditPermissionsUserEmail(user.email);
                          }}
                          title="ערוך הרשאות"
                        >
                          <Lock className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => {
                            if (confirm(`האם לשלוח הזמנה מחדש ל-${user.email}?`)) {
                              resendInviteMutation.mutate({ email: user.email });
                            }
                          }}
                          disabled={resendInviteMutation.isPending}
                          title="שלח הזמנה מחדש"
                        >
                          <Mail className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="destructive"
                          size="icon"
                          onClick={() => {
                            if (confirm(`האם אתה בטוח שברצונך למחוק את ${user.email}? פעולה זו תמחק את המשתמש לחלוטין מהמערכת.`)) {
                              deleteUserMutation.mutate({ userId: user.id });
                            }
                          }}
                          disabled={deleteUserMutation.isPending}
                          title="מחק משתמש לחלוטין"
                          className="flex-shrink-0"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
                </div>
              </Card>
            )}
          </TabsContent>

            <TabsContent value="tenants" className="mt-6">
              <Card>
                <div className="p-6">
                  <h2 className="text-xl font-semibold mb-4">ניהול ארגונים (Tenants)</h2>
                  <p className="text-sm text-muted-foreground mb-6">
                    כל ארגון מייצג לקוח SaaS נפרד עם משתמשים ונתונים משלו
                  </p>
                  
                  {!tenants || tenants.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      אין ארגונים במערכת. לחץ על "הוסף ארגון" כדי להתחיל.
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-right">שם הארגון</TableHead>
                          <TableHead className="text-right">סטטוס</TableHead>
                          <TableHead className="text-right">איש קשר</TableHead>
                          <TableHead className="text-right">תאריך יצירה</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {tenants.map((tenant: any) => (
                          <TableRow key={tenant.id}>
                            <TableCell className="font-medium">{tenant.name}</TableCell>
                            <TableCell>
                              <Badge variant={tenant.status === 'active' ? 'default' : 'secondary'}>
                                {tenant.status === 'active' ? 'פעיל' : tenant.status}
                              </Badge>
                            </TableCell>
                            <TableCell>{tenant.contact_name || '-'}</TableCell>
                            <TableCell>{new Date(tenant.created_at).toLocaleDateString('he-IL')}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
              </Card>
            </TabsContent>
          </Tabs>
        ) : isLoading ? (
          <Card className="p-6 text-center">טוען...</Card>
        ) : (
          <>
            <div className="mb-4 flex gap-4 items-center">
              <Label className="text-sm font-medium">סנן לפי סוכנות:</Label>
              <Select value={agencyFilter} onValueChange={setAgencyFilter}>
                <SelectTrigger className="w-[250px]">
                  <SelectValue placeholder="כל הסוכנויות" />
                </SelectTrigger>
                <SelectContent align="end">
                  <SelectItem value="all">כל הסוכנויות</SelectItem>
                  {agencies?.map((agency) => (
                    <SelectItem key={agency.id} value={agency.id}>
                      {agency.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {isMobile ? (
              <div className="space-y-4">
                {filteredUsers?.map((user: any) => (
              <Card key={user.id} className="p-4">
                <div className="space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-medium">{user.full_name || "-"}</div>
                      <div className="text-sm text-muted-foreground">{user.email}</div>
                    </div>
                    {user.role && (
                      <Badge className={roleBadgeColors[user.role]}>
                        {roleLabels[user.role]}
                      </Badge>
                    )}
                  </div>
                  
                  {user.campaigner_name && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">קמפיינר: </span>
                      <span>{user.campaigner_name}</span>
                    </div>
                  )}
                  
                  {user.sales_person_name && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">איש מכירות: </span>
                      <span>{user.sales_person_name}</span>
                    </div>
                  )}
                  
                  <div className="flex flex-wrap gap-2 pt-2 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditNameUserId(user.id);
                        setEditNameUserEmail(user.email);
                        setEditNameUserFullName(user.full_name || "");
                      }}
                      className="flex-1"
                    >
                      ערוך שם
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditCampaignerUserId(user.id);
                        setEditCampaignerUserEmail(user.email);
                      }}
                      className="flex-1"
                    >
                      קמפיינר
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditSalesPersonUserId(user.id);
                        setEditSalesPersonUserEmail(user.email);
                      }}
                      className="flex-1"
                    >
                      מכירות
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditAgenciesUserId(user.id);
                        setEditAgenciesUserEmail(user.email);
                      }}
                      className="flex-1"
                    >
                      <Settings className="h-3 w-3 ml-1" />
                      סוכנויות
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditPermissionsUserId(user.id);
                        setEditPermissionsUserEmail(user.email);
                      }}
                      className="flex-1"
                    >
                      <Lock className="h-3 w-3 ml-1" />
                      הרשאות
                    </Button>
                    <Select
                      value={user.role || ""}
                      onValueChange={(value) =>
                        updateRoleMutation.mutate({
                          userId: user.id,
                          role: value as UserRole,
                        })
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="שנה תפקיד" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(roleLabels).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex gap-2 w-full">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => resendInviteMutation.mutate({ email: user.email })}
                        disabled={resendInviteMutation.isPending}
                        className="flex-1"
                      >
                        <Mail className="h-3 w-3 ml-1" />
                        שלח מחדש
                      </Button>
                        {user.id !== currentUserId && (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => {
                              if (confirm(`האם למחוק את ${user.email}?`)) {
                                deleteUserMutation.mutate({ userId: user.id });
                              }
                            }}
                            className="flex-1"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <div className="overflow-x-auto">
              <Table className="min-w-[1200px] whitespace-nowrap">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">שם מלא</TableHead>
                      <TableHead className="text-right">אימייל</TableHead>
                      <TableHead className="text-right">תפקידים</TableHead>
                      <TableHead className="text-right">קמפיינר משויך</TableHead>
                      <TableHead className="text-right">איש מכירות</TableHead>
                      <TableHead className="text-right">סוכנויות איש מכירות</TableHead>
                      <TableHead className="text-right">פעולות</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers?.map((user: any) => (
                      <TableRow key={user.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="text-sm">{user.full_name || "-"}</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEditNameUserId(user.id);
                                setEditNameUserEmail(user.email);
                                setEditNameUserFullName(user.full_name || "");
                              }}
                              className="h-6 px-2 text-xs"
                            >
                              ערוך
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>
                          {user.role ? (
                            <Badge className={roleBadgeColors[user.role]}>
                              {roleLabels[user.role]}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">
                              אין תפקיד
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="text-sm">
                              {user.campaigner_name || "-"}
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEditCampaignerUserId(user.id);
                                setEditCampaignerUserEmail(user.email);
                              }}
                              className="h-6 px-2 text-xs"
                            >
                              ערוך
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="text-sm">
                              {user.sales_person_name || "-"}
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEditSalesPersonUserId(user.id);
                                setEditSalesPersonUserEmail(user.email);
                              }}
                              className="h-6 px-2 text-xs"
                            >
                              ערוך
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell>
                          {user.sales_person_id ? (
                            <div className="flex items-center gap-2">
                              <span className="text-sm">
                                {salesPeopleWithAgencies?.find(sp => sp.id === user.sales_person_id)?.agencies.map(a => a.name).join(", ") || "אין סוכנויות"}
                              </span>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  const salesPerson = salesPeopleWithAgencies?.find(sp => sp.id === user.sales_person_id);
                                  if (salesPerson) {
                                    setEditSalesPersonAgencies(salesPerson);
                                  }
                                }}
                                className="h-6 px-2 text-xs"
                              >
                                ערוך
                              </Button>
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setEditAgenciesUserId(user.id);
                                setEditAgenciesUserEmail(user.email);
                              }}
                              className="h-8"
                            >
                              <Settings className="h-3 w-3 ml-1" />
                              סוכנויות
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setEditPermissionsUserId(user.id);
                                setEditPermissionsUserEmail(user.email);
                              }}
                              className="h-8"
                            >
                              <Lock className="h-3 w-3 ml-1" />
                              הרשאות
                            </Button>
                            <Select
                              value={user.role || ""}
                              onValueChange={(value) =>
                                updateRoleMutation.mutate({
                                  userId: user.id,
                                  role: value as UserRole,
                                })
                              }
                            >
                              <SelectTrigger className="h-8 w-[140px]">
                                <SelectValue placeholder="שנה תפקיד" />
                              </SelectTrigger>
                              <SelectContent>
                                {Object.entries(roleLabels).map(([value, label]) => (
                                  <SelectItem key={value} value={value}>
                                    {label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => resendInviteMutation.mutate({ email: user.email })}
                              disabled={resendInviteMutation.isPending}
                              className="h-8"
                            >
                              <Mail className="h-3 w-3 ml-1" />
                              שלח מחדש
                            </Button>
                            {user.id !== currentUserId && (
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => {
                                  if (confirm(`האם אתה בטוח שברצונך למחוק את ${user.email}?`)) {
                                    deleteUserMutation.mutate({ userId: user.id });
                                  }
                                }}
                                className="h-8"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          )}
        </>
      )}

      <Card className="p-4 md:p-6 bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
        <h2 className="text-lg md:text-xl font-semibold mb-2 flex items-center gap-2">
          <Shield className="h-4 md:h-5 w-4 md:w-5" />
          הבנת מערכת הניהול
        </h2>
        <div className="mb-4 md:mb-6 p-3 md:p-4 bg-white dark:bg-gray-900 rounded-lg border">
          <h3 className="font-semibold mb-2 text-sm md:text-base">ההבדל בין ניהול משתמשים לניהול ארגונים:</h3>
          <ul className="text-xs md:text-sm space-y-2 mr-4">
            <li><strong>• ניהול משתמשים (דף זה):</strong> הוספת עובדים/קמפיינרים לארגון שלך. הם לא מקבלים חשבון נפרד, אלא נכנסים למערכת שלך.</li>
            <li><strong>• ניהול ארגונים (רק Super Admin):</strong> יצירת לקוחות SaaS חדשים שמקבלים חשבון נפרד לחלוטין.</li>
          </ul>
        </div>
        
        <h3 className="text-lg font-semibold mb-3">תפקידים זמינים:</h3>
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <Badge className={roleBadgeColors.owner}>
              {roleLabels.owner}
            </Badge>
            <p className="text-sm text-muted-foreground">
              גישה מלאה למערכת - רואה את כל הסוכנויות והלקוחות, יכול לנהל משתמשים ותפקידים
            </p>
          </div>
          <div className="flex items-start gap-3">
            <Badge className={roleBadgeColors.team_manager}>
              {roleLabels.team_manager}
            </Badge>
            <p className="text-sm text-muted-foreground">
              מנהל צוות - רואה רק סוכנויות שמשוייכות אליו דרך קישורים לקמפיינר או ניהול ישיר. חייב להיות משויך לקמפיינר פעיל או לסוכנויות ספציפיות.
            </p>
          </div>
          <div className="flex items-start gap-3">
            <Badge className={roleBadgeColors.team_manager}>
              {roleLabels.team_manager}
            </Badge>
            <p className="text-sm text-muted-foreground">
              מנהל צוות - רואה רק סוכנויות שמשוייכות אליו. חייב להיות משויך לקמפיינר פעיל.
            </p>
          </div>
          <div className="flex items-start gap-3">
            <Badge className={roleBadgeColors.campaigner}>
              {roleLabels.campaigner}
            </Badge>
            <p className="text-sm text-muted-foreground">
              קמפיינר - רואה רק סוכנויות ולקוחות שמשוייכים לקמפיינר שלו. חייב להיות משויך לקמפיינר פעיל.
            </p>
          </div>
        </div>
      </Card>

      {editAgenciesUserId && (
        <EditUserAgenciesDialog
          open={!!editAgenciesUserId}
          onOpenChange={(open) => {
            if (!open) {
              setEditAgenciesUserId(null);
              setEditAgenciesUserEmail("");
            }
          }}
          userId={editAgenciesUserId}
          userEmail={editAgenciesUserEmail}
        />
      )}

      {editPermissionsUserId && (
        <EditUserPermissionsDialog
          open={!!editPermissionsUserId}
          onOpenChange={(open) => {
            if (!open) {
              setEditPermissionsUserId(null);
              setEditPermissionsUserEmail("");
            }
          }}
          userId={editPermissionsUserId}
          userEmail={editPermissionsUserEmail}
        />
      )}

      {editCampaignerUserId && (
        <EditUserCampaignerDialog
          open={!!editCampaignerUserId}
          onOpenChange={(open) => {
            if (!open) {
              setEditCampaignerUserId(null);
              setEditCampaignerUserEmail("");
            }
          }}
          userId={editCampaignerUserId}
          userEmail={editCampaignerUserEmail}
        />
      )}

      {editSalesPersonUserId && (
        <EditUserSalesPersonDialog
          userId={editSalesPersonUserId}
          userEmail={editSalesPersonUserEmail}
          onClose={() => {
            setEditSalesPersonUserId(null);
            setEditSalesPersonUserEmail("");
          }}
        />
      )}

      {editNameUserId && (
        <EditUserNameDialog
          userId={editNameUserId}
          userEmail={editNameUserEmail}
          currentFullName={editNameUserFullName}
          onClose={() => {
            setEditNameUserId(null);
            setEditNameUserEmail("");
            setEditNameUserFullName("");
          }}
        />
      )}

      {editSalesPersonAgencies && (
        <EditSalesPersonAgenciesDialog
          open={!!editSalesPersonAgencies}
          onOpenChange={(open) => {
            if (!open) {
              setEditSalesPersonAgencies(null);
            }
          }}
          salesPerson={editSalesPersonAgencies}
        />
      )}
    </div>
  );
}
