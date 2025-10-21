import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface EditManagedAgenciesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: {
    id: string;
    full_name: string;
    managed_agencies: Array<{ id: string; name: string }>;
  };
}

export default function EditManagedAgenciesDialog({
  open,
  onOpenChange,
  user,
}: EditManagedAgenciesDialogProps) {
  const [selectedAgencies, setSelectedAgencies] = useState<string[]>(
    user.managed_agencies.map((a) => a.id)
  );
  const queryClient = useQueryClient();

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

  const updateMutation = useMutation({
    mutationFn: async (agencyIds: string[]) => {
      // Delete existing managed agencies
      await supabase
        .from("user_managed_agencies")
        .delete()
        .eq("user_id", user.id);

      // Insert new managed agencies
      if (agencyIds.length > 0) {
        const { error } = await supabase
          .from("user_managed_agencies")
          .insert(agencyIds.map((agencyId) => ({ user_id: user.id, agency_id: agencyId })));

        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("הסוכנויות עודכנו בהצלחה");
      queryClient.invalidateQueries({ queryKey: ["users-with-roles"] });
      onOpenChange(false);
    },
    onError: () => {
      toast.error("שגיאה בעדכון הסוכנויות");
    },
  });

  const handleSubmit = () => {
    updateMutation.mutate(selectedAgencies);
  };

  const handleToggle = (agencyId: string) => {
    setSelectedAgencies((prev) =>
      prev.includes(agencyId)
        ? prev.filter((id) => id !== agencyId)
        : [...prev, agencyId]
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>ערוך סוכנויות מנוהלות - {user.full_name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="max-h-96 overflow-y-auto space-y-3 border rounded-md p-4">
            {agencies?.map((agency) => (
              <div key={agency.id} className="flex items-center space-x-2 space-x-reverse">
                <Checkbox
                  id={agency.id}
                  checked={selectedAgencies.includes(agency.id)}
                  onCheckedChange={() => handleToggle(agency.id)}
                />
                <Label htmlFor={agency.id} className="cursor-pointer font-normal">
                  {agency.name}
                </Label>
              </div>
            ))}
          </div>
          <Button
            onClick={handleSubmit}
            disabled={updateMutation.isPending}
            className="w-full"
          >
            {updateMutation.isPending ? "שומר..." : "שמור שינויים"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
