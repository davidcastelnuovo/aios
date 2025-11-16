import { useState, KeyboardEvent } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Send } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

interface ChatInputProps {
  onSend: (message: string) => void;
  isLoading: boolean;
}

export default function ChatInput({ onSend, isLoading }: ChatInputProps) {
  const [message, setMessage] = useState("");
  const isMobile = useIsMobile();

  const handleSend = () => {
    if (!message.trim() || isLoading) return;
    onSend(message);
    setMessage("");
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className={`${isMobile ? 'p-2' : 'p-4'} flex gap-2 items-end`}>
      <Textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="הקלד הודעה... (Enter לשליחה)"
        className="resize-none flex-1"
        rows={isMobile ? 1 : 2}
        disabled={isLoading}
      />
      <Button
        onClick={handleSend}
        disabled={!message.trim() || isLoading}
        size="icon"
        className="shrink-0 h-10 w-10"
      >
        <Send className="h-4 w-4" />
      </Button>
    </div>
  );
}
