import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { parseDocumentFields, getFieldLabel, isSignatureFieldType } from "@/components/signatures/signatureFieldTypes";
import { toast } from "sonner";
import { Check, ChevronDown, Copy, ImagePlus, Mail, X } from "lucide-react";
import {
  copyFirstSigningLink,
  sendSignatureDocument,
  type SigningLinkResult,
} from "@/lib/signatureSend";
import { buildWhatsAppSignUrl, copySigningUrl } from "@/lib/signatureShare";
import SignatureContactPicker from "@/components/signatures/SignatureContactPicker";
import type { SignatureContactDetails } from "@/components/signatures/signatureContactUtils";
import { SignatureEmailColorFields, SignatureEmailPreview } from "@/components/signatures/SignatureEmailPreview";
import {
  DEFAULT_SIGNATURE_EMAIL_COLORS,
  resolveSignatureEmailColors,
  type SignatureEmailColors,
} from "../../../supabase/functions/_shared/signature-email-template.ts";
import { isFieldRequired } from "@/lib/signatureFieldGuide";

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

export interface SendSignatureDialogDoc {
  id: string;
  title: string;
  is_template?: boolean;
}

export interface SendSignatureDialogRecipient {
  name?: string;
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
}

export interface SendSignatureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  document: SendSignatureDialogDoc | null;
  tenantId?: string;
  defaultRecipient?: SendSignatureDialogRecipient;
  mode?: "direct" | "template";
  leadId?: string;
  clientId?: string;
  documentTitleOverride?: string;
  onSuccess?: (result: { signingLinks: SigningLinkResult[]; documentId: string }) => void;
}

/** Three independent actions — none depends on the others. */
const EMPTY_RECIPIENTS: { name: string; email: string }[] = [];

type SendAction = "copy" | "email" | "whatsapp";

export function SendSignatureDialog({
  open,
  onOpenChange,
  document: doc,
  tenantId,
  defaultRecipient,
  mode,
  leadId,
  clientId,
  documentTitleOverride,
  onSuccess,
}: SendSignatureDialogProps) {
  const queryClient = useQueryClient();
  const resolvedMode = mode ?? (doc?.is_template ? "template" : "direct");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState<SendAction | null>(null);
  const [links, setLinks] = useState<SigningLinkResult[]>([]);
  const [lastAction, setLastAction] = useState<SendAction | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const logoChoice = useRef<"auto" | "manual">("auto");
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [picked, setPicked] = useState<SignatureContactDetails | null>(null);
  const [fieldMap, setFieldMap] = useState<Record<string, string>>({});
  const [fieldRequired, setFieldRequired] = useState<Record<string, boolean>>({});
  const [fieldsOpen, setFieldsOpen] = useState(false);
  const [emailSubject, setEmailSubject] = useState("בקשה לחתימה: {{title}}");
  const [emailBody, setEmailBody] = useState("");
  const [emailColors, setEmailColors] = useState<SignatureEmailColors>(DEFAULT_SIGNATURE_EMAIL_COLORS);
  const [savingDefaults, setSavingDefaults] = useState(false);
  const emailDraftReady = useRef(false);
  const colorsReady = useRef(false);

  const { data: emailSettings } = useQuery({
    queryKey: ["signature-email-settings", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenant_settings")
        .select("setting_value")
        .eq("tenant_id", tenantId!)
        .eq("setting_key", "signature_email")
        .maybeSingle();
      if (error) throw error;
      return (data?.setting_value ?? null) as ({ logoUrl?: string | null } & Partial<SignatureEmailColors>) | null;
    },
    enabled: open && !!tenantId,
  });

  const { data: templateEmails } = useQuery({
    queryKey: ["signature-template-email", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenant_settings")
        .select("setting_value")
        .eq("tenant_id", tenantId!)
        .eq("setting_key", "signature_template_email")
        .maybeSingle();
      if (error) throw error;
      return (data?.setting_value ?? {}) as Record<string, { logoUrl?: string | null; subject?: string | null; body?: string | null }>;
    },
    enabled: open && !!tenantId && resolvedMode === "template",
  });
  const templateEmail = doc?.id ? templateEmails?.[doc.id] : undefined;

  const { data: brandLogo } = useQuery({
    queryKey: ["tenant-branding-logo", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenant_settings")
        .select("setting_value")
        .eq("tenant_id", tenantId!)
        .eq("setting_key", "branding")
        .maybeSingle();
      if (error) throw error;
      const settings = data?.setting_value as { logoUrl?: string } | null;
      return settings?.logoUrl || null;
    },
    enabled: open && !!tenantId,
  });

  const initializedDocument = useRef<string | null>(null);
  const preparedDocument = useRef<string | null>(null);
  const { data: existingRecipients = EMPTY_RECIPIENTS, isLoading: loadingRecipients } = useQuery({
    queryKey: ["signature-recipients-for-send", doc?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("signature_recipients")
        .select("name, email")
        .eq("document_id", doc!.id)
        .order("sign_order");
      if (error) throw error;
      return data;
    },
    enabled: open && !!doc?.id && resolvedMode === "direct" && !doc?.is_template,
  });

  const { data: documentFields = [] } = useQuery({
    queryKey: ["signature-doc-fields", doc?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("signature_documents")
        .select("document_fields")
        .eq("id", doc!.id)
        .single();
      if (error) throw error;
      return parseDocumentFields(data.document_fields);
    },
    enabled: open && !!doc?.id,
  });

  useEffect(() => {
    if (!open) {
      initializedDocument.current = null;
      preparedDocument.current = null;
      setLinks([]);
      setBusy(null);
      setLastAction(null);
      setLogoUrl(null);
      setPicked(null);
      logoChoice.current = "auto";
      emailDraftReady.current = false;
      colorsReady.current = false;
      return;
    }
    if (!doc?.id || loadingRecipients || initializedDocument.current === doc.id) return;
    initializedDocument.current = doc.id;
    preparedDocument.current = null;
    const existing = existingRecipients[0];
    setName(defaultRecipient?.name || existing?.name || "");
    setEmail(defaultRecipient?.email || existing?.email || "");
    setPhone(defaultRecipient?.phone || "");
    setLinks([]);
    setLastAction(null);
  }, [open, doc?.id, defaultRecipient?.name, defaultRecipient?.email, defaultRecipient?.phone, existingRecipients, loadingRecipients]);

  useEffect(() => {
    if (!open || logoChoice.current === "manual") return;
    setLogoUrl(emailSettings?.logoUrl || brandLogo || null);
  }, [open, doc?.id, brandLogo, emailSettings?.logoUrl]);

  useEffect(() => {
    if (!open) return;
    const fillable = documentFields.filter((field) => !isSignatureFieldType(field.type));
    setFieldMap(Object.fromEntries(fillable.map((field) => [
      field.id,
      field.type === "text" || field.type === "date" ? "none" : field.type,
    ])));
    setFieldRequired(Object.fromEntries(documentFields.map((field) => [field.id, isFieldRequired(field)])));
    setFieldsOpen(false);
  }, [open, doc?.id, documentFields]);

  useEffect(() => {
    if (!open) return;
    if (emailDraftReady.current || emailSettings === undefined) return;
    if (resolvedMode === "template" && templateEmails === undefined) return;
    emailDraftReady.current = true;
    setEmailSubject(templateEmail?.subject?.trim() || "בקשה לחתימה: {{title}}");
    setEmailBody(templateEmail?.body || "");
  }, [open, emailSettings, templateEmails, templateEmail, resolvedMode]);

  useEffect(() => {
    if (!open || colorsReady.current || emailSettings === undefined) return;
    colorsReady.current = true;
    setEmailColors(resolveSignatureEmailColors(emailSettings));
  }, [open, emailSettings]);

  const clearPrepared = () => { preparedDocument.current = null; setLinks([]); setLastAction(null); };

  const canAct = !!doc && !loadingRecipients && name.trim() && (email.trim() || phone.trim());
  const canEmail = !!(email.trim() || existingRecipients[0]?.email);
  const canWhatsApp = !!phone.trim();

  const runAction = async (action: SendAction) => {
    if (!doc) return;
    if (!name.trim()) {
      toast.error("הזן שם חותם");
      return;
    }
    if (!email.trim() && !phone.trim()) {
      toast.error("הזן אימייל או טלפון");
      return;
    }
    if (action === "email" && !canEmail) {
      toast.error("הזן אימייל לשליחה");
      return;
    }
    if (action === "whatsapp" && !canWhatsApp) {
      toast.error("הזן טלפון לוואטסאפ");
      return;
    }

    const signingEmail =
      email.trim() ||
      existingRecipients[0]?.email ||
      `${doc.id.replace(/-/g, "").slice(0, 12)}@sign.aios.local`;

    // Reserve the window during the click; mobile browsers block windows opened after network work.
    const whatsappWindow = action === "whatsapp" ? window.open("about:blank", "_blank") : null;
    if (whatsappWindow) whatsappWindow.opener = null;
    setBusy(action);
    try {
      const preparation = sendSignatureDocument({
        documentId: preparedDocument.current || doc.id,
        documentTitle: doc.title,
        isTemplate: doc.is_template,
        mode: preparedDocument.current ? "direct" : resolvedMode,
        sendEmail: action === "email",
        tenantId,
        recipient: {
          name: name.trim(),
          email: signingEmail,
          phone: phone.trim() || undefined,
        },
        contactDetails: {
          firstName: picked?.firstName || defaultRecipient?.firstName,
          lastName: picked?.lastName || defaultRecipient?.lastName,
          phone: phone.trim() || undefined,
          companyName: picked?.companyName,
          address: picked?.address,
          idNumber: picked?.idNumber,
        },
        fieldMap,
        fieldRequired,
        leadId: picked?.leadId || leadId,
        clientId: picked?.clientId || clientId,
        documentTitleOverride,
        logoUrl: logoChoice.current === "manual" ? logoUrl : logoUrl ?? undefined,
        emailSubject,
        emailBody,
        emailColors,
      });

      // Start clipboard work in the original user gesture, before awaiting the server.
      const copying = action === "copy" ? copySigningUrl(preparation.then((result) => {
        if (!result.signingLinks[0]?.url) throw new Error("לא נוצר קישור לחתימה");
        return result.signingLinks[0].url;
      })).then(() => true, () => false) : null;
      const result = await preparation;
      if (!result.signingLinks.length) throw new Error("לא נוצר קישור לחתימה");
      preparedDocument.current = result.documentId;
      setLinks(result.signingLinks);
      setLastAction(action);

      if (action === "copy") {
        if (await copying) toast.success("הקישור לחתימה הועתק");
        else toast.info("הקישור מוכן — לחץ על העתקה ליד הקישור למטה");
      } else if (action === "email") {
        if (result.emailSent) toast.success("נשלח לאימייל");
        else toast.warning("הכנה הצליחה — שליחת המייל נכשלה (אפשר להעתיק)");
      } else if (action === "whatsapp") {
        const link = result.signingLinks[0];
        const url = buildWhatsAppSignUrl({ phone, signingUrl: link.url, recipientName: link.name,
          documentTitle: documentTitleOverride || doc.title });
        if (url && whatsappWindow) whatsappWindow.location.replace(url);
        else {
          whatsappWindow?.close();
          toast.info("הקישור מוכן — לחץ על קישור הוואטסאפ למטה");
        }
      }

      onSuccess?.({ signingLinks: result.signingLinks, documentId: result.documentId });
    } catch (err) {
      whatsappWindow?.close();
      toast.error(err instanceof Error ? err.message : "שגיאה בשליחה");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="!flex !flex-col !gap-4 w-[calc(100vw-2rem)] max-w-5xl max-h-[90vh] overflow-hidden p-4 sm:p-6"
        dir="rtl"
      >
        <DialogHeader className="min-w-0 shrink-0 pr-6">
          <DialogTitle className="truncate text-base sm:text-lg">
            שליחה לחתימה — {doc?.title}
          </DialogTitle>
        </DialogHeader>

        <div className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-4">
          <div className="space-y-3 rounded-lg border p-3 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium">פרטי החותם</p>
              <SignatureContactPicker
                tenantId={tenantId}
                onSelect={(contact) => {
                  setPicked(contact);
                  setName(contact.name);
                  setEmail(contact.email);
                  setPhone(contact.phone || "");
                  clearPrepared();
                }}
              />
            </div>
            {picked?.sourceLabel && (
              <p className="text-xs text-primary">{picked.sourceLabel}</p>
            )}
            <div className="space-y-2 min-w-0">
              <Label>שם</Label>
              <Input
                value={name}
                onChange={(e) => { setName(e.target.value); clearPrepared(); }}
                disabled={!!busy}
                placeholder="שם החותם"
              />
            </div>
            <div className="space-y-2 min-w-0">
              <Label>אימייל</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); clearPrepared(); }}
                disabled={!!busy}
                placeholder="email@example.com"
                dir="ltr"
                className="text-left min-w-0"
              />
            </div>
            <div className="space-y-2 min-w-0">
              <Label>טלפון (לוואטסאפ)</Label>
              <Input
                value={phone}
                onChange={(e) => { setPhone(e.target.value); clearPrepared(); }}
                disabled={!!busy}
                placeholder="05..."
                dir="ltr"
                className="text-left min-w-0"
              />
            </div>
          </div>

          {documentFields.length > 0 && (
            <Collapsible open={fieldsOpen} onOpenChange={setFieldsOpen} className="rounded-lg border p-3 min-w-0">
              <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 text-sm font-medium">
                <span>מיפוי שדות ({documentFields.length})</span>
                <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${fieldsOpen ? "rotate-180" : ""}`} />
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-2 pt-3">
                {documentFields.map((field) => {
                  const signatureField = isSignatureFieldType(field.type);
                  return (
                    <div key={field.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 items-center">
                      <span className="text-sm truncate">{field.label || getFieldLabel(field.type)}</span>
                      <label className="flex items-center gap-1.5 text-xs whitespace-nowrap">
                        <Checkbox
                          checked={fieldRequired[field.id] === true}
                          disabled={!!busy}
                          onCheckedChange={(checked) => setFieldRequired((current) => ({ ...current, [field.id]: checked === true }))}
                        />
                        חובה
                      </label>
                      {!signatureField && (
                        <Select
                          value={fieldMap[field.id] || "none"}
                          onValueChange={(value) => setFieldMap((current) => ({ ...current, [field.id]: value }))}
                        >
                          <SelectTrigger className="col-span-2 h-8"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">בלי מילוי</SelectItem>
                            <SelectItem value="full_name">שם מלא</SelectItem>
                            <SelectItem value="first_name">שם פרטי</SelectItem>
                            <SelectItem value="last_name">שם משפחה</SelectItem>
                            <SelectItem value="company_name">חברה</SelectItem>
                            <SelectItem value="phone">טלפון</SelectItem>
                            <SelectItem value="email">אימייל</SelectItem>
                            <SelectItem value="address">כתובת</SelectItem>
                            <SelectItem value="id_number">ח.פ / ת.ז</SelectItem>
                            <SelectItem value="today">תאריך היום</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  );
                })}
              </CollapsibleContent>
            </Collapsible>
          )}

          <div className="space-y-2 rounded-lg border p-3 min-w-0">
            <p className="text-sm font-medium">לוגו במייל</p>
            {logoUrl ? (
              <div className="flex items-center gap-3">
                <img src={logoUrl} alt="" className="h-12 max-w-[140px] object-contain bg-white border rounded" />
                <Button type="button" size="sm" variant="ghost" disabled={!!busy} onClick={() => { logoChoice.current = "manual"; setLogoUrl(null); }}>
                  <X className="h-4 w-4" />
                  בלי לוגו
                </Button>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">המייל יישלח בלי לוגו</p>
            )}
            <div className="flex flex-wrap gap-2">
              {brandLogo && logoUrl !== brandLogo && (
                <Button type="button" size="sm" variant="outline" disabled={!!busy} onClick={() => { logoChoice.current = "manual"; setLogoUrl(brandLogo); }}>
                  לוגו המותג
                </Button>
              )}
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={!!busy || uploadingLogo || !tenantId}
                onClick={() => document.getElementById("signature-email-logo")?.click()}
              >
                <ImagePlus className="h-4 w-4" />
                {uploadingLogo ? "מעלה..." : "בחר לוגו"}
              </Button>
              <input
                id="signature-email-logo"
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="hidden"
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (!file || !tenantId) return;
                  if (!file.type.startsWith("image/") || file.size > 2 * 1024 * 1024) {
                    toast.error("יש להעלות תמונה עד 2MB");
                    return;
                  }
                  setUploadingLogo(true);
                  try {
                    const ext = file.name.split(".").pop() || "png";
                    const path = `${tenantId}/signature-email/${crypto.randomUUID()}.${ext}`;
                    const { error } = await supabase.storage.from("tenant-logos").upload(path, file, { upsert: false });
                    if (error) throw error;
                    const { data } = supabase.storage.from("tenant-logos").getPublicUrl(path);
                    logoChoice.current = "manual";
                    setLogoUrl(data.publicUrl);
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "העלאת הלוגו נכשלה");
                  } finally {
                    setUploadingLogo(false);
                  }
                }}
              />
            </div>
            <div className="space-y-2">
              <Label>נושא האימייל</Label>
              <Input value={emailSubject} onChange={(event) => setEmailSubject(event.target.value)} disabled={!!busy} />
            </div>
            <div className="space-y-2">
              <Label>גוף האימייל</Label>
              <div className="flex flex-wrap gap-1">
                {[
                  ["שם פרטי", "{{first_name}}"],
                  ["שם משפחה", "{{last_name}}"],
                  ["שם מלא", "{{name}}"],
                  ["חברה", "{{company}}"],
                  ["טלפון", "{{phone}}"],
                  ["אימייל", "{{email}}"],
                  ["כתובת", "{{address}}"],
                  ["ח.פ / ת.ז", "{{id_number}}"],
                  ["שם המסמך", "{{title}}"],
                  ["שולח", "{{sender}}"],
                ].map(([label, token]) => (
                  <Button
                    key={token}
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-xs"
                    disabled={!!busy}
                    onClick={() => setEmailBody((current) => `${current}${current && !current.endsWith(" ") ? " " : ""}${token}`)}
                  >
                    {label}
                  </Button>
                ))}
              </div>
              {picked && (
                <p className="text-xs text-muted-foreground">
                  {[picked.firstName && `שם פרטי: ${picked.firstName}`, picked.lastName && `שם משפחה: ${picked.lastName}`, picked.phone && `טלפון: ${picked.phone}`].filter(Boolean).join(" · ") || picked.name}
                </p>
              )}
              <Textarea value={emailBody} onChange={(event) => setEmailBody(event.target.value)} disabled={!!busy} rows={4} placeholder="היי {{first_name}}, מצורף מסמך לחתימה" />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label>צבעי המייל</Label>
                <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs" disabled={!!busy} onClick={() => setEmailColors(DEFAULT_SIGNATURE_EMAIL_COLORS)}>
                  איפוס
                </Button>
              </div>
              <SignatureEmailColorFields colors={emailColors} disabled={!!busy} onChange={setEmailColors} />
            </div>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={!!busy || savingDefaults || !tenantId || (resolvedMode === "template" && !doc?.id)}
              onClick={async () => {
                if (!tenantId) return;
                setSavingDefaults(true);
                try {
                  const { error: logoError } = await supabase.from("tenant_settings").upsert({
                    tenant_id: tenantId,
                    setting_key: "signature_email",
                    setting_value: { ...(emailSettings ?? {}), logoUrl, ...emailColors },
                  }, { onConflict: "tenant_id,setting_key" });
                  if (logoError) throw logoError;
                  if (resolvedMode === "template" && doc?.id) {
                    const { error } = await supabase.from("tenant_settings").upsert({
                      tenant_id: tenantId,
                      setting_key: "signature_template_email",
                      setting_value: {
                        ...(templateEmails ?? {}),
                        [doc.id]: { subject: emailSubject, body: emailBody },
                      },
                    }, { onConflict: "tenant_id,setting_key" });
                    if (error) throw error;
                    await queryClient.invalidateQueries({ queryKey: ["signature-template-email", tenantId] });
                  }
                  await queryClient.invalidateQueries({ queryKey: ["signature-email-settings", tenantId] });
                  toast.success(resolvedMode === "template" ? "הלוגו והצבעים נשמרו לסוכנות, והנושא והגוף לתבנית" : "הלוגו והצבעים נשמרו לסוכנות");
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "שמירת ההגדרות נכשלה");
                } finally {
                  setSavingDefaults(false);
                }
              }}
            >
              {savingDefaults ? "שומר..." : resolvedMode === "template" ? "שמור עיצוב לסוכנות ונוסח לתבנית" : "שמור עיצוב לסוכנות"}
            </Button>
          </div>

          <div className="grid gap-2 min-w-0">
            <p className="text-sm font-medium">בחר פעולה</p>

            <Button
              type="button"
              onClick={() => runAction("copy")}
              disabled={!canAct || !!busy}
              className="w-full"
            >
              {lastAction === "copy" && !busy ? (
                <Check className="h-4 w-4 ml-2 shrink-0" />
              ) : (
                <Copy className="h-4 w-4 ml-2 shrink-0" />
              )}
              {busy === "copy" ? "מעתיק קישור..." : "העתק קישור לחתימה"}
            </Button>

            <Button
              type="button"
              variant="secondary"
              onClick={() => runAction("email")}
              disabled={!canAct || !canEmail || !!busy}
              className="w-full"
            >
              <Mail className="h-4 w-4 ml-2 shrink-0" />
              {busy === "email" ? "שולח לאימייל..." : "שלח לאימייל"}
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={() => runAction("whatsapp")}
              disabled={!canAct || !canWhatsApp || !!busy}
              className="w-full text-green-700 border-green-200"
            >
              <WhatsAppIcon className="h-4 w-4 ml-2 shrink-0" />
              {busy === "whatsapp" ? "פותח וואטסאפ..." : "שלח לוואטסאפ"}
            </Button>
          </div>

          {links.length > 0 && (
            <div className="rounded-lg border border-green-200 bg-green-50/50 p-3 min-w-0">
              <p className="text-sm text-green-800 font-medium flex items-center gap-2">
                <Check className="h-4 w-4 shrink-0" />
                הקישור מוכן — אפשר להעתיק או לשלוח שוב בכל עת
              </p>
              {links.map((link) => <div key={link.url} className="mt-3 space-y-2">
                <p className="text-sm">{link.name}</p>
                <Input value={link.url} readOnly dir="ltr" aria-label="קישור לחתימה" onFocus={(event) => event.target.select()} />
                <div className="flex gap-3 items-center text-sm">
                  <Button type="button" size="sm" variant="outline" onClick={() => {
                    copyFirstSigningLink([link]).then(() => toast.success("הקישור הועתק"), () => toast.error("סמן והעתק את הקישור מהשדה"));
                  }}>העתקה</Button>
                  <a href={link.url} target="_blank" rel="noopener noreferrer" className="text-primary underline">פתח לחתימה</a>
                  {buildWhatsAppSignUrl({ phone, signingUrl: link.url, recipientName: link.name, documentTitle: doc?.title }) &&
                    <a href={buildWhatsAppSignUrl({ phone, signingUrl: link.url, recipientName: link.name, documentTitle: doc?.title })!}
                      target="_blank" rel="noopener noreferrer" className="text-green-700 underline">פתח וואטסאפ</a>}
                </div>
              </div>)}
              {links[0] && buildWhatsAppSignUrl({
                phone: links[0].phone ?? phone,
                signingUrl: links[0].url,
                recipientName: links[0].name,
                documentTitle: documentTitleOverride || doc?.title,
              }) && (
                <p className="text-xs text-muted-foreground mt-1 truncate">
                  חותם: {links[0].name}
                </p>
              )}
            </div>
          )}
        </div>
        <div className="min-w-0 lg:sticky lg:top-0">
          <SignatureEmailPreview
            colors={emailColors}
            logoUrl={logoUrl}
            subject={emailSubject}
            body={emailBody}
            vars={{
              name: name.trim() || picked?.name,
              title: documentTitleOverride || doc?.title,
              sender: "השולח",
              first_name: picked?.firstName || defaultRecipient?.firstName,
              last_name: picked?.lastName || defaultRecipient?.lastName,
              company: picked?.companyName,
              phone: phone.trim() || picked?.phone,
              email: email.trim() || picked?.email,
              address: picked?.address,
              id_number: picked?.idNumber,
            }}
          />
        </div>
        </div>
        </div>

        <Button
          type="button"
          variant="ghost"
          className="w-full shrink-0"
          onClick={() => onOpenChange(false)}
        >
          סגור
        </Button>
      </DialogContent>
    </Dialog>
  );
}
