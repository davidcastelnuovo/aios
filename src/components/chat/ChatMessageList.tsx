import { useEffect, useRef } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { he } from "date-fns/locale";
import { Loader2 } from "lucide-react";

interface Message {
  id: string;
  direction: 'inbound' | 'outbound';
  message_text: string;
  created_at: string;
  profiles?: {
    full_name: string;
  };
}

interface ChatMessageListProps {
  messages: Message[];
  isLoading: boolean;
}

export default function ChatMessageList({ messages, isLoading }: ChatMessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        אין הודעות עדיין
      </div>
    );
  }

  return (
    <ScrollArea className="h-full p-4" ref={scrollRef}>
      <div className="space-y-4">
        {messages.map((message) => {
          const isOutbound = message.direction === 'outbound';
          return (
            <div
              key={message.id}
              className={`flex ${isOutbound ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[70%] rounded-lg px-4 py-2 ${
                  isOutbound
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted'
                }`}
              >
                <div className="whitespace-pre-wrap break-words">
                  {message.message_text}
                </div>
                <div
                  className={`text-xs mt-1 ${
                    isOutbound ? 'opacity-70' : 'text-muted-foreground'
                  }`}
                >
                  {format(new Date(message.created_at), 'HH:mm', { locale: he })}
                  {isOutbound && message.profiles && (
                    <span className="mr-2">• {message.profiles.full_name}</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
