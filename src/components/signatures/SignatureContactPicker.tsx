import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, UserSearch } from "lucide-react";
import { splitContactName, type SignatureContactDetails } from "./signatureContactUtils";

type EntityType = "lead" | "client";

interface ContactOption extends SignatureContactDetails {
  key: string;
}

interface SignatureContactPickerProps {
  tenantId: string | undefined;
  onSelect: (contact: SignatureContactDetails) => void;
}

export default function SignatureContactPicker({ tenantId, onSelect }: SignatureContactPickerProps) {
  const [open, setOpen] = useState(false);
  const [entity, setEntity] = useState<EntityType>("lead");
  const [search, setSearch] = useState("");

  const { data: options = [], isLoading } = useQuery({
    queryKey: ["signature-contact-options", tenantId, entity],
    queryFn: async (): Promise<ContactOption[]> => {
      if (!tenantId) return [];

      if (entity === "lead") {
        const { data, error } = await supabase
          .from("leads")
          .select("id, contact_name, company_name, email, phone")
          .eq("tenant_id", tenantId)
          .is("archived_at", null)
          .not("email", "is", null)
          .order("contact_name")
          .limit(500);
        if (error) throw error;

        return (data || [])
          .filter((r) => r.email)
          .map((r) => {
            const displayName = r.contact_name || r.company_name || "ללא שם";
            const { firstName, lastName } = splitContactName(displayName);
            const label = r.company_name && r.contact_name
              ? `${r.contact_name} (${r.company_name})`
              : (r.company_name || r.contact_name || "ללא שם");
            return {
              key: `lead:${r.id}`,
              name: displayName,
              email: r.email!,
              phone: r.phone || undefined,
              firstName,
              lastName: lastName || r.company_name || undefined,
              sourceLabel: `ליד: ${label}`,
            };
          });
      }

      const { data: clients, error: clientsError } = await supabase
        .from("clients")
        .select("id, name, contact_name, email, phone")
        .eq("tenant_id", tenantId)
        .order("name")
        .limit(500);
      if (clientsError) throw clientsError;

      const clientIds = (clients || []).map((c) => c.id);
      let contactsByClient: Record<string, Array<{ id: string; contact_name: string; email: string | null; phone: string | null; role: string | null }>> = {};

      if (clientIds.length > 0) {
        const { data: subContacts, error: subError } = await supabase
          .from("client_contacts")
          .select("id, client_id, contact_name, email, phone, role")
          .eq("tenant_id", tenantId)
          .in("client_id", clientIds);
        if (subError) throw subError;
        for (const sc of subContacts || []) {
          if (!contactsByClient[sc.client_id]) contactsByClient[sc.client_id] = [];
          contactsByClient[sc.client_id].push(sc);
        }
      }

      const result: ContactOption[] = [];

      for (const client of clients || []) {
        const clientLabel = client.name;
        const primaryName = client.contact_name || client.name;
        if (client.email) {
          const { firstName, lastName } = splitContactName(primaryName);
          result.push({
            key: `client:${client.id}:primary`,
            name: primaryName,
            email: client.email,
            phone: client.phone || undefined,
            firstName,
            lastName: lastName || (client.contact_name ? client.name : undefined),
            sourceLabel: `לקוח: ${clientLabel}`,
          });
        }

        for (const sc of contactsByClient[client.id] || []) {
          if (!sc.email) continue;
          const { firstName, lastName } = splitContactName(sc.contact_name);
          result.push({
            key: `client_contact:${sc.id}`,
            name: sc.contact_name,
            email: sc.email,
            phone: sc.phone || undefined,
            firstName,
            lastName,
            sourceLabel: `לקוח: ${clientLabel}${sc.role ? ` · ${sc.role}` : ""}`,
          });
        }
      }

      return result;
    },
    enabled: !!tenantId && open,
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.name.toLowerCase().includes(q) ||
        o.email.toLowerCase().includes(q) ||
        o.phone?.includes(q) ||
        o.sourceLabel?.toLowerCase().includes(q),
    );
  }, [options, search]);

  const handleSelect = (option: ContactOption) => {
    onSelect(option);
    setOpen(false);
    setSearch("");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="shrink-0">
          <UserSearch className="h-3.5 w-3.5 ml-1" />
          מלידים / לקוחות
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-3" align="start" dir="rtl">
        <div className="space-y-3">
          <Select value={entity} onValueChange={(v) => { setEntity(v as EntityType); setSearch(""); }}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="lead">לידים</SelectItem>
              <SelectItem value="client">לקוחות</SelectItem>
            </SelectContent>
          </Select>

          <div className="relative">
            <Search className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="חיפוש לפי שם, אימייל או טלפון..."
              className="h-9 pr-8"
            />
          </div>

          <div className="max-h-56 overflow-y-auto space-y-1">
            {isLoading ? (
              <p className="text-xs text-muted-foreground text-center py-4">טוען...</p>
            ) : filtered.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">
                {entity === "lead" ? "לא נמצאו לידים עם אימייל" : "לא נמצאו לקוחות עם אימייל"}
              </p>
            ) : (
              filtered.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  className="w-full text-right rounded-md border border-transparent hover:border-border hover:bg-muted/50 px-2 py-2 transition-colors"
                  onClick={() => handleSelect(option)}
                >
                  <p className="text-sm font-medium truncate">{option.name}</p>
                  <p className="text-xs text-muted-foreground truncate" dir="ltr">{option.email}</p>
                  {option.sourceLabel && (
                    <p className="text-[10px] text-primary/80 truncate">{option.sourceLabel}</p>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
