import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ChatConnection } from "@/hooks/useChatConnections";

export type ChatFilter =
  | { kind: "all" }
  | { kind: "platform"; platform: "whatsapp" | "telegram" | "manychat" | "agents" }
  | { kind: "connection"; integrationId: string };

interface Props {
  value: ChatFilter;
  onChange: (v: ChatFilter) => void;
  connections: ChatConnection[];
  triggerClassName?: string;
}

const VALUE_ALL = "all";
const VALUE_AGENTS = "platform:agents";
const VALUE_WA = "platform:whatsapp";
const VALUE_TG = "platform:telegram";
const VALUE_MC = "platform:manychat";

function encode(v: ChatFilter): string {
  if (v.kind === "all") return VALUE_ALL;
  if (v.kind === "platform") return `platform:${v.platform}`;
  return `conn:${v.integrationId}`;
}

function decode(s: string): ChatFilter {
  if (s === VALUE_ALL) return { kind: "all" };
  if (s.startsWith("platform:")) {
    return { kind: "platform", platform: s.slice("platform:".length) as any };
  }
  if (s.startsWith("conn:")) {
    return { kind: "connection", integrationId: s.slice("conn:".length) };
  }
  return { kind: "all" };
}

export function ChatConnectionSelector({ value, onChange, connections, triggerClassName }: Props) {
  const wa = connections.filter((c) => c.platform === "whatsapp");
  const tg = connections.filter((c) => c.platform === "telegram");
  const mc = connections.filter((c) => c.platform === "manychat");

  return (
    <Select value={encode(value)} onValueChange={(v) => onChange(decode(v))}>
      <SelectTrigger className={triggerClassName ?? "h-8 w-auto gap-1 border-none shadow-none text-lg font-semibold px-1 hover:bg-accent"}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="bg-background z-50 max-h-[70vh]">
        <SelectItem value={VALUE_ALL}>צ'אט</SelectItem>
        <SelectSeparator />

        <SelectGroup>
          <SelectLabel>וואטסאפ</SelectLabel>
          <SelectItem value={VALUE_WA}>כל הוואטסאפ</SelectItem>
          {wa.map((c) => (
            <SelectItem key={c.id} value={`conn:${c.id}`} className="pr-6">
              <span className="flex items-center gap-2">
                <span>{c.display_name}</span>
                {!c.is_own && c.shared_by_name && (
                  <span className="text-xs text-muted-foreground">({c.shared_by_name})</span>
                )}
              </span>
            </SelectItem>
          ))}
        </SelectGroup>

        <SelectSeparator />
        <SelectGroup>
          <SelectLabel>טלגרם</SelectLabel>
          <SelectItem value={VALUE_TG}>כל הטלגרם</SelectItem>
          {tg.map((c) => (
            <SelectItem key={c.id} value={`conn:${c.id}`} className="pr-6">
              <span className="flex items-center gap-2">
                <span>{c.display_name}</span>
                {!c.is_own && c.shared_by_name && (
                  <span className="text-xs text-muted-foreground">({c.shared_by_name})</span>
                )}
              </span>
            </SelectItem>
          ))}
        </SelectGroup>

        <SelectSeparator />
        <SelectGroup>
          <SelectLabel>ManyChat</SelectLabel>
          <SelectItem value={VALUE_MC}>כל ה-ManyChat</SelectItem>
          {mc.map((c) => (
            <SelectItem key={c.id} value={`conn:${c.id}`} className="pr-6">
              <span className="flex items-center gap-2">
                <span>{c.display_name}</span>
                {!c.is_own && c.shared_by_name && (
                  <span className="text-xs text-muted-foreground">({c.shared_by_name})</span>
                )}
              </span>
            </SelectItem>
          ))}
        </SelectGroup>

        <SelectSeparator />
        <SelectItem value={VALUE_AGENTS}>סוכני AI 🤖</SelectItem>
      </SelectContent>
    </Select>
  );
}
