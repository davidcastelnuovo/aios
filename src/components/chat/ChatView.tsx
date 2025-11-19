import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, AlertCircle, Ban } from "lucide-react";
import ChatMessageList from "./ChatMessageList";
import ChatInput from "./ChatInput";
import { ManyChatControls } from "./ManyChatControls";
import { GreenAPIControls } from "./GreenAPIControls";
import { ChatProviderIndicator } from "./ChatProviderIndicator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { ConvertContactDialog } from "./ConvertContactDialog";
import { LinkContactDialog } from "./LinkContactDialog";
import { LinkPhoneDialog } from "./LinkPhoneDialog";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { useIsMobile } from "@/hooks/use-mobile";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { ChevronDown, ChevronUp } from "lucide-react";

interface Message {
  id: string;
  direction: "inbound" | "outbound";
  message_text: string;
  created_at: string;
  sender_name?: string | null;
  raw_provider_data?: any;
}

interface ChatViewProps {
  contactId: string;
  contactType: "client" | "lead" | "group" | "unknown";
  senderPhone?: string;
  onBack?: () => void;
}

export default function ChatView({ contactId, contactType, senderPhone, onBack }: ChatViewProps) {
  const queryClient = useQueryClient();
  const { tenant: currentTenant } = useCurrentTenant();
  const isMobile = useIsMobile();
  const [convertDialogOpen, setConvertDialogOpen] = useState(false);
  const [convertType, setConvertType] = useState<"client" | "lead" | "group">("client");
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkPhoneDialogOpen, setLinkPhoneDialogOpen] = useState(false);
  const [isHeaderExpanded, setIsHeaderExpanded] = useState(false);

  // Fetch contact details
  const { data: contact, isLoading: isLoadingContact } = useQuery({
    queryKey: ["contact", contactId, contactType, senderPhone],
    queryFn: async () => {
      if (contactType === "unknown") {
        // For unknown contacts, return mock data
        return {
          id: contactId,
          name: senderPhone || contactId,
          phone: senderPhone,
          email: null,
          agency_id: null,
          tenant_id: null,
          manychat_subscriber_id: null,
          active_chat_provider: null,
        };
      }
      
      if (contactType === "client") {
        const { data, error } = await supabase
          .from("clients")
          .select(`id, name, phone, email, agency_id, tenant_id, manychat_subscriber_id, active_chat_provider, agencies (name)`)
          .eq("id", contactId)
          .single();
        if (error) throw error;
        return data;
      } else if (contactType === "lead") {
        const { data, error } = await supabase
          .from("leads")
          .select(`id, company_name, phone, email, agency_id, tenant_id, manychat_subscriber_id, active_chat_provider, agencies (name)`)
          .eq("id", contactId)
          .single();
        if (error) throw error;
        return { ...data, name: data.company_name };
      } else if (contactType === "group") {
        const { data, error } = await supabase
          .from("whatsapp_groups")
          .select(`id, group_name, group_chat_id, agency_id, tenant_id, agencies (name)`)
          .eq("id", contactId)
          .single();
        if (error) throw error;
        return { 
          ...data, 
          name: data.group_name,
          phone: null,
          email: null,
          manychat_subscriber_id: null,
          active_chat_provider: 'green_api' as const
        };
      }
    },
    enabled: !!contactId,
  });

  // Fetch active chat provider - use currentTenant for unknown contacts
  const tenantIdForProvider = contactType === "unknown" ? currentTenant?.id : contact?.tenant_id;
  
  const { data: activeProvider } = useQuery({
    queryKey: ["active-chat-provider", tenantIdForProvider],
    queryFn: async () => {
      if (!tenantIdForProvider) return null;
      const { data, error } = await supabase
        .from("tenant_integrations")
        .select("integration_type")
        .eq("tenant_id", tenantIdForProvider)
        .eq("is_active", true)
        .in("integration_type", ["manychat", "green_api"])
        .single();
      if (error) return null;
      return data?.integration_type as "manychat" | "green_api" | null;
    },
    enabled: !!tenantIdForProvider,
  });

  // Mark messages as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: async () => {
      if (contactType === "unknown") {
        // For unknown contacts, mark by sender_phone
        const { error } = await supabase
          .from("chat_messages")
          .update({ read_at: new Date().toISOString() })
          .eq("sender_phone", senderPhone || contactId)
          .eq("direction", "inbound")
          .is("read_at", null);
        if (error) throw error;
      } else {
        const filter = contactType === "client" 
          ? { client_id: contactId } 
          : contactType === "lead" 
          ? { lead_id: contactId }
          : { group_id: contactId };
        const { error } = await supabase
          .from("chat_messages")
          .update({ read_at: new Date().toISOString() })
          .match(filter)
          .eq("direction", "inbound")
          .is("read_at", null);
        if (error) throw error;
      }
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
      queryClient.invalidateQueries({ queryKey: ["unknown-contacts"] });
    },
  });

  // Block contact mutation - works for all contact types
  const blockMutation = useMutation({
    mutationFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user || !contact?.tenant_id) throw new Error("Missing user or tenant");

      // Build the filter based on contact type
      let query = supabase
        .from("chat_messages")
        .update({
          is_blocked: true,
          blocked_at: new Date().toISOString(),
          blocked_by_user_id: userData.user.id,
        })
        .eq("tenant_id", contact.tenant_id);

      // Apply appropriate filter
      if (contactType === "unknown") {
        query = query.eq("sender_phone", senderPhone || contactId);
      } else if (contactType === "client") {
        query = query.eq("client_id", contactId);
      } else if (contactType === "lead") {
        query = query.eq("lead_id", contactId);
      } else if (contactType === "group") {
        query = query.eq("group_id", contactId);
      }

      const { error } = await query;
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("השיחה נחסמה בהצלחה - ההודעות לא יישמרו יותר בדטה-בייס");
      queryClient.invalidateQueries({ queryKey: ["chat-contacts"] });
      queryClient.invalidateQueries({ queryKey: ["unknown-contacts"] });
      queryClient.invalidateQueries({ queryKey: ["chat-messages", contactId, contactType, senderPhone] });
      onBack?.();
    },
    onError: (error) => {
      toast.error("שגיאה בחסימת השיחה");
      console.error("Block error:", error);
    },
  });

  // Fetch chat messages
  const { data: messagesData, isLoading: isLoadingMessages } = useQuery({
    queryKey: ["chat-messages", contactId, contactType, senderPhone],
    queryFn: async () => {
      if (contactType === "unknown") {
        const { data, error } = await supabase
          .from("chat_messages")
          .select("*")
          .eq("sender_phone", senderPhone || contactId)
          .order("created_at", { ascending: true });

        if (error) throw error;

        // Mark as read automatically for unknown contacts
        markAsReadMutation.mutate();
        return data;
      }

      const filter = contactType === "client" 
        ? { client_id: contactId } 
        : contactType === "lead" 
        ? { lead_id: contactId }
        : { group_id: contactId };

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
      sender_name: msg.sender_name,
      raw_provider_data: msg.raw_provider_data,
    })) || [];

  // Calculate anchor message for scroll
  const firstUnreadIndex = messagesData?.findIndex(
    (msg) => msg.direction === 'inbound' && !msg.read_at
  ) ?? -1;
  
  const anchorMessageId = firstUnreadIndex >= 0 
    ? messagesData?.[firstUnreadIndex]?.id 
    : messagesData?.[messagesData.length - 1]?.id;

  const handleSendMessage = async (message: string) => {
    if (!contact) return;

    try {
      // Check session first
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("נא להתחבר מחדש למערכת");
        return;
      }

      // Check if provider is configured
      if (!activeProvider) {
        toast.error("לא מוגדר ספק צ'אט פעיל");
        return;
      }

      // Validate required contact details
      if (activeProvider === 'manychat') {
        if (contactType === 'group') {
          toast.error("קבוצות לא נתמכות ב-ManyChat");
          return;
        }
        
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
        if (!contact.phone && contactType !== 'group' && contactType !== 'unknown') {
          toast.error("חסר מספר טלפון ל-Green API. אנא הוסף באיש הקשר.");
          return;
        }

        const body: any = {
          message,
          phoneNumber: senderPhone || contact.phone,
          provider: "green_api",
        };

        // Only add IDs for known contact types
        if (contactType === "client") {
          body.clientId = contactId;
        } else if (contactType === "lead") {
          body.leadId = contactId;
        } else if (contactType === "group") {
          body.groupId = contactId;
        }

        const { error } = await supabase.functions.invoke("send-green-api-message", {
          body,
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
    <div className="flex flex-col h-full min-h-0 overflow-hidden">
      <div className={`sticky top-0 z-10 ${isMobile ? 'p-2' : 'p-4'} border-b bg-card`}>
        {/* שורה ראשונה - תמיד גלויה */}
        <div className="flex items-center gap-3">
          {onBack && (
            <Button variant="ghost" size="icon" onClick={onBack}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-lg">{contact.name}</h2>
              <ChatProviderIndicator provider={contact.active_chat_provider} size="md" />
            </div>
          </div>
          {isMobile && (
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setIsHeaderExpanded(!isHeaderExpanded)}
            >
              {isHeaderExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          )}
        </div>
        
        {/* פרטים נוספים - מתקפל במובייל, תמיד פתוח בדסקטופ */}
        <Collapsible open={isMobile ? isHeaderExpanded : true}>
          <CollapsibleContent>
            <div className={`space-y-2 ${isMobile ? 'mt-2' : 'mt-4'}`}>
              {/* פרטי קשר */}
              <div className="text-sm text-muted-foreground space-y-1">
                {(contact as any).agencies?.name && (
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{(contact as any).agencies.name}</Badge>
                  </div>
                )}
                {contact.phone && <div>טלפון: {contact.phone}</div>}
                {contact.email && <div>אימייל: {contact.email}</div>}
              </div>

              {/* Alerts וכפתורים למשתמשים unknown */}
              {contactType === 'unknown' && (
                <>
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      איש קשר זה לא מוגדר במערכת. המר אותו ללקוח, ליד או קבוצה כדי לנהל אותו בצורה מסודרת.
                    </AlertDescription>
                  </Alert>
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      onClick={() => {
                        setConvertType("client");
                        setConvertDialogOpen(true);
                      }}
                      size="sm"
                    >
                      המר ללקוח
                    </Button>
                    <Button
                      onClick={() => {
                        setConvertType("lead");
                        setConvertDialogOpen(true);
                      }}
                      size="sm"
                      variant="outline"
                    >
                      המר לליד
                    </Button>
                    <Button
                      onClick={() => {
                        setConvertType("group");
                        setConvertDialogOpen(true);
                      }}
                      size="sm"
                      variant="outline"
                    >
                      המר לקבוצה
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => blockMutation.mutate()}
                      disabled={blockMutation.isPending}
                    >
                      <Ban className="h-4 w-4 ml-2" />
                      חסום
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setLinkDialogOpen(true)}
                    >
                      שייך לקיים
                    </Button>
                  </div>
                </>
              )}

              {/* כפתורים לכל סוגי אנשי הקשר */}
              {contactType !== 'unknown' && (
                <div className="flex gap-2 flex-wrap">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      if (confirm('האם אתה בטוח שברצונך לחסום את השיחה? הודעות חדשות לא יישמרו בדטה-בייס.')) {
                        blockMutation.mutate();
                      }
                    }}
                    disabled={blockMutation.isPending}
                  >
                    <Ban className="h-4 w-4 ml-2" />
                    חסום שיחה
                  </Button>
                  {contact.phone && contactType !== 'group' && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setLinkPhoneDialogOpen(true)}
                    >
                      שייך טלפון לאחר
                    </Button>
                  )}
                </div>
              )}

              {/* Provider Controls */}
              {!activeProvider && contactType !== 'unknown' && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    לא מוגדר ספק צ'אט פעיל. אנא הגדר באינטגרציות צ'אט.
                  </AlertDescription>
                </Alert>
              )}

              {activeProvider === 'manychat' && contactType !== 'unknown' && (
                <ManyChatControls
                  contactId={contactId}
                  contactType={contactType as 'client' | 'lead'}
                  subscriberId={contact.manychat_subscriber_id}
                  tenantId={contact.tenant_id}
                />
              )}

              {activeProvider === 'green_api' && contactType !== 'unknown' && (
                <GreenAPIControls phone={contact.phone} />
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden bg-[#e5ddd5]">
        <ChatMessageList 
          messages={messages} 
          isLoading={isLoadingMessages} 
          contactId={contactId} 
          contactType={contactType} 
          agencyId={contact?.agency_id}
          anchorMessageId={anchorMessageId}
        />
      </div>

      <div className="sticky bottom-0 z-10 border-t bg-card shadow-[0_-2px_10px_rgba(0,0,0,0.1)]">
        <ChatInput onSend={handleSendMessage} isLoading={false} />
      </div>

      {contactType === "unknown" && (
        <>
          <ConvertContactDialog
            open={convertDialogOpen}
            onOpenChange={setConvertDialogOpen}
            senderPhone={senderPhone || contactId}
            senderName={contact?.name}
            type={convertType}
            onSuccess={(id, type) => {
              setConvertDialogOpen(false);
              queryClient.invalidateQueries({ queryKey: ["chat-contacts"] });
              queryClient.invalidateQueries({ queryKey: ["unknown-contacts"] });
              if (onBack) onBack();
            }}
          />
          <LinkContactDialog
            open={linkDialogOpen}
            onOpenChange={setLinkDialogOpen}
            senderPhone={senderPhone || contactId}
            senderName={contact?.name}
            onSuccess={(id, type) => {
              setLinkDialogOpen(false);
              queryClient.invalidateQueries({ queryKey: ["chat-contacts"] });
              queryClient.invalidateQueries({ queryKey: ["unknown-contacts"] });
              if (onBack) onBack();
            }}
          />
          <LinkPhoneDialog
            open={linkPhoneDialogOpen}
            onOpenChange={setLinkPhoneDialogOpen}
            phone={contact?.phone || ""}
            contactId={contactId}
            contactType={contactType as "client" | "lead"}
            onSuccess={() => {
              setLinkPhoneDialogOpen(false);
              queryClient.invalidateQueries({ queryKey: ["contact", contactId, contactType] });
              queryClient.invalidateQueries({ queryKey: ["chat-contacts"] });
            }}
          />
        </>
      )}
    </div>
  );
}
