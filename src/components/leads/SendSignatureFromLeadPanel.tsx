import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantPath } from "@/hooks/useTenantPath";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { format } from "date-fns";
import { Download, FileSignature, FolderCheck, Plus, Save, Send } from "lucide-react";
import { splitContactName } from "@/components/signatures/signatureContactUtils";
import { SignatureLinkShareButtons } from "@/components/signatures/SignatureLinkShareButtons";
import { sanitizeFileName } from "@/lib/sanitizeFileName";
import { insertSignatureDocument } from "@/lib/insertSignatureDocument";
import { Pencil } from "lucide-react";
import { SendSignatureDialog } from "@/components/signatures/SendSignatureDialog";

interface LeadContact {
  id: string;
  contact_name?: string | null;
  company_name?: string | null;
  email?: string | null;
  phone?: string | null;
}

interface SendSignatureFromLeadPanelProps {
  lead: LeadContact;
  tenantId: string | undefined;
}

const statusLabels: Record<string, { label: string; color: string }> = {
  pending: { label: "ממתין לחתימה", color: "bg-yellow-100 text-yellow-800" },
  partially_signed: { label: "חתום חלקית", color: "bg-blue-100 text-blue-800" },
  completed: { label: "הושלם", color: "bg-green-100 text-green-800" },
  draft: { label: "טיוטה", color: "bg-muted text-muted-foreground" },
};

export function SendSignatureFromLeadPanel({ lead, tenantId }: SendSignatureFromLeadPanelProps) {
  const { buildPath } = useTenantPath();
  const { userId } = useCurrentUser();
  const queryClient = useQueryClient();
  const [sourceDocId, setSourceDocId] = useState("");
  const [documentTitle, setDocumentTitle] = useState("");
  const [lastLinks, setLastLinks] = useState<Array<{ name: string; email: string; url: string }>>([]);
  const [newDocTitle, setNewDocTitle] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [sendDialogOpen, setSendDialogOpen] = useState(false);

  const recipientName = lead.contact_name || lead.company_name || "";
  const recipientEmail = lead.email || "";
  const canSend = !!sourceDocId;
  const { firstName, lastName } = splitContactName(recipientName);

  const { data: sourceDocuments = [], isLoading: loadingSources, refetch: refetchSources } = useQuery({
    queryKey: ["signature-source-documents", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("signature_documents")
        .select("id, title, template_name, is_template, status, created_at, file_url")
        .eq("tenant_id", tenantId!)
        .eq("status", "draft")
        .not("file_url", "is", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const selectedSourceDoc = sourceDocuments.find((d) => d.id === sourceDocId);

  const { data: leadDocuments = [], refetch: refetchDocs } = useQuery({
    queryKey: ["lead-signature-documents", tenantId, lead.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("signature_documents")
        .select(`
          id, title, status, created_at, signed_file_url, saved_to_entity_at,
          signature_recipients(name, email, sign_token, status)
        `)
        .eq("tenant_id", tenantId!)
        .eq("lead_id", lead.id)
        .eq("is_template", false)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId && !!lead.id,
  });

  const saveDocMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId || !userId) throw new Error("חסר משתמש או דייר");
      if (!uploadFile) throw new Error("בחר קובץ להעלאה");
      if (!newDocTitle.trim()) throw new Error("הזן שם למסמך");

      const safeName = sanitizeFileName(uploadFile.name);
      const filePath = `${tenantId}/${Date.now()}_${safeName}`;
      const { error: uploadError } = await supabase.storage
        .from("signature-documents")
        .upload(filePath, uploadFile);
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("signature-documents").getPublicUrl(filePath);
      const doc = await insertSignatureDocument({
        tenant_id: tenantId,
        title: newDocTitle.trim(),
        file_url: urlData.publicUrl,
        document_type: "uploaded",
        status: "draft",
        created_by: userId,
        is_template: true,
        template_name: newDocTitle.trim(),
      });
      return doc.id;
    },
    onSuccess: (docId) => {
      setSourceDocId(docId);
      setUploadFile(null);
      refetchSources();
      queryClient.invalidateQueries({ queryKey: ["signature-templates", tenantId] });
      toast.success("המסמך נשמר — בחר אותו ושלח לחתימה");
    },
    onError: (err: Error) => toast.error(err.message || "שגיאה בשמירה"),
  });

  const getSigningUrl = (token: string) => `${window.location.origin}/sign/${token}`;

  const downloadSigned = async (doc: { signed_file_url: string | null; title: string }) => {
    if (!doc.signed_file_url) return;
    if (doc.signed_file_url.startsWith("http")) {
      window.open(doc.signed_file_url, "_blank");
      return;
    }
    const { data } = await supabase.storage
      .from("signature-documents")
      .createSignedUrl(doc.signed_file_url, 3600);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  return (
    <div className="space-y-4" dir="rtl">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileSignature className="h-4 w-4" />
            שמירה ושליחה לחתימה
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border bg-muted/30 p-3 text-sm space-y-1">
            <p><span className="text-muted-foreground">חותם:</span> {recipientName || "—"}</p>
            <p dir="ltr" className="text-left"><span className="text-muted-foreground" dir="rtl">אימייל:</span> {recipientEmail || "—"}</p>
            {lead.phone && <p><span className="text-muted-foreground">טלפון:</span> {lead.phone}</p>}
          </div>

          {/* Save new document */}
          <div className="rounded-lg border p-3 space-y-3">
            <p className="text-sm font-medium">שמור מסמך חדש</p>
            <div className="space-y-2">
              <Label>שם המסמך</Label>
              <Input
                value={newDocTitle}
                onChange={(e) => setNewDocTitle(e.target.value)}
                placeholder={lead.company_name ? `חוזה - ${lead.company_name}` : "שם המסמך..."}
              />
            </div>
            <div className="space-y-2">
              <Label>קובץ PDF / תמונה</Label>
              <Input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
              />
            </div>
            <Button
              variant="secondary"
              onClick={() => saveDocMutation.mutate()}
              disabled={!uploadFile || !newDocTitle.trim() || saveDocMutation.isPending}
            >
              <Save className="h-4 w-4 ml-2" />
              {saveDocMutation.isPending ? "שומר..." : "שמור מסמך"}
            </Button>
          </div>

          {!recipientEmail && !lead.phone && (
            <p className="text-sm text-destructive">יש להוסיף אימייל או טלפון לליד לפני שליחה לחתימה.</p>
          )}
          {!recipientEmail && lead.phone && (
            <p className="text-sm text-muted-foreground">אין אימייל לליד — השליחה תהיה בוואטסאפ בלבד.</p>
          )}

          <div className="space-y-2">
            <Label>מסמך לשליחה</Label>
            <Select value={sourceDocId} onValueChange={setSourceDocId} disabled={loadingSources}>
              <SelectTrigger>
                <SelectValue placeholder={loadingSources ? "טוען..." : "בחר מסמך שמור..."} />
              </SelectTrigger>
              <SelectContent>
                {sourceDocuments.length === 0 ? (
                  <SelectItem value="__none" disabled>אין מסמכים שמורים — העלה ושמור למעלה</SelectItem>
                ) : (
                  sourceDocuments.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.template_name || t.title}
                      {t.is_template ? " (תבנית)" : ""}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>כותרת לשליחה (אופציונלי)</Label>
            <Input
              value={documentTitle}
              onChange={(e) => setDocumentTitle(e.target.value)}
              placeholder="כותרת שתופיע במייל לחותם..."
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => setSendDialogOpen(true)}
              disabled={!canSend}
            >
              <Send className="h-4 w-4 ml-2" />
              שלח לחתימה
            </Button>
            {sourceDocId && (
              <Button variant="secondary" asChild>
                <Link to={buildPath(`signatures?edit=${sourceDocId}`)}>
                  <Pencil className="h-4 w-4 ml-2" />
                  ערוך שדות
                </Link>
              </Button>
            )}
            <Button variant="outline" asChild>
              <Link to={buildPath("signatures")}>
                <Plus className="h-4 w-4 ml-2" />
                ניהול מסמכים מתקדם
              </Link>
            </Button>
          </div>

          {lastLinks.length > 0 && (
            <div className="rounded-lg border p-3 space-y-3">
              <p className="text-sm font-medium">קישור לחתימה</p>
              {lastLinks.map((link) => (
                <div key={link.url} className="space-y-2">
                  <p className="text-xs text-muted-foreground truncate" dir="ltr">{link.url}</p>
                  <SignatureLinkShareButtons
                    size="sm"
                    signingUrl={link.url}
                    phone={lead.phone}
                    recipientName={link.name || recipientName}
                    documentTitle={documentTitle.trim() || undefined}
                  />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {leadDocuments.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">מסמכים שנשלחו לליד</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {leadDocuments.map((doc) => {
              const st = statusLabels[doc.status] || statusLabels.draft;
              const pendingRecipient = (doc.signature_recipients as Array<{ sign_token?: string; name?: string; status?: string }> | undefined)
                ?.find((r) => r.status === "pending" && r.sign_token);
              const signingUrl = pendingRecipient?.sign_token
                ? getSigningUrl(pendingRecipient.sign_token)
                : null;

              return (
                <div key={doc.id} className="flex items-center justify-between gap-2 p-2 border rounded-lg text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{doc.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(doc.created_at!), "dd/MM/yy HH:mm")}
                    </p>
                    {signingUrl && (
                      <div className="mt-2">
                        <SignatureLinkShareButtons
                          size="sm"
                          signingUrl={signingUrl}
                          phone={lead.phone}
                          recipientName={pendingRecipient?.name || recipientName}
                          documentTitle={doc.title}
                        />
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Badge className={st.color}>{st.label}</Badge>
                    {doc.status === "completed" && doc.signed_file_url && (
                      <Button variant="ghost" size="icon" onClick={() => downloadSigned(doc)} title="הורד PDF חתום">
                        <Download className="h-4 w-4" />
                      </Button>
                    )}
                    {doc.saved_to_entity_at && (
                      <span title="נשמר בתיק הליד"><FolderCheck className="h-4 w-4 text-green-600" /></span>
                    )}
                  </div>
                </div>
              );
            })}
            <p className="text-xs text-muted-foreground pt-1">
              מסמך חתום נשמר אוטומטית בטאב קבצים אחרי השלמת החתימה.
            </p>
          </CardContent>
        </Card>
      )}
      <SendSignatureDialog
        open={sendDialogOpen && !!selectedSourceDoc}
        onOpenChange={setSendDialogOpen}
        document={
          selectedSourceDoc
            ? { id: selectedSourceDoc.id, title: selectedSourceDoc.title, is_template: true }
            : null
        }
        tenantId={tenantId}
        mode="template"
        leadId={lead.id}
        documentTitleOverride={documentTitle.trim() || undefined}
        defaultRecipient={{
          name: recipientName || "חותם",
          email: recipientEmail || undefined,
          phone: lead.phone || undefined,
          firstName,
          lastName: lastName || lead.company_name || undefined,
        }}
        onSuccess={(result) => {
          setLastLinks(result.signingLinks);
          refetchDocs();
          queryClient.invalidateQueries({ queryKey: ["lead-detail", tenantId, lead.id] });
        }}
      />
    </div>
  );
}
