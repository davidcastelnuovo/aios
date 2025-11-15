import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Building2, Phone, Mail } from "lucide-react";
import ChatMessageList from "./ChatMessageList";
import ChatInput from "./ChatInput";
import { toast } from "sonner";

interface ChatViewProps {
  clientId: string;
}

export default function ChatView({ clientId }: ChatViewProps) {
  const queryClient = useQueryClient();

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
    },
    onError: (error: any) => {
      console.error('Send message error:', error);
      toast.error(error.message || 'שגיאה בשליחת ההודעה');
    },
  });

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
      <div className="p-4 border-b">
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
