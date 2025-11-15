import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Building2, Phone, Mail, AlertCircle, Edit, Send } from "lucide-react";
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
          manychat_subscriber_id,
          agencies (name)
        `)
        .eq('id', clientId)
        .single();

      if (error) throw error;
      return data;
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
    mutationFn: async (message: string) => {
      const { data, error } = await supabase.functions.invoke('send-chat-message', {
        body: {
          clientId,
          message,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat-messages', clientId] });
      queryClient.invalidateQueries({ queryKey: ['chat-clients'] });
      queryClient.invalidateQueries({ queryKey: ['client', clientId] });
      toast.success('הודעה נשלחה בהצלחה');
    },
    onError: (error: any) => {
      console.error('Send message error:', error);
      toast.error(error.message || 'שגיאה בשליחת ההודעה');
    },
  });

  const handleSendTestMessage = () => {
    sendMessageMutation.mutate("שלום! זוהי הודעת בדיקה מהמערכת.");
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
        <ChatInput
          onSend={(message) => sendMessageMutation.mutate(message)}
          isLoading={sendMessageMutation.isPending}
        />
      </div>
    </Card>
  );
}
