import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel, SelectSeparator } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Search } from "lucide-react";

export type EmailRecipient =
  | { type: "email_field"; field: string }
  | { type: "email_manual"; email: string }
  | { type: "contact_lookup"; entity: "lead" | "client"; id: string };

const TYPE_LABELS: Record<EmailRecipient["type"], string> = {
  email_field: "אימייל – שדה דינמי",
  email_manual: "אימייל – ידני",
  contact_lookup: "איש קשר מה-CRM",
};

function defaultForType(type: EmailRecipient["type"]): EmailRecipient {
  switch (type) {
    case "email_field":
      return { type, field: "email" };
    case "email_manual":
      return { type, email: "" };
    case "contact_lookup":
      return { type, entity: "lead", id: "" };
  }
}

interface Props {
  tenantId: string | undefined;
  availableFields: { key: string; label: string }[];
  value: EmailRecipient[];
  onChange: (next: EmailRecipient[]) => void;
}

export function EmailRecipientsListEditor({ tenantId, availableFields, value, onChange }: Props) {
  const recipients = value.length > 0 ? value : [defaultForType("email_field")];

  const updateAt = (idx: number, next: EmailRecipient) => {
    const copy = [...recipients];
    copy[idx] = next;
    onChange(copy);
  };

  const removeAt = (idx: number) => {
    const copy = recipients.filter((_, i) => i !== idx);
    onChange(copy.length === 0 ? [defaultForType("email_field")] : copy);
  };

  const add = () => onChange([...recipients, defaultForType("email_field")]);

  const emailFields = useMemo(
    () =>
      availableFields.filter(
        (f) =>
          f.key === "email" ||
          f.key.includes("email") ||
          f.key.includes("mail") ||
          f.key.includes("מייל") ||
          f.key.includes("אימייל"),
      ),
    [availableFields],
  );

  return (
    <div className="space-y-3">
      <Label className="text-right block">נמענים</Label>
      <div className="space-y-2">
        {recipients.map((r, idx) => (
          <RecipientRow
            key={idx}
            tenantId={tenantId}
            emailFields={emailFields.length ? emailFields : [{ key: "email", label: "אימייל" }]}
            availableFields={availableFields}
            value={r}
            onChange={(next) => updateAt(idx, next)}
            onRemove={() => removeAt(idx)}
            canRemove={recipients.length > 1}
          />
        ))}
      </div>
      <Button type="button" variant="outline" size="sm" onClick={add} className="w-full">
        <Plus className="h-4 w-4 ml-1" />
        הוסף נמען
      </Button>
      <p className="text-xs text-muted-foreground text-right">
        ניתן להוסיף כמה נמענים. באימייל ידני אפשר להזין כמה כתובות מופרדות בפסיק.
      </p>
    </div>
  );
}

function RecipientRow({
  tenantId,
  emailFields,
  availableFields,
  value,
  onChange,
  onRemove,
  canRemove,
}: {
  tenantId: string | undefined;
  emailFields: { key: string; label: string }[];
  availableFields: { key: string; label: string }[];
  value: EmailRecipient;
  onChange: (next: EmailRecipient) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  return (
    <div className="rounded-lg border bg-muted/20 p-2 space-y-2">
      <div className="flex items-center gap-2">
        <Select
          value={value.type}
          onValueChange={(v) => onChange(defaultForType(v as EmailRecipient["type"]))}
        >
          <SelectTrigger className="text-right flex-1 h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(TYPE_LABELS) as EmailRecipient["type"][]).map((t) => (
              <SelectItem key={t} value={t}>
                {TYPE_LABELS[t]}
              </SelectItem>
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
        emailFields={emailFields}
        availableFields={availableFields}
        value={value}
        onChange={onChange}
      />
    </div>
  );
}

function RecipientValueEditor({
  tenantId,
  emailFields,
  availableFields,
  value,
  onChange,
}: {
  tenantId: string | undefined;
  emailFields: { key: string; label: string }[];
  availableFields: { key: string; label: string }[];
  value: EmailRecipient;
  onChange: (next: EmailRecipient) => void;
}) {
  if (value.type === "email_field") {
    return (
      <Select value={value.field} onValueChange={(v) => onChange({ ...value, field: v })}>
        <SelectTrigger className="text-right h-9">
          <SelectValue placeholder="בחר שדה..." />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel className="text-xs font-bold text-muted-foreground">שדות אימייל</SelectLabel>
            {emailFields.map((f) => (
              <SelectItem key={f.key} value={f.key}>
                {f.label} ({`{{${f.key}}}`})
              </SelectItem>
            ))}
          </SelectGroup>
          {availableFields.some((f) => !emailFields.some((e) => e.key === f.key)) && (
            <>
              <SelectSeparator />
              <SelectGroup>
                <SelectLabel className="text-xs font-bold text-muted-foreground">שדות נוספים</SelectLabel>
                {availableFields
                  .filter((f) => !emailFields.some((e) => e.key === f.key))
                  .map((f) => (
                    <SelectItem key={f.key} value={f.key}>
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

  if (value.type === "email_manual") {
    return (
      <Input
        value={value.email}
        onChange={(e) => onChange({ ...value, email: e.target.value })}
        placeholder="email@example.com או כמה כתובות מופרדות בפסיק"
        dir="ltr"
        className="text-right h-9"
      />
    );
  }

  if (value.type === "contact_lookup") {
    return <ContactLookupEditor tenantId={tenantId} value={value} onChange={onChange} />;
  }

  return null;
}

function ContactLookupEditor({
  tenantId,
  value,
  onChange,
}: {
  tenantId: string | undefined;
  value: Extract<EmailRecipient, { type: "contact_lookup" }>;
  onChange: (next: EmailRecipient) => void;
}) {
  const [search, setSearch] = useState("");

  const { data: contacts } = useQuery({
    queryKey: ["email-recipient-contacts", tenantId, value.entity],
    queryFn: async () => {
      if (!tenantId) return [];
      const table = value.entity === "lead" ? "leads" : "clients";
      const nameField = value.entity === "lead" ? "contact_name" : "name";
      const { data, error } = await supabase
        .from(table)
        .select(`id, email, ${nameField}`)
        .eq("tenant_id", tenantId)
        .not("email", "is", null)
        .order(nameField)
        .limit(500);
      if (error) throw error;
      return (data || []).map((r: any) => ({
        id: r.id,
        name: r[nameField] || "ללא שם",
        email: r.email,
      }));
    },
    enabled: !!tenantId,
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return contacts || [];
    return (contacts || []).filter(
      (c) => c.name?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q),
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
                placeholder="חפש לפי שם או אימייל..."
                className="h-8 text-xs pr-7"
              />
            </div>
          </div>
          {filtered.length === 0 ? (
            <div className="px-2 py-4 text-center text-xs text-muted-foreground">לא נמצאו אנשי קשר עם אימייל</div>
          ) : (
            filtered.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name} · {c.email}
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>
    </div>
  );
}

export function migrateLegacyEmailRecipients(cfg: Record<string, any>): EmailRecipient[] {
  if (Array.isArray(cfg?.email_recipients) && cfg.email_recipients.length > 0) {
    return cfg.email_recipients as EmailRecipient[];
  }
  if (cfg?.to_email) {
    return [{ type: "email_manual", email: cfg.to_email }];
  }
  if (cfg?.email_field) {
    return [{ type: "email_field", field: cfg.email_field }];
  }
  return [{ type: "email_field", field: "email" }];
}
