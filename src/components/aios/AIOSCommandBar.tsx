import { useState, useRef } from "react";
import { Send, Loader2, Brain } from "lucide-react";
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

  const showThinking = isLoading && !statusText;

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

      {/* Thinking animation */}
      {showThinking && (
        <div className="max-w-3xl mx-auto flex items-center gap-3 py-2 animate-fade-in">
          <div className="relative flex items-center justify-center">
            <div className="absolute h-8 w-8 rounded-full bg-primary/20 animate-ping" />
            <div className="relative h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
              <Brain className="h-4 w-4 text-primary animate-pulse" />
            </div>
          </div>
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <span>המערכת חושבת</span>
            <span className="inline-flex gap-0.5">
              <span className="animate-bounce [animation-delay:0ms]">.</span>
              <span className="animate-bounce [animation-delay:150ms]">.</span>
              <span className="animate-bounce [animation-delay:300ms]">.</span>
            </span>
          </div>
        </div>
      )}

      {/* Status text - shows AI text response inline */}
      {statusText && (
        <div className="max-w-3xl mx-auto text-sm text-muted-foreground animate-fade-in">
          <div className="prose prose-sm dark:prose-invert max-w-none" dir="rtl">
            <ReactMarkdown>{statusText}</ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
}
