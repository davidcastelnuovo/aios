import { useState, useRef } from "react";
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
import { LinkCampaignerDialog } from "./LinkCampaignerDialog";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useIsMobile } from "@/hooks/use-mobile";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Link } from "react-router-dom";
import { useTenantPath } from "@/hooks/useTenantPath";

interface Message {
  id: string;
  direction: "inbound" | "outbound";
  message_text: string;
  created_at: string;
  sender_name?: string | null;
  raw_provider_data?: any;
  profiles?: {
    full_name: string;
  } | null;
}

interface ReplyToMessage {
  id: string;
  text: string;
  senderName?: string;
}

interface ChatViewProps {
  contactId: string;
  contactType: "client" | "lead" | "group" | "unknown";
  senderPhone?: string;
  contactName?: string;
  onBack?: () => void;
}

export default function ChatView({ contactId, contactType, senderPhone, contactName, onBack }: ChatViewProps) {
  const queryClient = useQueryClient();
  const { tenant: currentTenant, tenantId } = useCurrentTenant();
  const { userId } = useCurrentUser();
  const { buildPath } = useTenantPath();
  const isMobile = useIsMobile();
  const [convertDialogOpen, setConvertDialogOpen] = useState(false);
  const [convertType, setConvertType] = useState<"client" | "lead" | "group">("client");
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkPhoneDialogOpen, setLinkPhoneDialogOpen] = useState(false);
  const [linkCampaignerDialogOpen, setLinkCampaignerDialogOpen] = useState(false);
  const [isHeaderExpanded, setIsHeaderExpanded] = useState(false);
  const [replyToMessage, setReplyToMessage] = useState<ReplyToMessage | null>(null);
  const [messagePeriod, setMessagePeriod] = useState<'week' | 'month' | 'all'>('week');

  // Fetch contact details
  const { data: contact, isLoading: isLoadingContact } = useQuery({
    queryKey: ["contact", contactId, contactType, senderPhone],
    queryFn: async () => {
      if (contactType === "unknown") {
        // For unknown contacts, use the passed name or fallback to phone
        return {
          id: contactId,
          name: contactName || senderPhone || contactId,
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
  
  const { data: chatIntegration } = useQuery({
    queryKey: ["chat-integration", tenantIdForProvider],
    queryFn: async () => {
      if (!tenantIdForProvider) return null;
      const { data, error } = await supabase
        .from("tenant_integrations")
        .select("integration_type, user_id")
        .eq("tenant_id", tenantIdForProvider)
        .eq("is_active", true)
        .in("integration_type", ["manychat", "green_api"])
        .single();
      if (error) return null;
      return data;
    },
    enabled: !!tenantIdForProvider,
  });

  const activeProvider = chatIntegration?.integration_type as "manychat" | "green_api" | null;
  const connectionUserId = chatIntegration?.user_id;


  // Mark messages as read mutation + remove "unread" tag
  const markAsReadMutation = useMutation({
    mutationFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;
      
      // Mark messages as read
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
      
      // Remove "unread" tag (by name matching)
      if (tenantId) {
        // Find the "unread" tag by name patterns
        const { data: unreadTag } = await supabase
          .from("chat_tags")
          .select("id")
          .eq("tenant_id", tenantId)
          .or("name.ilike.%לא נקרא%,name.ilike.%unread%")
          .maybeSingle();
        
        if (unreadTag) {
          // Delete the tag association for this contact (for ANY user in this tenant)
          let deleteQuery = supabase
            .from("chat_contact_tags")
            .delete()
            .eq("tag_id", unreadTag.id)
            .eq("tenant_id", tenantId);
          
          if (contactType === "client") {
            deleteQuery = deleteQuery.eq("client_id", contactId);
          } else if (contactType === "lead") {
            deleteQuery = deleteQuery.eq("lead_id", contactId);
          } else if (contactType === "group") {
            deleteQuery = deleteQuery.eq("group_id", contactId);
          } else if (contactType === "unknown" && senderPhone) {
            deleteQuery = deleteQuery.eq("sender_phone", senderPhone);
          }
          
          await deleteQuery;
        }
      }
    },
    onMutate: async () => {
      // Cancel and update both active-chats and unknown-contacts queries for instant UI update
      await queryClient.cancelQueries({ queryKey: ["active-chats"] });
      await queryClient.cancelQueries({ queryKey: ["unknown-contacts"] });
      
      const previousActiveChats = queryClient.getQueryData(["active-chats"]);
      const previousUnknownContacts = queryClient.getQueryData(["unknown-contacts"]);

      // Optimistically update active-chats
      queryClient.setQueryData(["active-chats"], (old: any) => {
        if (!old) return old;
        return old.map((contact: any) =>
          contact.id === contactId && contact.contact_type === contactType
            ? { ...contact, unread_count: 0 }
            : contact
        );
      });

      // Optimistically update unknown-contacts
      queryClient.setQueryData(["unknown-contacts"], (old: any) => {
        if (!old) return old;
        return old.map((contact: any) =>
          (contact.id === contactId || contact.sender_phone === senderPhone)
            ? { ...contact, unread_count: 0 }
            : contact
        );
      });

      return { previousActiveChats, previousUnknownContacts };
    },
    onError: (err, variables, context: any) => {
      if (context?.previousActiveChats) {
        queryClient.setQueryData(["active-chats"], context.previousActiveChats);
      }
      if (context?.previousUnknownContacts) {
        queryClient.setQueryData(["unknown-contacts"], context.previousUnknownContacts);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["active-chats"] });
      queryClient.invalidateQueries({ queryKey: ["unknown-contacts"] });
      queryClient.invalidateQueries({ queryKey: ["contact-tags-for-list"] });
    },
  });

  // Block contact mutation - works for all contact types
  const blockMutation = useMutation({
    mutationFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Missing user");
      
      const effectiveTenantId = contactType === "unknown" ? tenantId : contact?.tenant_id;
      if (!effectiveTenantId) throw new Error("Missing tenant");

      // 1. Save to blocked_contacts table for permanent blocking
      const blockedContactData: any = {
        tenant_id: effectiveTenantId,
        connection_user_id: userData.user.id,
        blocked_by_user_id: userData.user.id,
      };

      if (contactType === "unknown") {
        blockedContactData.sender_phone = senderPhone || contactId;
      } else if (contactType === "client") {
        blockedContactData.client_id = contactId;
      } else if (contactType === "lead") {
        blockedContactData.lead_id = contactId;
      } else if (contactType === "group") {
        blockedContactData.group_id = contactId;
      }

      const { error: blockedError } = await supabase
        .from("blocked_contacts")
        .upsert(blockedContactData, { onConflict: 'id' });

      if (blockedError) {
        console.error("Error saving to blocked_contacts:", blockedError);
        // Continue anyway - the message blocking should still work
      }

      // 2. Update whatsapp_groups.is_blocked for groups
      if (contactType === "group") {
        await supabase
          .from("whatsapp_groups")
          .update({ is_blocked: true })
          .eq("id", contactId);
      }

      // 3. Update all existing messages as blocked
      let query = supabase
        .from("chat_messages")
        .update({
          is_blocked: true,
          blocked_at: new Date().toISOString(),
          blocked_by_user_id: userData.user.id,
        })
        .eq("tenant_id", effectiveTenantId);

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
      toast.success("השיחה נחסמה בהצלחה - ההודעות לא יישמרו יותר");
      queryClient.invalidateQueries({ queryKey: ["chat-contacts"] });
      queryClient.invalidateQueries({ queryKey: ["unknown-contacts"] });
      queryClient.invalidateQueries({ queryKey: ["active-chats"] });
      queryClient.invalidateQueries({ queryKey: ["chat-messages", contactId, contactType, senderPhone] });
      onBack?.();
    },
    onError: (error) => {
      toast.error("שגיאה בחסימת השיחה");
      console.error("Block error:", error);
    },
  });

  // Reset message period when contact changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const contactKey = `${contactId}-${contactType}-${senderPhone}`;
  const prevContactKey = useRef(contactKey);
  if (prevContactKey.current !== contactKey) {
    prevContactKey.current = contactKey;
    setMessagePeriod('week');
  }

  // Calculate date filter based on period
  const getDateFilter = () => {
    const now = new Date();
    if (messagePeriod === 'week') {
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    } else if (messagePeriod === 'month') {
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    }
    return null; // 'all' - no date filter
  };

  // Fetch chat messages
  const { data: messagesData, isLoading: isLoadingMessages } = useQuery({
    queryKey: ["chat-messages", contactId, contactType, senderPhone, connectionUserId, messagePeriod],
    queryFn: async () => {
      console.log("🔵 Fetching messages for:", { contactId, contactType, senderPhone, connectionUserId, messagePeriod });
      const dateFilter = getDateFilter();
      
      if (contactType === "unknown") {
        let query = supabase
          .from("chat_messages")
          .select("*")
          .eq("sender_phone", senderPhone || contactId)
          .eq("is_blocked", false);

        if (connectionUserId) {
          query = query.eq("connection_user_id", connectionUserId);
        }
        if (dateFilter) {
          query = query.gte("created_at", dateFilter);
        }

        const { data, error } = await query.order("created_at", { ascending: false }).limit(2000);

        if (error) {
          console.error("❌ Error fetching unknown messages:", error);
          throw error;
        }

        console.log("✅ Fetched unknown messages:", data?.length);
        markAsReadMutation.mutate();
        return data?.reverse() || [];
      }

      const filter = contactType === "client" 
        ? { client_id: contactId } 
        : contactType === "lead" 
        ? { lead_id: contactId }
        : { group_id: contactId };

      let query = supabase
        .from("chat_messages")
        .select("*")
        .match(filter)
        .eq("is_blocked", false);

      if (connectionUserId) {
        query = query.eq("connection_user_id", connectionUserId);
      }
      if (dateFilter) {
        query = query.gte("created_at", dateFilter);
      }

      const { data, error } = await query.order("created_at", { ascending: false }).limit(2000);

      if (error) {
        console.error("❌ Error fetching messages:", error);
        throw error;
      }

      console.log("✅ Fetched messages:", data?.length);
      markAsReadMutation.mutate();

      return data?.reverse() || [];
    },
    enabled: !!contactId,
    refetchInterval: 5000,
  });

  // Transform messages
  const messages: Message[] =
    messagesData?.map((msg: any) => ({
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

  const handleSendMessage = async (message: string, quotedMessageId?: string) => {
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
          quotedMessageId,
        };

        // Only add IDs for known contact types
        if (contactType === "client") {
          body.clientId = contactId;
        } else if (contactType === "lead") {
          body.leadId = contactId;
        } else if (contactType === "group") {
          body.groupId = contactId;
        } else if (contactType === "unknown") {
          // For unknown contacts, pass the tenant ID explicitly
          body.tenantId = tenantId;
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

  const handleSendFile = async (file: File, caption?: string) => {
    try {
      if (!contact) {
        toast.error("איש קשר לא נמצא");
        return;
      }

      if (!userId) {
        toast.error("נא להתחבר מחדש למערכת");
        return;
      }

      if (activeProvider !== 'green_api') {
        toast.error("שליחת קבצים נתמכת רק ב-Green API");
        return;
      }

      const formData = new FormData();
      formData.append('file', file, file.name);
      if (caption) formData.append('caption', caption);
      if (tenantId) formData.append('tenantId', tenantId);
      formData.append('phoneNumber', senderPhone || contact.phone || '');
      
      if (contactType === "client") {
        formData.append('clientId', contactId);
      } else if (contactType === "lead") {
        formData.append('leadId', contactId);
      } else if (contactType === "group") {
        formData.append('groupId', contactId);
      }

      // Determine file type
      if (file.type.startsWith('audio/')) {
        formData.append('fileType', 'voice');
      } else if (file.type.startsWith('image/')) {
        formData.append('fileType', 'image');
      } else if (file.type.startsWith('video/')) {
        formData.append('fileType', 'video');
      } else {
        formData.append('fileType', 'document');
      }

      const { error } = await supabase.functions.invoke("send-green-api-file", {
        body: formData,
      });

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["chat-messages", contactId] });
      toast.success("הקובץ נשלח בהצלחה");
    } catch (error) {
      console.error("Error sending file:", error);
      toast.error("שגיאה בשליחת הקובץ");
    }
  };

  if (isLoadingContact) {
    return <div className="p-4">טוען...</div>;
  }

  if (!contact) {
    return <div className="p-4">איש קשר לא נמצא</div>;
  }


  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header - קבוע וקומפקטי */}
      <div className={`${isMobile ? 'p-1.5' : 'px-3 py-2'} border-b bg-card shadow-sm`}>
        {/* שורה ראשונה - תמיד גלויה */}
        <div className="flex items-center gap-2">
          {onBack && (
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onBack}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h2 className="font-medium text-base">{contact.name}</h2>
              <ChatProviderIndicator provider={contact.active_chat_provider} size="sm" />
            </div>
          </div>
          {isMobile && (
            <Button 
              variant="ghost" 
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => setIsHeaderExpanded(!isHeaderExpanded)}
            >
              {isHeaderExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          )}
        </div>
        
        {/* פרטים נוספים - מתקפל במובייל, תמיד פתוח בדסקטופ */}
        <Collapsible open={isMobile ? isHeaderExpanded : true}>
          <CollapsibleContent>
            <div className={`space-y-1 ${isMobile ? 'mt-1' : 'mt-2'}`}>
              {/* פרטי קשר */}
              <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-0.5">
                {(contact as any).agencies?.name && (
                  <Badge variant="outline" className="text-xs h-5">{(contact as any).agencies.name}</Badge>
                )}
                {contact.phone && <span>טלפון: {contact.phone}</span>}
                {contact.email && <span>אימייל: {contact.email}</span>}
              </div>

              {/* Alerts וכפתורים למשתמשים unknown */}
              {contactType === 'unknown' && (
                <>
                  <Alert className="py-1.5">
                    <AlertCircle className="h-3 w-3" />
                    <AlertDescription className="text-xs">
                      איש קשר לא מוגדר במערכת. המר אותו ללקוח, ליד או קבוצה.
                    </AlertDescription>
                  </Alert>
                  <div className="flex gap-1.5 flex-wrap">
                    <Button onClick={() => { setConvertType("client"); setConvertDialogOpen(true); }} size="sm" className="h-7 text-xs">
                      המר ללקוח
                    </Button>
                    <Button onClick={() => { setConvertType("lead"); setConvertDialogOpen(true); }} size="sm" variant="outline" className="h-7 text-xs">
                      המר לליד
                    </Button>
                    <Button onClick={() => { setConvertType("group"); setConvertDialogOpen(true); }} size="sm" variant="outline" className="h-7 text-xs">
                      המר לקבוצה
                    </Button>
                    <Button variant="destructive" size="sm" className="h-7 text-xs" onClick={() => blockMutation.mutate()} disabled={blockMutation.isPending}>
                      <Ban className="h-3 w-3 ml-1" />
                      חסום
                    </Button>
                    <Button variant="secondary" size="sm" className="h-7 text-xs" onClick={() => setLinkDialogOpen(true)}>
                      שייך לקיים
                    </Button>
                    <Button variant="secondary" size="sm" className="h-7 text-xs" onClick={() => setLinkCampaignerDialogOpen(true)}>
                      שייך לקמפיינר
                    </Button>
                  </div>
                </>
              )}

              {/* כפתורים לכל סוגי אנשי הקשר */}
              {contactType !== 'unknown' && (
                <div className="flex gap-1.5 flex-wrap items-center">
                  <Button
                    variant="destructive"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => {
                      if (confirm('האם אתה בטוח שברצונך לחסום את השיחה?')) {
                        blockMutation.mutate();
                      }
                    }}
                    disabled={blockMutation.isPending}
                  >
                    <Ban className="h-3 w-3 ml-1" />
                    חסום שיחה
                  </Button>
                  {contact.phone && contactType !== 'group' && (
                    <Button variant="secondary" size="sm" className="h-7 text-xs" onClick={() => setLinkPhoneDialogOpen(true)}>
                      שייך טלפון לאחר
                    </Button>
                  )}
                  
                  {/* Provider Controls - inline */}
                  {activeProvider === 'green_api' && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mr-2">
                      <Badge variant="outline" className="h-5 text-xs bg-blue-500/10 text-blue-700 dark:text-blue-400">Green API</Badge>
                      {contactType === 'group' && (contact as any).group_chat_id && (
                        <code className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded cursor-pointer hover:bg-muted/80" 
                          onClick={() => {
                            navigator.clipboard.writeText((contact as any).group_chat_id);
                            toast.success("מזהה הקבוצה הועתק");
                          }}
                          title="לחץ להעתקה"
                        >
                          {(contact as any).group_chat_id}
                        </code>
                      )}
                      {contactType !== 'group' && contact.phone && (
                        <span className="font-mono">{contact.phone}</span>
                      )}
                    </div>
                  )}
                  {activeProvider === 'manychat' && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mr-2">
                      <Badge variant="outline" className="h-5 text-xs bg-green-500/10 text-green-700 dark:text-green-400">ManyChat</Badge>
                      {contact.manychat_subscriber_id && (
                        <span className="font-mono text-xs">{contact.manychat_subscriber_id}</span>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Provider Controls - full for unknown */}
              {!activeProvider && contactType !== 'unknown' && (
                <Alert className="py-1.5">
                  <AlertCircle className="h-3 w-3" />
                  <AlertDescription className="text-xs">
                    לא מוגדר ספק צ'אט פעיל.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>

      {/* Messages area - גלילה פנימית */}
      <div className="flex-1 min-h-0 overflow-y-auto bg-[#e5ddd5]">
        <ChatMessageList
          messages={messages} 
          isLoading={isLoadingMessages} 
          contactId={contactId} 
          contactType={contactType} 
          agencyId={contact?.agency_id}
          anchorMessageId={anchorMessageId}
          currentPeriod={messagePeriod}
          onLoadMore={(period) => setMessagePeriod(period)}
          onReplyToMessage={(msg) => setReplyToMessage({
            id: msg.raw_provider_data?.idMessage || msg.id,
            text: msg.message_text,
            senderName: msg.sender_name || undefined,
          })}
        />
      </div>

      {/* Input area - קבוע */}
      <div className="border-t bg-card shadow-[0_-2px_10px_rgba(0,0,0,0.1)]">
        <ChatInput 
          onSend={handleSendMessage} 
          onSendFile={handleSendFile} 
          isLoading={false}
          replyToMessage={replyToMessage}
          onClearReply={() => setReplyToMessage(null)}
        />
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
          <LinkCampaignerDialog
            open={linkCampaignerDialogOpen}
            onOpenChange={setLinkCampaignerDialogOpen}
            senderPhone={senderPhone || contactId}
            senderName={contact?.name}
            onSuccess={(campaignerId) => {
              setLinkCampaignerDialogOpen(false);
              queryClient.invalidateQueries({ queryKey: ["chat-contacts"] });
              queryClient.invalidateQueries({ queryKey: ["unknown-contacts"] });
              if (onBack) onBack();
            }}
          />
        </>
      )}
    </div>
  );
}
