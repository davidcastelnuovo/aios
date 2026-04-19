import { useState, useMemo } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

interface Group {
  id: string;
  group_name: string;
}

interface WhatsAppGroupSelectProps {
  groups: Group[] | undefined;
  value: string;
  onValueChange: (value: string) => void;
  triggerClassName?: string;
  placeholder?: string;
  noneLabel?: string;
}

export function WhatsAppGroupSelect({
  groups,
  value,
  onValueChange,
  triggerClassName,
  placeholder = "בחר קבוצה...",
  noneLabel = "מספר טלפון ישיר",
}: WhatsAppGroupSelectProps) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return groups || [];
    return (groups || []).filter((g) =>
      g.group_name?.toLowerCase().includes(q)
    );
  }, [groups, search]);

  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className={triggerClassName}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <div
          className="sticky top-0 z-10 bg-popover p-2 border-b"
          onPointerDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <div className="relative">
            <Search className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="חפש קבוצה..."
              className="h-8 text-xs pr-7"
            />
          </div>
        </div>
        <SelectItem value="__none__">{noneLabel}</SelectItem>
        {filtered.length === 0 ? (
          <div className="px-2 py-4 text-center text-xs text-muted-foreground">
            לא נמצאו קבוצות
          </div>
        ) : (
          filtered.map((g) => (
            <SelectItem key={g.id} value={g.id}>
              {g.group_name}
            </SelectItem>
          ))
        )}
      </SelectContent>
    </Select>
  );
}
