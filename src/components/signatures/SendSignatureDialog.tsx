import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Copy, Mail, Send } from "lucide-react";
import {
  copyFirstSigningLink,
  openWhatsAppForLinks,
  sendSignatureDocument,
  type SigningLinkResult,
} from "@/lib/signatureSend";
import { buildWhatsAppSignUrl, copySigningUrl } from "@/lib/signatureShare";

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
  const resolvedMode = mode ?? (doc?.is_template ? "template" : "direct");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [sendEmail, setSendEmail] = useState(true);
  const [sendWhatsApp, setSendWhatsApp] = useState(false);
  const [sending, setSending] = useState(false);
  const [links, setLinks] = useState<SigningLinkResult[]>([]);
  const [done, setDone] = useState(false);

  const { data: existingRecipients = [] } = useQuery({
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

  const needsRecipientForm =
    resolvedMode === "template" ||
    !!doc?.is_template ||
    (resolvedMode === "direct" && existingRecipients.length === 0);

  useEffect(() => {
    if (!open) {
      setLinks([]);
      setDone(false);
      setSending(false);
      return;
    }
    const existing = existingRecipients[0];
    setName(defaultRecipient?.name || existing?.name || "");
    setEmail(defaultRecipient?.email || existing?.email || "");
    setPhone(defaultRecipient?.phone || "");
    setSendEmail(!!(defaultRecipient?.email || existing?.email));
    setSendWhatsApp(!!defaultRecipient?.phone && !defaultRecipient?.email);
    setLinks([]);
    setDone(false);
  }, [open, doc?.id, defaultRecipient, existingRecipients]);

  const canSubmit = !!doc && name.trim() && (email.trim() || phone.trim());

  const handleSend = async () => {
    if (!doc) return;
    if (!name.trim()) {
      toast.error("הזן שם חותם");
      return;
    }
    if (!email.trim() && !phone.trim()) {
      toast.error("הזן אימייל או טלפון");
      return;
    }

    const signingEmail =
      email.trim() || `${doc.id.replace(/-/g, "").slice(0, 12)}@sign.aios.local`;

    setSending(true);
    try {
      const result = await sendSignatureDocument({
        documentId: doc.id,
        documentTitle: doc.title,
        isTemplate: doc.is_template,
        mode: resolvedMode,
        sendEmail,
        tenantId,
        recipient: { name: name.trim(), email: signingEmail, phone: phone.trim() || undefined },
        contactDetails: {
          firstName: defaultRecipient?.firstName,
          lastName: defaultRecipient?.lastName,
          phone: phone.trim() || undefined,
        },
        leadId,
        clientId,
        documentTitleOverride,
      });

      setLinks(result.signingLinks);
      setDone(true);

      if (sendWhatsApp) {
        const { opened, skipped } = openWhatsAppForLinks(
          result.signingLinks,
          documentTitleOverride || doc.title,
        );
        if (opened === 0) toast.warning("לא נמצא מספר טלפון תקין לוואטסאפ");
        else if (skipped > 0) toast.warning("חלק מהחותמים ללא טלפון לוואטסאפ");
      }

      if (sendEmail && result.emailSent) toast.success("המייל נשלח");
      else if (sendEmail && !result.emailSent) {
        toast.warning("הקישור מוכן — שליחת המייל נכשלה (אפשר וואטסאפ/העתקה)");
      } else toast.success("הקישור לחתימה מוכן");

      if (result.partial) toast.warning("חלק מהמיילים לא נשלחו");

      onSuccess?.({ signingLinks: result.signingLinks, documentId: result.documentId });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "שגיאה בשליחה");
    } finally {
      setSending(false);
    }
  };

  const handleCopy = async (url: string) => {
    await copySigningUrl(url);
    toast.success("הקישור הועתק");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle>שליחה לחתימה — {doc?.title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {needsRecipientForm && (
            <div className="space-y-3 rounded-lg border p-3">
              <p className="text-sm font-medium">פרטי החותם</p>
              <div className="space-y-2">
                <Label>שם</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="שם החותם" />
              </div>
              <div className="space-y-2">
                <Label>אימייל</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@example.com"
                  dir="ltr"
                  className="text-left"
                />
              </div>
              <div className="space-y-2">
                <Label>טלפון (לוואטסאפ)</Label>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="05..."
                  dir="ltr"
                  className="text-left"
                />
              </div>
            </div>
          )}

          {!needsRecipientForm && existingRecipients.length > 0 && (
            <div className="rounded-lg border bg-muted/30 p-3 text-sm space-y-1">
              <p>
                <span className="text-muted-foreground">חותם:</span>{" "}
                {existingRecipients.map((r) => r.name).join(", ")}
              </p>
              <p dir="ltr" className="text-left text-muted-foreground">
                {existingRecipients.map((r) => r.email).join(", ")}
              </p>
            </div>
          )}

          <div className="space-y-2">
            <p className="text-sm font-medium">אופן שליחה</p>
            <div className="flex items-center gap-2">
              <Checkbox
                id="send-email"
                checked={sendEmail}
                onCheckedChange={(v) => setSendEmail(!!v)}
                disabled={!email.trim() && !existingRecipients[0]?.email}
              />
              <Label htmlFor="send-email" className="cursor-pointer flex items-center gap-1">
                <Mail className="h-4 w-4" />
                שלח באימייל
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="send-wa"
                checked={sendWhatsApp}
                onCheckedChange={(v) => setSendWhatsApp(!!v)}
                disabled={!phone.trim()}
              />
              <Label htmlFor="send-wa" className="cursor-pointer flex items-center gap-1">
                <WhatsAppIcon className="h-4 w-4 text-green-600" />
                שלח בוואטסאפ
              </Label>
            </div>
            <p className="text-xs text-muted-foreground">
              תמיד תוכל להעתיק את הקישור לחתימה — לפני או אחרי השליחה.
            </p>
          </div>

          {done && links.length > 0 && (
            <div className="rounded-lg border border-green-200 bg-green-50/50 p-3 space-y-2">
              <p className="text-sm font-medium text-green-800">קישור לחתימה</p>
              {links.map((link) => (
                <div key={link.url} className="space-y-2">
                  <p className="text-xs truncate text-muted-foreground" dir="ltr">{link.url}</p>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => handleCopy(link.url)}>
                      <Copy className="h-4 w-4 ml-1" />
                      העתק קישור
                    </Button>
                    {buildWhatsAppSignUrl({
                      phone: link.phone ?? phone,
                      signingUrl: link.url,
                      recipientName: link.name,
                      documentTitle: documentTitleOverride || doc?.title,
                    }) && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="text-green-700 border-green-200"
                        onClick={() => {
                          const wa = buildWhatsAppSignUrl({
                            phone: link.phone ?? phone,
                            signingUrl: link.url,
                            recipientName: link.name,
                            documentTitle: documentTitleOverride || doc?.title,
                          });
                          if (wa) window.open(wa, "_blank", "noopener,noreferrer");
                        }}
                      >
                        <WhatsAppIcon className="h-4 w-4 ml-1" />
                        וואטסאפ
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {done ? "סגור" : "ביטול"}
          </Button>
          {!done && (
            <Button onClick={handleSend} disabled={!canSubmit || sending}>
              <Send className="h-4 w-4 ml-2" />
              {sending ? "מכין קישור..." : "שלח לחתימה"}
            </Button>
          )}
          {done && links[0] && (
            <Button
              variant="secondary"
              onClick={async () => {
                await copyFirstSigningLink(links);
                toast.success("הקישור הועתק");
              }}
            >
              <Copy className="h-4 w-4 ml-2" />
              העתק קישור
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
