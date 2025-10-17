import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users as UsersIcon, Mail, Shield, UserCircle } from "lucide-react";
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
  role: z.enum(["admin", "user"]),
});

export default function Users() {
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  const form = useForm<z.infer<typeof inviteSchema>>({
    resolver: zodResolver(inviteSchema),
    defaultValues: {
      email: "",
      fullName: "",
      role: "user",
    },
  });

  const { data: users, isLoading } = useQuery({
    queryKey: ["users-with-roles"],
    queryFn: async () => {
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select(`
          id,
          email,
          full_name,
          created_at,
          updated_at,
          user_roles!inner (role)
        `)
        .order("created_at", { ascending: false });

      if (profilesError) throw profilesError;
      
      // Transform the data to include role at the top level
      return profiles.map((profile: any) => ({
        id: profile.id,
        email: profile.email,
        full_name: profile.full_name,
        created_at: profile.created_at,
        updated_at: profile.updated_at,
        role: (profile.user_roles?.[0]?.role || "user") as "admin" | "user"
      }));
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, newRole }: { userId: string; newRole: "admin" | "user" }) => {
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

  const inviteUserMutation = useMutation({
    mutationFn: async (values: z.infer<typeof inviteSchema>) => {
      const redirectUrl = `${window.location.origin}/`;
      
      const { error } = await supabase.auth.signInWithOtp({
        email: values.email,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            full_name: values.fullName,
          },
        },
      });

      if (error) throw error;

      // Note: The role will be set to 'user' by default via trigger
      // Admin should manually update if needed after user confirms email
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

  const getRoleText = (role: string) => {
    return role === "admin" ? "מנהל" : "משתמש";
  };

  const getRoleColor = (role: string) => {
    return role === "admin" 
      ? "bg-destructive/10 text-destructive border-destructive/20" 
      : "bg-primary/10 text-primary border-primary/20";
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
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

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
              <TableHead className="text-right font-semibold">הרשאה</TableHead>
              <TableHead className="text-right font-semibold">תאריך הצטרפות</TableHead>
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
                      value={user.role}
                      onValueChange={(value: "admin" | "user") => 
                        updateRoleMutation.mutate({ userId: user.id, newRole: value })
                      }
                    >
                      <SelectTrigger className="w-[140px] h-9 bg-background hover:bg-accent/10 transition-colors">
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
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="py-4 text-sm text-muted-foreground">
                    {new Date(user.created_at).toLocaleDateString("he-IL")}
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
    </div>
  );
}
