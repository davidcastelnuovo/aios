import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel, SelectSeparator } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Search } from "lucide-react";

export type Recipient =
  | { type: "phone_field"; field: string }
  | { type: "phone_manual"; phone: string }
  | { type: "group_field"; field: string }
  | { type: "group_manual"; group_id: string }
  | { type: "contact_lookup"; entity: "lead" | "client"; id: string }
  | { type: "group_lookup"; group_id: string };

const TYPE_LABELS: Record<Recipient["type"], string> = {
  phone_field: "טלפון – שדה דינמי",
  phone_manual: "טלפון – ידני",
  group_field: "קבוצה – שדה דינמי",
  group_manual: "קבוצה – מזהה ידני",
  contact_lookup: "איש קשר מה-CRM",
  group_lookup: "קבוצה מרשימה",
};

function defaultForType(type: Recipient["type"]): Recipient {
  switch (type) {
    case "phone_field": return { type, field: "phone" };
    case "phone_manual": return { type, phone: "" };
    case "group_field": return { type, field: "group_chat_id" };
    case "group_manual": return { type, group_id: "" };
    case "contact_lookup": return { type, entity: "lead", id: "" };
    case "group_lookup": return { type, group_id: "" };
  }
}

interface Props {
  tenantId: string | undefined;
  availableFields: { key: string; label: string }[];
  value: Recipient[];
  onChange: (next: Recipient[]) => void;
}

export function RecipientsListEditor({ tenantId, availableFields, value, onChange }: Props) {
  const recipients = value.length > 0 ? value : [defaultForType("phone_field")];

  const updateAt = (idx: number, next: Recipient) => {
    const copy = [...recipients];
    copy[idx] = next;
    onChange(copy);
  };

  const removeAt = (idx: number) => {
    const copy = recipients.filter((_, i) => i !== idx);
    onChange(copy.length === 0 ? [defaultForType("phone_field")] : copy);
  };

  const add = () => onChange([...recipients, defaultForType("phone_field")]);

  return (
    <div className="space-y-3">
      <Label className="text-right block">יעדי שליחה</Label>
      <div className="space-y-2">
        {recipients.map((r, idx) => (
          <RecipientRow
            key={idx}
            tenantId={tenantId}
            availableFields={availableFields}
            value={r}
            onChange={(next) => updateAt(idx, next)}
            onRemove={() => removeAt(idx)}
            canRemove={recipients.length > 1}
          />
        ))}
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={add}
        className="w-full"
      >
        <Plus className="h-4 w-4 ml-1" />
        הוסף יעד
      </Button>
      <p className="text-xs text-muted-foreground text-right">
        ההודעה תישלח לכל היעדים ברשימה. כשל באחד לא יעצור את היתר.
      </p>
    </div>
  );
}

function RecipientRow({
  tenantId,
  availableFields,
  value,
  onChange,
  onRemove,
  canRemove,
}: {
  tenantId: string | undefined;
  availableFields: { key: string; label: string }[];
  value: Recipient;
  onChange: (next: Recipient) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  return (
    <div className="rounded-lg border bg-muted/20 p-2 space-y-2">
      <div className="flex items-center gap-2">
        <Select
          value={value.type}
          onValueChange={(v) => onChange(defaultForType(v as Recipient["type"]))}
        >
          <SelectTrigger className="text-right flex-1 h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(TYPE_LABELS) as Recipient["type"][]).map((t) => (
              <SelectItem key={t} value={t}>{TYPE_LABELS[t]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {canRemove && (
          <Button type="button" variant="ghost" size="icon" onClick={onRemove} className="h-9 w-9 text-destructive">
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
      <RecipientValueEditor
        tenantId={tenantId}
        availableFields={availableFields}
        value={value}
        onChange={onChange}
      />
    </div>
  );
}

function RecipientValueEditor({
  tenantId,
  availableFields,
  value,
  onChange,
}: {
  tenantId: string | undefined;
  availableFields: { key: string; label: string }[];
  value: Recipient;
  onChange: (next: Recipient) => void;
}) {
  if (value.type === "phone_field") {
    return (
      <Select value={value.field} onValueChange={(v) => onChange({ ...value, field: v })}>
        <SelectTrigger className="text-right h-9">
          <SelectValue placeholder="בחר שדה..." />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel className="text-xs font-bold text-muted-foreground">שדות מערכת</SelectLabel>
            {availableFields.filter(f => !f.key.startsWith("fb_")).map((f) => (
              <SelectItem key={f.key} value={f.key}>{f.label} ({`{{${f.key}}}`})</SelectItem>
            ))}
          </SelectGroup>
          {availableFields.some(f => f.key.startsWith("fb_")) && (
            <>
              <SelectSeparator />
              <SelectGroup>
                <SelectLabel className="text-xs font-bold text-blue-600">שדות פייסבוק</SelectLabel>
                {availableFields.filter(f => f.key.startsWith("fb_")).map((f) => (
                  <SelectItem key={f.key} value={f.key} className="text-blue-700 bg-blue-50/50">
                    {f.label} ({`{{${f.key}}}`})
                  </SelectItem>
                ))}
              </SelectGroup>
            </>
          )}
        </SelectContent>
      </Select>
    );
  }

  if (value.type === "phone_manual") {
    return (
      <Input
        value={value.phone}
        onChange={(e) => onChange({ ...value, phone: e.target.value })}
        placeholder="050-1234567"
        dir="ltr"
        className="text-right h-9"
      />
    );
  }

  if (value.type === "group_field") {
    return (
      <Select value={value.field} onValueChange={(v) => onChange({ ...value, field: v })}>
        <SelectTrigger className="text-right h-9">
          <SelectValue placeholder="בחר שדה..." />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="group_chat_id">מזהה צ'אט קבוצה - מומלץ ({`{{group_chat_id}}`})</SelectItem>
          <SelectItem value="group_id">מזהה קבוצה ({`{{group_id}}`})</SelectItem>
          {availableFields
            .filter(f => (f.key.toLowerCase().includes("group") || f.key === "chat_id"))
            .filter(f => f.key !== "group_id" && f.key !== "group_chat_id")
            .map((f) => (
              <SelectItem key={f.key} value={f.key}>{f.label} ({`{{${f.key}}}`})</SelectItem>
            ))}
        </SelectContent>
      </Select>
    );
  }

  if (value.type === "group_manual") {
    return (
      <Input
        value={value.group_id}
        onChange={(e) => onChange({ ...value, group_id: e.target.value })}
        placeholder="120363012345678901 או 120363...@g.us"
        dir="ltr"
        className="text-right h-9 font-mono text-xs"
      />
    );
  }

  if (value.type === "contact_lookup") {
    return <ContactLookupEditor tenantId={tenantId} value={value} onChange={onChange} />;
  }

  if (value.type === "group_lookup") {
    return <GroupLookupEditor tenantId={tenantId} value={value} onChange={onChange} />;
  }

  return null;
}

function ContactLookupEditor({
  tenantId,
  value,
  onChange,
}: {
  tenantId: string | undefined;
  value: Extract<Recipient, { type: "contact_lookup" }>;
  onChange: (next: Recipient) => void;
}) {
  const [search, setSearch] = useState("");

  const { data: contacts } = useQuery({
    queryKey: ["recipient-contacts", tenantId, value.entity],
    queryFn: async () => {
      if (!tenantId) return [];
      const table = value.entity === "lead" ? "leads" : "clients";
      const nameField = value.entity === "lead" ? "contact_name" : "name";
      const { data, error } = await supabase
        .from(table)
        .select(`id, phone, ${nameField}`)
        .eq("tenant_id", tenantId)
        .not("phone", "is", null)
        .order(nameField)
        .limit(500);
      if (error) throw error;
      return (data || []).map((r: any) => ({
        id: r.id,
        name: r[nameField] || "ללא שם",
        phone: r.phone,
      }));
    },
    enabled: !!tenantId,
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return contacts || [];
    return (contacts || []).filter((c) =>
      c.name?.toLowerCase().includes(q) || c.phone?.includes(q)
    );
  }, [contacts, search]);

  return (
    <div className="space-y-2">
      <Select
        value={value.entity}
        onValueChange={(v) => onChange({ ...value, entity: v as "lead" | "client", id: "" })}
      >
        <SelectTrigger className="text-right h-9">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="lead">ליד</SelectItem>
          <SelectItem value="client">לקוח</SelectItem>
        </SelectContent>
      </Select>
      <Select value={value.id} onValueChange={(v) => onChange({ ...value, id: v })}>
        <SelectTrigger className="text-right h-9">
          <SelectValue placeholder={value.entity === "lead" ? "בחר ליד..." : "בחר לקוח..."} />
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
                placeholder="חפש לפי שם או טלפון..."
                className="h-8 text-xs pr-7"
              />
            </div>
          </div>
          {filtered.length === 0 ? (
            <div className="px-2 py-4 text-center text-xs text-muted-foreground">לא נמצאו תוצאות</div>
          ) : (
            filtered.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name} · {c.phone}
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>
    </div>
  );
}

function GroupLookupEditor({
  tenantId,
  value,
  onChange,
}: {
  tenantId: string | undefined;
  value: Extract<Recipient, { type: "group_lookup" }>;
  onChange: (next: Recipient) => void;
}) {
  const [search, setSearch] = useState("");

  const { data: groups } = useQuery({
    queryKey: ["recipient-wa-groups", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("whatsapp_groups")
        .select("id, group_name, group_chat_id, is_blocked")
        .eq("tenant_id", tenantId)
        .eq("is_blocked", false)
        .order("group_name");
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return groups || [];
    return (groups || []).filter((g) => g.group_name?.toLowerCase().includes(q));
  }, [groups, search]);

  return (
    <Select value={value.group_id} onValueChange={(v) => onChange({ ...value, group_id: v })}>
      <SelectTrigger className="text-right h-9">
        <SelectValue placeholder="בחר קבוצה..." />
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
        {filtered.length === 0 ? (
          <div className="px-2 py-4 text-center text-xs text-muted-foreground">לא נמצאו קבוצות</div>
        ) : (
          filtered.map((g) => (
            <SelectItem key={g.id} value={g.group_chat_id}>{g.group_name}</SelectItem>
          ))
        )}
      </SelectContent>
    </Select>
  );
}

// Legacy → recipients[] migration helper
export function migrateLegacyRecipients(cfg: Record<string, any>): Recipient[] {
  if (Array.isArray(cfg?.recipients) && cfg.recipients.length > 0) {
    return cfg.recipients as Recipient[];
  }
  const mode = cfg?.phone_mode;
  if (mode === "manual" && cfg?.manual_phone) {
    return [{ type: "phone_manual", phone: cfg.manual_phone }];
  }
  if (mode === "group_manual" && cfg?.manual_group_id) {
    return [{ type: "group_manual", group_id: cfg.manual_group_id }];
  }
  if (mode === "group_field") {
    return [{ type: "group_field", field: cfg.group_id_field || "group_chat_id" }];
  }
  if (mode === "field" && cfg?.phone_field) {
    return [{ type: "phone_field", field: cfg.phone_field }];
  }
  // Default to dynamic phone field
  return [{ type: "phone_field", field: cfg?.phone_field || "phone" }];
}
