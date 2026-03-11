import { useEffect, useRef, useState, useMemo } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { he } from "date-fns/locale";
import { Loader2, MoreVertical, Copy, CheckSquare, Reply, AlertCircle, History } from "lucide-react";
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
  anchorMessageId?: string;
  currentPeriod?: 'week' | 'month' | 'all';
  onLoadMore?: (period: 'week' | 'month' | 'all') => void;
  onReplyToMessage?: (message: Message) => void;
}

// Color palette for group members - distinct colors for easy identification
const MEMBER_COLORS = [
  '#0088CC', // Blue
  '#E91E63', // Pink
  '#9C27B0', // Purple
  '#673AB7', // Deep Purple
  '#3F51B5', // Indigo
  '#00BCD4', // Cyan
  '#009688', // Teal
  '#4CAF50', // Green
  '#FF9800', // Orange
  '#795548', // Brown
  '#607D8B', // Blue Grey
  '#F44336', // Red
];

// Generate consistent color for a sender based on their phone/name
const getSenderColor = (senderPhone: string | null | undefined, senderName: string | null | undefined, colorMap: Map<string, string>): string => {
  const key = senderPhone || senderName || 'unknown';
  
  if (!colorMap.has(key)) {
    const colorIndex = colorMap.size % MEMBER_COLORS.length;
    colorMap.set(key, MEMBER_COLORS[colorIndex]);
  }
  
  return colorMap.get(key) || MEMBER_COLORS[0];
};

export default function ChatMessageList({ 
  messages, 
  isLoading,
  contactId,
  contactType,
  agencyId,
  anchorMessageId,
  currentPeriod = 'week',
  onLoadMore,
  onReplyToMessage,
}: ChatMessageListProps) {
  const isMobile = useIsMobile();
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [showTaskDialog, setShowTaskDialog] = useState(false);
  const msgRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const bottomRef = useRef<HTMLDivElement>(null);
  const hasScrolledToAnchor = useRef(false);
  const lastContactId = useRef<string | undefined>(undefined);
  const lastMessageCount = useRef<number>(0);
  const isUserScrolling = useRef(false);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Build a color map for group members
  const senderColorMap = useMemo(() => {
    const map = new Map<string, string>();
    if (contactType === 'group') {
      messages.forEach((msg) => {
        if (msg.direction === 'inbound') {
          const senderPhone = msg.raw_provider_data?.senderData?.sender;
          const senderName = msg.sender_name;
          getSenderColor(senderPhone, senderName, map);
        }
      });
    }
    return map;
  }, [messages, contactType]);

  const handleCopyMessage = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("הועתק ללוח");
  };

  const handleConvertToTask = (message: Message) => {
    setSelectedMessage(message);
    setShowTaskDialog(true);
  };

  // Reset scroll flag only when contact actually changes
  useEffect(() => {
    if (lastContactId.current !== contactId) {
      hasScrolledToAnchor.current = false;
      lastMessageCount.current = 0;
      lastContactId.current = contactId;
    }
  }, [contactId]);

  // Scroll to anchor message or bottom - only on initial load or contact change
  useEffect(() => {
    if (!messages.length) return;
    
    const isContactChange = lastMessageCount.current === 0;
    const isNewMessages = messages.length > lastMessageCount.current;
    
    // Update message count
    lastMessageCount.current = messages.length;
    
    // Only scroll on contact change, not on refetch
    if (!hasScrolledToAnchor.current && isContactChange) {
      // Use a small delay to ensure DOM is ready
      requestAnimationFrame(() => {
        if (anchorMessageId) {
          const anchorElement = msgRefs.current[anchorMessageId];
          if (anchorElement) {
            anchorElement.scrollIntoView({ behavior: 'instant', block: 'center' });
          } else if (bottomRef.current) {
            bottomRef.current.scrollIntoView({ behavior: 'instant' });
          }
        } else if (bottomRef.current) {
          bottomRef.current.scrollIntoView({ behavior: 'instant' });
        }
        hasScrolledToAnchor.current = true;
      });
    } else if (isNewMessages && !isUserScrolling.current) {
      // New messages arrived via refetch - only scroll if user is near bottom
      const container = bottomRef.current?.parentElement?.parentElement;
      if (container) {
        const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 150;
        if (isNearBottom) {
          requestAnimationFrame(() => {
            bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
          });
        }
      }
    }
  }, [messages, anchorMessageId]);

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          אין הודעות עדיין
        </div>
      </div>
    );
  }
  // Detect placeholder texts like [quotedMessage], [reactionMessage], [הודעת קול]
  const isPlaceholder = (text?: string) => !!text && /^\s*\[[^\]]+\]\s*$/.test(text);

  const getQuotedMessage = (message: Message) => {
    const messageData = message.raw_provider_data?.messageData;
    const quotedMessage = messageData?.quotedMessage ||
                          messageData?.extendedTextMessageData?.quotedMessage;
    
    // If no quoted message structure, check if we have a quotedMessage type with main text
    if (!quotedMessage && messageData?.typeMessage !== 'quotedMessage') return null;

    // Get the MAIN message text (what the user typed as a reply)
    const mainMessageText = messageData?.extendedTextMessageData?.text ||
                            message.raw_provider_data?.fetchedMessageContent?.extendedTextMessage?.text;

    // Get quoted message text content (the message being replied to)
    const quotedText = quotedMessage?.textMessage || 
                       quotedMessage?.caption || 
                       quotedMessage?.extendedTextMessageData?.text ||
                       null;
    
    // Check for media in quoted message
    const hasImage = quotedMessage?.typeMessage === 'imageMessage' || quotedMessage?.downloadUrl;
    const hasVideo = quotedMessage?.typeMessage === 'videoMessage';
    const hasAudio = quotedMessage?.typeMessage === 'audioMessage';
    const hasDocument = quotedMessage?.typeMessage === 'documentMessage';

    let mediaIndicator = null;
    if (hasImage) mediaIndicator = '📷 תמונה';
    else if (hasVideo) mediaIndicator = '🎬 סרטון';
    else if (hasAudio) mediaIndicator = '🎤 הודעה קולית';
    else if (hasDocument) mediaIndicator = '📄 מסמך';

    // Format participant for display - remove @c.us and show just the number
    const participant = quotedMessage?.participant;
    const participantDisplay = participant ? participant.replace(/@c\.us$/, '').replace(/^(\d{3})(\d+)$/, '+$1 $2') : null;

    return {
      quotedElement: (
        <div className="bg-black/5 border-r-4 border-blue-500 pr-2 py-1 mb-2 text-[13px] rounded-sm">
          {participantDisplay && (
            <div className="font-semibold text-xs mb-0.5 text-blue-600">
              {participantDisplay}
            </div>
          )}
          <div className="line-clamp-2 text-gray-600">
            {quotedText || mediaIndicator || '[מדיה]'}
          </div>
        </div>
      ),
      mainMessageText,
    };
  };

  const getReactionEmoji = (message: Message) => {
    const messageData = message.raw_provider_data?.messageData;
    
    // Check if this is a reaction message
    if (messageData?.typeMessage !== 'reactionMessage') return null;
    
    // Get the emoji from extendedTextMessageData.text
    const reactionText = messageData?.extendedTextMessageData?.text;
    if (!reactionText) return null;

    // Get stanzaId to find the original message
    const quotedMessage = messageData?.quotedMessage;
    const quotedStanzaId = quotedMessage?.stanzaId;
    
    // Look for the original message in our messages array by idMessage
    const originalMessage = quotedStanzaId 
      ? messages.find(m => m.raw_provider_data?.idMessage === quotedStanzaId)
      : null;

    // Try to get text from the quotedMessage itself if we can't find the original
    const quotedText = originalMessage?.message_text || 
                       quotedMessage?.textMessage || 
                       quotedMessage?.caption || 
                       quotedMessage?.extendedTextMessageData?.text ||
                       null;
    
    // Check for media in quoted message
    const hasImage = quotedMessage?.typeMessage === 'imageMessage' || quotedMessage?.downloadUrl;
    const hasVideo = quotedMessage?.typeMessage === 'videoMessage';
    const hasAudio = quotedMessage?.typeMessage === 'audioMessage';
    const hasDocument = quotedMessage?.typeMessage === 'documentMessage';

    let mediaIndicator = null;
    if (hasImage) mediaIndicator = '📷 תמונה';
    else if (hasVideo) mediaIndicator = '🎬 סרטון';
    else if (hasAudio) mediaIndicator = '🎤 הודעה קולית';
    else if (hasDocument) mediaIndicator = '📄 מסמך';

    const displayText = quotedText || mediaIndicator;

    return (
      <div className="mb-1">
        {/* Show what message is being reacted to */}
        {displayText ? (
          <div className="bg-black/5 border-r-4 border-purple-400 pr-2 py-1 mb-2 text-[12px] rounded-sm">
            <div className="font-medium text-xs text-purple-600 mb-0.5">תגובה להודעה:</div>
            <div className="line-clamp-2 text-gray-600">{displayText}</div>
          </div>
        ) : quotedStanzaId ? (
          <div className="text-xs text-gray-400 mb-1">
            תגובה להודעה קודמת
          </div>
        ) : null}
        <div className="text-2xl">
          {reactionText}
        </div>
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
          className={`rounded-md mb-1 ${isMobile ? 'max-w-[250px]' : 'max-w-[300px]'} max-h-[400px] object-cover`}
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
          className={`rounded-md mb-1 ${isMobile ? 'max-w-[250px]' : 'max-w-[300px]'} max-h-[400px]`}
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

  // Render text with clickable links
  const renderTextWithLinks = (text: string) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);
    
    return parts.map((part, index) => {
      if (part.match(urlRegex)) {
        return (
          <a 
            key={index}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 underline hover:text-blue-800"
            onClick={(e) => e.stopPropagation()}
          >
            {part}
          </a>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  // Get sender color for group messages
  const getSenderDisplayColor = (message: Message): string => {
    if (contactType !== 'group' || message.direction !== 'inbound') {
      return '#0088CC'; // Default blue
    }
    const senderPhone = message.raw_provider_data?.senderData?.sender;
    return getSenderColor(senderPhone, message.sender_name, senderColorMap);
  };

  return (
    <div className={`flex flex-col h-full`}>
      <div className={`flex flex-col gap-2 ${isMobile ? 'p-2' : 'p-4'}`}>
        {currentPeriod !== 'all' && onLoadMore && (
          <div className="flex items-center justify-center py-2 mb-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 text-xs bg-white/80">
                  <History className="h-3.5 w-3.5" />
                  טען הודעות ישנות יותר
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center">
                {currentPeriod === 'week' && (
                  <DropdownMenuItem onClick={() => onLoadMore('month')}>
                    חודש אחרון
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => onLoadMore('all')}>
                  כל ההודעות
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
        {messages.map((message) => {
          const isOutbound = message.direction === 'outbound';
          const mediaContent = getMediaContent(message);
          const quotedMessageData = getQuotedMessage(message);
          const reactionEmoji = getReactionEmoji(message);
          const senderColor = getSenderDisplayColor(message);
          
          // For quoted messages, show the main message text (reply), not the placeholder
          const displayText = quotedMessageData?.mainMessageText || message.message_text;
          
          return (
            <div
              key={message.id}
              ref={(el) => { msgRefs.current[message.id] = el; }}
              className={`flex ${isOutbound ? 'justify-end' : 'justify-start'} group`}
            >
              <div
                className={`${isMobile ? 'max-w-[80%]' : 'max-w-[65%]'} 
                  ${isOutbound ? 'rounded-tl-lg rounded-tr-md rounded-bl-lg rounded-br-md' : 'rounded-tl-md rounded-tr-lg rounded-bl-md rounded-br-lg'}
                  px-2.5 py-1.5 shadow-sm
                  ${isOutbound ? 'bg-[#dcf8c6] text-gray-900' : 'bg-white text-gray-900'}
                  relative`}
              >
                {!isOutbound && message.sender_name && message.sender_name !== "אני" && (
                  <div 
                    className="font-semibold text-[12.8px] mb-0.5"
                    style={{ color: senderColor }}
                  >
                    {message.sender_name}
                  </div>
                )}
                {isOutbound && message.profiles?.full_name && (
                  <div className="font-semibold text-[12.8px] mb-0.5 text-green-600">
                    {message.profiles.full_name}
                  </div>
                )}
                {quotedMessageData?.quotedElement}
                {reactionEmoji}
                {mediaContent}
                {displayText && !reactionEmoji && !isPlaceholder(displayText) && (
                  <div className="whitespace-pre-wrap break-words text-[14.2px] leading-[19px]" dir="rtl">
                    {renderTextWithLinks(displayText)}
                  </div>
                )}
                <div
                  className="text-[11px] mt-0.5 flex items-center justify-end gap-1 text-gray-500">
                  <span>
                    {format(new Date(message.created_at), 'd/M HH:mm', { locale: he })}
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
                        <DropdownMenuItem onClick={() => onReplyToMessage?.(message)}>
                          <Reply className="ml-2 h-4 w-4" />
                          הגב
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
        <div ref={bottomRef} />
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
    </div>
  );
}