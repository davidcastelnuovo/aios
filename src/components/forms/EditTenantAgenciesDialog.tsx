import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info } from "lucide-react";

interface EditTenantAgenciesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenant: {
    id: string;
    name: string;
  };
}

export default function EditTenantAgenciesDialog({
  open,
  onOpenChange,
  tenant,
}: EditTenantAgenciesDialogProps) {
  const { tenantId: currentTenantId } = useCurrentTenant();
  const queryClient = useQueryClient();
  const [selectedAgencies, setSelectedAgencies] = useState<string[]>([]);

  // שליפת הסוכנויות של הארגון הנוכחי
  const { data: agencies, isLoading: loadingAgencies } = useQuery({
    queryKey: ["agencies", currentTenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agencies")
        .select("id, name")
        .eq("tenant_id", currentTenantId)
        .order("name");
      
      if (error) throw error;
      return data;
    },
    enabled: !!currentTenantId && open,
  });

  // שליפת הגישות הקיימות
  const { data: existingAccess, isLoading: loadingAccess } = useQuery({
    queryKey: ["agency-tenant-access", currentTenantId, tenant.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agency_tenant_access")
        .select("agency_id")
        .eq("source_tenant_id", currentTenantId)
        .eq("accessing_tenant_id", tenant.id);
      
      if (error) throw error;
      return data?.map((a) => a.agency_id) || [];
    },
    enabled: !!currentTenantId && open,
  });

  useEffect(() => {
    if (existingAccess) {
      setSelectedAgencies(existingAccess);
    }
  }, [existingAccess]);

  const mutation = useMutation({
    mutationFn: async (agencyIds: string[]) => {
      // מחיקת גישות קיימות
      await supabase
        .from("agency_tenant_access")
        .delete()
        .eq("source_tenant_id", currentTenantId)
        .eq("accessing_tenant_id", tenant.id);

      // הוספת גישות חדשות
      if (agencyIds.length > 0) {
        const { error } = await supabase
          .from("agency_tenant_access")
          .insert(
            agencyIds.map((agencyId) => ({
              source_tenant_id: currentTenantId,
              agency_id: agencyId,
              accessing_tenant_id: tenant.id,
              access_level: "read_write",
            }))
          );

        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("הגישות לסוכנויות עודכנו בהצלחה");
      queryClient.invalidateQueries({ queryKey: ["agency-tenant-access"] });
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      onOpenChange(false);
    },
    onError: (error) => {
      console.error("Error updating agency access:", error);
      toast.error("שגיאה בעדכון הגישות לסוכנויות");
    },
  });

  const handleSubmit = () => {
    mutation.mutate(selectedAgencies);
  };

  const handleToggle = (agencyId: string) => {
    setSelectedAgencies((prev) =>
      prev.includes(agencyId)
        ? prev.filter((id) => id !== agencyId)
        : [...prev, agencyId]
    );
  };

  const isLoading = loadingAgencies || loadingAccess;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>ניהול גישות לסוכנויות - {tenant.name}</DialogTitle>
          <DialogDescription>
            בחר את הסוכנויות שארגון "{tenant.name}" יוכל לראות ולערוך
          </DialogDescription>
        </DialogHeader>

        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            <strong>שים לב:</strong> שדות כספיים (תקציבים, retainer, תשלומים) יישארו פרטיים לארגון המקורי ולא יוצגו לארגון שמקבל גישה.
          </AlertDescription>
        </Alert>

        <div className="space-y-4">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              טוען סוכנויות...
            </div>
          ) : agencies && agencies.length > 0 ? (
            <div className="max-h-96 overflow-y-auto space-y-3 border rounded-md p-4">
              {agencies.map((agency) => (
                <div key={agency.id} className="flex items-center space-x-2 space-x-reverse">
                  <Checkbox
                    id={agency.id}
                    checked={selectedAgencies.includes(agency.id)}
                    onCheckedChange={() => handleToggle(agency.id)}
                  />
                  <Label htmlFor={agency.id} className="cursor-pointer font-normal flex-1">
                    {agency.name}
                  </Label>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              אין סוכנויות זמינות בארגון זה
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            ביטול
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={mutation.isPending || isLoading}
          >
            {mutation.isPending ? "שומר..." : "שמור שינויים"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
