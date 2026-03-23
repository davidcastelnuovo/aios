import { useState, useRef } from "react";
import { Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ReactMarkdown from "react-markdown";

interface AIOSCommandBarProps {
  onSend: (message: string) => void;
  isLoading: boolean;
  statusText: string;
}

export function AIOSCommandBar({ onSend, isLoading, statusText }: AIOSCommandBarProps) {
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;
    onSend(trimmed);
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="border-b bg-card px-4 py-3 space-y-2">
      <div className="flex items-center gap-2 max-w-3xl mx-auto">
        <Input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="מה תרצה לראות? למשל: ״הראה לי את המשימות שלי״"
          disabled={isLoading}
          className="text-sm h-10 bg-background border-border flex-1"
        />
        <Button
          size="icon"
          onClick={handleSubmit}
          disabled={!input.trim() || isLoading}
          className="h-10 w-10 shrink-0"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Status text - shows AI text response inline */}
      {statusText && (
        <div className="max-w-3xl mx-auto text-sm text-muted-foreground">
          <div className="prose prose-sm dark:prose-invert max-w-none" dir="rtl">
            <ReactMarkdown>{statusText}</ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
}
