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
import { Shield, UserPlus, Trash2 } from "lucide-react";
import { useState } from "react";
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
  agency_owner: "בעל סוכנות",
  team_manager: "מנהל צוות",
  campaigner: "קמפיינר",
};

const roleBadgeColors: Record<UserRole, string> = {
  owner: "bg-purple-500",
  agency_owner: "bg-blue-500",
  team_manager: "bg-green-500",
  campaigner: "bg-orange-500",
};

export default function Users() {
  const { isOwner, isAgencyOwner, userId: currentUserId } = useUserRole();
  const queryClient = useQueryClient();
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<UserRole>("campaigner");
  const [selectedAgencies, setSelectedAgencies] = useState<string[]>([]);

  const { data: agencies } = useQuery({
    queryKey: ["agencies", currentUserId],
    queryFn: async () => {
      if (isOwner) {
        // Owner sees all agencies
        const { data, error } = await supabase
          .from("agencies")
          .select("id, name")
          .order("name");
        if (error) throw error;
        return data;
      } else if (isAgencyOwner) {
        // Agency owner sees only their agencies
        // First get campaigner_id from profile
        const { data: profile } = await supabase
          .from("profiles")
          .select("campaigner_id")
          .eq("id", currentUserId)
          .single();
        
        if (!profile?.campaigner_id) {
          return [];
        }
        
        // Get agencies through campaigner_agencies
        const { data: agencyLinks, error } = await supabase
          .from("campaigner_agencies")
          .select("agency_id, agencies(id, name)")
          .eq("campaigner_id", profile.campaigner_id);
        
        if (error) throw error;
        
        // Extract agencies
        return agencyLinks?.map((link: any) => link.agencies).filter((a: any) => a) || [];
      }
      return [];
    },
  });

  const { data: users, isLoading } = useQuery({
    queryKey: ["users-with-roles"],
    queryFn: async () => {
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, email, full_name");

      if (profilesError) throw profilesError;

      const { data: userRoles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role");

      if (rolesError) throw rolesError;

      return profiles.map((profile) => {
        const userRole = userRoles.find((r) => r.user_id === profile.id);
        return {
          ...profile,
          role: userRole?.role as UserRole | undefined,
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users-with-roles"] });
      toast.success("התפקיד עודכן בהצלחה");
    },
    onError: (error: Error) => {
      toast.error("שגיאה בעדכון תפקיד: " + error.message);
    },
  });


  const inviteUserMutation = useMutation({
    mutationFn: async ({ email, role, agencyIds }: { email: string; role: UserRole; agencyIds: string[] }) => {
      const { data, error } = await supabase.functions.invoke("invite-user", {
        body: { 
          email, 
          role,
          agencyIds,
          redirectUrl: `${window.location.origin}/setup`
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
      setInviteRole("campaigner");
      setSelectedAgencies([]);
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

  if (!isOwner && !isAgencyOwner) {
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
    <div className="container mx-auto py-6 space-y-6" dir="rtl">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">ניהול משתמשים</h1>
          <p className="text-muted-foreground">
            ניהול משתמשים ותפקידים במערכת
          </p>
        </div>
        <Dialog open={isInviteDialogOpen} onOpenChange={setIsInviteDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="h-4 w-4 ml-2" />
              הזמן משתמש חדש
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>הזמן משתמש חדש</DialogTitle>
              <DialogDescription>
                המשתמש יקבל מייל עם קישור ליצירת חשבון והגדרת סיסמה
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
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
              <div>
                <Label>סוכנויות</Label>
                <div className="border rounded-md p-3 space-y-2 max-h-48 overflow-y-auto">
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
              <Button
                onClick={() =>
                  inviteUserMutation.mutate({
                    email: inviteEmail,
                    role: inviteRole,
                    agencyIds: selectedAgencies,
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
                <TableHead className="text-right">פעולות</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users?.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>{user.full_name || "-"}</TableCell>
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
              גישה מלאה למערכת, יכול לנהל משתמשים ותפקידים
            </p>
          </div>
          <div className="flex items-start gap-3">
            <Badge className={roleBadgeColors.agency_owner}>
              {roleLabels.agency_owner}
            </Badge>
            <p className="text-sm text-muted-foreground">
              בעלים של סוכנות, יכול לנהל את הסוכנות שלו ולקוחות
            </p>
          </div>
          <div className="flex items-start gap-3">
            <Badge className={roleBadgeColors.team_manager}>
              {roleLabels.team_manager}
            </Badge>
            <p className="text-sm text-muted-foreground">
              מנהל צוות, יכול לנהל קמפיינרים ומשימות
            </p>
          </div>
          <div className="flex items-start gap-3">
            <Badge className={roleBadgeColors.campaigner}>
              {roleLabels.campaigner}
            </Badge>
            <p className="text-sm text-muted-foreground">
              קמפיינר, גישה בסיסית למערכת
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
