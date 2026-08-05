import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Plus, Users, Megaphone, Check, Bell } from "lucide-react";
import { cn } from "@/lib/utils";

export interface QuickTaskPayload {
  title: string;
  clientId?: string | null;
  campaignerId?: string | null;
  selfReminderAt?: string | null;
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

  const resetForm = () => {
    setTitle("");
    setClientId(null);
    setCampaignerId(defaultCampaignerId ?? null);
    setReminderEnabled(false);
    setReminderAt("");
    setClientSearch("");
    setCampaignerSearch("");
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
