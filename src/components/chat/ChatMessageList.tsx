import { useEffect, useRef, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { he } from "date-fns/locale";
import { Loader2, MoreVertical, Copy, CheckSquare } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import CustomAudioPlayer from "./CustomAudioPlayer";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ConvertMessageToTaskDialog } from "./ConvertMessageToTaskDialog";
import { toast } from "sonner";

interface Message {
  id: string;
  direction: 'inbound' | 'outbound';
  message_text: string;
  created_at: string;
  sender_name?: string | null;
  raw_provider_data?: any;
  profiles?: {
    full_name: string;
  };
}

interface ChatMessageListProps {
  messages: Message[];
  isLoading: boolean;
  contactId?: string;
  contactType?: 'client' | 'lead' | 'group' | 'unknown';
  agencyId?: string;
}

export default function ChatMessageList({ 
  messages, 
  isLoading,
  contactId,
  contactType,
  agencyId,
}: ChatMessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [showTaskDialog, setShowTaskDialog] = useState(false);

  const handleCopyMessage = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("הועתק ללוח");
  };

  const handleConvertToTask = (message: Message) => {
    setSelectedMessage(message);
    setShowTaskDialog(true);
  };

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
        <CustomAudioPlayer 
          src={fileData.downloadUrl} 
          className="mb-2"
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
              className={`flex ${isOutbound ? 'justify-end' : 'justify-start'} group`}
            >
              <div
                className={`${isMobile ? 'max-w-[85%]' : 'max-w-[70%]'} rounded-lg ${isMobile ? 'px-3 py-1.5' : 'px-4 py-2'} ${
                  isOutbound
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted'
                } relative`}
              >
                {!isOutbound && message.sender_name && (
                  <div className="font-semibold text-xs mb-1 opacity-90">
                    {message.sender_name}
                  </div>
                )}
                {quotedMessage}
                {reactionEmoji}
                {mediaContent}
                {message.message_text && !reactionEmoji && !quotedMessage && !isPlaceholder(message.message_text) && (
                  <div className="whitespace-pre-wrap break-words" dir="rtl">
                    {message.message_text}
                  </div>
                )}
                <div
                  className={`text-xs mt-1 flex items-center justify-between gap-2 ${
                    isOutbound ? 'opacity-70' : 'text-muted-foreground'
                  }`}
                >
                  <span>
                    {format(new Date(message.created_at), 'HH:mm', { locale: he })}
                    {isOutbound && message.profiles && (
                      <span className="mr-2">• {message.profiles.full_name}</span>
                    )}
                  </span>
                  {message.message_text && !reactionEmoji && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <MoreVertical className="h-3 w-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleCopyMessage(message.message_text)}>
                          <Copy className="ml-2 h-4 w-4" />
                          העתק
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleConvertToTask(message)}>
                          <CheckSquare className="ml-2 h-4 w-4" />
                          המר למשימה
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      
      {selectedMessage && (
        <ConvertMessageToTaskDialog
          open={showTaskDialog}
          onOpenChange={setShowTaskDialog}
          messageText={selectedMessage.message_text}
          contactId={contactId}
          contactType={contactType}
          agencyId={agencyId}
        />
      )}
    </ScrollArea>
  );
}
