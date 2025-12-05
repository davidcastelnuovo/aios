import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";

interface LinkCampaignerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  senderPhone: string;
  senderName?: string | null;
  onSuccess: (campaignerId: string) => void;
}

export function LinkCampaignerDialog({
  open,
  onOpenChange,
  senderPhone,
  senderName,
  onSuccess,
}: LinkCampaignerDialogProps) {
  const { tenantId } = useCurrentTenant();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCampaignerId, setSelectedCampaignerId] = useState<string>("");

  // Fetch campaigners
  const { data: campaigners = [], isLoading } = useQuery({
    queryKey: ["campaigners-for-link", tenantId, searchTerm],
    queryFn: async () => {
      if (!tenantId) return [];
      let query = supabase
        .from("campaigners")
        .select("id, full_name, phone, email")
        .eq("tenant_id", tenantId)
        .eq("active", true)
        .order("full_name");
      
      if (searchTerm) {
        query = query.or(`full_name.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`);
      }
      
      const { data } = await query.limit(50);
      return data || [];
    },
    enabled: !!tenantId && open,
  });

  // Link mutation - update all messages with this sender_phone to the selected campaigner
  const linkMutation = useMutation({
    mutationFn: async () => {
      if (!selectedCampaignerId || !tenantId) {
        throw new Error("Missing campaigner ID or tenant ID");
      }

      // Update all chat messages with this sender_phone to link to the campaigner
      const { error } = await supabase
        .from("chat_messages")
        .update({ campaigner_id: selectedCampaignerId } as any)
        .eq("sender_phone", senderPhone)
        .eq("tenant_id", tenantId);

      if (error) throw error;

      return selectedCampaignerId;
    },
    onSuccess: (campaignerId) => {
      toast.success("שויך בהצלחה לקמפיינר");
      queryClient.invalidateQueries({ queryKey: ["active-chats"] });
      queryClient.invalidateQueries({ queryKey: ["unknown-contacts"] });
      queryClient.invalidateQueries({ queryKey: ["chat-messages"] });
      queryClient.invalidateQueries({ queryKey: ["chat-contacts"] });
      onSuccess(campaignerId);
      onOpenChange(false);
      setSelectedCampaignerId("");
    },
    onError: (error: any) => {
      console.error("Link to campaigner error:", error);
      toast.error(error.message || "שגיאה בשיוך לקמפיינר");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCampaignerId) {
      toast.error("יש לבחור קמפיינר");
      return;
    }
    linkMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]" dir="rtl">
        <DialogHeader>
          <DialogTitle>שיוך לקמפיינר</DialogTitle>
          <DialogDescription>
            שייך את המספר {senderPhone} לקמפיינר במערכת
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>חיפוש</Label>
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="חפש קמפיינר..."
                className="pr-10"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>בחר קמפיינר</Label>
            {isLoading ? (
              <div className="flex items-center justify-center p-4">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : (
              <Select
                value={selectedCampaignerId}
                onValueChange={setSelectedCampaignerId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="בחר קמפיינר..." />
                </SelectTrigger>
                <SelectContent>
                  {campaigners.length === 0 ? (
                    <div className="p-2 text-center text-sm text-muted-foreground">
                      לא נמצאו קמפיינרים
                    </div>
                  ) : (
                    campaigners.map((campaigner) => (
                      <SelectItem key={campaigner.id} value={campaigner.id}>
                        {campaigner.full_name}
                        {campaigner.phone && ` • ${campaigner.phone}`}
                        {campaigner.email && ` • ${campaigner.email}`}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="flex gap-2 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              ביטול
            </Button>
            <Button type="submit" disabled={linkMutation.isPending || !selectedCampaignerId}>
              {linkMutation.isPending && (
                <Loader2 className="ml-2 h-4 w-4 animate-spin" />
              )}
              שייך
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
