import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, AlertCircle } from "lucide-react";
import ChatMessageList from "./ChatMessageList";
import ChatInput from "./ChatInput";
import { ManyChatControls } from "./ManyChatControls";
import { GreenAPIControls } from "./GreenAPIControls";
import { ChatProviderIndicator } from "./ChatProviderIndicator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

interface Message {
  id: string;
  direction: "inbound" | "outbound";
  message_text: string;
  created_at: string;
}

interface ChatViewProps {
  contactId: string;
  contactType: "client" | "lead";
  onBack?: () => void;
}

export default function ChatView({ contactId, contactType, onBack }: ChatViewProps) {
  const queryClient = useQueryClient();

  // Fetch contact details
  const { data: contact, isLoading: isLoadingContact } = useQuery({
    queryKey: ["contact", contactId, contactType],
    queryFn: async () => {
      const table = contactType === "client" ? "clients" : "leads";
      if (contactType === "client") {
        const { data, error } = await supabase
          .from("clients")
          .select(`id, name, phone, email, agency_id, tenant_id, manychat_subscriber_id, active_chat_provider, agencies (name)`)
          .eq("id", contactId)
          .single();
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from("leads")
          .select(`id, company_name, phone, email, agency_id, tenant_id, manychat_subscriber_id, active_chat_provider, agencies (name)`)
          .eq("id", contactId)
          .single();
        if (error) throw error;
        return { ...data, name: data.company_name };
      }
    },
    enabled: !!contactId,
  });

  // Fetch active chat provider
  const { data: activeProvider } = useQuery({
    queryKey: ["active-chat-provider", contact?.tenant_id],
    queryFn: async () => {
      if (!contact?.tenant_id) return null;
      const { data, error } = await supabase
        .from("tenant_integrations")
        .select("integration_type")
        .eq("tenant_id", contact.tenant_id)
        .eq("is_active", true)
        .in("integration_type", ["manychat", "green_api"])
        .single();
      if (error) return null;
      return data?.integration_type as "manychat" | "green_api" | null;
    },
    enabled: !!contact?.tenant_id,
  });

  // Mark messages as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: async () => {
      const filter = contactType === "client" ? { client_id: contactId } : { lead_id: contactId };

      const { error } = await supabase
        .from("chat_messages")
        .update({ read_at: new Date().toISOString() })
        .match(filter)
        .eq("direction", "inbound")
        .is("read_at", null);

      if (error) throw error;
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["chat-contacts"] });
      const previousContacts = queryClient.getQueryData(["chat-contacts"]);

      queryClient.setQueryData(["chat-contacts"], (old: any) => {
        if (!old) return old;
        return old.map((contact: any) =>
          contact.id === contactId && contact.contact_type === contactType
            ? { ...contact, unread_count: 0 }
            : contact
        );
      });

      return { previousContacts };
    },
    onError: (err, variables, context: any) => {
      if (context?.previousContacts) {
        queryClient.setQueryData(["chat-contacts"], context.previousContacts);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["chat-contacts"] });
    },
  });

  // Fetch chat messages
  const { data: messagesData, isLoading: isLoadingMessages } = useQuery({
    queryKey: ["chat-messages", contactId, contactType],
    queryFn: async () => {
      const filter = contactType === "client" ? { client_id: contactId } : { lead_id: contactId };

      const { data, error } = await supabase
        .from("chat_messages")
        .select("*")
        .match(filter)
        .order("created_at", { ascending: true });

      if (error) throw error;

      // Mark as read automatically
      markAsReadMutation.mutate();

      return data;
    },
    enabled: !!contactId,
    refetchInterval: 5000,
  });

  // Transform messages
  const messages: Message[] =
    messagesData?.map((msg) => ({
      id: msg.id,
      direction: msg.direction as "inbound" | "outbound",
      message_text: msg.message_text,
      created_at: msg.created_at || "",
    })) || [];

  const handleSendMessage = async (message: string) => {
    if (!contact) return;

    try {
      // Check if provider is configured
      if (!activeProvider) {
        toast.error("לא מוגדר ספק צ'אט פעיל");
        return;
      }

      // Validate required contact details
      if (activeProvider === 'manychat') {
        if (!contact.manychat_subscriber_id) {
          toast.error("חסר Subscriber ID למניצ'אט. אנא הוסף ב-ManyChat Settings.");
          return;
        }

        const { error } = await supabase.functions.invoke("send-chat-message", {
          body: {
            [contactType === "client" ? "clientId" : "leadId"]: contactId,
            message,
            channel: "whatsapp",
            provider: "manychat",
          },
        });

        if (error) throw error;
      } else if (activeProvider === 'green_api') {
        if (!contact.phone) {
          toast.error("חסר מספר טלפון ל-Green API. אנא הוסף באיש הקשר.");
          return;
        }

        const { error } = await supabase.functions.invoke("send-green-api-message", {
          body: {
            [contactType === "client" ? "clientId" : "leadId"]: contactId,
            message,
            phoneNumber: contact.phone,
            provider: "green_api",
          },
        });

        if (error) throw error;
      }

      queryClient.invalidateQueries({ queryKey: ["chat-messages", contactId] });
      toast.success("ההודעה נשלחה בהצלחה");
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error("שגיאה בשליחת ההודעה");
    }
  };

  if (isLoadingContact) {
    return <div className="p-4">טוען...</div>;
  }

  if (!contact) {
    return <div className="p-4">איש קשר לא נמצא</div>;
  }

  return (
    <div className="flex flex-col h-full bg-card">
      <div className="p-4 border-b">
        <div className="flex items-center gap-3 mb-4">
          {onBack && (
            <Button variant="ghost" size="icon" onClick={onBack}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="font-semibold text-lg">{contact.name}</h2>
              <ChatProviderIndicator provider={contact.active_chat_provider} size="md" />
            </div>
            <div className="text-sm text-muted-foreground space-y-1">
              {contact.agencies?.name && (
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{contact.agencies.name}</Badge>
                </div>
              )}
              {contact.phone && <div>טלפון: {contact.phone}</div>}
              {contact.email && <div>אימייל: {contact.email}</div>}
            </div>
          </div>
        </div>

        {/* Provider Controls */}
        {!activeProvider && (
          <Alert className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              לא מוגדר ספק צ'אט פעיל. אנא הגדר באינטגרציות צ'אט.
            </AlertDescription>
          </Alert>
        )}

        {activeProvider === 'manychat' && (
          <ManyChatControls
            contactId={contactId}
            contactType={contactType}
            subscriberId={contact.manychat_subscriber_id}
            tenantId={contact.tenant_id}
          />
        )}

        {activeProvider === 'green_api' && (
          <GreenAPIControls phone={contact.phone} />
        )}
      </div>

      <div className="flex-1 overflow-hidden">
        <ChatMessageList messages={messages} isLoading={isLoadingMessages} />
      </div>

      <div className="border-t p-4">
        <ChatInput onSend={handleSendMessage} isLoading={false} />
      </div>
    </div>
  );
}
