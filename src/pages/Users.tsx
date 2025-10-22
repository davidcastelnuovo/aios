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
  const { isOwner } = useUserRole();
  const queryClient = useQueryClient();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserRole, setNewUserRole] = useState<UserRole>("campaigner");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<UserRole>("campaigner");

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

      return profiles.map((profile) => ({
        ...profile,
        roles: userRoles
          .filter((r) => r.user_id === profile.id)
          .map((r) => r.role as UserRole),
      }));
    },
  });

  const assignRoleMutation = useMutation({
    mutationFn: async ({
      email,
      role,
    }: {
      email: string;
      role: UserRole;
    }) => {
      const { error } = await supabase.rpc("assign_role_by_email", {
        _email: email,
        _role: role,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users-with-roles"] });
      toast.success("התפקיד נוסף בהצלחה");
      setIsAddDialogOpen(false);
      setNewUserEmail("");
      setNewUserRole("campaigner");
    },
    onError: (error: Error) => {
      toast.error("שגיאה בהוספת תפקיד: " + error.message);
    },
  });

  const removeRoleMutation = useMutation({
    mutationFn: async ({
      userId,
      role,
    }: {
      userId: string;
      role: UserRole;
    }) => {
      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId)
        .eq("role", role);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users-with-roles"] });
      toast.success("התפקיד הוסר בהצלחה");
    },
    onError: (error: Error) => {
      toast.error("שגיאה בהסרת תפקיד: " + error.message);
    },
  });

  const inviteUserMutation = useMutation({
    mutationFn: async ({ email, role }: { email: string; role: UserRole }) => {
      const { data, error } = await supabase.functions.invoke("invite-user", {
        body: { 
          email, 
          role,
          redirectUrl: `${window.location.origin}/auth?type=recovery`
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
    },
    onError: (error: Error) => {
      toast.error("שגיאה בשליחת הזמנה: " + error.message);
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
              רק בעלים יכולים לגשת לדף זה
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
        <div className="flex gap-2">
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
                    onValueChange={(value) => setInviteRole(value as UserRole)}
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
                <Button
                  onClick={() =>
                    inviteUserMutation.mutate({
                      email: inviteEmail,
                      role: inviteRole,
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

          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <UserPlus className="h-4 w-4 ml-2" />
                הוסף תפקיד למשתמש קיים
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>הוסף תפקיד למשתמש קיים</DialogTitle>
                <DialogDescription>
                  הוסף תפקיד נוסף למשתמש שכבר רשום במערכת
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="email">אימייל משתמש</Label>
                  <Input
                    id="email"
                    type="email"
                    value={newUserEmail}
                    onChange={(e) => setNewUserEmail(e.target.value)}
                    placeholder="user@example.com"
                  />
                </div>
                <div>
                  <Label htmlFor="role">תפקיד</Label>
                  <Select
                    value={newUserRole}
                    onValueChange={(value) => setNewUserRole(value as UserRole)}
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
                <Button
                  onClick={() =>
                    assignRoleMutation.mutate({
                      email: newUserEmail,
                      role: newUserRole,
                    })
                  }
                  disabled={!newUserEmail || assignRoleMutation.isPending}
                  className="w-full"
                >
                  הוסף תפקיד
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
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
                    <div className="flex gap-2 flex-wrap">
                      {user.roles.length === 0 ? (
                        <span className="text-muted-foreground text-sm">
                          אין תפקידים
                        </span>
                      ) : (
                        user.roles.map((role) => (
                          <Badge
                            key={role}
                            className={roleBadgeColors[role]}
                          >
                            {roleLabels[role]}
                          </Badge>
                        ))
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Select
                        onValueChange={(role) =>
                          assignRoleMutation.mutate({
                            email: user.email,
                            role: role as UserRole,
                          })
                        }
                      >
                        <SelectTrigger className="w-[180px]">
                          <SelectValue placeholder="הוסף תפקיד" />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(roleLabels).map(([value, label]) => (
                            <SelectItem
                              key={value}
                              value={value}
                              disabled={user.roles.includes(value as UserRole)}
                            >
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {user.roles.length > 0 && (
                        <Select
                          onValueChange={(role) =>
                            removeRoleMutation.mutate({
                              userId: user.id,
                              role: role as UserRole,
                            })
                          }
                        >
                          <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="הסר תפקיד" />
                          </SelectTrigger>
                          <SelectContent>
                            {user.roles.map((role) => (
                              <SelectItem key={role} value={role}>
                                {roleLabels[role]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
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
