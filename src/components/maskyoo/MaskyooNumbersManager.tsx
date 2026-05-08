import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ListChecks, Loader2, Trash2, Phone, Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface NumberRow {
  id: string;
  phone_last9: string;
  display_number: string;
  label: string | null;
  client_id: string | null;
  category: "organic" | "paid" | "general";
  is_ignored: boolean;
}

interface ClientOption { id: string; name: string }

export function MaskyooNumbersManager({ tenantId }: { tenantId: string }) {
  const qc = useQueryClient();

  const { data: numbers, isLoading } = useQuery({
    queryKey: ["maskyoo-numbers", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("maskyoo_numbers" as any)
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as NumberRow[];
    },
  });

  const { data: clients } = useQuery({
    queryKey: ["clients-min-cross-tenant", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      // Owned agencies
      const { data: owned } = await supabase
        .from("agencies")
        .select("id")
        .eq("tenant_id", tenantId);
      // Shared agencies via agency_tenant_access (e.g., DMM)
      const { data: shared } = await supabase
        .from("agency_tenant_access")
        .select("agency_id")
        .eq("accessing_tenant_id", tenantId);
      const agencyIds = Array.from(
        new Set([
          ...((owned || []).map((a: any) => a.id)),
          ...((shared || []).map((s: any) => s.agency_id)),
        ])
      ).filter(Boolean);

      let query = supabase
        .from("clients")
        .select("id, name")
        .in("status", ["active", "onboarding"]);

      if (agencyIds.length > 0) {
        query = query.or(`tenant_id.eq.${tenantId},agency_id.in.(${agencyIds.join(",")})`);
      } else {
        query = query.eq("tenant_id", tenantId);
      }

      const { data, error } = await query.order("name");
      if (error) throw error;
      // Dedupe by id
      const map = new Map<string, ClientOption>();
      (data || []).forEach((c: any) => map.set(c.id, { id: c.id, name: c.name }));
      return Array.from(map.values());
    },
  });

  // Counts per number from call_logs (last 30d)
  const { data: counts } = useQuery({
    queryKey: ["maskyoo-call-counts", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const since = new Date(Date.now() - 30 * 86400_000).toISOString();
      const { data, error } = await supabase
        .from("call_logs")
        .select("to_number, created_at")
        .eq("tenant_id", tenantId)
        .eq("provider", "maskyoo")
        .gte("created_at", since)
        .limit(5000);
      if (error) throw error;
      const map = new Map<string, number>();
      for (const r of data || []) {
        const last9 = (r.to_number || "").replace(/\D/g, "").slice(-9);
        if (!last9) continue;
        map.set(last9, (map.get(last9) || 0) + 1);
      }
      return map;
    },
    staleTime: 60_000,
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<NumberRow> }) => {
      const { error } = await supabase.from("maskyoo_numbers" as any).update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["maskyoo-numbers", tenantId] });
    },
    onError: (e: any) => toast.error("שגיאה בעדכון", { description: e.message }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("maskyoo_numbers" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("המספר נמחק");
      qc.invalidateQueries({ queryKey: ["maskyoo-numbers", tenantId] });
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ListChecks className="h-5 w-5" /> מספרי מסקיו שנקלטו
        </CardTitle>
        <CardDescription>
          כל מספר חדש שמגיע מ-Maskyoo נרשם כאן אוטומטית. שייך לקוח כדי שכל הדוחות שלו יציגו את השיחות,
          או סמן "התעלם" כדי שלא נשמור עוד שיחות מהמספר הזה.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : !numbers || numbers.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground py-6 flex flex-col items-center gap-2">
            <Phone className="h-6 w-6 opacity-40" />
            עדיין לא נקלטו מספרים. ברגע שמסקיו ישלחו שיחה ראשונה למספר חדש – הוא יופיע כאן.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>מספר</TableHead>
                  <TableHead>תווית</TableHead>
                  <TableHead>קטגוריה</TableHead>
                  <TableHead>לקוח משויך</TableHead>
                  <TableHead className="text-center">שיחות 30 יום</TableHead>
                  <TableHead className="text-center">התעלם</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {numbers.map((row) => {
                  const count = counts?.get(row.phone_last9) ?? 0;
                  return (
                    <TableRow key={row.id} className={row.is_ignored ? "opacity-60" : ""}>
                      <TableCell dir="ltr" className="font-mono text-sm">{row.display_number}</TableCell>
                      <TableCell>
                        <Input
                          dir="rtl"
                          className="h-8 min-w-[140px]"
                          defaultValue={row.label || ""}
                          placeholder="לדוגמה: אורגני"
                          onBlur={(e) => {
                            const v = e.target.value.trim();
                            if (v !== (row.label || "")) {
                              updateMutation.mutate({ id: row.id, patch: { label: v || null } });
                            }
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Select
                          value={row.category}
                          onValueChange={(v) => updateMutation.mutate({ id: row.id, patch: { category: v as any } })}
                        >
                          <SelectTrigger className="h-8 min-w-[110px]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="organic">אורגני</SelectItem>
                            <SelectItem value="paid">ממומן</SelectItem>
                            <SelectItem value="general">כללי</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <ClientCombobox
                          clients={clients || []}
                          value={row.client_id}
                          onChange={(v) => updateMutation.mutate({ id: row.id, patch: { client_id: v } })}
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={count > 0 ? "default" : "secondary"}>{count}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Switch
                          checked={row.is_ignored}
                          onCheckedChange={(checked) => updateMutation.mutate({ id: row.id, patch: { is_ignored: checked } })}
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            if (confirm(`למחוק את המספר ${row.display_number}? הוא יופיע שוב אם תגיע אליו שיחה.`)) {
                              deleteMutation.mutate(row.id);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

import { useState } from "react";

function ClientCombobox({
  clients,
  value,
  onChange,
}: {
  clients: ClientOption[];
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = clients.find((c) => c.id === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          className="h-8 min-w-[180px] justify-between font-normal"
        >
          <span className="truncate">{selected?.name || "— ללא שיוך —"}</span>
          <ChevronsUpDown className="ms-2 h-3.5 w-3.5 opacity-50 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[260px] p-0" align="start">
        <Command
          filter={(val, search) => (val.includes(search.toLowerCase()) ? 1 : 0)}
        >
          <CommandInput placeholder="חפש לקוח..." />
          <CommandList>
            <CommandEmpty>לא נמצאו לקוחות</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="ללא שיוך"
                onSelect={() => {
                  onChange(null);
                  setOpen(false);
                }}
              >
                <Check className={cn("me-2 h-4 w-4", !value ? "opacity-100" : "opacity-0")} />
                — ללא שיוך —
              </CommandItem>
              {clients.map((c) => (
                <CommandItem
                  key={c.id}
                  value={`${c.name} ${c.id}`}
                  onSelect={() => {
                    onChange(c.id);
                    setOpen(false);
                  }}
                >
                  <Check className={cn("me-2 h-4 w-4", value === c.id ? "opacity-100" : "opacity-0")} />
                  <span className="truncate">{c.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
