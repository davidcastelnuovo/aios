import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Wrench } from "lucide-react";
import { spriteForMessage } from "@/lib/agentSeats";

interface ChatMessageRowProps {
  role: "user" | "assistant" | "tool_call";
  content?: string;
  speaker?: string | null;
  channel?: string | null;
  tool?: string;
}

export function ChatMessageRow({ role, content, speaker, channel, tool }: ChatMessageRowProps) {
  if (role === "tool_call") {
    return (
      <p className="flex items-center justify-center gap-1.5 py-1 text-xs text-[var(--cc-text-dim)]">
        <Wrench className="h-3 w-3 shrink-0" />
        {tool}
      </p>
    );
  }

  const isUser = role === "user";
  const sprite = spriteForMessage({ role, speaker, channel });

  return (
    <div className={`cc-msg-row${isUser ? " is-user" : " is-agent"}`}>
      {!isUser && (
        <span
          className="cc-msg-avatar"
          style={{ backgroundImage: `url(${sprite})` }}
          aria-hidden
        />
      )}
      <div className={`cc-msg-bubble${isUser ? " is-user" : ""}`}>
        <div className="cc-md prose prose-invert prose-sm max-w-none [&_p]:my-1">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{content ?? ""}</ReactMarkdown>
        </div>
      </div>
      {isUser && (
        <span className="cc-msg-avatar is-user" aria-hidden>
          אתה
        </span>
      )}
    </div>
  );
}
