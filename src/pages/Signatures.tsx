import { useState, useRef, useCallback } from "react";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, FileText, Upload, Send, Eye, Trash2, CheckCircle, Clock, XCircle, Copy, ExternalLink } from "lucide-react";
import { format } from "date-fns";

interface Recipient {
  name: string;
  email: string;
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

export default function Signatures() {
  const { tenantId } = useCurrentTenant();
  const { userId } = useCurrentUser();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createTab, setCreateTab] = useState<"create" | "upload">("create");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [recipients, setRecipients] = useState<Recipient[]>([{ name: "", email: "" }]);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [selectedDoc, setSelectedDoc] = useState<any>(null);
  const [isViewOpen, setIsViewOpen] = useState(false);

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

  // Create document mutation
  const createMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId || !userId) throw new Error("Missing tenant or user");
      
      let fileUrl: string | null = null;
      const docType = createTab === "upload" ? "uploaded" : "created";

      // Upload file if needed
      if (createTab === "upload" && uploadFile) {
        const filePath = `${tenantId}/${Date.now()}_${uploadFile.name}`;
        const { error: uploadError } = await supabase.storage
          .from("signature-documents")
          .upload(filePath, uploadFile);
        if (uploadError) throw uploadError;
        
        const { data: urlData } = supabase.storage
          .from("signature-documents")
          .getPublicUrl(filePath);
        fileUrl = urlData.publicUrl;
      }

      // Create document
      const { data: doc, error: docError } = await supabase
        .from("signature_documents")
        .insert({
          tenant_id: tenantId,
          title,
          content: createTab === "create" ? content : null,
          file_url: fileUrl,
          document_type: docType,
          status: "draft",
          created_by: userId,
        })
        .select()
        .single();
      if (docError) throw docError;

      // Add recipients
      const validRecipients = recipients.filter(r => r.name && r.email);
      if (validRecipients.length > 0) {
        const { error: recError } = await supabase
          .from("signature_recipients")
          .insert(
            validRecipients.map((r, i) => ({
              document_id: doc.id,
              tenant_id: tenantId,
              name: r.name,
              email: r.email,
              sign_order: i + 1,
            }))
          );
        if (recError) throw recError;
      }

      return doc;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["signature-documents"] });
      toast.success("המסמך נוצר בהצלחה");
      resetForm();
      setIsCreateOpen(false);
    },
    onError: (err: any) => toast.error("שגיאה ביצירת מסמך: " + err.message),
  });

  // Send for signing
  const sendMutation = useMutation({
    mutationFn: async (docId: string) => {
      const { error } = await supabase
        .from("signature_documents")
        .update({ status: "pending" })
        .eq("id", docId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["signature-documents"] });
      toast.success("המסמך נשלח לחתימה");
    },
  });

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
      queryClient.invalidateQueries({ queryKey: ["signature-documents"] });
      toast.success("המסמך נמחק");
    },
  });

  const resetForm = () => {
    setTitle("");
    setContent("");
    setRecipients([{ name: "", email: "" }]);
    setUploadFile(null);
    setCreateTab("create");
  };

  const addRecipient = () => setRecipients([...recipients, { name: "", email: "" }]);
  const removeRecipient = (i: number) => setRecipients(recipients.filter((_, idx) => idx !== i));
  const updateRecipient = (i: number, field: keyof Recipient, val: string) => {
    const updated = [...recipients];
    updated[i][field] = val;
    setRecipients(updated);
  };

  const getSigningLink = (token: string) => {
    return `${window.location.origin}/sign/${token}`;
  };

  const copySigningLink = (token: string) => {
    navigator.clipboard.writeText(getSigningLink(token));
    toast.success("הקישור הועתק");
  };

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">חתימות דיגיטליות</h1>
          <p className="text-muted-foreground">ניהול מסמכים וחתימות דיגיטליות</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => { resetForm(); setIsCreateOpen(true); }}>
              <Plus className="h-4 w-4 ml-2" />
              מסמך חדש
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
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
                      accept=".pdf,.docx,.doc,.png,.jpg,.jpeg"
                      onChange={e => setUploadFile(e.target.files?.[0] || null)}
                      className="mt-1"
                    />
                    {uploadFile && (
                      <p className="text-sm text-muted-foreground mt-1">
                        קובץ נבחר: {uploadFile.name}
                      </p>
                    )}
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
                  <div key={i} className="flex gap-2 items-center">
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
                    />
                    {recipients.length > 1 && (
                      <Button variant="ghost" size="icon" onClick={() => removeRecipient(i)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex gap-2 justify-end pt-4">
                <Button variant="outline" onClick={() => setIsCreateOpen(false)}>ביטול</Button>
                <Button
                  onClick={() => createMutation.mutate()}
                  disabled={!title || createMutation.isPending || (createTab === "create" && !content) || (createTab === "upload" && !uploadFile)}
                >
                  {createMutation.isPending ? "יוצר..." : "צור מסמך"}
                </Button>
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
                      <TableCell className="font-medium">{doc.title}</TableCell>
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
                          {doc.status === "draft" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => sendMutation.mutate(doc.id)}
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
      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
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
                    <a href={selectedDoc.file_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-primary hover:underline">
                      <ExternalLink className="h-4 w-4" />
                      צפה בקובץ המקורי
                    </a>
                  </CardContent>
                </Card>
              )}

              {/* Recipients */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">חותמים</CardTitle>
                </CardHeader>
                <CardContent>
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
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className={r.status === "signed" ? "bg-green-100 text-green-800" : r.status === "declined" ? "bg-destructive/10 text-destructive" : "bg-yellow-100 text-yellow-800"}>
                              {r.status === "signed" ? "חתם" : r.status === "declined" ? "סירב" : "ממתין"}
                            </Badge>
                            {selectedDoc.status !== "draft" && r.sign_token && (
                              <Button variant="ghost" size="icon" onClick={() => copySigningLink(r.sign_token)}>
                                <Copy className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {selectedDoc.status === "draft" && (
                <div className="flex justify-end">
                  <Button onClick={() => { sendMutation.mutate(selectedDoc.id); setIsViewOpen(false); }}>
                    <Send className="h-4 w-4 ml-2" />
                    שלח לחתימה
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
