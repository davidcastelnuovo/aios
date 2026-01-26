import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { toast } from "sonner";
import { Users, Plus, Trash2, UserPlus, Calendar, Eye, Edit, CalendarCheck } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";

interface TenantUser {
  user_id: string;
  profiles: {
    id: string;
    email: string | null;
    full_name: string | null;
  } | null;
}

interface CalendarShare {
  id: string;
  owner_user_id: string;
  shared_with_user_id: string;
  permission_level: string;
  created_at: string;
  shared_with_profile?: {
    email: string | null;
    full_name: string | null;
  };
}

export function CalendarSharingSettings() {
  const { userId } = useCurrentUser();
  const { tenantId } = useCurrentTenant();
  const queryClient = useQueryClient();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [permissionLevel, setPermissionLevel] = useState<string>("full");

  // Fetch current shares where user is the owner
  const { data: myShares, isLoading: sharesLoading } = useQuery({
    queryKey: ["calendar-shares-owner", userId],
    queryFn: async () => {
      if (!userId) return [];

      const { data, error } = await supabase
        .from("calendar_shares")
        .select(`
          id,
          owner_user_id,
          shared_with_user_id,
          permission_level,
          created_at
        `)
        .eq("owner_user_id", userId);

      if (error) throw error;

      // Fetch profiles for shared users
      const sharedUserIds = data.map(s => s.shared_with_user_id);
      if (sharedUserIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, email, full_name")
          .in("id", sharedUserIds);

        return data.map(share => ({
          ...share,
          shared_with_profile: profiles?.find(p => p.id === share.shared_with_user_id) || null
        }));
      }

      return data;
    },
    enabled: !!userId,
  });

  // Fetch shares where other users shared with me
  const { data: sharedWithMe, isLoading: sharedWithMeLoading } = useQuery({
    queryKey: ["calendar-shares-with-me", userId],
    queryFn: async () => {
      if (!userId) return [];

      const { data, error } = await supabase
        .from("calendar_shares")
        .select(`
          id,
          owner_user_id,
          shared_with_user_id,
          permission_level,
          created_at
        `)
        .eq("shared_with_user_id", userId);

      if (error) throw error;

      // Fetch profiles for owner users
      const ownerUserIds = data.map(s => s.owner_user_id);
      if (ownerUserIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, email, full_name")
          .in("id", ownerUserIds);

        return data.map(share => ({
          ...share,
          owner_profile: profiles?.find(p => p.id === share.owner_user_id) || null
        }));
      }

      return data;
    },
    enabled: !!userId,
  });

  // Fetch tenant users for dropdown
  const { data: tenantUsers } = useQuery({
    queryKey: ["tenant-users-for-calendar", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];

      // First get tenant user IDs
      const { data: tuData, error: tuError } = await supabase
        .from("tenant_users")
        .select("user_id")
        .eq("tenant_id", tenantId);

      if (tuError) throw tuError;
      
      const userIds = tuData?.map(tu => tu.user_id) || [];
      if (userIds.length === 0) return [];

      // Then fetch profiles for those users
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, email, full_name")
        .in("id", userIds);

      if (profilesError) throw profilesError;

      return (profiles || []).map(p => ({
        user_id: p.id,
        profiles: p
      })) as TenantUser[];
    },
    enabled: !!tenantId,
  });

  // Filter out current user and already shared users
  const availableUsers = tenantUsers?.filter(tu => {
    if (tu.user_id === userId) return false;
    if (myShares?.some(s => s.shared_with_user_id === tu.user_id)) return false;
    return true;
  }) || [];

  // Add share mutation
  const addShareMutation = useMutation({
    mutationFn: async ({ sharedWithUserId, permission }: { sharedWithUserId: string; permission: string }) => {
      const { data, error } = await supabase
        .from("calendar_shares")
        .insert({
          owner_user_id: userId!,
          shared_with_user_id: sharedWithUserId,
          permission_level: permission,
          tenant_id: tenantId!,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar-shares-owner", userId] });
      toast.success("היומן שותף בהצלחה");
      setShowAddDialog(false);
      setSelectedUserId("");
      setPermissionLevel("full");
    },
    onError: (error: Error) => {
      console.error("Error sharing calendar:", error);
      toast.error("שגיאה בשיתוף היומן: " + error.message);
    },
  });

  // Remove share mutation
  const removeShareMutation = useMutation({
    mutationFn: async (shareId: string) => {
      const { error } = await supabase
        .from("calendar_shares")
        .delete()
        .eq("id", shareId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar-shares-owner", userId] });
      toast.success("השיתוף הוסר בהצלחה");
    },
    onError: (error: Error) => {
      console.error("Error removing share:", error);
      toast.error("שגיאה בהסרת השיתוף: " + error.message);
    },
  });

  // Update share permission mutation
  const updateShareMutation = useMutation({
    mutationFn: async ({ shareId, permission }: { shareId: string; permission: string }) => {
      const { error } = await supabase
        .from("calendar_shares")
        .update({ permission_level: permission })
        .eq("id", shareId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar-shares-owner", userId] });
      toast.success("ההרשאות עודכנו בהצלחה");
    },
    onError: (error: Error) => {
      console.error("Error updating share:", error);
      toast.error("שגיאה בעדכון ההרשאות: " + error.message);
    },
  });

  const getPermissionLabel = (level: string) => {
    switch (level) {
      case "view":
        return "צפייה בלבד";
      case "book":
        return "צפייה + קביעת פגישות";
      case "full":
        return "גישה מלאה";
      default:
        return level;
    }
  };

  const getPermissionIcon = (level: string) => {
    switch (level) {
      case "view":
        return <Eye className="h-3 w-3" />;
      case "book":
        return <CalendarCheck className="h-3 w-3" />;
      case "full":
        return <Edit className="h-3 w-3" />;
      default:
        return null;
    }
  };

  const getPermissionColor = (level: string) => {
    switch (level) {
      case "view":
        return "bg-blue-500/10 text-blue-600 border-blue-500/20";
      case "book":
        return "bg-yellow-500/10 text-yellow-600 border-yellow-500/20";
      case "full":
        return "bg-green-500/10 text-green-600 border-green-500/20";
      default:
        return "";
    }
  };

  const handleAddShare = () => {
    if (!selectedUserId) {
      toast.error("יש לבחור משתמש");
      return;
    }
    addShareMutation.mutate({ sharedWithUserId: selectedUserId, permission: permissionLevel });
  };

  if (sharesLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            שיתוף יומן
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">טוען...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          שיתוף יומן
        </CardTitle>
        <CardDescription>
          שתף את היומן שלך עם משתמשים אחרים כדי שיוכלו לקבוע פגישות בשמך
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* My Shares Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm">משתמשים עם גישה ליומן שלי</h3>
            <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Plus className="h-4 w-4 ml-2" />
                  הוסף משתמש
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>שתף יומן עם משתמש</DialogTitle>
                  <DialogDescription>
                    בחר משתמש והרשאות לשיתוף היומן שלך
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>בחר משתמש</Label>
                    <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                      <SelectTrigger>
                        <SelectValue placeholder="בחר משתמש..." />
                      </SelectTrigger>
                      <SelectContent>
                        <ScrollArea className="max-h-60">
                          {availableUsers.length === 0 ? (
                            <div className="p-2 text-sm text-muted-foreground text-center">
                              אין משתמשים זמינים לשיתוף
                            </div>
                          ) : (
                            availableUsers.map(tu => (
                              <SelectItem key={tu.user_id} value={tu.user_id}>
                                {tu.profiles?.full_name || tu.profiles?.email || tu.user_id}
                              </SelectItem>
                            ))
                          )}
                        </ScrollArea>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>רמת הרשאות</Label>
                    <Select value={permissionLevel} onValueChange={setPermissionLevel}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="view">
                          <div className="flex items-center gap-2">
                            <Eye className="h-4 w-4" />
                            צפייה בלבד - רואה את האירועים
                          </div>
                        </SelectItem>
                        <SelectItem value="book">
                          <div className="flex items-center gap-2">
                            <CalendarCheck className="h-4 w-4" />
                            צפייה + קביעת פגישות
                          </div>
                        </SelectItem>
                        <SelectItem value="full">
                          <div className="flex items-center gap-2">
                            <Edit className="h-4 w-4" />
                            גישה מלאה - צפייה, קביעה ועריכה
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Button 
                    onClick={handleAddShare} 
                    disabled={!selectedUserId || addShareMutation.isPending}
                    className="w-full"
                  >
                    <UserPlus className="h-4 w-4 ml-2" />
                    שתף יומן
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {myShares && myShares.length > 0 ? (
            <div className="space-y-2">
              {myShares.map((share: CalendarShare) => (
                <div 
                  key={share.id} 
                  className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <Users className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">
                        {share.shared_with_profile?.full_name || share.shared_with_profile?.email || "משתמש לא ידוע"}
                      </p>
                      {share.shared_with_profile?.email && share.shared_with_profile.full_name && (
                        <p className="text-xs text-muted-foreground">{share.shared_with_profile.email}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select
                      value={share.permission_level}
                      onValueChange={(value) => updateShareMutation.mutate({ shareId: share.id, permission: value })}
                    >
                      <SelectTrigger className="w-40 h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="view">צפייה בלבד</SelectItem>
                        <SelectItem value="book">צפייה + קביעה</SelectItem>
                        <SelectItem value="full">גישה מלאה</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => removeShareMutation.mutate(share.id)}
                      disabled={removeShareMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              היומן שלך לא משותף עם אף משתמש
            </p>
          )}
        </div>

        {/* Shared With Me Section */}
        {sharedWithMe && sharedWithMe.length > 0 && (
          <div className="space-y-4 pt-4 border-t">
            <h3 className="font-semibold text-sm">יומנים ששותפו איתי</h3>
            <div className="space-y-2">
              {sharedWithMe.map((share: any) => (
                <div 
                  key={share.id} 
                  className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-secondary/50 flex items-center justify-center">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">
                        {share.owner_profile?.full_name || share.owner_profile?.email || "משתמש לא ידוע"}
                      </p>
                      {share.owner_profile?.email && share.owner_profile.full_name && (
                        <p className="text-xs text-muted-foreground">{share.owner_profile.email}</p>
                      )}
                    </div>
                  </div>
                  <Badge className={getPermissionColor(share.permission_level)}>
                    {getPermissionIcon(share.permission_level)}
                    <span className="mr-1">{getPermissionLabel(share.permission_level)}</span>
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
