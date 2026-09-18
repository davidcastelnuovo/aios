import { useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { he } from "date-fns/locale";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Calendar } from "@/components/ui/calendar";
import {
  Plus,
  Users,
  Megaphone,
  Check,
  Bell,
  CalendarDays,
  Flag,
  Link2,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { TimeSlotPicker } from "./TimeSlotPicker";

export interface QuickTaskPayload {
  title: string;
  clientId?: string | null;
  campaignerId?: string | null;
  selfReminderAt?: string | null;
  /** When to perform / show on calendar (תאריך ביצוע) */
  executionDate?: string | null;
  executionTime?: string | null;
  /** Deadline to complete by (תאריך יעד) */
  targetDate?: string | null;
}

interface QuickTaskInputProps {
  onAddTask: (payload: QuickTaskPayload) => void;
  disabled?: boolean;
  clientsList?: { id: string; name: string }[];
  campaignersList?: { id: string; full_name: string }[];
  defaultCampaignerId?: string | null;
}

const COMPACT_WIDTH = 420;

type LinksPanel = "menu" | "client" | "campaigner" | "execution" | "target";

export function QuickTaskInput({
  onAddTask,
  disabled,
  clientsList,
  campaignersList,
  defaultCampaignerId,
}: QuickTaskInputProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [compact, setCompact] = useState(true);
  const [title, setTitle] = useState("");
  const [clientId, setClientId] = useState<string | null>(null);
  const [campaignerId, setCampaignerId] = useState<string | null>(defaultCampaignerId ?? null);
  const [clientOpen, setClientOpen] = useState(false);
  const [campaignerOpen, setCampaignerOpen] = useState(false);
  const [clientSearch, setClientSearch] = useState("");
  const [campaignerSearch, setCampaignerSearch] = useState("");
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderAt, setReminderAt] = useState("");
  const [executionDate, setExecutionDate] = useState<Date | undefined>(undefined);
  const [executionTime, setExecutionTime] = useState<string | null>(null);
  const [targetDate, setTargetDate] = useState<Date | undefined>(undefined);
  const [executionOpen, setExecutionOpen] = useState(false);
  const [targetOpen, setTargetOpen] = useState(false);
  const [linksOpen, setLinksOpen] = useState(false);
  const [linksPanel, setLinksPanel] = useState<LinksPanel>("menu");

  useEffect(() => {
    const el = formRef.current;
    if (!el) return;
    const update = () => setCompact(el.clientWidth < COMPACT_WIDTH);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const isTyping = title.trim().length > 0;
  const effectiveCampaignerId = campaignerId ?? defaultCampaignerId ?? null;
  const canSetReminder = Boolean(
    defaultCampaignerId && effectiveCampaignerId === defaultCampaignerId
  );

  const filteredClients = useMemo(() => {
    if (!clientsList) return [];
    if (!clientSearch.trim()) return clientsList;
    const q = clientSearch.toLowerCase();
    return clientsList.filter((c) => c.name.toLowerCase().includes(q));
  }, [clientsList, clientSearch]);

  const filteredCampaigners = useMemo(() => {
    if (!campaignersList) return [];
    if (!campaignerSearch.trim()) return campaignersList;
    const q = campaignerSearch.toLowerCase();
    return campaignersList.filter((c) => c.full_name.toLowerCase().includes(q));
  }, [campaignersList, campaignerSearch]);

  const selectedClientName = clientsList?.find((c) => c.id === clientId)?.name;
  const selectedCampaignerName = campaignersList?.find((c) => c.id === effectiveCampaignerId)?.full_name;

  const executionLabel = executionDate
    ? format(executionDate, "dd/MM", { locale: he }) +
      (executionTime ? ` ${executionTime}` : "")
    : "תאריך ביצוע";

  const targetLabel = targetDate
    ? format(targetDate, "dd/MM", { locale: he })
    : "תאריך יעד";

  const assignmentCount = [
    clientId,
    executionDate,
    targetDate,
    reminderEnabled,
    campaignerId && campaignerId !== defaultCampaignerId,
  ].filter(Boolean).length;

  const resetForm = () => {
    setTitle("");
    setClientId(null);
    setCampaignerId(defaultCampaignerId ?? null);
    setReminderEnabled(false);
    setReminderAt("");
    setClientSearch("");
    setCampaignerSearch("");
    setExecutionDate(undefined);
    setExecutionTime(null);
    setTargetDate(undefined);
    setLinksOpen(false);
    setLinksPanel("menu");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;

    if (reminderEnabled && !reminderAt) return;

    onAddTask({
      title: trimmed,
      clientId,
      campaignerId: effectiveCampaignerId,
      selfReminderAt:
        canSetReminder && reminderEnabled && reminderAt
          ? new Date(reminderAt).toISOString()
          : null,
      executionDate: executionDate ? format(executionDate, "yyyy-MM-dd") : null,
      executionTime: executionTime ?? null,
      targetDate: targetDate ? format(targetDate, "yyyy-MM-dd") : null,
    });
    resetForm();
  };

  const chipClass = (active?: boolean) =>
    cn("h-8 gap-1 text-xs min-w-0", active && "border-primary/40 bg-primary/5");

  const clientPicker = clientsList ? (
    <Popover open={clientOpen} onOpenChange={setClientOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm" className={cn(chipClass(Boolean(clientId)), "max-w-[140px]")}>
          <Users className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{selectedClientName || "שייך לקוח"}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[220px] p-0 z-50" align="start">
        <ClientCommand
          search={clientSearch}
          onSearch={setClientSearch}
          selectedId={clientId}
          items={filteredClients}
          onSelect={(id) => {
            setClientId(id);
            setClientOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  ) : null;

  const campaignerPicker = campaignersList ? (
    <Popover open={campaignerOpen} onOpenChange={setCampaignerOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm" className={cn(chipClass(Boolean(effectiveCampaignerId)), "max-w-[140px]")}>
          <Megaphone className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{selectedCampaignerName || "שייך קמפיינר"}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[220px] p-0 z-50" align="start">
        <CampaignerCommand
          search={campaignerSearch}
          onSearch={setCampaignerSearch}
          selectedId={effectiveCampaignerId}
          items={filteredCampaigners}
          onSelect={(id) => {
            setCampaignerId(id);
            setCampaignerOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  ) : null;

  const executionPicker = (
    <Popover open={executionOpen} onOpenChange={setExecutionOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn(chipClass(Boolean(executionDate)), "max-w-[150px]", executionDate && "border-primary/40 bg-primary/5")}
        >
          <CalendarDays className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{executionLabel}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3 z-50 space-y-3" align="start">
        <ExecutionCalendar
          date={executionDate}
          time={executionTime}
          disabled={disabled}
          onDate={setExecutionDate}
          onTime={setExecutionTime}
        />
      </PopoverContent>
    </Popover>
  );

  const targetPicker = (
    <Popover open={targetOpen} onOpenChange={setTargetOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn("h-8 gap-1 text-xs min-w-0 max-w-[130px]", targetDate && "border-amber-500/40 bg-amber-500/5")}
        >
          <Flag className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{targetLabel}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3 z-50 space-y-2" align="start">
        <TargetCalendar date={targetDate} onDate={setTargetDate} />
      </PopoverContent>
    </Popover>
  );

  const reminderBlock = canSetReminder ? (
    <div className="space-y-2">
      <label className="flex cursor-pointer items-center gap-2 text-xs font-medium">
        <input
          type="checkbox"
          checked={reminderEnabled}
          onChange={(e) => {
            setReminderEnabled(e.target.checked);
            if (!e.target.checked) setReminderAt("");
          }}
          className="h-3.5 w-3.5 rounded border-input"
        />
        <Bell className="h-3.5 w-3.5 text-muted-foreground" />
        הזכר לי על המשימה
      </label>
      {reminderEnabled && (
        <Input
          type="datetime-local"
          value={reminderAt}
          onChange={(e) => setReminderAt(e.target.value)}
          className="h-8 text-xs"
          disabled={disabled}
        />
      )}
    </div>
  ) : null;

  const showExtras = isTyping && (clientsList || campaignersList || canSetReminder);

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-1.5 min-w-0 overflow-hidden">
      <div className="flex gap-1.5 min-w-0">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="משימה חדשה..."
          disabled={disabled}
          enterKeyHint="send"
          className="text-sm h-8 bg-background border-dashed flex-1 min-w-0"
        />
        <Button
          type="submit"
          size="icon"
          disabled={!title.trim() || disabled || (reminderEnabled && !reminderAt)}
          className="h-8 w-8 shrink-0 bg-emerald-600 text-white hover:bg-emerald-500 hover:text-white shadow-sm shadow-emerald-600/30 disabled:bg-emerald-600/45 disabled:text-white/90 disabled:opacity-100"
          aria-label="הוסף משימה"
        >
          <Plus className="h-4 w-4" strokeWidth={2.5} />
        </Button>
      </div>

      {showExtras && compact && (
        <Popover
          open={linksOpen}
          onOpenChange={(open) => {
            setLinksOpen(open);
            if (!open) setLinksPanel("menu");
          }}
        >
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={cn(
                "h-8 w-full justify-between gap-1.5 text-xs min-w-0",
                assignmentCount > 0 && "border-primary/40 bg-primary/5",
              )}
            >
              <span className="inline-flex items-center gap-1.5 min-w-0">
                <Link2 className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">שייוך</span>
                {assignmentCount > 0 && (
                  <span className="rounded-full bg-primary/15 px-1.5 text-[10px] font-bold leading-4">
                    {assignmentCount}
                  </span>
                )}
              </span>
              <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="w-[min(280px,calc(100vw-1.5rem))] p-2 z-50"
            align="start"
            collisionPadding={12}
          >
            {linksPanel === "menu" && (
              <div className="space-y-1">
                {clientsList && (
                  <MenuRow
                    icon={Users}
                    label="לקוח"
                    value={selectedClientName || "לא משויך"}
                    onClick={() => setLinksPanel("client")}
                  />
                )}
                {campaignersList && (
                  <MenuRow
                    icon={Megaphone}
                    label="קמפיינר"
                    value={selectedCampaignerName || "לא משויך"}
                    onClick={() => setLinksPanel("campaigner")}
                  />
                )}
                <MenuRow
                  icon={CalendarDays}
                  label="ביצוע"
                  value={executionDate ? executionLabel : "ללא"}
                  onClick={() => setLinksPanel("execution")}
                />
                <MenuRow
                  icon={Flag}
                  label="יעד"
                  value={targetDate ? targetLabel : "ללא"}
                  onClick={() => setLinksPanel("target")}
                />
                {reminderBlock && <div className="pt-1.5 px-1">{reminderBlock}</div>}
              </div>
            )}
            {linksPanel === "client" && clientsList && (
              <div className="space-y-2">
                <BackRow label="לקוח" onBack={() => setLinksPanel("menu")} />
                <ClientCommand
                  search={clientSearch}
                  onSearch={setClientSearch}
                  selectedId={clientId}
                  items={filteredClients}
                  onSelect={(id) => {
                    setClientId(id);
                    setLinksPanel("menu");
                  }}
                />
              </div>
            )}
            {linksPanel === "campaigner" && campaignersList && (
              <div className="space-y-2">
                <BackRow label="קמפיינר" onBack={() => setLinksPanel("menu")} />
                <CampaignerCommand
                  search={campaignerSearch}
                  onSearch={setCampaignerSearch}
                  selectedId={effectiveCampaignerId}
                  items={filteredCampaigners}
                  onSelect={(id) => {
                    setCampaignerId(id);
                    setLinksPanel("menu");
                  }}
                />
              </div>
            )}
            {linksPanel === "execution" && (
              <div className="space-y-2">
                <BackRow label="תאריך ביצוע" onBack={() => setLinksPanel("menu")} />
                <ExecutionCalendar
                  date={executionDate}
                  time={executionTime}
                  disabled={disabled}
                  onDate={setExecutionDate}
                  onTime={setExecutionTime}
                />
              </div>
            )}
            {linksPanel === "target" && (
              <div className="space-y-2">
                <BackRow label="תאריך יעד" onBack={() => setLinksPanel("menu")} />
                <TargetCalendar date={targetDate} onDate={setTargetDate} />
              </div>
            )}
          </PopoverContent>
        </Popover>
      )}

      {showExtras && !compact && (
        <div className="space-y-2 rounded-md border border-dashed border-border/70 bg-muted/20 p-2 min-w-0 overflow-hidden">
          <div className="flex flex-wrap items-center gap-1.5 min-w-0">
            {executionPicker}
            {targetPicker}
            {clientPicker}
            {campaignerPicker}
          </div>
          {reminderBlock}
        </div>
      )}
    </form>
  );
}

function MenuRow({
  icon: Icon,
  label,
  value,
  onClick,
}: {
  icon: typeof Users;
  label: string;
  value: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-right text-xs hover:bg-muted"
    >
      <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <span className="font-medium shrink-0">{label}</span>
      <span className="truncate flex-1 text-muted-foreground">{value}</span>
      <ChevronRight className="h-3.5 w-3.5 shrink-0 rotate-180 text-muted-foreground" />
    </button>
  );
}

function BackRow({ label, onBack }: { label: string; onBack: () => void }) {
  return (
    <button
      type="button"
      onClick={onBack}
      className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
    >
      <ChevronRight className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

function ClientCommand({
  search,
  onSearch,
  selectedId,
  items,
  onSelect,
}: {
  search: string;
  onSearch: (value: string) => void;
  selectedId: string | null;
  items: { id: string; name: string }[];
  onSelect: (id: string | null) => void;
}) {
  return (
    <Command>
      <CommandInput
        placeholder="חיפוש לקוח..."
        className="h-8 text-xs"
        value={search}
        onValueChange={onSearch}
      />
      <CommandList>
        <CommandEmpty>לא נמצא</CommandEmpty>
        <CommandGroup>
          <CommandItem onSelect={() => onSelect(null)}>
            <Check className={cn("h-3 w-3 mr-1", !selectedId ? "opacity-100" : "opacity-0")} />
            ללא לקוח
          </CommandItem>
          {items.map((c) => (
            <CommandItem key={c.id} onSelect={() => onSelect(c.id)}>
              <Check className={cn("h-3 w-3 mr-1", selectedId === c.id ? "opacity-100" : "opacity-0")} />
              {c.name}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </Command>
  );
}

function CampaignerCommand({
  search,
  onSearch,
  selectedId,
  items,
  onSelect,
}: {
  search: string;
  onSearch: (value: string) => void;
  selectedId: string | null;
  items: { id: string; full_name: string }[];
  onSelect: (id: string | null) => void;
}) {
  return (
    <Command>
      <CommandInput
        placeholder="חיפוש קמפיינר..."
        className="h-8 text-xs"
        value={search}
        onValueChange={onSearch}
      />
      <CommandList>
        <CommandEmpty>לא נמצא</CommandEmpty>
        <CommandGroup>
          <CommandItem onSelect={() => onSelect(null)}>
            <Check className={cn("h-3 w-3 mr-1", !selectedId ? "opacity-100" : "opacity-0")} />
            ללא קמפיינר
          </CommandItem>
          {items.map((c) => (
            <CommandItem key={c.id} onSelect={() => onSelect(c.id)}>
              <Check
                className={cn("h-3 w-3 mr-1", selectedId === c.id ? "opacity-100" : "opacity-0")}
              />
              {c.full_name}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </Command>
  );
}

function ExecutionCalendar({
  date,
  time,
  disabled,
  onDate,
  onTime,
}: {
  date?: Date;
  time: string | null;
  disabled?: boolean;
  onDate: (date: Date | undefined) => void;
  onTime: (time: string | null) => void;
}) {
  return (
    <>
      <p className="text-xs font-medium text-muted-foreground">מתי לבצע / להציג ביומן</p>
      <Calendar
        mode="single"
        selected={date}
        onSelect={onDate}
        initialFocus
        className="p-0 pointer-events-auto"
      />
      <TimeSlotPicker value={time} onChange={onTime} disabled={disabled} />
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="w-full h-7 text-xs"
        onClick={() => {
          onDate(undefined);
          onTime(null);
        }}
      >
        נקה תאריך ביצוע
      </Button>
    </>
  );
}

function TargetCalendar({
  date,
  onDate,
}: {
  date?: Date;
  onDate: (date: Date | undefined) => void;
}) {
  return (
    <>
      <p className="text-xs font-medium text-muted-foreground">עד מתי להשלים (דדליין)</p>
      <Calendar
        mode="single"
        selected={date}
        onSelect={onDate}
        initialFocus
        className="p-0 pointer-events-auto"
      />
      <Button type="button" variant="ghost" size="sm" className="w-full h-7 text-xs" onClick={() => onDate(undefined)}>
        נקה תאריך יעד
      </Button>
    </>
  );
}
