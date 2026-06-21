import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Command, CommandInput, CommandItem, CommandList, CommandEmpty } from "@/components/ui/command";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  tenantId: string | undefined;
  value: string | null;
  onChange: (id: string) => void;
}

export function ClientSelector({ tenantId, value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    if (!tenantId) return;
    let cancel = false;
    supabase
      .from("clients")
      .select("id, name")
      .eq("tenant_id", tenantId)
      .order("name")
      .then(({ data }) => {
        if (!cancel && data) setClients(data);
      });
    return () => {
      cancel = true;
    };
  }, [tenantId]);

  const current = clients.find((c) => c.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="min-w-[200px] justify-between">
          {current?.name ?? "בחר לקוח"}
          <ChevronsUpDown className="h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[260px] p-0" align="start">
        <Command>
          <CommandInput placeholder="חפש לקוח..." />
          <CommandList>
            <CommandEmpty>לא נמצאו לקוחות</CommandEmpty>
            {clients.map((c) => (
              <CommandItem
                key={c.id}
                value={c.name}
                onSelect={() => {
                  onChange(c.id);
                  setOpen(false);
                }}
              >
                <Check className={cn("ml-2 h-4 w-4", value === c.id ? "opacity-100" : "opacity-0")} />
                {c.name}
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
