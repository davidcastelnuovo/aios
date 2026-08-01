import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  FileText,
  Loader2,
  Plus,
  RefreshCw,
  Send,
  Trash2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

type MetaTemplateComponent = {
  type: string;
  text?: string;
  example?: { body_text?: string[][] };
};

type MetaTemplate = {
  id: string;
  name: string;
  status: string;
  category: string;
  language: string;
  components: MetaTemplateComponent[];
  rejected_reason?: string | null;
  quality_score?: { score?: string } | null;
};

type Props = {
  tenantId: string;
  integrationId: string;
  displayPhone?: string;
};

const statusConfig: Record<string, { label: string; className: string }> = {
  APPROVED: { label: "מאושרת", className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700" },
  PENDING: { label: "ממתינה לאישור", className: "border-amber-500/30 bg-amber-500/10 text-amber-700" },
  REJECTED: { label: "נדחתה", className: "border-red-500/30 bg-red-500/10 text-red-700" },
  PAUSED: { label: "מושהית", className: "border-orange-500/30 bg-orange-500/10 text-orange-700" },
  DISABLED: { label: "מושבתת", className: "border-slate-500/30 bg-slate-500/10 text-slate-700" },
};

const variableIndexes = (text: string) =>
  [...text.matchAll(/\{\{(\d+)\}\}/g)]
    .map((match) => Number(match[1]))
    .filter((value, index, values) => values.indexOf(value) === index)
    .sort((a, b) => a - b);

const templateBody = (template: MetaTemplate) =>
  template.components?.find((component) => component.type.toUpperCase() === "BODY")?.text ?? "";

const friendlyError = (error: unknown) => {
  if (error instanceof Error) return error.message;
  return "אירעה שגיאה מול Meta";
};

export function MetaWhatsAppTemplates({ tenantId, integrationId, displayPhone }: Props) {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [sendTemplate, setSendTemplate] = useState<MetaTemplate | null>(null);
  const [form, setForm] = useState({
    name: "",
    category: "UTILITY",
    language: "he",
    body: "",
    footer: "",
  });
  const [examples, setExamples] = useState<string[]>([]);
  const [recipientPhone, setRecipientPhone] = useState("");
  const [sendValues, setSendValues] = useState<string[]>([]);

  const queryKey = ["meta-whatsapp-templates", integrationId];
  const templatesQuery = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("meta-whatsapp-templates", {
        body: { action: "list", tenant_id: tenantId, integration_id: integrationId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return {
        templates: (data?.templates ?? []) as MetaTemplate[],
        canManage: data?.can_manage === true,
      };
    },
  });

  const formVariables = useMemo(() => variableIndexes(form.body), [form.body]);
  const sendVariables = useMemo(
    () => (sendTemplate ? variableIndexes(templateBody(sendTemplate)) : []),
    [sendTemplate],
  );

  useEffect(() => {
    setExamples((current) => formVariables.map((_, index) => current[index] ?? ""));
  }, [formVariables.length]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setSendValues(sendVariables.map(() => ""));
    setRecipientPhone("");
  }, [sendTemplate?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const resetCreateForm = () => {
    setForm({ name: "", category: "UTILITY", language: "he", body: "", footer: "" });
    setExamples([]);
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("meta-whatsapp-templates", {
        body: {
          action: "create",
          tenant_id: tenantId,
          integration_id: integrationId,
          template: {
            name: form.name,
            category: form.category,
            language: form.language,
            body_text: form.body,
            footer_text: form.footer,
            examples,
          },
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "יצירת התבנית נכשלה");
    },
    onSuccess: () => {
      toast.success("התבנית נשלחה לאישור Meta");
      setCreateOpen(false);
      resetCreateForm();
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (error) => toast.error(friendlyError(error)),
  });

  const deleteMutation = useMutation({
    mutationFn: async (template: MetaTemplate) => {
      const { data, error } = await supabase.functions.invoke("meta-whatsapp-templates", {
        body: {
          action: "delete",
          tenant_id: tenantId,
          integration_id: integrationId,
          template_name: template.name,
          template_id: template.id,
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "מחיקת התבנית נכשלה");
    },
    onSuccess: () => {
      toast.success("התבנית נמחקה");
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (error) => toast.error(friendlyError(error)),
  });

  const sendMutation = useMutation({
    mutationFn: async () => {
      if (!sendTemplate) throw new Error("לא נבחרה תבנית");
      const components = sendValues.length
        ? [{
            type: "body",
            parameters: sendValues.map((value) => ({ type: "text", text: value })),
          }]
        : undefined;
      const { data, error } = await supabase.functions.invoke("send-meta-whatsapp-message", {
        body: {
          tenantId,
          integrationId,
          phoneNumber: recipientPhone,
          template: {
            name: sendTemplate.name,
            language: sendTemplate.language,
            components,
          },
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "שליחת התבנית נכשלה");
    },
    onSuccess: () => {
      toast.success("הודעת התבנית נשלחה");
      setSendTemplate(null);
    },
    onError: (error) => toast.error(friendlyError(error)),
  });

  const canCreate =
    /^[a-z0-9_]+$/.test(form.name) &&
    form.body.trim().length > 0 &&
    examples.length === formVariables.length &&
    examples.every(Boolean);
  const canSend =
    Boolean(recipientPhone.replace(/\D/g, "")) &&
    sendValues.length === sendVariables.length &&
    sendValues.every(Boolean);

  return (
    <section className="space-y-4 rounded-lg border bg-muted/20 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 font-semibold">
            <FileText className="h-4 w-4 text-emerald-600" />
            תבניות הודעה רשמיות
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            יצירה, מעקב אישור ושליחת templates של Meta מחוץ לחלון 24 השעות.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => templatesQuery.refetch()}
            disabled={templatesQuery.isFetching}
          >
            <RefreshCw className={`ml-2 h-4 w-4 ${templatesQuery.isFetching ? "animate-spin" : ""}`} />
            רענן
          </Button>
          {templatesQuery.data?.canManage && (
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="ml-2 h-4 w-4" />
              צור תבנית
            </Button>
          )}
        </div>
      </div>

      {templatesQuery.isLoading ? (
        <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          טוען תבניות מ־Meta...
        </div>
      ) : templatesQuery.isError ? (
        <Alert variant="destructive">
          <AlertDescription>
            {friendlyError(templatesQuery.error)}. ודאו שהחיבור כולל את ההרשאה
            `whatsapp_business_management`.
          </AlertDescription>
        </Alert>
      ) : templatesQuery.data?.templates.length === 0 ? (
        <div className="rounded-md border border-dashed py-8 text-center text-sm text-muted-foreground">
          עדיין אין תבניות בחשבון WhatsApp הזה.
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>שם</TableHead>
              <TableHead>סטטוס</TableHead>
              <TableHead>קטגוריה</TableHead>
              <TableHead>שפה</TableHead>
              <TableHead className="w-[150px]">פעולות</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {templatesQuery.data?.templates.map((template) => {
              const status = statusConfig[template.status] ?? {
                label: template.status,
                className: "",
              };
              return (
                <TableRow key={template.id}>
                  <TableCell>
                    <div className="font-mono text-xs" dir="ltr">{template.name}</div>
                    {template.rejected_reason && (
                      <div className="mt-1 max-w-xs text-xs text-destructive">{template.rejected_reason}</div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={status.className}>{status.label}</Badge>
                  </TableCell>
                  <TableCell>{template.category === "UTILITY" ? "שירות" : "שיווק"}</TableCell>
                  <TableCell>{template.language}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={template.status !== "APPROVED"}
                        onClick={() => setSendTemplate(template)}
                      >
                        <Send className="ml-1 h-3.5 w-3.5" />
                        שלח
                      </Button>
                      {templatesQuery.data?.canManage && (
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={deleteMutation.isPending}
                          onClick={() => {
                            if (confirm(`למחוק את התבנית "${template.name}" מ־Meta?`)) {
                              deleteMutation.mutate(template);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent dir="rtl" className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>יצירת תבנית WhatsApp</DialogTitle>
            <DialogDescription>
              התבנית תישלח ל־Meta לבדיקה. ניתן לשלוח אותה רק לאחר שהסטטוס משתנה ל״מאושרת״.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>שם התבנית</Label>
                <Input
                  dir="ltr"
                  placeholder="appointment_reminder"
                  value={form.name}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      name: event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"),
                    })
                  }
                />
                <p className="text-xs text-muted-foreground">אותיות אנגליות קטנות, מספרים וקו תחתון בלבד.</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>קטגוריה</Label>
                  <Select value={form.category} onValueChange={(category) => setForm({ ...form, category })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="UTILITY">שירות</SelectItem>
                      <SelectItem value="MARKETING">שיווק</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>שפה</Label>
                  <Select value={form.language} onValueChange={(language) => setForm({ ...form, language })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="he">עברית</SelectItem>
                      <SelectItem value="en_US">English</SelectItem>
                      <SelectItem value="ar">العربية</SelectItem>
                      <SelectItem value="ru">Русский</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label>תוכן ההודעה</Label>
              <Textarea
                value={form.body}
                onChange={(event) => setForm({ ...form, body: event.target.value })}
                placeholder={"שלום {{1}}, הפגישה שלך נקבעה לתאריך {{2}}."}
                className="min-h-28"
              />
              <p className="text-xs text-muted-foreground">
                משתנים נכתבים ברצף: {"{{1}}"}, {"{{2}}"} וכן הלאה.
              </p>
            </div>
            {formVariables.map((variable, index) => (
              <div className="space-y-2" key={variable}>
                <Label>דוגמה עבור {`{{${variable}}}`}</Label>
                <Input
                  value={examples[index] ?? ""}
                  onChange={(event) =>
                    setExamples((current) =>
                      current.map((value, itemIndex) => itemIndex === index ? event.target.value : value)
                    )
                  }
                  placeholder={index === 0 ? "דוד" : "01/08/2026 בשעה 15:00"}
                />
              </div>
            ))}
            <div className="space-y-2">
              <Label>שורת סיום (אופציונלי)</Label>
              <Input
                value={form.footer}
                onChange={(event) => setForm({ ...form, footer: event.target.value.slice(0, 60) })}
                placeholder="AIOS — כאן בשבילך"
              />
              <p className="text-xs text-muted-foreground">{form.footer.length}/60</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>ביטול</Button>
            <Button
              disabled={!canCreate || createMutation.isPending}
              onClick={() => createMutation.mutate()}
            >
              {createMutation.isPending && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
              שלח לאישור Meta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(sendTemplate)} onOpenChange={(open) => !open && setSendTemplate(null)}>
        <DialogContent dir="rtl" className="max-w-lg">
          <DialogHeader>
            <DialogTitle>שליחת תבנית מאושרת</DialogTitle>
            <DialogDescription>
              שולח דרך {displayPhone || "מספר Meta WhatsApp המחובר"}.
            </DialogDescription>
          </DialogHeader>
          {sendTemplate && (
            <div className="space-y-4">
              <div className="rounded-md border bg-muted/40 p-3 text-sm whitespace-pre-wrap">
                {templateBody(sendTemplate)}
              </div>
              <div className="space-y-2">
                <Label>מספר הנמען</Label>
                <Input
                  dir="ltr"
                  inputMode="tel"
                  placeholder="0501234567"
                  value={recipientPhone}
                  onChange={(event) => setRecipientPhone(event.target.value)}
                />
              </div>
              {sendVariables.map((variable, index) => (
                <div className="space-y-2" key={variable}>
                  <Label>ערך עבור {`{{${variable}}}`}</Label>
                  <Input
                    value={sendValues[index] ?? ""}
                    onChange={(event) =>
                      setSendValues((current) =>
                        current.map((value, itemIndex) => itemIndex === index ? event.target.value : value)
                      )
                    }
                  />
                </div>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSendTemplate(null)}>ביטול</Button>
            <Button disabled={!canSend || sendMutation.isPending} onClick={() => sendMutation.mutate()}>
              {sendMutation.isPending
                ? <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                : <Send className="ml-2 h-4 w-4" />}
              שלח תבנית
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
