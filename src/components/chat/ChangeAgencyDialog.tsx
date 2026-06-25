import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { InlineDialog } from "@/components/ui/inline-dialog";
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
  /** When true, renders embedded in the page flow instead of as a modal overlay. */
  inline?: boolean;
  contactId: string;
  contactType: "client" | "lead" | "group";
  currentAgencyId: string | null;
  contactName: string;
  onSuccess?: () => void;
}

export function ChangeAgencyDialog({
  open,
  onOpenChange,
  inline = false,
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
    <InlineDialog
      open={open}
      onOpenChange={onOpenChange}
      inline={inline}
      title="שינוי סוכנות"
      description={`שינוי הסוכנות המשויכת ל: ${contactName}`}
      className="sm:max-w-md"
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
            ביטול
          </Button>
          <Button
            onClick={handleSave}
            disabled={mutation.isPending || !selectedAgencyId || selectedAgencyId === currentAgencyId}
          >
            {mutation.isPending ? "שומר..." : "שמור"}
          </Button>
        </>
      }
    >
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
    </InlineDialog>
  );
}
