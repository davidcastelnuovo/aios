import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface EditUserAgenciesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userEmail: string;
}

export function EditUserAgenciesDialog({
  open,
  onOpenChange,
  userId,
  userEmail,
}: EditUserAgenciesDialogProps) {
  const { isOwner, userId: currentUserId } = useUserRole();
  const queryClient = useQueryClient();
  const [selectedAgencies, setSelectedAgencies] = useState<string[]>([]);

  // Fetch available agencies
  const { data: agencies } = useQuery({
    queryKey: ["agencies-for-edit", currentUserId],
    queryFn: async () => {
      const { data: userRoles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", currentUserId);
      
      const roles = userRoles?.map(r => r.role) || [];
      const isOwnerRole = roles.includes("owner");
      
      if (isOwnerRole) {
        const { data, error } = await supabase
          .from("agencies")
          .select("id, name")
          .order("name");
        if (error) throw error;
        return data;
      }
      return [];
    },
    enabled: open,
  });

  // Fetch current user's agencies
  const { data: currentAgencies } = useQuery({
    queryKey: ["user-agencies", userId],
    queryFn: async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("campaigner_id")
        .eq("id", userId)
        .single();

      if (!profile?.campaigner_id) {
        return [];
      }

      const { data: links, error } = await supabase
        .from("campaigner_agencies")
        .select("agency_id")
        .eq("campaigner_id", profile.campaigner_id);

      if (error) throw error;
      return links?.map(link => link.agency_id) || [];
    },
    enabled: open && !!userId,
  });

  // Update selected agencies when current agencies load
  useEffect(() => {
    if (currentAgencies) {
      setSelectedAgencies(currentAgencies);
    }
  }, [currentAgencies]);

  const updateAgenciesMutation = useMutation({
    mutationFn: async (agencyIds: string[]) => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error("No active session");
      }

      const { data, error } = await supabase.functions.invoke("update-user-agencies", {
        body: { userId, agencyIds },
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
      queryClient.invalidateQueries({ queryKey: ["user-agencies", userId] });
      toast.success("הסוכנויות עודכנו בהצלחה");
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error("שגיאה בעדכון סוכנויות: " + error.message);
    },
  });

  const handleSave = () => {
    updateAgenciesMutation.mutate(selectedAgencies);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>עריכת סוכנויות למשתמש</DialogTitle>
          <DialogDescription>
            עריכת הסוכנויות המשוייכות למשתמש: {userEmail}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
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
                      id={`edit-agency-${agency.id}`}
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
                      htmlFor={`edit-agency-${agency.id}`}
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
          <div className="flex gap-2">
            <Button
              onClick={handleSave}
              disabled={updateAgenciesMutation.isPending}
              className="flex-1"
            >
              {updateAgenciesMutation.isPending ? "שומר..." : "שמור שינויים"}
            </Button>
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={updateAgenciesMutation.isPending}
            >
              ביטול
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
