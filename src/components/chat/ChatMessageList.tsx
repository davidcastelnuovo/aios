import { useEffect, useRef } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { he } from "date-fns/locale";
import { Loader2 } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

interface Message {
  id: string;
  direction: 'inbound' | 'outbound';
  message_text: string;
  created_at: string;
  raw_provider_data?: any;
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
  const isMobile = useIsMobile();

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
  // Detect placeholder texts like [quotedMessage], [reactionMessage], [הודעת קול]
  const isPlaceholder = (text?: string) => !!text && /^\s*\[[^\]]+\]\s*$/.test(text);

  const getQuotedMessage = (message: Message) => {
    const quotedMessage =
      message.raw_provider_data?.messageData?.quotedMessage ||
      message.raw_provider_data?.messageData?.extendedTextMessageData?.quotedMessage;
    if (!quotedMessage) return null;

    return (
      <div className="bg-background/50 border-r-2 border-primary pr-2 mb-2 text-sm opacity-80">
        <div className="font-semibold text-xs mb-1">
          {quotedMessage.chatName || 'הודעה מצוטטת'}
        </div>
        <div className="line-clamp-2">
          {quotedMessage.textMessage || quotedMessage.caption || '[מדיה]'}
        </div>
      </div>
    );
  };

  const getReactionEmoji = (message: Message) => {
    const reactionText = message.raw_provider_data?.messageData?.reactionMessageData?.reactionText;
    if (!reactionText) return null;

    return (
      <div className="text-2xl mb-1">
        {reactionText}
      </div>
    );
  };

  const getMediaContent = (message: Message) => {
    if (!message.raw_provider_data?.messageData) return null;
    
    const messageData = message.raw_provider_data.messageData;
    const fileData = messageData.fileMessageData;
    
    if (!fileData?.downloadUrl) return null;

    const messageType = messageData.typeMessage;
    
    if (messageType === 'imageMessage') {
      return (
        <img
          src={fileData.downloadUrl}
          alt="תמונה מצורפת"
          loading="lazy"
          className="max-w-full rounded-md mb-2"
        />
      );
    }
    
    if (messageType === 'videoMessage') {
      return (
        <video
          src={fileData.downloadUrl}
          controls
          playsInline
          controlsList="nodownload noplaybackrate noremoteplayback"
          className="max-w-full rounded-md mb-2"
          onContextMenu={(e) => e.preventDefault()}
        />
      );
    }
    
    if (messageType === 'audioMessage') {
      return (
        <audio
          src={fileData.downloadUrl}
          controls
          controlsList="nodownload noplaybackrate noremoteplayback"
          className="w-full mb-2"
          onContextMenu={(e) => e.preventDefault()}
        />
      );
    }
    
    if (messageType === 'documentMessage') {
      return (
        <a 
          href={fileData.downloadUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-sm underline mb-2"
        >
          📄 {fileData.fileName || 'מסמך'}
        </a>
      );
    }
    
    return null;
  };

  return (
    <ScrollArea className={`h-full overflow-visible ${isMobile ? 'p-2' : 'p-4'}`} ref={scrollRef}>
      <div className="space-y-4">
        {messages.map((message) => {
          const isOutbound = message.direction === 'outbound';
          const mediaContent = getMediaContent(message);
          const quotedMessage = getQuotedMessage(message);
          const reactionEmoji = getReactionEmoji(message);
          
          return (
            <div
              key={message.id}
              className={`flex ${isOutbound ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`${isMobile ? 'max-w-[85%]' : 'max-w-[70%]'} rounded-lg ${isMobile ? 'px-3 py-1.5' : 'px-4 py-2'} ${
                  isOutbound
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted'
                } relative`}
              >
                {quotedMessage}
                {reactionEmoji}
                {mediaContent}
                {message.message_text && !reactionEmoji && !quotedMessage && !isPlaceholder(message.message_text) && (
                  <div className="whitespace-pre-wrap break-words" dir="rtl">
                    {message.message_text}
                  </div>
                )}
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
