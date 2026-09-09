import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Check, Copy, Mail } from "lucide-react";
import {
  copyFirstSigningLink,
  openWhatsAppForLinks,
  sendSignatureDocument,
  type SigningLinkResult,
} from "@/lib/signatureSend";
import { buildWhatsAppSignUrl } from "@/lib/signatureShare";

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
  const resolvedMode = mode ?? (doc?.is_template ? "template" : "direct");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState<SendAction | null>(null);
  const [links, setLinks] = useState<SigningLinkResult[]>([]);
  const [lastAction, setLastAction] = useState<SendAction | null>(null);

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

  useEffect(() => {
    if (!open) {
      setLinks([]);
      setBusy(null);
      setLastAction(null);
      return;
    }
    const existing = existingRecipients[0];
    setName(defaultRecipient?.name || existing?.name || "");
    setEmail(defaultRecipient?.email || existing?.email || "");
    setPhone(defaultRecipient?.phone || "");
    setLinks([]);
    setLastAction(null);
  }, [open, doc?.id, defaultRecipient, existingRecipients]);

  const canAct = !!doc && name.trim() && (email.trim() || phone.trim());
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

    setBusy(action);
    try {
      const result = await sendSignatureDocument({
        documentId: doc.id,
        documentTitle: doc.title,
        isTemplate: doc.is_template,
        mode: resolvedMode,
        sendEmail: action === "email",
        tenantId,
        recipient: {
          name: name.trim(),
          email: signingEmail,
          phone: phone.trim() || undefined,
        },
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
      setLastAction(action);

      if (action === "copy") {
        await copyFirstSigningLink(result.signingLinks);
        toast.success("הקישור לחתימה הועתק");
      } else if (action === "email") {
        if (result.emailSent) toast.success("נשלח לאימייל");
        else toast.warning("הכנה הצליחה — שליחת המייל נכשלה (אפשר להעתיק)");
      } else if (action === "whatsapp") {
        const { opened } = openWhatsAppForLinks(
          result.signingLinks,
          documentTitleOverride || doc.title,
        );
        if (opened === 0) toast.warning("לא נמצא מספר טלפון תקין לוואטסאפ");
        else toast.success("נפתח וואטסאפ עם קישור לחתימה");
      }

      onSuccess?.({ signingLinks: result.signingLinks, documentId: result.documentId });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "שגיאה בשליחה");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="!flex !flex-col !gap-4 w-[calc(100vw-2rem)] max-w-md max-h-[90vh] overflow-hidden p-4 sm:p-6"
        dir="rtl"
      >
        <DialogHeader className="min-w-0 shrink-0 pr-6">
          <DialogTitle className="truncate text-base sm:text-lg">
            שליחה לחתימה — {doc?.title}
          </DialogTitle>
        </DialogHeader>

        <div className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden space-y-4">
          <div className="space-y-3 rounded-lg border p-3 min-w-0">
            <p className="text-sm font-medium">פרטי החותם</p>
            <div className="space-y-2 min-w-0">
              <Label>שם</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="שם החותם"
              />
            </div>
            <div className="space-y-2 min-w-0">
              <Label>אימייל</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@example.com"
                dir="ltr"
                className="text-left min-w-0"
              />
            </div>
            <div className="space-y-2 min-w-0">
              <Label>טלפון (לוואטסאפ)</Label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="05..."
                dir="ltr"
                className="text-left min-w-0"
              />
            </div>
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
