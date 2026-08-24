import { useMemo, useState } from "react";
import { format } from "date-fns";
import { he } from "date-fns/locale";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Calendar } from "@/components/ui/calendar";
import { Plus, Users, Megaphone, Check, Bell, CalendarDays, Flag } from "lucide-react";
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

export function QuickTaskInput({
  onAddTask,
  disabled,
  clientsList,
  campaignersList,
  defaultCampaignerId,
}: QuickTaskInputProps) {
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

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <div className="flex gap-2">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="משימה חדשה..."
          disabled={disabled}
          enterKeyHint="send"
          className="text-sm h-9 bg-background/50 border-dashed flex-1"
        />
        <Button
          type="submit"
          size="icon"
          variant="outline"
          disabled={!title.trim() || disabled || (reminderEnabled && !reminderAt)}
          className="h-9 w-9 shrink-0"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {isTyping && (clientsList || campaignersList || canSetReminder) && (
        <div className="space-y-2 rounded-md border border-dashed border-border/70 bg-muted/20 p-2">
          <div className="flex flex-wrap items-center gap-2">
            <Popover open={executionOpen} onOpenChange={setExecutionOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className={cn(
                    "h-8 gap-1 text-xs max-w-[150px]",
                    executionDate && "border-primary/40 bg-primary/5",
                  )}
                >
                  <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{executionLabel}</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-3 z-50 space-y-3" align="start">
                <p className="text-xs font-medium text-muted-foreground">
                  מתי לבצע / להציג ביומן
                </p>
                <Calendar
                  mode="single"
                  selected={executionDate}
                  onSelect={setExecutionDate}
                  initialFocus
                  className="p-0 pointer-events-auto"
                />
                <TimeSlotPicker
                  value={executionTime}
                  onChange={setExecutionTime}
                  disabled={disabled}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-full h-7 text-xs"
                  onClick={() => {
                    setExecutionDate(undefined);
                    setExecutionTime(null);
                  }}
                >
                  נקה תאריך ביצוע
                </Button>
              </PopoverContent>
            </Popover>

            <Popover open={targetOpen} onOpenChange={setTargetOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className={cn(
                    "h-8 gap-1 text-xs max-w-[130px]",
                    targetDate && "border-amber-500/40 bg-amber-500/5",
                  )}
                >
                  <Flag className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{targetLabel}</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-3 z-50 space-y-2" align="start">
                <p className="text-xs font-medium text-muted-foreground">
                  עד מתי להשלים (דדליין)
                </p>
                <Calendar
                  mode="single"
                  selected={targetDate}
                  onSelect={setTargetDate}
                  initialFocus
                  className="p-0 pointer-events-auto"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-full h-7 text-xs"
                  onClick={() => setTargetDate(undefined)}
                >
                  נקה תאריך יעד
                </Button>
              </PopoverContent>
            </Popover>

            {clientsList && (
              <Popover open={clientOpen} onOpenChange={setClientOpen}>
                <PopoverTrigger asChild>
                  <Button type="button" variant="outline" size="sm" className="h-8 gap-1 text-xs max-w-[140px]">
                    <Users className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{selectedClientName || "שייך לקוח"}</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[220px] p-0 z-50" align="start">
                  <Command>
                    <CommandInput
                      placeholder="חיפוש לקוח..."
                      className="h-8 text-xs"
                      value={clientSearch}
                      onValueChange={setClientSearch}
                    />
                    <CommandList>
                      <CommandEmpty>לא נמצא</CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          onSelect={() => {
                            setClientId(null);
                            setClientOpen(false);
                          }}
                        >
                          <Check className={cn("h-3 w-3 mr-1", !clientId ? "opacity-100" : "opacity-0")} />
                          ללא לקוח
                        </CommandItem>
                        {filteredClients.map((c) => (
                          <CommandItem
                            key={c.id}
                            onSelect={() => {
                              setClientId(c.id);
                              setClientOpen(false);
                            }}
                          >
                            <Check className={cn("h-3 w-3 mr-1", clientId === c.id ? "opacity-100" : "opacity-0")} />
                            {c.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            )}

            {campaignersList && (
              <Popover open={campaignerOpen} onOpenChange={setCampaignerOpen}>
                <PopoverTrigger asChild>
                  <Button type="button" variant="outline" size="sm" className="h-8 gap-1 text-xs max-w-[140px]">
                    <Megaphone className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{selectedCampaignerName || "שייך קמפיינר"}</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[220px] p-0 z-50" align="start">
                  <Command>
                    <CommandInput
                      placeholder="חיפוש קמפיינר..."
                      className="h-8 text-xs"
                      value={campaignerSearch}
                      onValueChange={setCampaignerSearch}
                    />
                    <CommandList>
                      <CommandEmpty>לא נמצא</CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          onSelect={() => {
                            setCampaignerId(null);
                            setCampaignerOpen(false);
                          }}
                        >
                          <Check className={cn("h-3 w-3 mr-1", !effectiveCampaignerId ? "opacity-100" : "opacity-0")} />
                          ללא קמפיינר
                        </CommandItem>
                        {filteredCampaigners.map((c) => (
                          <CommandItem
                            key={c.id}
                            onSelect={() => {
                              setCampaignerId(c.id);
                              setCampaignerOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "h-3 w-3 mr-1",
                                effectiveCampaignerId === c.id ? "opacity-100" : "opacity-0",
                              )}
                            />
                            {c.full_name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            )}
          </div>

          {canSetReminder && (
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
          )}
        </div>
      )}
    </form>
  );
}
