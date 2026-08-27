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
import { Checkbox } from "@/components/ui/checkbox";
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

type HeaderFormatOption = "NONE" | "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT";

type MetaTemplateComponent = {
  type: string;
  format?: string;
  text?: string;
  example?: { body_text?: string[][]; header_text?: string[]; header_handle?: string[] };
};

const HEADER_MEDIA_ACCEPT: Record<Exclude<HeaderFormatOption, "NONE" | "TEXT">, string> = {
  IMAGE: "image/jpeg,image/png,.jpg,.jpeg,.png",
  VIDEO: "video/mp4,.mp4",
  DOCUMENT: "application/pdf,.pdf",
};

const HEADER_MEDIA_HINT: Record<Exclude<HeaderFormatOption, "NONE" | "TEXT">, string> = {
  IMAGE: "JPEG או PNG, עד 5MB",
  VIDEO: "MP4, עד 16MB",
  DOCUMENT: "PDF, עד 16MB",
};

const templateHeader = (template: MetaTemplate) =>
  template.components?.find((component) => component.type.toUpperCase() === "HEADER");

const templateHeaderLabel = (template: MetaTemplate) => {
  const header = templateHeader(template);
  if (!header) return null;
  const format = String(header.format ?? "TEXT").toUpperCase();
  if (format === "TEXT") return header.text ?? "כותרת טקסט";
  if (format === "DOCUMENT") return "📄 PDF";
  if (format === "IMAGE") return "🖼️ תמונה";
  if (format === "VIDEO") return "🎬 וידאו";
  return format;
};

const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("לא ניתן לקרוא את הקובץ"));
    reader.readAsDataURL(file);
  });

type MetaTemplate = {
  id: string;
  name: string;
  status: string;
  category: string;
  language: string;
  parameter_format?: string;
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

const hasInvalidVariableSyntax = (text: string) => {
  const tokens = [...text.matchAll(/\{\{([^{}]+)\}\}/g)];
  const remainder = text.replace(/\{\{[^{}]+\}\}/g, "");
  return (
    tokens.some((match) => !/^\d+$/.test(match[1])) ||
    remainder.includes("{{") ||
    remainder.includes("}}")
  );
};

const templateBody = (template: MetaTemplate) =>
  template.components?.find((component) => component.type.toUpperCase() === "BODY")?.text ?? "";

const supportsDirectSend = (template: MetaTemplate) => {
  if (template.parameter_format === "named") return false;
  if (
    !template.components?.every((component) =>
      ["HEADER", "BODY", "FOOTER", "BUTTONS"].includes(component.type.toUpperCase()),
    )
  ) {
    return false;
  }
  const header = templateHeader(template);
  if (header) {
    const format = String(header.format ?? "TEXT").toUpperCase();
    if (format === "TEXT") {
      const headerText = header.text ?? "";
      if (variableIndexes(headerText).length > 0) return false;
      if (hasInvalidVariableSyntax(headerText)) return false;
    } else if (!["IMAGE", "VIDEO", "DOCUMENT"].includes(format)) {
      return false;
    }
  }
  const body = templateBody(template);
  const tokens = [...body.matchAll(/\{\{([^{}]+)\}\}/g)];
  const remainder = body.replace(/\{\{[^{}]+\}\}/g, "");
  return (
    tokens.every((match) => /^\d+$/.test(match[1])) &&
    !remainder.includes("{{") &&
    !remainder.includes("}}")
  );
};

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
    headerType: "NONE" as HeaderFormatOption,
    headerText: "",
    headerExample: "",
    body: "",
    footer: "",
    withOptInButton: false,
  });
  const [headerFile, setHeaderFile] = useState<File | null>(null);
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
        truncated: data?.truncated === true,
      };
    },
  });

  const formHeaderVariables = useMemo(() => variableIndexes(form.headerText), [form.headerText]);
  const formVariables = useMemo(() => variableIndexes(form.body), [form.body]);
  const sendVariables = useMemo(
    () => (sendTemplate ? variableIndexes(templateBody(sendTemplate)) : []),
    [sendTemplate],
  );
  const formVariableKey = formVariables.join(",");
  const sendVariableKey = sendVariables.join(",");

  useEffect(() => {
    setExamples(formVariables.map(() => ""));
  }, [formVariableKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setSendValues(sendVariables.map(() => ""));
    setRecipientPhone("");
  }, [sendTemplate?.id, sendVariableKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const resetCreateForm = () => {
    setForm({
      name: "",
      category: "UTILITY",
      language: "he",
      headerType: "NONE",
      headerText: "",
      headerExample: "",
      body: "",
      footer: "",
      withOptInButton: false,
    });
    setHeaderFile(null);
    setExamples([]);
  };

  const uploadHeaderMedia = async (file: File, headerType: Exclude<HeaderFormatOption, "NONE" | "TEXT">) => {
    const dataUrl = await readFileAsDataUrl(file);
    const { data, error } = await supabase.functions.invoke("meta-whatsapp-templates", {
      body: {
        action: "upload_media",
        tenant_id: tenantId,
        integration_id: integrationId,
        mime_type: file.type,
        file_name: file.name,
        file_base64: dataUrl,
      },
    });
    if (error) throw error;
    if (!data?.success || !data?.handle) throw new Error(data?.error || "העלאת הקובץ ל-Meta נכשלה");
    if (String(data.format) !== headerType) {
      throw new Error("סוג הקובץ לא תואם לסוג הכותרת שנבחר");
    }
    return String(data.handle);
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      let headerHandle = "";
      if (form.headerType === "IMAGE" || form.headerType === "VIDEO" || form.headerType === "DOCUMENT") {
        if (!headerFile) throw new Error("יש לבחור קובץ לכותרת");
        headerHandle = await uploadHeaderMedia(headerFile, form.headerType);
      }

      const { data, error } = await supabase.functions.invoke("meta-whatsapp-templates", {
        body: {
          action: "create",
          tenant_id: tenantId,
          integration_id: integrationId,
          template: {
            name: form.name,
            category: form.category,
            language: form.language,
            header_format: form.headerType,
            header_text: form.headerType === "TEXT" ? form.headerText : undefined,
            header_example: form.headerType === "TEXT" ? form.headerExample : undefined,
            header_handle: headerHandle || undefined,
            body_text: form.body,
            footer_text: form.footer,
            examples,
            ...(form.withOptInButton
              ? {
                  quick_replies: [
                    { text: "אני מאשר/ת קבלת לידים", payload: "LEAD_OPTIN_YES" },
                  ],
                }
              : {}),
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

  const headerMediaReady =
    form.headerType === "NONE" ||
    form.headerType === "TEXT" ||
    Boolean(headerFile);
  const headerTextReady =
    form.headerType !== "TEXT" ||
    (form.headerText.trim().length > 0 &&
      !hasInvalidVariableSyntax(form.headerText) &&
      formHeaderVariables.every((value, index) => value === index + 1) &&
      formHeaderVariables.length <= 1 &&
      (formHeaderVariables.length === 0 || Boolean(form.headerExample.trim())));
  const canCreate =
    /^[a-z0-9_]+$/.test(form.name) &&
    form.body.trim().length > 0 &&
    !hasInvalidVariableSyntax(form.body) &&
    !form.footer.includes("{{") &&
    !form.footer.includes("}}") &&
    formVariables.every((value, index) => value === index + 1) &&
    examples.length === formVariables.length &&
    examples.every(Boolean) &&
    headerMediaReady &&
    headerTextReady;
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
        <>
        {templatesQuery.data?.truncated && (
          <Alert className="mb-3">
            <AlertDescription>מוצגות 2,000 התבניות הראשונות. מחקו תבניות ישנות כדי להציג נוספות.</AlertDescription>
          </Alert>
        )}
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
              const canSendTemplate = template.status === "APPROVED" && supportsDirectSend(template);
              return (
                <TableRow key={template.id}>
                  <TableCell>
                    <div className="font-mono text-xs" dir="ltr">{template.name}</div>
                    {templateHeaderLabel(template) && (
                      <div className="mt-1 text-xs text-muted-foreground">
                        {templateHeaderLabel(template)}
                      </div>
                    )}
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
                        disabled={!canSendTemplate}
                        title={
                          template.status !== "APPROVED"
                            ? "ניתן לשלוח רק תבנית מאושרת"
                            : !supportsDirectSend(template)
                              ? "התבנית כוללת header עם משתנה, כפתורים לא נתמכים, או מדיה דינמית — שליחה מהירה אינה זמינה"
                              : undefined
                        }
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
        </>
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
            <div className="space-y-3 rounded-lg border p-4">
              <Label>כותרת (Header) — אופציונלי</Label>
              <Select
                value={form.headerType}
                onValueChange={(headerType) => {
                  setForm({ ...form, headerType: headerType as HeaderFormatOption, headerText: "", headerExample: "" });
                  setHeaderFile(null);
                }}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">ללא כותרת</SelectItem>
                  <SelectItem value="TEXT">טקסט</SelectItem>
                  <SelectItem value="IMAGE">תמונה</SelectItem>
                  <SelectItem value="VIDEO">וידאו</SelectItem>
                  <SelectItem value="DOCUMENT">PDF / מסמך</SelectItem>
                </SelectContent>
              </Select>

              {form.headerType === "TEXT" && (
                <div className="space-y-2">
                  <Input
                    value={form.headerText}
                    onChange={(event) => setForm({ ...form, headerText: event.target.value.slice(0, 60) })}
                    placeholder="ברוכים הבאים {{1}}"
                  />
                  <p className="text-xs text-muted-foreground">עד 60 תווים · משתנה אחד לכל היותר: {"{{1}}"}</p>
                  {hasInvalidVariableSyntax(form.headerText) && (
                    <p className="text-xs text-destructive">משתנה בכותרת חייב להיות {"{{1}}"} בלבד.</p>
                  )}
                  {formHeaderVariables.length === 1 && (
                    <div className="space-y-2">
                      <Label>דוגמה לכותרת {`{{1}}`}</Label>
                      <Input
                        value={form.headerExample}
                        onChange={(event) => setForm({ ...form, headerExample: event.target.value })}
                        placeholder="אלי"
                      />
                    </div>
                  )}
                </div>
              )}

              {(form.headerType === "IMAGE" || form.headerType === "VIDEO" || form.headerType === "DOCUMENT") && (
                <div className="space-y-2">
                  <Input
                    type="file"
                    accept={HEADER_MEDIA_ACCEPT[form.headerType]}
                    onChange={(event) => setHeaderFile(event.target.files?.[0] ?? null)}
                  />
                  <p className="text-xs text-muted-foreground">
                    {HEADER_MEDIA_HINT[form.headerType]} · הקובץ יועלה ל-Meta כדוגמה לאישור התבנית.
                  </p>
                  {headerFile && (
                    <p className="text-xs text-muted-foreground" dir="ltr">
                      {headerFile.name} ({Math.ceil(headerFile.size / 1024)} KB)
                    </p>
                  )}
                </div>
              )}
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
              {hasInvalidVariableSyntax(form.body) && (
                <p className="text-xs text-destructive">
                  משתנים חייבים להיות מספריים וברצף, למשל {"{{1}}"} ואז {"{{2}}"}.
                </p>
              )}
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
              {(form.footer.includes("{{") || form.footer.includes("}}")) && (
                <p className="text-xs text-destructive">שורת סיום אינה תומכת במשתנים.</p>
              )}
            </div>
            <div className="flex items-start gap-2 rounded-md border p-3">
              <Checkbox
                id="optin-quick-reply"
                checked={form.withOptInButton}
                onCheckedChange={(value) => setForm({ ...form, withOptInButton: value === true })}
              />
              <div className="space-y-1">
                <Label htmlFor="optin-quick-reply" className="font-normal">
                  הוסף כפתור אישור קבלת לידים (Quick Reply)
                </Label>
                <p className="text-xs text-muted-foreground">
                  טקסט הכפתור: «אני מאשר/ת קבלת לידים» · payload: LEAD_OPTIN_YES.
                  מומלץ לתבנית <code dir="ltr">lead_optin_confirm_he</code>.
                </p>
              </div>
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
              {templateHeaderLabel(sendTemplate) && (
                <div className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
                  כותרת: {templateHeaderLabel(sendTemplate)}
                </div>
              )}
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
