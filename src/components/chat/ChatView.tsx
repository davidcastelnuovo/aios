import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, Phone, Mail, AlertCircle, Edit, Send, MessageSquare } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import ChatMessageList from "./ChatMessageList";
import ChatInput from "./ChatInput";
import { toast } from "sonner";

interface ChatViewProps {
  clientId: string;
}

export default function ChatView({ clientId }: ChatViewProps) {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState(false);
  const [subscriberId, setSubscriberId] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [templateVariables, setTemplateVariables] = useState<Record<string, string>>({});

  // Fetch client details
  const { data: client } = useQuery({
    queryKey: ['client', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select(`
          id,
          name,
          phone,
          email,
          agency_id,
          tenant_id,
          manychat_subscriber_id,
          agencies (name)
        `)
        .eq('id', clientId)
        .single();

      if (error) throw error;
      return data;
    },
  });

  // Fetch templates
  const { data: templates } = useQuery({
    queryKey: ['manychat-templates', client?.tenant_id],
    queryFn: async () => {
      if (!client?.tenant_id) return [];
      const { data, error } = await supabase
        .from('manychat_templates')
        .select('*')
        .eq('tenant_id', client.tenant_id)
        .eq('is_active', true)
        .order('display_name');
      
      if (error) throw error;
      return data;
    },
    enabled: !!client?.tenant_id,
  });

  // Mark messages as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('chat_messages')
        .update({ read_at: new Date().toISOString() })
        .eq('client_id', clientId)
        .eq('direction', 'inbound')
        .is('read_at', null);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat-messages', clientId] });
      queryClient.invalidateQueries({ queryKey: ['chat-clients'] });
      queryClient.invalidateQueries({ queryKey: ['unsynced-clients-count'] });
    },
  });

  // Fetch messages
  const { data: messages, isLoading } = useQuery({
    queryKey: ['chat-messages', clientId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('get-chat-history', {
        body: { clientId },
      });

      if (error) throw error;
      
      // Mark messages as read after fetching
      markAsReadMutation.mutate();
      
      return data.messages || [];
    },
    refetchInterval: 5000, // Poll every 5 seconds for new messages
  });

  // Update ManyChat ID mutation
  const updateIdMutation = useMutation({
    mutationFn: async (newSubscriberId: string) => {
      const { error } = await supabase
        .from('clients')
        .update({ manychat_subscriber_id: newSubscriberId })
        .eq('id', clientId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client', clientId] });
      queryClient.invalidateQueries({ queryKey: ['chat-clients'] });
      queryClient.invalidateQueries({ queryKey: ['unsynced-clients'] });
      setEditingId(false);
      setSubscriberId("");
      toast.success('ManyChat ID עודכן בהצלחה');
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
      templateVariables?: Record<string, string> 
    }) => {
      const { data, error } = await supabase.functions.invoke('send-chat-message', {
        body: { clientId, message, templateId, templateVariables },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat-messages', clientId] });
      queryClient.invalidateQueries({ queryKey: ['chat-clients'] });
      queryClient.invalidateQueries({ queryKey: ['client', clientId] });
      setSelectedTemplate(null);
      setTemplateVariables({});
      toast.success('הודעה נשלחה בהצלחה');
    },
    onError: (error: any) => {
      console.error('Send message error:', error);
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

  const handleSendTestMessage = () => {
    if (selectedTemplate) {
      handleSendWithTemplate();
    } else {
      sendMessageMutation.mutate({ message: "שלום! זוהי הודעת בדיקה מהמערכת." });
    }
  };

  if (!client) {
    return (
      <Card className="h-full flex items-center justify-center">
        <div className="text-muted-foreground">טוען...</div>
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">{client.name}</h2>
            <div className="flex gap-4 mt-1 text-sm text-muted-foreground">
              {client.agencies && (
                <div className="flex items-center gap-1">
                  <Building2 className="h-3 w-3" />
                  {client.agencies.name}
                </div>
              )}
              {client.phone && (
                <div className="flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  {client.phone}
                </div>
              )}
              {client.email && (
                <div className="flex items-center gap-1">
                  <Mail className="h-3 w-3" />
                  {client.email}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ManyChat Status & Actions */}
        {!client.manychat_subscriber_id && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between gap-4">
              <div className="text-sm">
                <div className="font-semibold">לקוח לא מסונכרן עם ManyChat</div>
                <div className="text-xs text-muted-foreground mt-1">
                  שלח הודעת בדיקה או הזן את ה-ManyChat ID ידנית
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleSendTestMessage}
                  disabled={sendMessageMutation.isPending}
                >
                  <Send className="h-3 w-3 ml-1" />
                  הודעת בדיקה
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setEditingId(true)}
                >
                  <Edit className="h-3 w-3 ml-1" />
                  הזן ID
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {editingId && (
          <div className="flex gap-2">
            <Input
              placeholder="ManyChat Subscriber ID"
              value={subscriberId}
              onChange={(e) => setSubscriberId(e.target.value)}
              className="flex-1"
            />
            <Button
              size="sm"
              onClick={() => updateIdMutation.mutate(subscriberId)}
              disabled={!subscriberId || updateIdMutation.isPending}
            >
              שמור
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setEditingId(false);
                setSubscriberId("");
              }}
            >
              ביטול
            </Button>
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-hidden">
        <ChatMessageList messages={messages || []} isLoading={isLoading} />
      </div>

      {/* Input */}
      <div className="border-t">
        {/* Template Selection - Compact Dropdown above input */}
        {templates && templates.length > 0 && (
          <div className="px-4 pt-3 pb-2 space-y-2">
            <div className="flex gap-2 items-center">
              <Select value={selectedTemplate || ""} onValueChange={setSelectedTemplate}>
                <SelectTrigger className="flex-1 h-9">
                  <SelectValue placeholder="בחר טמפלייט WhatsApp (אופציונלי)" />
                </SelectTrigger>
                <SelectContent className="z-50 bg-background">
                  {templates.map((template: any) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.display_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedTemplate && (
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => {
                    setSelectedTemplate(null);
                    setTemplateVariables({});
                  }}
                  className="h-9 px-2"
                >
                  ✕
                </Button>
              )}
            </div>
            
            {/* Template Variables Form */}
            {selectedTemplateData && Array.isArray(selectedTemplateData.template_variables) && selectedTemplateData.template_variables.length > 0 && (
              <div className="space-y-2 pt-2 border-t">
                <Label className="text-xs text-muted-foreground">משתנים:</Label>
                <div className="grid grid-cols-2 gap-2">
                  {(selectedTemplateData.template_variables as string[]).map((varName: string) => (
                    <div key={varName}>
                      <Label className="text-xs">{varName}</Label>
                      <Input
                        className="h-8"
                        value={templateVariables[varName] || ""}
                        onChange={(e) => setTemplateVariables({
                          ...templateVariables,
                          [varName]: e.target.value
                        })}
                        placeholder={`הזן ${varName}`}
                      />
                    </div>
                  ))}
                </div>
                <Button 
                  size="sm" 
                  className="w-full"
                  onClick={handleSendWithTemplate}
                  disabled={sendMessageMutation.isPending}
                >
                  <MessageSquare className="h-3 w-3 ml-1" />
                  שלח עם טמפלייט
                </Button>
              </div>
            )}
          </div>
        )}
        
        <ChatInput
          onSend={handleSendMessage}
          isLoading={sendMessageMutation.isPending}
        />
      </div>
    </Card>
  );
}
