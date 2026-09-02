import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { File as FileIcon, Image as ImageIcon, Wrench } from "lucide-react";
import { spriteForMessage } from "@/lib/agentSeats";
import type { CommandCenterAttachment } from "@/lib/commandCenterAttachments";

interface ChatMessageRowProps {
  role: "user" | "assistant" | "tool_call";
  content?: string;
  attachments?: CommandCenterAttachment[];
  speaker?: string | null;
  channel?: string | null;
  tool?: string;
}

function AttachmentStrip({ attachments }: { attachments: CommandCenterAttachment[] }) {
  if (!attachments.length) return null;
  return (
    <div className="mt-2 flex flex-col gap-2">
      {attachments.filter((a) => a.type === "image").length > 0 && (
        <div className={`grid gap-2 ${attachments.filter((a) => a.type === "image").length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
          {attachments.filter((a) => a.type === "image").map((att, idx) => (
            <a key={`${att.url}-${idx}`} href={att.url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-md border border-[var(--cc-line)]">
              <img src={att.url} alt={att.name} className="max-h-48 w-full object-cover" loading="lazy" />
            </a>
          ))}
        </div>
      )}
      {attachments.filter((a) => a.type !== "image").map((att, idx) => (
        <a
          key={`${att.url}-file-${idx}`}
          href={att.url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-md border border-[var(--cc-line)] bg-[rgba(5,10,22,0.35)] px-2 py-1 text-xs text-[var(--cc-accent)] hover:underline"
        >
          <FileIcon className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{att.name}</span>
        </a>
      ))}
    </div>
  );
}

export function ChatMessageRow({ role, content, attachments, speaker, channel, tool }: ChatMessageRowProps) {
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
  const hasAttachments = !!attachments?.length;

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
        {(content || !hasAttachments) && (
          <div className="cc-md prose prose-invert prose-sm max-w-none [&_p]:my-1">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content ?? ""}</ReactMarkdown>
          </div>
        )}
        {hasAttachments && <AttachmentStrip attachments={attachments!} />}
        {hasAttachments && !content && (
          <p className="mt-1 flex items-center gap-1 text-xs text-[var(--cc-text-dim)]">
            <ImageIcon className="h-3 w-3" />
            {attachments!.length} קבצים
          </p>
        )}
      </div>
      {isUser && (
        <span className="cc-msg-avatar is-user" aria-hidden>
          אתה
        </span>
      )}
    </div>
  );
}
