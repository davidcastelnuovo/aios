import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronsUpDown, ChevronLeft, Search, Building2, User } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  tenantId: string | undefined;
  value: string | null;
  onChange: (id: string) => void;
}

interface Client {
  id: string;
  name: string;
  agency_id: string | null;
}

interface Agency {
  id: string;
  name: string;
}

const ALL_AGENCY = "__all__";
const NO_AGENCY = "__none__";

export function ClientSelector({ tenantId, value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [selectedAgency, setSelectedAgency] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!tenantId) return;
    let cancel = false;
    Promise.all([
      supabase
        .from("clients")
        .select("id, name, agency_id, status")
        .eq("tenant_id", tenantId)
        .eq("status", "active")
        .order("name"),
      supabase.from("agencies").select("id, name").eq("tenant_id", tenantId).order("name"),
    ]).then(([clientsRes, agenciesRes]) => {
      if (cancel) return;
      setClients((clientsRes.data ?? []) as Client[]);
      setAgencies((agenciesRes.data ?? []) as Agency[]);
    });
    return () => {
      cancel = true;
    };
  }, [tenantId]);

  const current = clients.find((c) => c.id === value);

  const clientCountByAgency = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of clients) {
      const k = c.agency_id ?? NO_AGENCY;
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return m;
  }, [clients]);

  const visibleClients = useMemo(() => {
    let list = clients;
    if (selectedAgency === NO_AGENCY) list = list.filter((c) => !c.agency_id);
    else if (selectedAgency && selectedAgency !== ALL_AGENCY)
      list = list.filter((c) => c.agency_id === selectedAgency);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((c) => c.name.toLowerCase().includes(q));
    }
    return list;
  }, [clients, selectedAgency, search]);

  const handleOpenChange = (o: boolean) => {
    setOpen(o);
    if (o) {
      setSearch("");
      // Default to current client's agency view, or pick first
      if (selectedAgency === null) {
        if (current?.agency_id) setSelectedAgency(current.agency_id);
      }
    }
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="min-w-[220px] justify-between" dir="rtl">
          <span className="truncate">{current?.name ?? "בחר לקוח"}</span>
          <ChevronsUpDown className="h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start" dir="rtl">
        {selectedAgency === null ? (
          <div>
            <div className="border-b p-2 text-xs font-medium text-muted-foreground">בחר סוכנות</div>
            <div className="max-h-[320px] overflow-y-auto">
              <button
                className="flex w-full items-center justify-between px-3 py-2 text-sm hover:bg-muted/60"
                onClick={() => setSelectedAgency(ALL_AGENCY)}
              >
                <span className="flex items-center gap-2">
                  <Building2 className="h-4 w-4" /> כל הלקוחות
                </span>
                <span className="text-xs text-muted-foreground">{clients.length}</span>
              </button>
              {agencies.map((a) => {
                const count = clientCountByAgency.get(a.id) ?? 0;
                if (count === 0) return null;
                return (
                  <button
                    key={a.id}
                    className="flex w-full items-center justify-between px-3 py-2 text-sm hover:bg-muted/60"
                    onClick={() => setSelectedAgency(a.id)}
                  >
                    <span className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      {a.name}
                    </span>
                    <span className="text-xs text-muted-foreground">{count}</span>
                  </button>
                );
              })}
              {(clientCountByAgency.get(NO_AGENCY) ?? 0) > 0 && (
                <button
                  className="flex w-full items-center justify-between px-3 py-2 text-sm hover:bg-muted/60"
                  onClick={() => setSelectedAgency(NO_AGENCY)}
                >
                  <span className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" /> ללא סוכנות
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {clientCountByAgency.get(NO_AGENCY)}
                  </span>
                </button>
              )}
            </div>
          </div>
        ) : (
          <div>
            <div className="flex items-center gap-1 border-b p-1.5">
              <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => setSelectedAgency(null)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium truncate">
                {selectedAgency === ALL_AGENCY
                  ? "כל הלקוחות"
                  : selectedAgency === NO_AGENCY
                  ? "ללא סוכנות"
                  : agencies.find((a) => a.id === selectedAgency)?.name || ""}
              </span>
            </div>
            <div className="border-b p-2">
              <div className="relative">
                <Search className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="חפש לקוח..."
                  className="h-8 pe-7"
                  autoFocus
                />
              </div>
            </div>
            <div className="max-h-[300px] overflow-y-auto">
              {visibleClients.length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground text-center">לא נמצאו לקוחות</div>
              ) : (
                visibleClients.map((c) => (
                  <button
                    key={c.id}
                    className={cn(
                      "flex w-full items-center justify-between px-3 py-2 text-sm hover:bg-muted/60",
                      value === c.id && "bg-muted"
                    )}
                    onClick={() => {
                      onChange(c.id);
                      setOpen(false);
                    }}
                  >
                    <span className="truncate">{c.name}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
