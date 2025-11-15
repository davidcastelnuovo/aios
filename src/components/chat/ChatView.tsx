import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, Phone, Mail, AlertCircle, Edit, Tag, ArrowLeft, Check, X, Send } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import ChatMessageList from "./ChatMessageList";
import ChatInput from "./ChatInput";
import { toast } from "sonner";

interface Message {
  id: string;
  direction: 'inbound' | 'outbound';
  message_text: string;
  created_at: string;
}

interface ChatViewProps {
  contactId: string;
  contactType: 'client' | 'lead';
  onBack?: () => void;
}

export default function ChatView({ contactId, contactType, onBack }: ChatViewProps) {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState(false);
  const [subscriberId, setSubscriberId] = useState("");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  // Fetch contact details (client or lead)
  const { data: contact } = useQuery({
    queryKey: ['contact', contactId, contactType],
    queryFn: async () => {
      if (contactType === 'client') {
        const { data, error } = await supabase
          .from('clients')
          .select('id, name, phone, email, agency_id, tenant_id, manychat_subscriber_id, agencies (name)')
          .eq('id', contactId)
          .single();
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from('leads')
          .select('id, company_name, phone, email, agency_id, tenant_id, manychat_subscriber_id, agencies (name)')
          .eq('id', contactId)
          .single();
        if (error) throw error;
        return { ...data, name: data.company_name };
      }
    },
  });

  // Fetch ManyChat tags
  const { data: tags, isLoading: tagsLoading } = useQuery({
    queryKey: ['manychat-tags', contact?.tenant_id],
    queryFn: async () => {
      if (!contact?.tenant_id) return [];
      
      const { data, error } = await supabase.functions.invoke('get-manychat-tags', {
        body: { tenantId: contact.tenant_id }
      });
      
      if (error) {
        console.error('Error fetching tags:', error);
        return [];
      }
      
      return data?.tags || [];
    },
    enabled: !!contact?.tenant_id,
  });

  // Mark messages as read mutation with optimistic update
  const markAsReadMutation = useMutation({
    mutationFn: async () => {
      const filter = contactType === 'client' 
        ? { client_id: contactId }
        : { lead_id: contactId };
      
      const { error } = await supabase
        .from('chat_messages')
        .update({ read_at: new Date().toISOString() })
        .match(filter)
        .eq('direction', 'inbound')
        .is('read_at', null);
      
      if (error) throw error;
    },
    onMutate: async () => {
      // Optimistic update - immediately update UI
      await queryClient.cancelQueries({ queryKey: ['chat-contacts'] });
      const previousContacts = queryClient.getQueryData(['chat-contacts']);
      
      queryClient.setQueryData(['chat-contacts'], (old: any) => {
        if (!old) return old;
        return old.map((contact: any) => 
          contact.id === contactId && contact.contact_type === contactType
            ? { ...contact, unread_count: 0 }
            : contact
        );
      });
      
      return { previousContacts };
    },
    onError: (_err, _vars, context) => {
      // Rollback on error
      if (context?.previousContacts) {
        queryClient.setQueryData(['chat-contacts'], context.previousContacts);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['chat-contacts'] });
    },
  });

  // Fetch messages with auto-refresh
  const { data: rawMessages = [], isLoading: messagesLoading } = useQuery({
    queryKey: ['chat-messages', contactId],
    queryFn: async () => {
      const filter = contactType === 'client' 
        ? { client_id: contactId }
        : { lead_id: contactId };
      
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .match(filter)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      
      // Mark as read after fetching
      markAsReadMutation.mutate();
      
      return data;
    },
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  const messages: Message[] = rawMessages.map(msg => ({
    id: msg.id,
    direction: msg.direction as 'inbound' | 'outbound',
    message_text: msg.message_text,
    created_at: msg.created_at,
  }));

  // Update ManyChat ID
  const updateIdMutation = useMutation({
    mutationFn: async (newId: string) => {
      const table = contactType === 'client' ? 'clients' : 'leads';
      const { error } = await supabase
        .from(table)
        .update({ manychat_subscriber_id: newId })
        .eq('id', contactId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contact', contactId, contactType] });
      setEditingId(false);
      toast.success('ה-Subscriber ID עודכן בהצלחה');
    },
    onError: (error: any) => {
      console.error('Update error:', error);
      toast.error('שגיאה בעדכון ה-ID');
    },
  });

  // Add tag mutation
  const addTagMutation = useMutation({
    mutationFn: async ({ tagId }: { tagId: string }) => {
      if (!contact?.manychat_subscriber_id) {
        throw new Error('אין Subscriber ID למנוי');
      }

      const { data, error } = await supabase.functions.invoke('add-manychat-tag', {
        body: {
          subscriberId: contact.manychat_subscriber_id,
          tagId,
          tenantId: contact.tenant_id,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('ה-Tag נוסף בהצלחה והטריגר הופעל');
      setSelectedTag(null);
    },
    onError: (error: any) => {
      console.error('Add tag error:', error);
      toast.error('שגיאה בהוספת ה-Tag');
    },
  });

  const [isSending, setIsSending] = useState(false);

  const handleSendMessage = async (message: string) => {
    setIsSending(true);
    try {
      // Send plain text message
      const { error } = await supabase
        .from('chat_messages')
        .insert({
          client_id: contactType === 'client' ? contactId : null,
          lead_id: contactType === 'lead' ? contactId : null,
          tenant_id: contact?.tenant_id || '',
          message_text: message,
          direction: 'outbound',
          channel: 'internal',
        });

      if (error) {
        console.error('Send error:', error);
        toast.error('שגיאה בשליחת ההודעה');
        return;
      }

      queryClient.invalidateQueries({ queryKey: ['chat-messages', contactId] });
      toast.success('ההודעה נשלחה');
    } finally {
      setIsSending(false);
    }
  };

  const handleAddTag = async () => {
    if (!selectedTag) {
      toast.error('נא לבחור Tag');
      return;
    }
    await addTagMutation.mutateAsync({ tagId: selectedTag });
  };

  if (!contact) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center text-muted-foreground">טוען...</div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b bg-card">
        <div className="flex items-center gap-3">
          {onBack && (
            <Button variant="ghost" size="sm" onClick={onBack}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-lg font-semibold">{contact.name}</h2>
            </div>
            {contact.agencies && (
              <Badge variant="secondary" className="text-xs mt-1">
                {contact.agencies.name}
              </Badge>
            )}
          </div>
        </div>

        {/* Contact Info */}
        <div className="mt-3 space-y-1 text-sm text-muted-foreground">
          {contact.phone && (
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <span>{contact.phone}</span>
            </div>
          )}
          {contact.email && (
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span>{contact.email}</span>
            </div>
          )}
        </div>

        {/* ManyChat Sync Status - Compact */}
        <div className="mt-2 flex items-center gap-2">
          {contact.manychat_subscriber_id ? (
            <>
              {editingId ? (
                <>
                  <Input
                    value={subscriberId}
                    onChange={(e) => setSubscriberId(e.target.value)}
                    placeholder="Subscriber ID"
                    className="h-7 text-xs flex-1"
                  />
                  <Button size="sm" onClick={() => updateIdMutation.mutate(subscriberId)} disabled={updateIdMutation.isPending} className="h-7 px-2">
                    <Check className="h-3 w-3" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingId(false)} className="h-7 px-2">
                    <X className="h-3 w-3" />
                  </Button>
                </>
              ) : (
                <>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-7 px-2">
                          <Check className="h-3 w-3 text-green-600" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-xs">מסונכרן: {contact.manychat_subscriber_id}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => { setSubscriberId(contact.manychat_subscriber_id || ''); setEditingId(true); }}>
                    <Edit className="h-3 w-3" />
                  </Button>
                  
                  {/* Tags Selection - Compact */}
                  {tags && tags.length > 0 && (
                    <>
                      <Select value={selectedTag || ''} onValueChange={setSelectedTag}>
                        <SelectTrigger className="h-7 text-xs bg-background flex-1">
                          <Tag className="h-3 w-3 ml-1" />
                          <SelectValue placeholder="טאג" />
                        </SelectTrigger>
                        <SelectContent className="bg-popover border shadow-lg z-50">
                          {tags.map((tag: any) => (
                            <SelectItem key={tag.id} value={tag.id.toString()} className="cursor-pointer hover:bg-accent text-xs">
                              {tag.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {selectedTag && (
                        <Button size="sm" onClick={handleAddTag} disabled={addTagMutation.isPending} className="h-7 px-2">
                          <Send className="h-3 w-3" />
                        </Button>
                      )}
                    </>
                  )}
                </>
              )}
            </>
          ) : (
            <>
              <AlertCircle className="h-3 w-3 text-amber-500" />
              {!editingId ? (
                <Button size="sm" variant="outline" onClick={() => setEditingId(true)} className="h-7 text-xs px-2">
                  הוסף ID
                </Button>
              ) : (
                <>
                  <Input value={subscriberId} onChange={(e) => setSubscriberId(e.target.value)} placeholder="Subscriber ID" className="h-7 text-xs flex-1" />
                  <Button size="sm" onClick={() => updateIdMutation.mutate(subscriberId)} disabled={updateIdMutation.isPending} className="h-7 px-2">
                    <Check className="h-3 w-3" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingId(false)} className="h-7 px-2">
                    <X className="h-3 w-3" />
                  </Button>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-hidden">
        <ChatMessageList messages={messages} isLoading={messagesLoading} />
      </div>

      {/* Input */}
      <div className="border-t bg-card">
        <ChatInput onSend={handleSendMessage} isLoading={isSending} />
      </div>
    </div>
  );
}
