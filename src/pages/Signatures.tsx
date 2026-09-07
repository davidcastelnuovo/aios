import { useState, useRef, useCallback, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, FileText, Upload, Send, Eye, Trash2, CheckCircle, Clock, XCircle, Copy, ExternalLink, Link, Download, History, Pencil } from "lucide-react";
import { format } from "date-fns";
import SignatureFieldPlacer, { getRecipientColor, type SignaturePosition } from "@/components/signatures/SignatureFieldPlacer";
import { SignatureLinkShareButtons } from "@/components/signatures/SignatureLinkShareButtons";
import { type DocumentField, parseDocumentFields } from "@/components/signatures/signatureFieldTypes";
import SignatureContactPicker from "@/components/signatures/SignatureContactPicker";
import { buildFieldPrefill, type SignatureContactDetails } from "@/components/signatures/signatureContactUtils";
import { sanitizeFileName } from "@/lib/sanitizeFileName";
import { insertSignatureDocument } from "@/lib/insertSignatureDocument";
import { syncSignatureRecipientPosition, updateSignatureDocumentFields } from "@/lib/updateSignatureDocumentFields";
import { signatureDocumentStoragePath } from "@/lib/resolveSignatureDocumentUrl";
import { SignatureDocumentFieldEditor } from "@/components/signatures/SignatureDocumentFieldEditor";
import { SendSignatureDialog } from "@/components/signatures/SendSignatureDialog";
import { mediaKindFromFile } from "@/components/signatures/signatureDocumentMedia";
import { SignatureOriginalFileLink } from "@/components/signatures/SignatureOriginalFileLink";

interface Recipient {
  name: string;
  email: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  address?: string;
  idNumber?: string;
  contactSource?: string;
  signaturePosition: SignaturePosition | null;
}

const statusLabels: Record<string, { label: string; color: string }> = {
  draft: { label: "טיוטה", color: "bg-muted text-muted-foreground" },
  pending: { label: "ממתין לחתימה", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200" },
  partially_signed: { label: "חתום חלקית", color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" },
  completed: { label: "הושלם", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" },
  cancelled: { label: "בוטל", color: "bg-destructive/10 text-destructive" },
};

const statusIcons: Record<string, any> = {
  draft: FileText,
  pending: Clock,
  partially_signed: Clock,
  completed: CheckCircle,
  cancelled: XCircle,
};

const eventLabels: Record<string, string> = {
  sent: "נשלח במייל",
  viewed: "נצפה",
  signed: "חתם",
  declined: "סירב",
  pdf_generated: "PDF חתום נוצר",
};

export default function Signatures() {
  const { tenantId } = useCurrentTenant();
  const { userId } = useCurrentUser();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createTab, setCreateTab] = useState<"create" | "upload" | "url">("create");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [documentUrl, setDocumentUrl] = useState("");
  const [recipients, setRecipients] = useState<Recipient[]>([{ name: "", email: "", signaturePosition: null }]);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadPreviewUrl, setUploadPreviewUrl] = useState<string | null>(null);
  const [selectedDoc, setSelectedDoc] = useState<any>(null);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [showPlacement, setShowPlacement] = useState(false);
  const [isTemplate, setIsTemplate] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [documentFields, setDocumentFields] = useState<DocumentField[]>([]);
  const [lastSentLinks, setLastSentLinks] = useState<Array<{ name: string; email: string; url: string }>>([]);
  const skipDialogResetRef = useRef(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const [editingDoc, setEditingDoc] = useState<any>(null);
  const [sendDialogDoc, setSendDialogDoc] = useState<any>(null);
  const [sendDialogRecipient, setSendDialogRecipient] = useState<{
    name?: string;
    email?: string;
    phone?: string;
    firstName?: string;
    lastName?: string;
  } | undefined>();

  const canEditDocFields = (doc: { status: string; file_url?: string | null }) =>
    doc.status === "draft" && !!doc.file_url;

  const openFieldEditor = (doc: any) => {
    if (!canEditDocFields(doc)) {
      toast.error("עריכת שדות זמינה רק למסמכי טיוטה עם קובץ");
      return;
    }
    setEditingDoc(doc);
    setIsViewOpen(false);
  };

  const closeFieldEditor = () => setEditingDoc(null);

  // Fetch documents
  const { data: documents, isLoading } = useQuery({
    queryKey: ["signature-documents", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("signature_documents")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  // Fetch recipients for selected doc
  const { data: docRecipients } = useQuery({
    queryKey: ["signature-recipients", selectedDoc?.id],
    queryFn: async () => {
      if (!selectedDoc?.id) return [];
      const { data, error } = await supabase
        .from("signature_recipients")
        .select("*")
        .eq("document_id", selectedDoc.id)
        .order("sign_order");
      if (error) throw error;
      return data;
    },
    enabled: !!selectedDoc?.id,
  });

  // Fetch audit events for selected doc
  const { data: docEvents } = useQuery({
    queryKey: ["signature-events", selectedDoc?.id],
    queryFn: async () => {
      if (!selectedDoc?.id) return [];
      const { data, error } = await supabase
        .from("signature_events")
        .select("*, signature_recipients(name, email)")
        .eq("document_id", selectedDoc.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedDoc?.id,
  });

  const [signedPdfUrl, setSignedPdfUrl] = useState<string | null>(null);

  // Resolve signed PDF download URL
  useEffect(() => {
    if (!selectedDoc?.signed_file_url) {
      setSignedPdfUrl(null);
      return;
    }
    const path = selectedDoc.signed_file_url;
    if (path.startsWith("http")) {
      setSignedPdfUrl(path);
      return;
    }
    supabase.storage
      .from("signature-documents")
      .createSignedUrl(path, 3600)
      .then(({ data }) => setSignedPdfUrl(data?.signedUrl ?? null));
  }, [selectedDoc?.signed_file_url]);

  // Create document mutation
  const createMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId || !userId) throw new Error("Missing tenant or user");
      
      let fileUrl: string | null = null;
      let docType = "created";

      if (createTab === "upload" && uploadFile) {
        docType = "uploaded";
        const safeName = sanitizeFileName(uploadFile.name);
        const filePath = signatureDocumentStoragePath(tenantId, safeName);
        const { error: uploadError } = await supabase.storage
          .from("signature-documents")
          .upload(filePath, uploadFile);
        if (uploadError) throw uploadError;
        fileUrl = filePath;
      } else if (createTab === "url" && documentUrl) {
        docType = "uploaded";
        fileUrl = documentUrl;
      }

      const baseDoc = {
        tenant_id: tenantId,
        title,
        content: createTab === "create" ? content : null,
        file_url: fileUrl,
        document_type: docType,
        status: "draft",
        created_by: userId,
        is_template: isTemplate,
        template_name: isTemplate ? (templateName || title) : null,
      };

      const insertPayload = {
        ...baseDoc,
        ...(documentFields.length > 0 ? { document_fields: documentFields as any } : {}),
      };
      const doc = await insertSignatureDocument(insertPayload);

      const validRecipients = recipients.filter(r => r.name && r.email);
      if (validRecipients.length > 0) {
        const rows = validRecipients.map((r, i) => {
          const sigField = documentFields.find(
            (f) => f.type === "signature" && (f.recipient_index ?? 0) === i,
          );
          const position = sigField?.position ?? r.signaturePosition;
          const fieldPrefill = buildFieldPrefill(documentFields, i, r);
          return {
            document_id: doc!.id,
            tenant_id: tenantId,
            name: r.name,
            email: r.email,
            sign_order: i + 1,
            signature_position: position as any,
            field_values: fieldPrefill as any,
          };
        });

        let recError = (await supabase.from("signature_recipients").insert(rows)).error;
        if (recError?.message?.includes("field_values")) {
          recError = (await supabase.from("signature_recipients").insert(
            rows.map(({ field_values: _fv, ...rest }) => rest),
          )).error;
        }
        if (recError) throw recError;
      }

      return { doc, isTemplate };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["signature-documents", tenantId] });
    },
    onError: (err: any) => toast.error("שגיאה: " + err.message),
  });

  const handleSaveOnly = async () => {
    try {
      const result = await createMutation.mutateAsync();
      queryClient.invalidateQueries({ queryKey: ["signature-documents", tenantId] });
      toast.success(result.isTemplate ? "התבנית נשמרה" : "המסמך נשמר — מוכן לשליחה");
      setShowPlacement(false);
      resetForm();
      setIsCreateOpen(false);
    } catch {
      // errors handled in mutations
    }
  };

  const handleSaveOrSend = async () => {
    try {
      const result = await createMutation.mutateAsync();
      queryClient.invalidateQueries({ queryKey: ["signature-documents", tenantId] });

      if (result.isTemplate) {
        toast.success("התבנית נשמרה");
      } else {
        setShowPlacement(false);
        resetForm();
        setIsCreateOpen(false);
        openSendDialog({
          id: result.doc.id,
          title,
          is_template: false,
        }, recipients.find((r) => r.name || r.email));
        return;
      }

      setShowPlacement(false);
      resetForm();
      setIsCreateOpen(false);
    } catch {
      // errors handled in mutations
    }
  };

  const openSendDialog = (
    doc: any,
    recipient?: { name?: string; email?: string; phone?: string; firstName?: string; lastName?: string },
  ) => {
    setSelectedDoc(doc);
    setSendDialogDoc(doc);
    setSendDialogRecipient(
      recipient ??
      recipients.find((r) => r.name || r.email) ?? undefined,
    );
  };

  // Delete document
  const deleteMutation = useMutation({
    mutationFn: async (docId: string) => {
      const { error } = await supabase
        .from("signature_documents")
        .delete()
        .eq("id", docId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["signature-documents", tenantId] });
      toast.success("המסמך נמחק");
    },
  });

  const updateFieldsMutation = useMutation({
    mutationFn: async ({
      doc,
      fields,
      thenSend,
    }: {
      doc: { id: string; title: string; is_template?: boolean };
      fields: DocumentField[];
      thenSend?: boolean;
    }) => {
      await updateSignatureDocumentFields(doc.id, fields);
      await syncSignatureRecipientPosition(doc.id, fields);
      return { doc, thenSend: !!thenSend };
    },
    onSuccess: async ({ doc, thenSend }) => {
      queryClient.invalidateQueries({ queryKey: ["signature-documents", tenantId] });
      queryClient.invalidateQueries({ queryKey: ["signature-source-documents", tenantId] });
      toast.success(doc.is_template ? "התבנית נשמרה" : "המסמך נשמר — מוכן לשליחה");
      closeFieldEditor();

      if (thenSend && !doc.is_template) {
        const { data: recipients } = await supabase
          .from("signature_recipients")
          .select("name, email, phone")
          .eq("document_id", doc.id)
          .order("sign_order")
          .limit(1);

        openSendDialog(
          { id: doc.id, title: doc.title, is_template: false },
          recipients?.[0] ?? undefined,
        );
      }
    },
    onError: (err: Error) => toast.error(err.message || "שגיאה בשמירת שדות"),
  });

  const handleEditSaveOnly = async (fields: DocumentField[]) => {
    if (!editingDoc) return;
    try {
      await updateFieldsMutation.mutateAsync({
        doc: {
          id: editingDoc.id,
          title: editingDoc.title,
          is_template: editingDoc.is_template,
        },
        fields,
        thenSend: false,
      });
    } catch {
      // errors handled in mutation
    }
  };

  const handleEditSaveOrSend = async (fields: DocumentField[]) => {
    if (!editingDoc) return;
    try {
      await updateFieldsMutation.mutateAsync({
        doc: {
          id: editingDoc.id,
          title: editingDoc.title,
          is_template: editingDoc.is_template,
        },
        fields,
        thenSend: true,
      });
    } catch {
      // errors handled in mutation
    }
  };

  useEffect(() => {
    const editId = searchParams.get("edit");
    if (!editId || !documents?.length) return;
    const doc = documents.find((d) => d.id === editId);
    if (doc?.status === "draft" && doc.file_url) {
      setEditingDoc(doc);
      setIsViewOpen(false);
    }
    const next = new URLSearchParams(searchParams);
    next.delete("edit");
    setSearchParams(next, { replace: true });
  }, [documents, searchParams, setSearchParams]);

  const resetForm = () => {
    setTitle("");
    setContent("");
    setDocumentUrl("");
    setRecipients([{ name: "", email: "", signaturePosition: null }]);
    setUploadFile(null);
    setUploadPreviewUrl(null);
    setCreateTab("create");
    setShowPlacement(false);
    setIsTemplate(false);
    setTemplateName("");
    setDocumentFields([]);
  };

  const addRecipient = () => setRecipients([...recipients, { name: "", email: "", signaturePosition: null }]);
  const removeRecipient = (i: number) => setRecipients(recipients.filter((_, idx) => idx !== i));
  const updateRecipient = (i: number, field: "name" | "email", val: string) => {
    const updated = [...recipients];
    updated[i] = { ...updated[i], [field]: val };
    setRecipients(updated);
  };

  const applyContactToRecipient = (index: number, contact: SignatureContactDetails) => {
    const updated = [...recipients];
    updated[index] = {
      ...updated[index],
      name: contact.name,
      email: contact.email,
      phone: contact.phone,
      firstName: contact.firstName,
      lastName: contact.lastName,
      address: contact.address,
      idNumber: contact.idNumber,
      contactSource: contact.sourceLabel,
    };
    setRecipients(updated);
    toast.success("פרטי איש הקשר נטענו");
  };

  const handleFileChange = (file: File | null) => {
    setUploadFile(file);
    if (file) {
      const url = URL.createObjectURL(file);
      setUploadPreviewUrl(url);
    } else {
      setUploadPreviewUrl(null);
    }
  };

  const recipientIndexForPlacement = recipients
    .map((r, i) => ({ index: i, name: r.name, color: getRecipientColor(i) }))
    .filter((r) => r.name);

  // Get preview URL for placement
  const getPreviewUrl = (): string | null => {
    if (createTab === "upload" && uploadPreviewUrl) return uploadPreviewUrl;
    if (createTab === "url" && documentUrl) return documentUrl;
    return null;
  };

  const previewUrl = getPreviewUrl();
  const hasValidRecipients = recipients.some(r => r.name && r.email);
  const canShowPlacement = (createTab === "upload" || createTab === "url") && previewUrl && (isTemplate || hasValidRecipients);

  const getSigningLink = (token: string) => {
    return `${window.location.origin}/sign/${token}`;
  };

  const sendDialog = (
    <SendSignatureDialog
      open={!!sendDialogDoc}
      onOpenChange={(open) => {
        if (!open) {
          setSendDialogDoc(null);
          setSendDialogRecipient(undefined);
        }
      }}
      document={sendDialogDoc}
      tenantId={tenantId}
      defaultRecipient={sendDialogRecipient}
      mode={sendDialogDoc?.is_template ? "template" : "direct"}
      onSuccess={(result) => {
        setLastSentLinks(result.signingLinks);
        queryClient.invalidateQueries({ queryKey: ["signature-documents", tenantId] });
        queryClient.invalidateQueries({ queryKey: ["signature-events", result.documentId] });
      }}
    />
  );

  if (editingDoc?.file_url) {
    return (
      <>
        <SignatureDocumentFieldEditor
          title={editingDoc.title}
          fileUrl={editingDoc.file_url}
          initialFields={parseDocumentFields(editingDoc.document_fields)}
          isTemplate={editingDoc.is_template}
          saving={updateFieldsMutation.isPending}
          onClose={closeFieldEditor}
          onSave={handleEditSaveOnly}
          onSaveAndSend={handleEditSaveOrSend}
        />
        {sendDialog}
      </>
    );
  }

  // Full-screen placement overlay
  if (showPlacement && previewUrl) {
    const placementCanCreate =
      !!title.trim() &&
      !createMutation.isPending &&
      (createTab === "upload" ? !!uploadFile : createTab === "url" ? !!documentUrl : !!content) &&
      (isTemplate || hasValidRecipients);

    const placementActionLabel = isTemplate
      ? (createMutation.isPending ? "שומר..." : "שמור תבנית")
      : (createMutation.isPending ? "שולח..." : "שלח לחתימה");

    return (
      <div className="fixed inset-0 z-50 bg-background flex flex-col" dir="rtl">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b border-border bg-background">
          <div className="flex flex-col gap-2 min-w-[200px] flex-1">
            <h2 className="text-lg font-bold text-foreground">הגדרת שדות וחתימות</h2>
            <div className="flex items-center gap-2 max-w-md">
              <Label htmlFor="placement-title" className="shrink-0 text-sm">שם המסמך</Label>
              <Input
                id="placement-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="הזן שם למסמך..."
                className="h-9"
              />
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { setShowPlacement(false); setIsCreateOpen(true); }}>
                חזור
              </Button>
              <Button
                variant={isTemplate ? "default" : "secondary"}
                onClick={() => handleSaveOnly()}
                disabled={!placementCanCreate}
              >
                {createMutation.isPending
                  ? "שומר..."
                  : isTemplate
                    ? "שמור תבנית"
                    : "שמור מסמך"}
              </Button>
              {!isTemplate && hasValidRecipients && (
                <Button onClick={() => handleSaveOrSend()} disabled={!placementCanCreate}>
                  {placementActionLabel}
                </Button>
              )}
            </div>
            {!title.trim() && (
              <p className="text-xs text-destructive">נא למלא שם מסמך כדי להמשיך</p>
            )}
          </div>
        </div>
        {/* Placer content */}
        <div className="flex-1 overflow-auto p-4">
          <SignatureFieldPlacer
            fileUrl={previewUrl}
            mediaKind={createTab === "upload" ? mediaKindFromFile(uploadFile) : undefined}
            fullScreen
            recipients={recipientIndexForPlacement}
            fields={documentFields}
            onFieldsChange={setDocumentFields}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">חתימות דיגיטליות</h1>
          <p className="text-muted-foreground">ניהול מסמכים וחתימות דיגיטליות</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={(open) => {
          setIsCreateOpen(open);
          if (!open) {
            if (skipDialogResetRef.current) {
              skipDialogResetRef.current = false;
              return;
            }
            resetForm();
          }
        }}>
          <DialogTrigger asChild>
            <Button onClick={() => { resetForm(); setIsCreateOpen(true); }}>
              <Plus className="h-4 w-4 ml-2" />
              מסמך חדש
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" dir="rtl">
            <DialogHeader>
              <DialogTitle>יצירת מסמך חדש</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <Label>שם המסמך</Label>
                <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="הזן שם למסמך..." />
              </div>

              <Tabs value={createTab} onValueChange={v => setCreateTab(v as any)}>
                <TabsList className="w-full">
                  <TabsTrigger value="create" className="flex-1">
                    <FileText className="h-4 w-4 ml-2" />
                    יצירת מסמך
                  </TabsTrigger>
                  <TabsTrigger value="upload" className="flex-1">
                    <Upload className="h-4 w-4 ml-2" />
                    העלאת מסמך
                  </TabsTrigger>
                  <TabsTrigger value="url" className="flex-1">
                    <Link className="h-4 w-4 ml-2" />
                    קישור למסמך
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="create" className="space-y-3">
                  <div>
                    <Label>תוכן המסמך</Label>
                    <Textarea
                      value={content}
                      onChange={e => setContent(e.target.value)}
                      placeholder="הקלד את תוכן המסמך כאן..."
                      rows={10}
                      className="font-mono text-sm"
                    />
                  </div>
                </TabsContent>
                <TabsContent value="upload" className="space-y-3">
                  <div>
                    <Label>העלה קובץ (PDF, DOCX, תמונה)</Label>
                    <Input
                      type="file"
                      accept=".pdf,.png,.jpg,.jpeg"
                      onChange={e => handleFileChange(e.target.files?.[0] || null)}
                      className="mt-1"
                    />
                    {uploadFile && (
                      <p className="text-sm text-muted-foreground mt-1">
                        קובץ נבחר: {uploadFile.name}
                      </p>
                    )}
                  </div>
                </TabsContent>
                <TabsContent value="url" className="space-y-3">
                  <div>
                    <Label>קישור למסמך (PDF, תמונה)</Label>
                    <Input
                      value={documentUrl}
                      onChange={e => setDocumentUrl(e.target.value)}
                      placeholder="https://example.com/document.pdf"
                      dir="ltr"
                      className="text-left"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      הדבק קישור ישיר לקובץ PDF או תמונה
                    </p>
                  </div>
                </TabsContent>
              </Tabs>

              {/* Recipients */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-semibold">חותמים</Label>
                  <Button variant="outline" size="sm" onClick={addRecipient}>
                    <Plus className="h-3 w-3 ml-1" />
                    הוסף חותם
                  </Button>
                </div>
                {recipients.map((r, i) => (
                  <div key={i} className="space-y-2 p-3 border rounded-lg">
                    <div className="flex gap-2 items-center">
                      <div className="w-3 h-3 rounded flex-shrink-0" style={{ backgroundColor: getRecipientColor(i) }} />
                      <SignatureContactPicker
                        tenantId={tenantId}
                        onSelect={(contact) => applyContactToRecipient(i, contact)}
                      />
                      {recipients.length > 1 && (
                        <Button variant="ghost" size="icon" className="mr-auto" onClick={() => removeRecipient(i)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                    {r.contactSource && (
                      <p className="text-xs text-primary">{r.contactSource}</p>
                    )}
                    <div className="flex gap-2 items-center">
                      <Input
                        placeholder="שם"
                        value={r.name}
                        onChange={e => updateRecipient(i, "name", e.target.value)}
                        className="flex-1"
                      />
                      <Input
                        placeholder="אימייל"
                        type="email"
                        value={r.email}
                        onChange={e => updateRecipient(i, "email", e.target.value)}
                        className="flex-1"
                        dir="ltr"
                      />
                    </div>
                    {(r.phone || r.firstName || r.lastName) && (
                      <p className="text-xs text-muted-foreground">
                        {r.firstName && `שם: ${r.firstName}`}
                        {r.lastName && ` · משפחה: ${r.lastName}`}
                        {r.phone && ` · טלפון: ${r.phone}`}
                      </p>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2 p-3 border rounded-lg">
                <Checkbox
                  id="is-template"
                  checked={isTemplate}
                  onCheckedChange={(v) => setIsTemplate(!!v)}
                />
                <Label htmlFor="is-template" className="cursor-pointer">שמור כתבנית לשימוש חוזר (מלידים / אוטומציות)</Label>
              </div>
              {isTemplate && (
                <div>
                  <Label>שם התבנית</Label>
                  <Input
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    placeholder={title || "שם התבנית..."}
                  />
                </div>
              )}

              <div className="flex gap-2 justify-end pt-4">
                <Button variant="outline" onClick={() => setIsCreateOpen(false)}>ביטול</Button>
                {canShowPlacement && (
                  <Button
                    variant="secondary"
                    disabled={!title.trim()}
                    onClick={() => {
                      skipDialogResetRef.current = true;
                      setShowPlacement(true);
                      setIsCreateOpen(false);
                    }}
                  >
                    הגדר שדות וחתימות
                  </Button>
                )}
                <Button
                  variant="secondary"
                  onClick={async () => {
                    try {
                      await createMutation.mutateAsync();
                      toast.success(isTemplate ? "התבנית נשמרה" : "המסמך נשמר — מוכן לשליחה");
                      resetForm();
                      setIsCreateOpen(false);
                    } catch { /* toast in mutation */ }
                  }}
                  disabled={
                    !title ||
                    createMutation.isPending ||
                    (createTab === "create" && !content) ||
                    (createTab === "upload" && !uploadFile) ||
                    (createTab === "url" && !documentUrl)
                  }
                >
                  {createMutation.isPending ? "שומר..." : "שמור מסמך"}
                </Button>
                {!isTemplate && (
                <Button
                  onClick={async () => {
                    try {
                      const result = await createMutation.mutateAsync();
                      resetForm();
                      setIsCreateOpen(false);
                      openSendDialog({
                        id: result.doc.id,
                        title,
                        is_template: false,
                      }, recipients.find((r) => r.name || r.email));
                    } catch { /* toast in mutation */ }
                  }}
                  disabled={
                    !title ||
                    createMutation.isPending ||
                    (createTab === "create" && !content) ||
                    (createTab === "upload" && !uploadFile) ||
                    (createTab === "url" && !documentUrl)
                  }
                >
                  {createMutation.isPending ? "שומר..." : "שלח לחתימה"}
                </Button>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "סה\"כ מסמכים", count: documents?.length || 0, icon: FileText },
          { label: "ממתינים לחתימה", count: documents?.filter(d => d.status === "pending" || d.status === "partially_signed").length || 0, icon: Clock },
          { label: "הושלמו", count: documents?.filter(d => d.status === "completed").length || 0, icon: CheckCircle },
          { label: "טיוטות", count: documents?.filter(d => d.status === "draft").length || 0, icon: FileText },
        ].map((stat, i) => (
          <Card key={i}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <stat.icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stat.count}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Documents Table */}
      <Card>
        <CardHeader>
          <CardTitle>מסמכים</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-center text-muted-foreground py-8">טוען...</p>
          ) : !documents?.length ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">אין מסמכים עדיין</p>
              <p className="text-sm text-muted-foreground">לחץ על "מסמך חדש" כדי להתחיל</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">שם המסמך</TableHead>
                  <TableHead className="text-right">סוג</TableHead>
                  <TableHead className="text-right">סטטוס</TableHead>
                  <TableHead className="text-right">תאריך יצירה</TableHead>
                  <TableHead className="text-right">פעולות</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.map(doc => {
                  const status = statusLabels[doc.status] || statusLabels.draft;
                  const StatusIcon = statusIcons[doc.status] || FileText;
                  return (
                    <TableRow key={doc.id}>
                      <TableCell className="font-medium">
                        {doc.title}
                        {doc.is_template && (
                          <Badge variant="secondary" className="mr-2">תבנית</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {doc.document_type === "created" ? "נוצר" : "הועלה"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={status.color}>
                          <StatusIcon className="h-3 w-3 ml-1" />
                          {status.label}
                        </Badge>
                      </TableCell>
                      <TableCell>{format(new Date(doc.created_at), "dd/MM/yyyy HH:mm")}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => { setSelectedDoc(doc); setIsViewOpen(true); }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {canEditDocFields(doc) && (
                            <Button
                              variant="ghost"
                              size="icon"
                              title="ערוך שדות"
                              onClick={() => openFieldEditor(doc)}
                            >
                              <Pencil className="h-4 w-4 text-primary" />
                            </Button>
                          )}
                          {doc.status === "draft" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              title="שלח לחתימה"
                              onClick={() => openSendDialog(doc)}
                            >
                              <Send className="h-4 w-4 text-primary" />
                            </Button>
                          )}
                          {doc.status === "draft" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteMutation.mutate(doc.id)}
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
        </CardContent>
      </Card>

      {/* View Document Dialog */}
      <Dialog open={isViewOpen} onOpenChange={(open) => { setIsViewOpen(open); if (!open) setLastSentLinks([]); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle>{selectedDoc?.title}</DialogTitle>
          </DialogHeader>
          {selectedDoc && (
            <div className="space-y-4">
              {/* Document Content */}
              {selectedDoc.document_type === "created" && selectedDoc.content && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">תוכן המסמך</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="whitespace-pre-wrap text-sm bg-muted/50 p-4 rounded-lg max-h-60 overflow-y-auto">
                      {selectedDoc.content}
                    </div>
                  </CardContent>
                </Card>
              )}

              {selectedDoc.document_type === "uploaded" && selectedDoc.file_url && (
                <Card>
                  <CardContent className="p-4">
                    <SignatureOriginalFileLink fileUrl={selectedDoc.file_url} />
                  </CardContent>
                </Card>
              )}

              {selectedDoc.status === "completed" && !signedPdfUrl && (
                <Card>
                  <CardContent className="p-4 text-sm text-muted-foreground">
                    המסמך סומן כחתום — PDF חתום עדיין לא זמין. רענן בעוד רגע.
                  </CardContent>
                </Card>
              )}

              {selectedDoc.status === "completed" && signedPdfUrl && (
                <Card>
                  <CardContent className="p-4">
                    <a href={signedPdfUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-primary hover:underline">
                      <Download className="h-4 w-4" />
                      הורד מסמך חתום (PDF)
                    </a>
                  </CardContent>
                </Card>
              )}

              {selectedDoc.document_fields && parseDocumentFields(selectedDoc.document_fields).length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">שדות במסמך</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {parseDocumentFields(selectedDoc.document_fields).map((f) => (
                        <Badge key={f.id} variant="outline">{f.label}</Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Recipients */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">חותמים</CardTitle>
                </CardHeader>
                <CardContent>
                  {lastSentLinks.length > 0 && (
                    <div className="mb-4 rounded-lg border border-green-200 bg-green-50/50 p-3 space-y-2">
                      <p className="text-sm font-medium text-green-800">קישורים לחתימה</p>
                      {lastSentLinks.map((link) => (
                        <div key={link.url} className="space-y-2">
                          <p className="text-xs text-muted-foreground truncate" dir="ltr">{link.url}</p>
                          <SignatureLinkShareButtons
                            size="sm"
                            signingUrl={link.url}
                            recipientName={link.name}
                            documentTitle={selectedDoc?.title}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                  {!docRecipients?.length ? (
                    <p className="text-sm text-muted-foreground">אין חותמים</p>
                  ) : (
                    <div className="space-y-3">
                      {docRecipients.map((r: any) => (
                        <div key={r.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex items-center gap-3">
                            <div>
                              <p className="font-medium text-sm">{r.name}</p>
                              <p className="text-xs text-muted-foreground">{r.email}</p>
                              {r.signature_position && (
                                <p className="text-xs text-primary">📍 שדות מוגדרים</p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className={r.status === "signed" ? "bg-green-100 text-green-800" : r.status === "declined" ? "bg-destructive/10 text-destructive" : "bg-yellow-100 text-yellow-800"}>
                              {r.status === "signed" ? "חתם" : r.status === "declined" ? "סירב" : "ממתין"}
                            </Badge>
                            {selectedDoc.status !== "draft" && r.sign_token && (
                              <>
                                <SignatureLinkShareButtons
                                  signingUrl={getSigningLink(r.sign_token)}
                                  recipientName={r.name}
                                  documentTitle={selectedDoc.title}
                                />
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Audit trail */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <History className="h-4 w-4" />
                    יומן פעילות
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {!docEvents?.length ? (
                    <p className="text-sm text-muted-foreground">אין אירועים עדיין</p>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {docEvents.map((ev: any) => (
                        <div key={ev.id} className="flex items-center justify-between text-sm border-b pb-2 last:border-0">
                          <div>
                            <span className="font-medium">{eventLabels[ev.event_type] || ev.event_type}</span>
                            {ev.signature_recipients?.name && (
                              <span className="text-muted-foreground"> — {ev.signature_recipients.name}</span>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(ev.created_at), "dd/MM/yy HH:mm")}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {selectedDoc.status === "draft" && canEditDocFields(selectedDoc) && (
                <div className="flex justify-end gap-2">
                  <Button variant="secondary" onClick={() => openFieldEditor(selectedDoc)}>
                    <Pencil className="h-4 w-4 ml-2" />
                    ערוך שדות
                  </Button>
                  {!selectedDoc.is_template && (
                    <Button onClick={() => { openSendDialog(selectedDoc); setIsViewOpen(false); }}>
                      <Send className="h-4 w-4 ml-2" />
                      שלח לחתימה
                    </Button>
                  )}
                  {selectedDoc.is_template && (
                    <Button onClick={() => { openSendDialog(selectedDoc); setIsViewOpen(false); }}>
                      <Send className="h-4 w-4 ml-2" />
                      שלח לחתימה מתבנית
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {sendDialog}
    </div>
  );
}
