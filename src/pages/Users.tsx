import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole, UserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
import { Shield, UserPlus, Trash2, Settings, Lock, Mail } from "lucide-react";
import { useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { EditUserAgenciesDialog } from "@/components/forms/EditUserAgenciesDialog";
import { EditUserPermissionsDialog } from "@/components/forms/EditUserPermissionsDialog";
import { EditUserCampaignerDialog } from "@/components/forms/EditUserCampaignerDialog";
import { EditUserSalesPersonDialog } from "@/components/forms/EditUserSalesPersonDialog";
import { EditUserNameDialog } from "@/components/forms/EditUserNameDialog";
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
};

const roleBadgeColors: Record<UserRole, string> = {
  owner: "bg-purple-500",
  team_manager: "bg-green-500",
  campaigner: "bg-orange-500",
  sales_person: "bg-blue-500",
};

export default function Users() {
  const { isOwner, userId: currentUserId } = useUserRole();
  const queryClient = useQueryClient();
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

      return profiles.map((profile: any) => {
        const userRole = userRoles.find((r) => r.user_id === profile.id);
        return {
          ...profile,
          role: userRole?.role as UserRole | undefined,
          campaigner_name: profile.campaigners?.full_name,
          sales_person_name: profile.sales_people?.full_name,
        };
      });
    },
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

      const { data, error } = await supabase.functions.invoke("invite-user", {
        body: { 
          email,
          fullName,
          role,
          agencyIds,
          modulePermissions,
          campaignerId,
          salesPersonId,
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      
      if (error) throw error;
      if (!data.success) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users-with-roles"] });
      toast.success("הזמנה נשלחה בהצלחה למייל המשתמש");
      setIsInviteDialogOpen(false);
      setInviteEmail("");
      setInviteFullName("");
      setInviteRole("campaigner");
      setSelectedAgencies([]);
      setSelectedModules([]);
      setSelectedCampaignerId("");
      setSelectedSalesPersonId("");
    },
    onError: (error: Error) => {
      toast.error("שגיאה בשליחת הזמנה: " + error.message);
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { data, error } = await supabase.functions.invoke("delete-user", {
        body: { userId },
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
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      
      if (error) throw error;
      if (!data.success) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast.success("הזמנה נשלחה מחדש בהצלחה");
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
    <div className="container mx-auto py-6 px-6 space-y-6" dir="rtl">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">ניהול משתמשים</h1>
        </div>
        <Dialog open={isInviteDialogOpen} onOpenChange={setIsInviteDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="h-4 w-4 ml-2" />
              הזמן משתמש חדש
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>הזמן משתמש חדש</DialogTitle>
              <DialogDescription>
                המשתמש יקבל מייל עם קישור ליצירת חשבון והגדרת סיסמה.
              </DialogDescription>
            </DialogHeader>
            <ScrollArea className="max-h-[calc(90vh-180px)] pl-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pr-4" dir="rtl">
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

      <Card>
        {isLoading ? (
          <div className="p-6 text-center">טוען...</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">שם מלא</TableHead>
                <TableHead className="text-right">אימייל</TableHead>
                <TableHead className="text-right">תפקידים</TableHead>
                <TableHead className="text-right">קמפיינר משויך</TableHead>
                <TableHead className="text-right">איש מכירות</TableHead>
                <TableHead className="text-right">פעולות</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users?.map((user: any) => (
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
                          if (confirm(`האם אתה בטוח שברצונך למחוק את ${user.email}?`)) {
                            deleteUserMutation.mutate(user.id);
                          }
                        }}
                        disabled={deleteUserMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">הסבר על התפקידים</h2>
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
    </div>
  );
}
