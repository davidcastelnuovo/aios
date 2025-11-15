import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, Phone, Mail, AlertCircle, Edit, Send, MessageSquare, ArrowLeft } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import ChatMessageList from "./ChatMessageList";
import ChatInput from "./ChatInput";
import { toast } from "sonner";

interface ChatViewProps {
  contactId: string;
  contactType: 'client' | 'lead';
  onBack?: () => void;
}

export default function ChatView({ contactId, contactType, onBack }: ChatViewProps) {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState(false);
  const [subscriberId, setSubscriberId] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [templateVariables, setTemplateVariables] = useState<Record<string, string>>({});

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

  // Fetch templates
  const { data: templates, isLoading: templatesLoading } = useQuery({
    queryKey: ['manychat-templates', contact?.tenant_id],
    queryFn: async () => {
      if (!contact?.tenant_id) return [];
      const { data, error } = await supabase
        .from('manychat_templates')
        .select('*')
        .eq('tenant_id', contact.tenant_id)
        .eq('is_active', true)
        .order('display_name');
      
      if (error) throw error;
      return data;
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
      queryClient.invalidateQueries({ queryKey: ['chat-messages', contactId, contactType] });
      queryClient.invalidateQueries({ queryKey: ['chat-contacts'] });
    },
  });

  // Fetch messages with smart refetch
  const { data: messages, isLoading } = useQuery({
    queryKey: ['chat-messages', contactId, contactType],
    queryFn: async () => {
      console.time(`⏱️ Chat messages for ${contactId}`);
      const payload = contactType === 'client' 
        ? { clientId: contactId }
        : { leadId: contactId };
      
      const { data, error } = await supabase.functions.invoke('get-chat-history', {
        body: payload,
      });

      console.timeEnd(`⏱️ Chat messages for ${contactId}`);

      if (error) throw error;
      markAsReadMutation.mutate();
      return data.messages || [];
    },
    refetchInterval: 5000,
    staleTime: 2000,
  });

  // Update ManyChat ID mutation
  const updateIdMutation = useMutation({
    mutationFn: async (newSubscriberId: string) => {
      const table = contactType === 'client' ? 'clients' : 'leads';
      const { error } = await supabase
        .from(table)
        .update({ manychat_subscriber_id: newSubscriberId })
        .eq('id', contactId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contact', contactId, contactType] });
      toast.success('ManyChat ID עודכן בהצלחה');
      setEditingId(false);
    },
    onError: () => {
      toast.error('שגיאה בעדכון ManyChat ID');
    },
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async ({ message, templateId, templateVariables }: { 
      message?: string;
      templateId?: string;
      templateVariables?: Record<string, string>;
    }) => {
      const payload: any = { message, templateId, templateVariables };
      
      if (contactType === 'client') {
        payload.clientId = contactId;
      } else {
        payload.leadId = contactId;
      }
      
      const { data, error } = await supabase.functions.invoke('send-chat-message', {
        body: payload,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat-messages', contactId, contactType] });
      toast.success('ההודעה נשלחה בהצלחה');
      setSelectedTemplate(null);
      setTemplateVariables({});
    },
    onError: (error: any) => {
      toast.error(error.message || 'שגיאה בשליחת ההודעה');
    },
  });

  const handleSendMessage = (message: string) => {
    if (selectedTemplate) {
      sendMessageMutation.mutate({ message, templateId: selectedTemplate, templateVariables });
    } else {
      sendMessageMutation.mutate({ message });
    }
  };

  const handleSendWithTemplate = () => {
    if (!selectedTemplate) {
      toast.error('נא לבחור טמפלייט');
      return;
    }
    sendMessageMutation.mutate({ templateId: selectedTemplate, templateVariables });
  };

  const selectedTemplateData = templates?.find(t => t.id === selectedTemplate);

  if (!contact) {
    return (
      <Card className="h-full flex items-center justify-center">
        <div className="text-center">
          <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-20" />
          <p className="text-muted-foreground">טוען פרטי איש קשר...</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b bg-muted/50">
        <div className="flex items-center gap-3 mb-3">
          {onBack && (
            <Button
              variant="outline"
              onClick={onBack}
              className="lg:hidden gap-2"
            >
              <ArrowLeft className="h-5 w-5" />
              <span>חזרה לרשימה</span>
            </Button>
          )}
          <div className="flex-1">
            <h2 className="font-semibold text-lg flex items-center gap-2">
              {contact.name}
              {contactType === 'lead' && (
                <Badge variant="outline" className="text-xs">ליד</Badge>
              )}
            </h2>
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <Building2 className="h-3 w-3" />
              {contact.agencies?.name}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 text-sm">
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

      {/* Template Selection */}
      {templates && templates.length > 0 && (
        <div className="p-3 border-b bg-muted/30">
          <Label className="text-xs">טמפלייט</Label>
          <div className="flex gap-2 mt-1">
            <Select value={selectedTemplate || 'none'} onValueChange={(value) => { setSelectedTemplate(value === 'none' ? null : value); setTemplateVariables({}); }}>
              <SelectTrigger className="h-8 text-sm flex-1">
                <SelectValue placeholder="בחר טמפלייט (אופציונלי)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">ללא טמפלייט</SelectItem>
                {templates.map((template) => (
                  <SelectItem key={template.id} value={template.id}>{template.display_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedTemplate && (
              <Button size="sm" variant="outline" onClick={handleSendWithTemplate} disabled={sendMessageMutation.isPending}>
                <Send className="h-3 w-3 ml-1" />
                שלח
              </Button>
            )}
          </div>

          {/* Template Variables */}
          {selectedTemplateData?.template_variables && Array.isArray(selectedTemplateData.template_variables) && selectedTemplateData.template_variables.length > 0 && (
            <div className="mt-2 space-y-2">
              <Label className="text-xs">משתנים</Label>
              {selectedTemplateData.template_variables.map((variable: string) => (
                <div key={variable} className="flex items-center gap-2">
                  <Label className="text-xs min-w-[80px]">{variable}:</Label>
                  <Input value={templateVariables[variable] || ''} onChange={(e) => setTemplateVariables(prev => ({ ...prev, [variable]: e.target.value }))} placeholder={`ערך עבור ${variable}`} className="h-7 text-sm" />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-hidden">
        <ChatMessageList messages={messages || []} isLoading={isLoading} />
      </div>

      {/* Input */}
      <div className="p-3 border-t">
        <ChatInput onSend={handleSendMessage} isLoading={!contact.manychat_subscriber_id || sendMessageMutation.isPending} />
      </div>
    </Card>
  );
}
