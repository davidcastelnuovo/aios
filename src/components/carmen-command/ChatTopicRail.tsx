import { Plus } from "lucide-react";
import type { BrainRoute } from "@/lib/agentChannelRouting";
import { topicAgentLabel, topicAgentSprite } from "@/lib/agentSeats";
import { topicIsLive, topicTitle, type TopicChat } from "@/lib/chatTopics";

interface ChatTopicRailProps {
  items: TopicChat[];
  routes: BrainRoute[];
  activeId: string | null;
  onSelect: (chat: TopicChat) => void;
  onNew: () => void;
  className?: string;
}

export function ChatTopicRail({ items, routes, activeId, onSelect, onNew, className = "" }: ChatTopicRailProps) {
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
          const agentLabel = topicAgentLabel(conv, routes);
          return (
            <button
              key={conv.id}
              type="button"
              onClick={() => onSelect(conv)}
              title={agentLabel}
              className={`cc-chat-topic ${activeId === conv.id ? "is-active" : ""} ${live ? "is-live" : ""}`}
            >
              <span className="cc-chat-topic-agent-wrap">
                <img
                  src={topicAgentSprite(conv, routes)}
                  alt=""
                  aria-hidden
                  className="cc-chat-topic-agent"
                />
                {live && <span className="cc-chat-topic-dot is-live" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-right text-[13px]">{topicTitle(conv.title)}</span>
                <span className="mt-0.5 flex items-center justify-end gap-2 text-[10px] text-[var(--cc-text-dim)]">
                  <span className="truncate">{agentLabel}</span>
                  <span className="cc-num shrink-0">
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
