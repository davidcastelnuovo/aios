import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

interface ChangeAgencyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactId: string;
  contactType: "client" | "lead" | "group";
  currentAgencyId: string | null;
  contactName: string;
  onSuccess?: () => void;
}

export function ChangeAgencyDialog({
  open,
  onOpenChange,
  contactId,
  contactType,
  currentAgencyId,
  contactName,
  onSuccess,
}: ChangeAgencyDialogProps) {
  const { tenantId } = useCurrentTenant();
  const queryClient = useQueryClient();
  const [selectedAgencyId, setSelectedAgencyId] = useState<string>(currentAgencyId || "");

  const { data: agencies, isLoading: isLoadingAgencies } = useQuery({
    queryKey: ["agencies-for-change", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("agencies")
        .select("id, name")
        .eq("tenant_id", tenantId)
        .order("name");
      if (error) throw error;
      return data || [];
    },
    enabled: open && !!tenantId,
  });

  const mutation = useMutation({
    mutationFn: async (agencyId: string) => {
      const table = contactType === "client" ? "clients" : contactType === "lead" ? "leads" : "whatsapp_groups";
      const { error } = await supabase
        .from(table)
        .update({ agency_id: agencyId })
        .eq("id", contactId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contact", contactId] });
      queryClient.invalidateQueries({ queryKey: ["active-chats"] });
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast.success("הסוכנות עודכנה בהצלחה");
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (error: Error) => {
      toast.error("שגיאה בעדכון סוכנות: " + error.message);
    },
  });

  const handleSave = () => {
    if (!selectedAgencyId) {
      toast.error("נא לבחור סוכנות");
      return;
    }
    mutation.mutate(selectedAgencyId);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>שינוי סוכנות</DialogTitle>
          <DialogDescription>
            שינוי הסוכנות המשויכת ל: {contactName}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Select value={selectedAgencyId} onValueChange={setSelectedAgencyId}>
            <SelectTrigger>
              <SelectValue placeholder="בחר סוכנות" />
            </SelectTrigger>
            <SelectContent>
              {agencies?.map((agency) => (
                <SelectItem key={agency.id} value={agency.id}>
                  {agency.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex gap-2">
            <Button
              onClick={handleSave}
              disabled={mutation.isPending || !selectedAgencyId || selectedAgencyId === currentAgencyId}
              className="flex-1"
            >
              {mutation.isPending ? "שומר..." : "שמור"}
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
              ביטול
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
