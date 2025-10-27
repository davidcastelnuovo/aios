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

interface EditUserCampaignerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userEmail: string;
}

export function EditUserCampaignerDialog({
  open,
  onOpenChange,
  userId,
  userEmail,
}: EditUserCampaignerDialogProps) {
  const queryClient = useQueryClient();
  const [selectedCampaignerId, setSelectedCampaignerId] = useState<string>("");

  // Fetch current user's campaigner
  const { data: currentCampaigner } = useQuery({
    queryKey: ["user-campaigner", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("campaigner_id")
        .eq("id", userId)
        .single();

      if (error) throw error;
      return data.campaigner_id;
    },
    enabled: open,
  });

  // Fetch all active campaigners
  const { data: campaigners } = useQuery({
    queryKey: ["campaigners-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaigners")
        .select("id, full_name")
        .eq("active", true)
        .order("full_name");

      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  useEffect(() => {
    if (currentCampaigner) {
      setSelectedCampaignerId(currentCampaigner);
    } else {
      setSelectedCampaignerId("none");
    }
  }, [currentCampaigner]);

  const updateCampaignerMutation = useMutation({
    mutationFn: async (campaignerId: string | null) => {
      // Convert "none" to null
      const actualCampaignerId = campaignerId === "none" ? null : campaignerId;
      
      const { error } = await supabase
        .from("profiles")
        .update({ campaigner_id: actualCampaignerId })
        .eq("id", userId);

      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["users-with-roles"] });
      await queryClient.invalidateQueries({ queryKey: ["user-campaigner"] });
      await queryClient.refetchQueries({ queryKey: ["users-with-roles"] });
      toast.success("איש הצוות המשויך עודכן בהצלחה");
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error("שגיאה בעדכון איש צוות: " + error.message);
    },
  });

  const handleSave = () => {
    updateCampaignerMutation.mutate(selectedCampaignerId === "none" ? null : selectedCampaignerId);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>עריכת איש צוות משויך</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>משתמש</Label>
            <p className="text-sm text-muted-foreground">{userEmail}</p>
          </div>
          <div>
            <Label htmlFor="campaigner-select">איש צוות משויך</Label>
            <Select
              value={selectedCampaignerId}
              onValueChange={setSelectedCampaignerId}
            >
              <SelectTrigger id="campaigner-select">
                <SelectValue placeholder="בחר איש צוות" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">ללא איש צוות משויך</SelectItem>
                {campaigners?.map((campaigner) => (
                  <SelectItem key={campaigner.id} value={campaigner.id}>
                    {campaigner.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              ביטול
            </Button>
            <Button
              onClick={handleSave}
              disabled={updateCampaignerMutation.isPending}
            >
              {updateCampaignerMutation.isPending ? "שומר..." : "שמור"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
