import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, Phone, Mail, AlertCircle, Edit, Tag, ArrowLeft } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
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
          client_id: contactType === 'client' ? contactId : '',
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

        {/* ManyChat Sync Status */}
        <div className="mt-3">
          {contact.manychat_subscriber_id ? (
            <div className="flex items-center gap-2">
              {editingId ? (
                <div className="flex items-center gap-2 flex-1">
                  <Input
                    value={subscriberId}
                    onChange={(e) => setSubscriberId(e.target.value)}
                    placeholder="Subscriber ID"
                    className="h-8 text-sm"
                  />
                  <Button size="sm" onClick={() => updateIdMutation.mutate(subscriberId)} disabled={updateIdMutation.isPending}>
                    שמור
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingId(false)}>
                    ביטול
                  </Button>
                </div>
              ) : (
                <Alert className="flex-1">
                  <AlertDescription className="flex items-center justify-between">
                    <span className="text-xs">מסונכרן ל-ManyChat: {contact.manychat_subscriber_id}</span>
                    <Button size="sm" variant="ghost" onClick={() => { setSubscriberId(contact.manychat_subscriber_id || ''); setEditingId(true); }}>
                      <Edit className="h-3 w-3" />
                    </Button>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          ) : (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="flex items-center justify-between">
                <span className="text-sm">איש קשר זה לא מסונכרן ל-ManyChat</span>
                {!editingId && (
                  <Button size="sm" variant="outline" onClick={() => setEditingId(true)}>
                    הוסף Subscriber ID
                  </Button>
                )}
              </AlertDescription>
            </Alert>
          )}
          {editingId && !contact.manychat_subscriber_id && (
            <div className="flex items-center gap-2 mt-2">
              <Input value={subscriberId} onChange={(e) => setSubscriberId(e.target.value)} placeholder="Subscriber ID" className="h-8 text-sm" />
              <Button size="sm" onClick={() => updateIdMutation.mutate(subscriberId)} disabled={updateIdMutation.isPending}>
                שמור
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditingId(false)}>
                ביטול
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Tag Selection */}
      {tags && tags.length > 0 && contact.manychat_subscriber_id && (
        <div className="p-3 border-b bg-muted/30">
          <Label className="text-xs">שליחת טריגר דרך Tag</Label>
          <div className="flex gap-2 mt-1">
            <Select value={selectedTag || 'none'} onValueChange={(value) => setSelectedTag(value === 'none' ? null : value)}>
              <SelectTrigger className="h-8 text-sm flex-1">
                <SelectValue placeholder="בחר Tag לשליחת טריגר" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">בחר Tag</SelectItem>
                {tags.map((tag: any) => (
                  <SelectItem key={tag.id} value={tag.id.toString()}>{tag.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedTag && (
              <Button size="sm" variant="default" onClick={handleAddTag} disabled={addTagMutation.isPending}>
                <Tag className="h-3 w-3 ml-1" />
                הוסף Tag
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            הוספת Tag תפעיל אוטומציה ב-ManyChat אם הגדרת Flow עם הטריגר המתאים
          </p>
        </div>
      )}

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
