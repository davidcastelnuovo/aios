import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Search, Loader2, Phone, MessageSquare } from "lucide-react";

interface AssignPhoneFromWhatsAppDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  clientName: string;
  onSuccess?: () => void;
}

export function AssignPhoneFromWhatsAppDialog({
  open,
  onOpenChange,
  clientId,
  clientName,
  onSuccess,
}: AssignPhoneFromWhatsAppDialogProps) {
  const { tenantId } = useCurrentTenant();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");

  // Fetch unknown WhatsApp contacts
  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ["whatsapp-contacts-for-assign", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase.rpc("get_unknown_chat_contacts", {
        p_tenant_id: tenantId,
      });
      if (error) {
        console.error("Error fetching unknown contacts:", error);
        return [];
      }
      return data || [];
    },
    enabled: !!tenantId && open,
  });

  // Also fetch known contacts (clients/leads with messages)
  const { data: knownContacts = [], isLoading: knownLoading } = useQuery({
    queryKey: ["known-chat-contacts-for-assign", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return [];
      const { data, error } = await supabase.rpc("get_chat_contacts", {
        p_tenant_id: tenantId,
        p_connection_user_ids: [userData.user.id],
        p_provider: "green_api",
      } as any);
      if (error) {
        console.error("Error fetching known contacts:", error);
        return [];
      }
      // Only return ones with phone
      return (data || []).filter((c: any) => c.phone);
    },
    enabled: !!tenantId && open,
  });

  const filteredContacts = contacts.filter((c: any) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      (c.name && c.name.toLowerCase().includes(term)) ||
      (c.sender_phone && c.sender_phone.includes(term))
    );
  });

  const assignMutation = useMutation({
    mutationFn: async (phone: string) => {
      const { error } = await supabase
        .from("clients")
        .update({ phone })
        .eq("id", clientId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`מספר טלפון שויך ל${clientName}`);
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      queryClient.invalidateQueries({ queryKey: ["active-chats"] });
      onSuccess?.();
      onOpenChange(false);
    },
    onError: () => {
      toast.error("שגיאה בעדכון מספר טלפון");
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] max-h-[80vh]" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right">שיוך מספר טלפון מוואטסאפ</DialogTitle>
          <p className="text-sm text-muted-foreground text-right">
            חפש שיחה מוואטסאפ ושייך את המספר ל-{clientName}
          </p>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="חפש לפי שם או מספר..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pr-9"
            autoFocus
          />
        </div>

        <ScrollArea className="h-[400px]">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredContacts.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              {searchTerm ? "לא נמצאו תוצאות" : "אין אנשי קשר מוואטסאפ"}
            </div>
          ) : (
            <div className="space-y-1">
              {filteredContacts.map((contact: any) => (
                <button
                  key={contact.id || contact.sender_phone}
                  className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors text-right"
                  onClick={() => {
                    if (contact.sender_phone) {
                      assignMutation.mutate(contact.sender_phone);
                    }
                  }}
                  disabled={assignMutation.isPending}
                >
                  <Avatar className="h-10 w-10 shrink-0">
                    {contact.whatsapp_avatar_url && (
                      <AvatarImage src={contact.whatsapp_avatar_url} />
                    )}
                    <AvatarFallback className="bg-primary/10 text-primary text-sm">
                      {(contact.name || contact.sender_phone || "?").charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 text-right">
                    <p className="text-sm font-medium truncate">{contact.name || contact.sender_phone}</p>
                    <div className="flex items-center gap-1 justify-end text-xs text-muted-foreground">
                      <span dir="ltr">{contact.sender_phone}</span>
                      <Phone className="h-3 w-3" />
                    </div>
                  </div>
                  {contact.unread_count > 0 && (
                    <span className="bg-primary text-primary-foreground text-xs rounded-full h-5 min-w-5 flex items-center justify-center px-1">
                      {contact.unread_count}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
