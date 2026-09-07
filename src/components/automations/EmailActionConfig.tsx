import { useEffect, useMemo, useRef, useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useBroadcastDomains } from "@/hooks/useBroadcastDomains";
import { EmailRecipientsListEditor, migrateLegacyEmailRecipients } from "./EmailRecipientsListEditor";

interface Props {
  configuration: Record<string, any>;
  availableFields: { key: string; label: string }[];
  tenantId: string | undefined;
  onConfigChange: (key: string, value: any) => void;
}

export function EmailActionConfig({ configuration, availableFields, tenantId, onConfigChange }: Props) {
  const { list: domainsQuery } = useBroadcastDomains();
  const domains = domainsQuery.data || [];
  const defaultDomain = domains.find((d) => d.is_default) || domains[0];

  const fromMode = configuration?.from_mode || "default";
  const subjectRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const [subjectCursor, setSubjectCursor] = useState<number | null>(null);
  const [bodyCursor, setBodyCursor] = useState<number | null>(null);

  const systemFields = useMemo(
    () => availableFields.filter((f) => !f.key.startsWith("fb_")),
    [availableFields],
  );
  const fbFields = useMemo(
    () => availableFields.filter((f) => f.key.startsWith("fb_")),
    [availableFields],
  );

  useEffect(() => {
    if (domains.length === 0) return;
    if (configuration?.sender_domain_id) return;
    const preferred = defaultDomain?.id;
    if (preferred) onConfigChange("sender_domain_id", preferred);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [domains.length, defaultDomain?.id]);

  const selectedDomain =
    domains.find((d) => d.id === configuration?.sender_domain_id) || defaultDomain;

  const insertVariable = (fieldKey: string, target: "subject" | "body") => {
    const variable = `{{${fieldKey}}}`;
    if (target === "subject") {
      const current = configuration?.subject_template || "";
      const pos = subjectCursor ?? current.length;
      onConfigChange("subject_template", current.slice(0, pos) + variable + current.slice(pos));
      return;
    }
    const current = configuration?.body_template || "";
    const pos = bodyCursor ?? current.length;
    onConfigChange("body_template", current.slice(0, pos) + variable + current.slice(pos));
  };

  const VariableButtons = ({ target }: { target: "subject" | "body" }) => (
    <div className="space-y-2">
      {systemFields.length > 0 && (
        <div className="space-y-1">
          <p className="text-[10px] font-medium text-muted-foreground text-right">שדות מערכת</p>
          <div className="flex flex-wrap gap-1 justify-end">
            {systemFields.map((field) => (
              <Button
                key={field.key}
                type="button"
                variant="outline"
                size="sm"
                className="text-xs h-6 px-2"
                onClick={() => insertVariable(field.key, target)}
              >
                {field.label}
              </Button>
            ))}
          </div>
        </div>
      )}
      {fbFields.length > 0 && (
        <div className="space-y-1">
          <p className="text-[10px] font-medium text-blue-500 text-right">שדות פייסבוק</p>
          <div className="flex flex-wrap gap-1 justify-end">
            {fbFields.map((field) => (
              <Button
                key={field.key}
                type="button"
                variant="outline"
                size="sm"
                className="text-xs h-6 px-2 border-blue-400 text-blue-600 bg-blue-50 hover:bg-blue-100"
                onClick={() => insertVariable(field.key, target)}
              >
                {field.label}
              </Button>
            ))}
          </div>
        </div>
      )}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="text-xs h-6 px-2 border-primary text-primary"
        onClick={() => insertVariable("agent_output", target)}
      >
        🤖 תוצאת סוכן AI
      </Button>
    </div>
  );

  return (
    <div className="space-y-4" dir="rtl">
      <div className="rounded-lg border border-sky-500/30 bg-sky-500/10 p-3">
        <p className="text-xs font-semibold text-sky-700">שליחת אימייל (Resend)</p>
      </div>

      <div className="space-y-2 rounded-lg border p-3">
        <Label className="text-right block">כתובת שולח (From)</Label>
        {domainsQuery.isLoading ? (
          <p className="text-xs text-muted-foreground text-right">טוען דומיינים...</p>
        ) : domains.length === 0 ? (
          <p className="text-xs text-destructive text-right">
            לא הוגדר דומיין שליחה לארגון. הוסף דומיין מאומת בדיוור → הגדרות שולח לפני שליחת אימייל.
          </p>
        ) : (
          <>
            <div className="space-y-2">
              <Label className="text-right block text-xs">דומיין מאומת</Label>
              <Select
                value={configuration?.sender_domain_id || selectedDomain?.id || ""}
                onValueChange={(v) => onConfigChange("sender_domain_id", v)}
              >
                <SelectTrigger className="text-right">
                  <SelectValue placeholder="בחר דומיין..." />
                </SelectTrigger>
                <SelectContent>
                  {domains.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.default_local}@{d.domain}
                      {d.from_name ? ` · ${d.from_name}` : ""}
                      {d.is_default ? " (ברירת מחדל)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-wrap gap-2 text-sm">
              <button
                type="button"
                onClick={() => onConfigChange("from_mode", "default")}
                className={`rounded border px-2 py-1 ${fromMode === "default" ? "bg-primary text-primary-foreground" : ""}`}
              >
                ברירת מחדל ({selectedDomain ? `${selectedDomain.default_local}@${selectedDomain.domain}` : ""})
              </button>
              <button
                type="button"
                onClick={() => onConfigChange("from_mode", "custom")}
                className={`rounded border px-2 py-1 ${fromMode === "custom" ? "bg-primary text-primary-foreground" : ""}`}
              >
                כתובת מותאמת
              </button>
            </div>

            {fromMode === "custom" && (
              <div className="space-y-2">
                <Input
                  value={configuration?.from_name || ""}
                  onChange={(e) => onConfigChange("from_name", e.target.value)}
                  placeholder="שם השולח (לדוגמה: AfterLead)"
                  className="text-right"
                />
                <div className="flex items-center gap-1">
                  <Input
                    value={configuration?.from_local || selectedDomain?.default_local || "noreply"}
                    onChange={(e) => onConfigChange("from_local", e.target.value)}
                    placeholder="info"
                    className="flex-1"
                    dir="ltr"
                  />
                  <span className="text-muted-foreground">@</span>
                  <Input
                    value={selectedDomain?.domain || ""}
                    readOnly
                    className="w-40 bg-muted"
                    dir="ltr"
                  />
                </div>
                <p className="text-xs text-muted-foreground text-right">ניתן לשלוח רק מדומיין מאומת ב-Resend.</p>
              </div>
            )}
          </>
        )}

        <div className="space-y-2 pt-1">
          <Label className="text-right block text-xs">Reply-To (לאן יגיעו תשובות — אופציונלי)</Label>
          <Input
            type="email"
            value={configuration?.reply_to || ""}
            onChange={(e) => onConfigChange("reply_to", e.target.value)}
            placeholder="david@gmail.com"
            dir="ltr"
            className="text-right"
          />
        </div>
      </div>

      <EmailRecipientsListEditor
        tenantId={tenantId}
        availableFields={availableFields}
        value={migrateLegacyEmailRecipients(configuration || {})}
        onChange={(next) => onConfigChange("email_recipients", next)}
      />

      <div className="space-y-2">
        <Label className="text-right block">נושא האימייל</Label>
        <Input
          ref={subjectRef}
          value={configuration?.subject_template || ""}
          onChange={(e) => onConfigChange("subject_template", e.target.value)}
          onSelect={(e) => setSubjectCursor((e.target as HTMLInputElement).selectionStart)}
          placeholder="למשל: עדכון לגבי {{contact_name}}"
          className="text-right"
        />
        <VariableButtons target="subject" />
      </div>

      <div className="space-y-2">
        <Label className="text-right block">גוף ההודעה</Label>
        <Textarea
          ref={bodyRef}
          value={configuration?.body_template || ""}
          onChange={(e) => onConfigChange("body_template", e.target.value)}
          onSelect={(e) => setBodyCursor((e.target as HTMLTextAreaElement).selectionStart)}
          placeholder="שלום {{contact_name}}, ..."
          className="text-right min-h-[120px]"
          rows={5}
        />
        <VariableButtons target="body" />
      </div>
    </div>
  );
}
