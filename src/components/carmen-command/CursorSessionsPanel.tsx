import { ExternalLink } from "lucide-react";
import { HudPanel } from "./panels";
import { useActiveCursorSessions } from "@/lib/cursorTaskSessions";

export function CursorSessionsPanel({
  tenantId,
  className,
}: {
  tenantId: string | null;
  className?: string;
}) {
  const { data = [], isLoading, isError } = useActiveCursorSessions(tenantId);

  return (
    <HudPanel
      title="סשני Cursor פעילים"
      icon={<ExternalLink className="h-4 w-4 text-[var(--cc-accent)]" />}
      className={className ?? ""}
    >
      {isLoading && <p className="text-sm text-[var(--cc-text-dim)]">טוענת סשנים…</p>}
      {isError && <p className="text-sm text-[var(--cc-warn)]">לא הצלחתי לטעון סשנים</p>}
      {!isLoading && !isError && data.length === 0 && (
        <p className="text-sm text-[var(--cc-text-dim)]">אין סשני Cursor פעילים כרגע.</p>
      )}
      <ul className="space-y-2">
        {data.map((row) => (
          <li key={row.id} className="rounded-md border border-[var(--cc-line)] p-2 text-xs">
            <p className="font-medium text-[var(--cc-text)]">{row.task_title || row.display_name}</p>
            <p className="text-[var(--cc-text-dim)]">
              {row.status} · {row.app_env || "env?"} · {row.source_tool}
            </p>
            <p className="cc-num text-[10px] text-[var(--cc-text-dim)]">{row.cursor_agent_id}</p>
            {row.session_url && (
              <a
                href={row.session_url}
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-flex items-center gap-1 text-[var(--cc-accent)] hover:underline"
              >
                פתח ב-Cursor
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </li>
        ))}
      </ul>
    </HudPanel>
  );
}
