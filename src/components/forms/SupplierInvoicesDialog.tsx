import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Upload, Sparkles, Trash2, Download, Phone, Mail, Loader2 } from "lucide-react";
import { format } from "date-fns";

interface SupplierInvoicesDialogProps {
  supplier: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SupplierInvoicesDialog({ supplier, open, onOpenChange }: SupplierInvoicesDialogProps) {
  const { tenantId } = useCurrentTenant();
  const queryClient = useQueryClient();
  
  const [file, setFile] = useState<File | null>(null);
  const [invoiceName, setInvoiceName] = useState("");
  const [invoiceAmount, setInvoiceAmount] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [invoiceMonth, setInvoiceMonth] = useState(format(new Date(), "yyyy-MM"));
  const [notes, setNotes] = useState("");
  const [isExtracting, setIsExtracting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const { data: invoices, isLoading } = useQuery({
    queryKey: ["supplier-invoices", supplier?.id, tenantId],
    queryFn: async () => {
      if (!tenantId || !supplier?.id) return [];
      const { data, error } = await supabase
        .from("supplier_invoices")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("supplier_id", supplier.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: open && !!tenantId && !!supplier?.id,
  });

  const deleteMutation = useMutation({
    mutationFn: async (invoiceId: string) => {
      const { error } = await supabase
        .from("supplier_invoices")
        .delete()
        .eq("id", invoiceId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supplier-invoices", supplier?.id] });
      toast.success("החשבונית נמחקה");
    },
    onError: () => toast.error("שגיאה במחיקת חשבונית"),
  });

  const handleExtractAI = async () => {
    if (!file) {
      toast.error("נא לבחור קובץ תחילה");
      return;
    }
    setIsExtracting(true);
    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(",")[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const { data, error } = await supabase.functions.invoke("extract-invoice-data", {
        body: { file_base64: base64, file_type: file.type },
      });

      if (error) throw error;
      if (data?.invoice_name) setInvoiceName(data.invoice_name);
      if (data?.invoice_amount) setInvoiceAmount(String(data.invoice_amount));
      toast.success("הנתונים חולצו בהצלחה!");
    } catch (e: any) {
      console.error(e);
      toast.error("שגיאה בקריאת החשבונית: " + (e.message || ""));
    } finally {
      setIsExtracting(false);
    }
  };

  const handleSaveInvoice = async () => {
    if (!invoiceName || !invoiceAmount || !tenantId) {
      toast.error("נא למלא שם חשבונית וסכום");
      return;
    }
    setIsUploading(true);
    try {
      let fileUrl: string | null = null;
      let fileName: string | null = null;

      if (file) {
        const ext = file.name.split(".").pop();
        const path = `${tenantId}/${supplier.id}/${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("supplier-invoices")
          .upload(path, file);
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage.from("supplier-invoices").getPublicUrl(path);
        fileUrl = urlData.publicUrl;
        fileName = file.name;
      }

      const { error } = await supabase.from("supplier_invoices").insert({
        tenant_id: tenantId,
        supplier_id: supplier.id,
        invoice_name: invoiceName,
        invoice_amount: parseFloat(invoiceAmount),
        invoice_date: invoiceDate || null,
        invoice_month: invoiceMonth,
        file_url: fileUrl,
        file_name: fileName,
        ai_extracted: isExtracting ? false : !!file,
        notes: notes || null,
      });
      if (error) throw error;

      toast.success("החשבונית נשמרה בהצלחה!");
      queryClient.invalidateQueries({ queryKey: ["supplier-invoices", supplier?.id] });
      // Reset form
      setFile(null);
      setInvoiceName("");
      setInvoiceAmount("");
      setNotes("");
      setInvoiceDate(format(new Date(), "yyyy-MM-dd"));
      setInvoiceMonth(format(new Date(), "yyyy-MM"));
    } catch (e: any) {
      toast.error("שגיאה בשמירת חשבונית: " + (e.message || ""));
    } finally {
      setIsUploading(false);
    }
  };

  const total = invoices?.reduce((sum, inv) => sum + Number(inv.invoice_amount || 0), 0) || 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle>ניהול חשבוניות - {supplier?.name}</DialogTitle>
        </DialogHeader>

        {/* Supplier info */}
        <div className="flex gap-4 text-sm text-muted-foreground border-b pb-3">
          {supplier?.phone && (
            <span className="flex items-center gap-1">
              <Phone className="h-3.5 w-3.5" />
              <span dir="ltr">{supplier.phone}</span>
            </span>
          )}
          {supplier?.email && (
            <span className="flex items-center gap-1">
              <Mail className="h-3.5 w-3.5" />
              {supplier.email}
            </span>
          )}
        </div>

        {/* Upload new invoice */}
        <div className="space-y-3 border rounded-lg p-4 bg-muted/30">
          <h4 className="font-semibold text-sm">העלאת חשבונית חדשה</h4>
          
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <Label className="text-xs">קובץ חשבונית</Label>
              <Input
                type="file"
                accept="image/*,.pdf"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="text-sm"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExtractAI}
              disabled={!file || isExtracting}
            >
              {isExtracting ? <Loader2 className="h-4 w-4 animate-spin ml-1" /> : <Sparkles className="h-4 w-4 ml-1" />}
              קרא עם AI
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">שם החשבונית</Label>
              <Input value={invoiceName} onChange={(e) => setInvoiceName(e.target.value)} placeholder="שם/תיאור" />
            </div>
            <div>
              <Label className="text-xs">סכום</Label>
              <Input type="number" value={invoiceAmount} onChange={(e) => setInvoiceAmount(e.target.value)} placeholder="0" />
            </div>
            <div>
              <Label className="text-xs">תאריך חשבונית</Label>
              <Input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">חודש דיווח</Label>
              <Input type="month" value={invoiceMonth} onChange={(e) => setInvoiceMonth(e.target.value)} />
            </div>
          </div>

          <div>
            <Label className="text-xs">הערות</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="הערות..." />
          </div>

          <Button onClick={handleSaveInvoice} disabled={isUploading || !invoiceName || !invoiceAmount} className="w-full">
            {isUploading ? <Loader2 className="h-4 w-4 animate-spin ml-1" /> : <Upload className="h-4 w-4 ml-1" />}
            שמור חשבונית
          </Button>
        </div>

        {/* Invoices table */}
        <div className="space-y-2">
          <h4 className="font-semibold text-sm">חשבוניות קיימות</h4>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">טוען...</p>
          ) : invoices && invoices.length > 0 ? (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>שם חשבונית</TableHead>
                    <TableHead>סכום</TableHead>
                    <TableHead>תאריך</TableHead>
                    <TableHead>חודש</TableHead>
                    <TableHead>קובץ</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((inv) => (
                    <TableRow key={inv.id}>
                      <TableCell className="font-medium">
                        {inv.invoice_name}
                        {inv.ai_extracted && <Badge variant="secondary" className="mr-1 text-[10px]">AI</Badge>}
                      </TableCell>
                      <TableCell>₪{Number(inv.invoice_amount).toLocaleString()}</TableCell>
                      <TableCell>{inv.invoice_date ? format(new Date(inv.invoice_date), "dd/MM/yyyy") : "-"}</TableCell>
                      <TableCell>{inv.invoice_month || "-"}</TableCell>
                      <TableCell>
                        {inv.file_url ? (
                          <a href={inv.file_url} target="_blank" rel="noopener noreferrer">
                            <Download className="h-4 w-4 text-primary hover:text-primary/80" />
                          </a>
                        ) : "-"}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            if (confirm("למחוק חשבונית זו?")) deleteMutation.mutate(inv.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="flex justify-between items-center pt-2 border-t font-semibold text-sm">
                <span>סה"כ</span>
                <span>₪{total.toLocaleString()}</span>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">אין חשבוניות עדיין</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
