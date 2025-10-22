import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users as UsersIcon, Mail, Shield, UserCircle, Edit, Trash2 } from "lucide-react";
import EditManagedAgenciesDialog from "@/components/forms/EditManagedAgenciesDialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

const inviteSchema = z.object({
  email: z.string().email("אימייל לא תקין"),
  fullName: z.string().min(1, "שם מלא הוא שדה חובה"),
  role: z.enum(["admin", "user", "agency_manager"]),
  agencyIds: z.array(z.string()).optional(),
});

const editSchema = z.object({
  fullName: z.string().min(1, "שם מלא הוא שדה חובה"),
});

export default function Users() {
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [agenciesDialogOpen, setAgenciesDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const queryClient = useQueryClient();

  const form = useForm<z.infer<typeof inviteSchema>>({
    resolver: zodResolver(inviteSchema),
    defaultValues: {
      email: "",
      fullName: "",
      role: "user",
      agencyIds: [],
    },
  });

  const editForm = useForm<z.infer<typeof editSchema>>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      fullName: "",
    },
  });

  const { data: users, isLoading } = useQuery({
    queryKey: ["users-with-roles"],
    queryFn: async () => {
      // Get all profiles
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, email, full_name, created_at, updated_at, campaigner_id")
        .order("created_at", { ascending: false });

      if (profilesError) throw profilesError;
      
      // Get all user roles
      const { data: userRoles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role");

      if (rolesError) throw rolesError;

      // Get user managed agencies
      const { data: userAgencies, error: agenciesError } = await supabase
        .from("user_managed_agencies")
        .select("user_id, agency_id, agencies(name)");

      if (agenciesError) throw agenciesError;

      // Create a map of user_id to role
      const rolesMap = new Map(userRoles?.map(r => [r.user_id, r.role]) || []);
      
      // Create a map of user_id to managed agencies
      const agenciesMap = new Map<string, any[]>();
      userAgencies?.forEach((ua: any) => {
        if (!agenciesMap.has(ua.user_id)) {
          agenciesMap.set(ua.user_id, []);
        }
        agenciesMap.get(ua.user_id)?.push({
          id: ua.agency_id,
          name: ua.agencies?.name
        });
      });
      
      // Combine the data
      return profiles.map((profile: any) => ({
        id: profile.id,
        email: profile.email,
        full_name: profile.full_name,
        created_at: profile.created_at,
        updated_at: profile.updated_at,
        campaigner_id: profile.campaigner_id,
        role: (rolesMap.get(profile.id) || "user") as "admin" | "user" | "owner" | "agency_manager",
        managed_agencies: agenciesMap.get(profile.id) || []
      }));
    },
  });

  const { data: campaigners } = useQuery({
    queryKey: ["campaigners"],
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

  const { data: agencies } = useQuery({
    queryKey: ["agencies"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agencies")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, newRole }: { userId: string; newRole: "admin" | "user" | "agency_manager" }) => {
      // First, delete existing role
      await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId);

      // Then insert new role
      const { error } = await supabase
        .from("user_roles")
        .insert({ user_id: userId, role: newRole });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("ההרשאה עודכנה בהצלחה");
      queryClient.invalidateQueries({ queryKey: ["users-with-roles"] });
    },
    onError: () => {
      toast.error("שגיאה בעדכון ההרשאה");
    },
  });

  const updateManagedAgenciesMutation = useMutation({
    mutationFn: async ({ userId, agencyIds }: { userId: string; agencyIds: string[] }) => {
      // First, delete existing managed agencies
      await supabase
        .from("user_managed_agencies")
        .delete()
        .eq("user_id", userId);

      // Then insert new managed agencies
      if (agencyIds.length > 0) {
        const { error } = await supabase
          .from("user_managed_agencies")
          .insert(agencyIds.map(agencyId => ({ user_id: userId, agency_id: agencyId })));

        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("הסוכנויות עודכנו בהצלחה");
      queryClient.invalidateQueries({ queryKey: ["users-with-roles"] });
    },
    onError: () => {
      toast.error("שגיאה בעדכון הסוכנויות");
    },
  });

  const assignCampaignerMutation = useMutation({
    mutationFn: async ({ userId, campaignerId }: { userId: string; campaignerId: string | null }) => {
      const { error } = await supabase
        .from("profiles")
        .update({ campaigner_id: campaignerId })
        .eq("id", userId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("הקמפיינר שויך בהצלחה");
      queryClient.invalidateQueries({ queryKey: ["users-with-roles"] });
    },
    onError: () => {
      toast.error("שגיאה בשיוך הקמפיינר");
    },
  });

  const inviteUserMutation = useMutation({
    mutationFn: async (values: z.infer<typeof inviteSchema>) => {
      const { data, error } = await supabase.functions.invoke("invite-user", {
        body: {
          email: values.email,
          fullName: values.fullName,
          role: values.role,
          agencyIds: values.agencyIds || [],
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      toast.success("הזמנה נשלחה בהצלחה");
      setInviteDialogOpen(false);
      form.reset();
    },
    onError: (error: Error) => {
      toast.error(`שגיאה בשליחת ההזמנה: ${error.message}`);
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: async ({ userId, fullName }: { userId: string; fullName: string }) => {
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: fullName })
        .eq("id", userId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("המשתמש עודכן בהצלחה");
      queryClient.invalidateQueries({ queryKey: ["users-with-roles"] });
      setEditDialogOpen(false);
    },
    onError: () => {
      toast.error("שגיאה בעדכון המשתמש");
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { data, error } = await supabase.functions.invoke("delete-user", {
        body: { userId },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      toast.success("המשתמש נמחק בהצלחה");
      queryClient.invalidateQueries({ queryKey: ["users-with-roles"] });
      setDeleteDialogOpen(false);
    },
    onError: () => {
      toast.error("שגיאה במחיקת המשתמש");
    },
  });

  const getRoleText = (role: string) => {
    switch (role) {
      case "admin": return "מנהל";
      case "agency_manager": return "מנהל סוכנות";
      case "owner": return "בעלים";
      default: return "משתמש";
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case "admin": return "bg-destructive/10 text-destructive border-destructive/20";
      case "agency_manager": return "bg-accent/10 text-accent-foreground border-accent/20";
      case "owner": return "bg-primary/10 text-primary border-primary/20";
      default: return "bg-muted/10 text-muted-foreground border-muted/20";
    }
  };

  if (isLoading) {
    return <div className="flex justify-center p-8">טוען...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">משתמשים</h2>
          <p className="text-muted-foreground mt-1">ניהול משתמשים והרשאות במערכת</p>
        </div>

        <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Mail className="h-4 w-4" />
              הזמן משתמש
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>הזמן משתמש חדש</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit((values) => inviteUserMutation.mutate(values))} className="space-y-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>אימייל</FormLabel>
                      <FormControl>
                        <Input type="email" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="fullName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>שם מלא</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>הרשאה</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="bg-background">
                          <SelectItem value="user">משתמש</SelectItem>
                          <SelectItem value="admin">מנהל</SelectItem>
                          <SelectItem value="agency_manager">מנהל סוכנות</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {form.watch("role") === "agency_manager" && (
                  <FormField
                    control={form.control}
                    name="agencyIds"
                    render={() => (
                      <FormItem>
                        <FormLabel>סוכנויות מנוהלות</FormLabel>
                        <div className="space-y-2 max-h-48 overflow-y-auto border rounded-md p-3">
                          {agencies?.map((agency) => (
                            <FormField
                              key={agency.id}
                              control={form.control}
                              name="agencyIds"
                              render={({ field }) => (
                                <FormItem className="flex items-center space-x-2 space-x-reverse">
                                  <FormControl>
                                    <input
                                      type="checkbox"
                                      checked={field.value?.includes(agency.id)}
                                      onChange={(e) => {
                                        const newValue = e.target.checked
                                          ? [...(field.value || []), agency.id]
                                          : (field.value || []).filter((id) => id !== agency.id);
                                        field.onChange(newValue);
                                      }}
                                      className="h-4 w-4"
                                    />
                                  </FormControl>
                                  <FormLabel className="font-normal cursor-pointer">
                                    {agency.name}
                                  </FormLabel>
                                </FormItem>
                              )}
                            />
                          ))}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <Button type="submit" disabled={inviteUserMutation.isPending} className="w-full">
                  {inviteUserMutation.isPending ? "שולח..." : "שלח הזמנה"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-card rounded-lg border shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50 border-b">
              <TableHead className="text-right font-semibold h-12">שם</TableHead>
              <TableHead className="text-right font-semibold">אימייל</TableHead>
              <TableHead className="text-right font-semibold">קמפיינר</TableHead>
              <TableHead className="text-right font-semibold">הרשאה</TableHead>
              <TableHead className="text-right font-semibold">סוכנויות מנוהלות</TableHead>
              <TableHead className="text-right font-semibold">תאריך הצטרפות</TableHead>
              <TableHead className="text-right font-semibold">פעולות</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users?.map((user) => {
              return (
                <TableRow 
                  key={user.id}
                  className="hover:bg-accent/5 transition-colors border-b border-border/50"
                >
                  <TableCell className="py-4">
                    <div className="flex items-center gap-2">
                      <UserCircle className="h-5 w-5 text-muted-foreground" />
                      <span className="font-medium">{user.full_name || "-"}</span>
                    </div>
                  </TableCell>
                  <TableCell className="py-4">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Mail className="h-4 w-4" />
                      <span>{user.email}</span>
                    </div>
                  </TableCell>
                  <TableCell className="py-4">
                    <Select
                      value={user.campaigner_id || "none"}
                      onValueChange={(value) => 
                        assignCampaignerMutation.mutate({ 
                          userId: user.id, 
                          campaignerId: value === "none" ? null : value 
                        })
                      }
                    >
                      <SelectTrigger className="w-[180px] h-9 bg-background hover:bg-accent/10 transition-colors">
                        <SelectValue placeholder="בחר קמפיינר" />
                      </SelectTrigger>
                      <SelectContent className="bg-background">
                        <SelectItem value="none">ללא קמפיינר</SelectItem>
                        {campaigners?.map((campaigner) => (
                          <SelectItem key={campaigner.id} value={campaigner.id}>
                            {campaigner.full_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="py-4">
                    <Select
                      value={user.role}
                      onValueChange={(value: "admin" | "user" | "agency_manager") => 
                        updateRoleMutation.mutate({ userId: user.id, newRole: value })
                      }
                    >
                      <SelectTrigger className="w-[160px] h-9 bg-background hover:bg-accent/10 transition-colors">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-background">
                        <SelectItem value="user">
                          <div className="flex items-center gap-2">
                            <UserCircle className="h-4 w-4" />
                            משתמש
                          </div>
                        </SelectItem>
                        <SelectItem value="admin">
                          <div className="flex items-center gap-2">
                            <Shield className="h-4 w-4" />
                            מנהל
                          </div>
                        </SelectItem>
                        <SelectItem value="agency_manager">
                          <div className="flex items-center gap-2">
                            <Shield className="h-4 w-4" />
                            מנהל סוכנות
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="py-4">
                    {user.role === "agency_manager" ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedUser(user);
                          setAgenciesDialogOpen(true);
                        }}
                      >
                        {user.managed_agencies?.length > 0
                          ? `${user.managed_agencies.length} סוכנויות`
                          : "בחר סוכנויות"}
                      </Button>
                    ) : (
                      <span className="text-muted-foreground text-sm">-</span>
                    )}
                  </TableCell>
                  <TableCell className="py-4 text-sm text-muted-foreground">
                    {new Date(user.created_at).toLocaleDateString("he-IL")}
                  </TableCell>
                  <TableCell className="py-4">
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedUser(user);
                          editForm.setValue("fullName", user.full_name || "");
                          setEditDialogOpen(true);
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedUser(user);
                          setDeleteDialogOpen(true);
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {users?.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <UsersIcon className="h-16 w-16 text-muted-foreground mb-4" />
            <p className="text-lg font-medium mb-2">אין משתמשים במערכת</p>
            <p className="text-muted-foreground">הזמן משתמש ראשון</p>
          </CardContent>
        </Card>
      )}

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ערוך משתמש</DialogTitle>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit((values) => {
              if (selectedUser) {
                updateUserMutation.mutate({ 
                  userId: selectedUser.id, 
                  fullName: values.fullName 
                });
              }
            })} className="space-y-4">
              <FormField
                control={editForm.control}
                name="fullName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>שם מלא</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={updateUserMutation.isPending} className="w-full">
                {updateUserMutation.isPending ? "שומר..." : "שמור שינויים"}
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>האם אתה בטוח?</AlertDialogTitle>
            <AlertDialogDescription>
              פעולה זו תמחק את המשתמש לצמיתות. לא ניתן לשחזר את הנתונים.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ביטול</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (selectedUser) {
                  deleteUserMutation.mutate(selectedUser.id);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              מחק
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {selectedUser && (
        <EditManagedAgenciesDialog
          open={agenciesDialogOpen}
          onOpenChange={setAgenciesDialogOpen}
          user={selectedUser}
        />
      )}
    </div>
  );
}
