import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, FileText, Check, AlertCircle, Sparkles, Download, X } from "lucide-react";
import { toast } from "sonner";

interface InvoiceResult {
  messageId: string;
  subject?: string;
  from?: string;
  fromEmail?: string;
  filename?: string;
  fileUrl?: string | null;
  invoiceName?: string;
  invoiceAmount?: number;
  invoiceDate?: string | null;
  invoiceMonth?: string;
  aiExtracted?: boolean;
  matchedSupplierId?: string | null;
  matchedSupplierName?: string | null;
  error?: string;
  skipped?: boolean;
  // UI state
  selectedSupplierId?: string;
  saved?: boolean;
}

interface ProcessInvoicesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  messageIds: string[];
}

export function ProcessInvoicesDialog({ open, onOpenChange, messageIds }: ProcessInvoicesDialogProps) {
  const { tenantId } = useCurrentTenant();
  const [results, setResults] = useState<InvoiceResult[]>([]);
  const [processing, setProcessing] = useState(false);
  const [saving, setSaving] = useState(false);

  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers-for-invoices", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("suppliers")
        .select("id, name, email")
        .eq("tenant_id", tenantId!)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: open && !!tenantId,
  });

  const processMutation = useMutation({
    mutationFn: async () => {
      setProcessing(true);
      const { data, error } = await supabase.functions.invoke("process-invoice-emails", {
        body: { messageIds, tenantId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      const items = (data.results || []).map((r: InvoiceResult) => ({
        ...r,
        selectedSupplierId: r.matchedSupplierId || "",
        saved: false,
      }));
      setResults(items);
      const valid = items.filter((r: InvoiceResult) => !r.error && !r.skipped);
      const skipped = items.filter((r: InvoiceResult) => r.skipped);
      toast.success(`נמצאו ${valid.length} חשבוניות${skipped.length ? `, ${skipped.length} בלי קבצים מצורפים` : ""}`);
    },
    onError: (e: any) => {
      toast.error("שגיאה בעיבוד: " + (e.message || ""));
    },
    onSettled: () => setProcessing(false),
  });

  const handleProcess = () => {
    setResults([]);
    processMutation.mutate();
  };

  const updateResult = (index: number, updates: Partial<InvoiceResult>) => {
    setResults(prev => prev.map((r, i) => i === index ? { ...r, ...updates } : r));
  };

  const handleSaveAll = async () => {
    const toSave = results.filter(r => !r.error && !r.skipped && !r.saved && r.selectedSupplierId);
    if (toSave.length === 0) {
      toast.error("אין חשבוניות לשמירה. וודא ששייכת ספק לכל חשבונית.");
      return;
    }

    setSaving(true);
    let savedCount = 0;
    for (const r of toSave) {
      try {
        const { error } = await supabase.from("supplier_invoices").insert({
          tenant_id: tenantId!,
          supplier_id: r.selectedSupplierId!,
          invoice_name: r.invoiceName || r.filename || "חשבונית",
          invoice_amount: r.invoiceAmount || 0,
          invoice_date: r.invoiceDate || null,
          invoice_month: r.invoiceMonth || new Date().toISOString().substring(0, 7),
          file_url: r.fileUrl || null,
          file_name: r.filename || null,
          ai_extracted: r.aiExtracted || false,
          notes: `מקור: ${r.from || ""} | נושא: ${r.subject || ""}`,
        });
        if (!error) {
          const idx = results.indexOf(r);
          if (idx >= 0) updateResult(idx, { saved: true });
          savedCount++;
        }
      } catch (e) {
        console.error("Save error:", e);
      }
    }
    setSaving(false);
    toast.success(`${savedCount} חשבוניות נשמרו בהצלחה!`);
  };

  const validResults = results.filter(r => !r.error && !r.skipped);
  const skippedResults = results.filter(r => r.skipped);
  const errorResults = results.filter(r => r.error && !r.skipped);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            עיבוד חשבוניות מאימיילים
          </DialogTitle>
        </DialogHeader>

        {results.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <FileText className="h-16 w-16 text-muted-foreground" />
            <p className="text-sm text-muted-foreground text-center">
              {messageIds.length} אימיילים נבחרו לעיבוד.
              <br />
              הסוכן ישלוף קבצים מצורפים, יחלץ נתונים עם AI, ויתאים לספקים.
            </p>
            <Button onClick={handleProcess} disabled={processing} size="lg">
              {processing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin me-2" />
                  מעבד...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 me-2" />
                  התחל עיבוד
                </>
              )}
            </Button>
          </div>
        ) : (
          <>
            <ScrollArea className="flex-1 max-h-[60vh]">
              {validResults.length > 0 && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">#</TableHead>
                      <TableHead>שם חשבונית</TableHead>
                      <TableHead className="w-24">סכום</TableHead>
                      <TableHead>שולח</TableHead>
                      <TableHead className="w-48">ספק</TableHead>
                      <TableHead className="w-16">קובץ</TableHead>
                      <TableHead className="w-16">סטטוס</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {validResults.map((r, i) => {
                      const globalIdx = results.indexOf(r);
                      return (
                        <TableRow key={i} className={r.saved ? "opacity-60" : ""}>
                          <TableCell className="text-muted-foreground text-xs">{i + 1}</TableCell>
                          <TableCell>
                            <Input
                              value={r.invoiceName || ""}
                              onChange={(e) => updateResult(globalIdx, { invoiceName: e.target.value })}
                              className="h-8 text-sm"
                              disabled={r.saved}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              value={r.invoiceAmount || ""}
                              onChange={(e) => updateResult(globalIdx, { invoiceAmount: parseFloat(e.target.value) || 0 })}
                              className="h-8 text-sm w-24"
                              disabled={r.saved}
                            />
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground truncate max-w-[150px]">
                            {r.fromEmail || r.from || "-"}
                          </TableCell>
                          <TableCell>
                            {r.saved ? (
                              <span className="text-sm">{suppliers.find(s => s.id === r.selectedSupplierId)?.name || "-"}</span>
                            ) : (
                              <Select
                                value={r.selectedSupplierId || ""}
                                onValueChange={(v) => updateResult(globalIdx, { selectedSupplierId: v })}
                              >
                                <SelectTrigger className="h-8 text-sm">
                                  <SelectValue placeholder="בחר ספק..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {suppliers.map((s) => (
                                    <SelectItem key={s.id} value={s.id}>
                                      {s.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          </TableCell>
                          <TableCell>
                            {r.fileUrl ? (
                              <a href={r.fileUrl} target="_blank" rel="noopener noreferrer">
                                <Download className="h-4 w-4 text-primary" />
                              </a>
                            ) : "-"}
                          </TableCell>
                          <TableCell>
                            {r.saved ? (
                              <Check className="h-4 w-4 text-green-500" />
                            ) : r.aiExtracted ? (
                              <Badge variant="secondary" className="text-[10px]">AI</Badge>
                            ) : null}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}

              {skippedResults.length > 0 && (
                <div className="p-3 border-t">
                  <p className="text-xs text-muted-foreground mb-1">
                    <AlertCircle className="h-3 w-3 inline me-1" />
                    {skippedResults.length} אימיילים בלי קבצים מצורפים (דולגו)
                  </p>
                </div>
              )}

              {errorResults.length > 0 && (
                <div className="p-3 border-t">
                  <p className="text-xs text-destructive mb-1">
                    <X className="h-3 w-3 inline me-1" />
                    {errorResults.length} שגיאות בעיבוד
                  </p>
                </div>
              )}
            </ScrollArea>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>סגור</Button>
              <Button
                onClick={handleSaveAll}
                disabled={saving || validResults.filter(r => !r.saved && r.selectedSupplierId).length === 0}
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin me-2" />
                ) : (
                  <Check className="h-4 w-4 me-2" />
                )}
                שמור {validResults.filter(r => !r.saved && r.selectedSupplierId).length} חשבוניות
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
