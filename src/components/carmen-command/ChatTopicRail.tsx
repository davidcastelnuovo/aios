import { Plus } from "lucide-react";
import { topicIsLive, topicModeLabel, topicTitle, type TopicChat } from "@/lib/chatTopics";

interface ChatTopicRailProps {
  items: TopicChat[];
  activeId: string | null;
  onSelect: (chat: TopicChat) => void;
  onNew: () => void;
  className?: string;
}

export function ChatTopicRail({ items, activeId, onSelect, onNew, className = "" }: ChatTopicRailProps) {
  return (
    <aside className={`cc-chat-rail ${className}`.trim()}>
      <div className="mb-2 flex shrink-0 items-center justify-between gap-2 px-1">
        <span className="cc-panel-title">צ׳אטים</span>
        <button type="button" onClick={onNew} className="flex items-center gap-1 text-[11px] text-[var(--cc-accent)] hover:underline">
          <Plus className="h-3.5 w-3.5" />
          חדש
        </button>
      </div>
      <div className="cc-scroll cc-chat-rail-list">
        {!items.length && <p className="px-1 py-2 text-xs text-[var(--cc-text-dim)]">אין שיחות עדיין</p>}
        {items.map((conv) => {
          const live = topicIsLive(conv.status);
          const mode = topicModeLabel(conv.routing_mode);
          return (
            <button
              key={conv.id}
              type="button"
              onClick={() => onSelect(conv)}
              className={`cc-chat-topic ${activeId === conv.id ? "is-active" : ""} ${live ? "is-live" : ""}`}
            >
              <span className={`cc-chat-topic-dot ${live ? "is-live" : ""}`} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-right text-[13px]">{topicTitle(conv.title)}</span>
                <span className="mt-0.5 flex items-center justify-end gap-2 text-[10px] text-[var(--cc-text-dim)]">
                  {mode && <span>{mode}</span>}
                  <span className="cc-num">
                    {new Date(conv.updated_at).toLocaleDateString("he-IL", { day: "numeric", month: "numeric" })}
                  </span>
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
