import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface EditUserSalesPersonDialogProps {
  userId: string | null;
  userEmail: string;
  onClose: () => void;
}

export function EditUserSalesPersonDialog({
  userId,
  userEmail,
  onClose,
}: EditUserSalesPersonDialogProps) {
  const queryClient = useQueryClient();
  const [selectedSalesPerson, setSelectedSalesPerson] = useState<string>("none");

  // Fetch all sales people
  const { data: salesPeople } = useQuery({
    queryKey: ["sales-people-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales_people")
        .select("id, full_name, active")
        .eq("active", true)
        .order("full_name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch current sales person assignment
  const { data: currentAssignment } = useQuery({
    queryKey: ["user-sales-person", userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("sales_person_id")
        .eq("id", userId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });

  useEffect(() => {
    if (currentAssignment?.sales_person_id) {
      setSelectedSalesPerson(currentAssignment.sales_person_id);
    } else {
      setSelectedSalesPerson("none");
    }
  }, [currentAssignment]);

  const updateSalesPersonMutation = useMutation({
    mutationFn: async (salesPersonId: string | null) => {
      if (!userId) return;
      
      const { error } = await supabase
        .from("profiles")
        .update({ sales_person_id: salesPersonId })
        .eq("id", userId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users-with-roles"] });
      queryClient.invalidateQueries({ queryKey: ["user-sales-person", userId] });
      toast.success("איש מכירות עודכן בהצלחה");
      onClose();
    },
    onError: (error: Error) => {
      toast.error("שגיאה בעדכון איש מכירות: " + error.message);
    },
  });

  const handleSave = () => {
    const salesPersonId = selectedSalesPerson === "none" ? null : selectedSalesPerson;
    updateSalesPersonMutation.mutate(salesPersonId);
  };

  return (
    <Dialog open={!!userId} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>עריכת איש מכירות - {userEmail}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="sales-person-select">איש מכירות</Label>
            <Select
              value={selectedSalesPerson}
              onValueChange={setSelectedSalesPerson}
            >
              <SelectTrigger id="sales-person-select">
                <SelectValue placeholder="בחר איש מכירות" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">ללא שיוך</SelectItem>
                {salesPeople?.map((sp) => (
                  <SelectItem key={sp.id} value={sp.id}>
                    {sp.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={onClose}>
              ביטול
            </Button>
            <Button
              onClick={handleSave}
              disabled={updateSalesPersonMutation.isPending}
            >
              {updateSalesPersonMutation.isPending ? "שומר..." : "שמור"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
