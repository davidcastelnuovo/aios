import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Upload, FileText, Trash2, CheckCircle2, Loader2, AlertCircle, Image as ImageIcon, ExternalLink } from "lucide-react";
import { format } from "date-fns";

type Invoice = any;

export function InvoiceIntakeTab() {
  const { tenantId } = useCurrentTenant();
  const qc = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: invoices, isLoading } = useQuery({
    queryKey: ["invoice-uploads", tenantId, statusFilter],
    queryFn: async () => {
      if (!tenantId) return [];
      let q = supabase
        .from("invoice_uploads")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });
      if (statusFilter !== "all") q = q.eq("status", statusFilter);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: suppliers } = useQuery({
    queryKey: ["accounting-suppliers-list", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("suppliers").select("id, name").eq("tenant_id", tenantId);
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: clients } = useQuery({
    queryKey: ["accounting-clients-list", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("id, name, agency_id").eq("tenant_id", tenantId);
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: agencies } = useQuery({
    queryKey: ["accounting-agencies-list", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("agencies").select("id, name").eq("tenant_id", tenantId);
      return data || [];
    },
    enabled: !!tenantId,
  });

  const handleFiles = async (files: FileList | null) => {
    if (!files || !tenantId) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const ext = file.name.split(".").pop() || "bin";
        const path = `${tenantId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error: upErr } = await supabase.storage.from("invoices").upload(path, file, {
          contentType: file.type,
          upsert: false,
        });
        if (upErr) throw upErr;

        const { data: row, error: insErr } = await supabase
          .from("invoice_uploads")
          .insert({
            tenant_id: tenantId,
            file_path: path,
            mime_type: file.type,
            status: "pending",
          })
          .select("id")
          .single();
        if (insErr) throw insErr;

        // Trigger extraction
        const { error: fnErr } = await supabase.functions.invoke("extract-invoice-data", {
          body: { invoice_id: row.id },
        });
        if (fnErr) {
          console.error("extract error", fnErr);
          toast.error(`שגיאה בזיהוי AI: ${file.name}`);
        }
      }
      toast.success("החשבוניות הועלו ונשלחו לזיהוי");
      qc.invalidateQueries({ queryKey: ["invoice-uploads"] });
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "שגיאה בהעלאה");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-6">
          <div
            className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary transition-colors cursor-pointer"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              handleFiles(e.dataTransfer.files);
            }}
            onClick={() => document.getElementById("invoice-file-input")?.click()}
          >
            <input
              id="invoice-file-input"
              type="file"
              accept="image/*,application/pdf"
              multiple
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
            {uploading ? (
              <div className="flex items-center justify-center gap-2 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                מעלה ומזהה...
              </div>
            ) : (
              <>
                <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                <p className="font-medium">גרור קבצים לכאן או לחץ להעלאה</p>
                <p className="text-sm text-muted-foreground mt-1">תמונות (JPG/PNG) או PDF</p>
              </>
            )}
          </div>

          <div className="flex items-center gap-3 mt-4">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">כל הסטטוסים</SelectItem>
                <SelectItem value="pending">בעיבוד</SelectItem>
                <SelectItem value="processed">זוהה - ממתין לשיוך</SelectItem>
                <SelectItem value="linked">נשמר כהוצאה</SelectItem>
                <SelectItem value="failed">נכשל</SelectItem>
              </SelectContent>
            </Select>
            <Badge variant="secondary">{invoices?.length || 0} חשבוניות</Badge>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}
        </div>
      ) : invoices && invoices.length > 0 ? (
        <div className="space-y-3">
          {invoices.map((inv) => (
            <InvoiceCard
              key={inv.id}
              invoice={inv}
              suppliers={suppliers || []}
              clients={clients || []}
              agencies={agencies || []}
              tenantId={tenantId!}
              onChanged={() => qc.invalidateQueries({ queryKey: ["invoice-uploads"] })}
            />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            עדיין לא נקלטו חשבוניות
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function InvoiceCard({
  invoice,
  suppliers,
  clients,
  agencies,
  tenantId,
  onChanged,
}: {
  invoice: Invoice;
  suppliers: any[];
  clients: any[];
  agencies: any[];
  tenantId: string;
  onChanged: () => void;
}) {
  const [form, setForm] = useState({
    vendor_name: invoice.vendor_name || "",
    invoice_date: invoice.invoice_date || "",
    total_amount: invoice.total_amount?.toString() || "",
    vat_amount: invoice.vat_amount?.toString() || "",
    description: invoice.description || "",
    supplier_id: invoice.supplier_id || "",
    client_id: invoice.client_id || "",
    agency_id: invoice.agency_id || "",
  });
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const openFile = async () => {
    if (signedUrl) {
      window.open(signedUrl, "_blank");
      return;
    }
    const { data } = await supabase.storage.from("invoices").createSignedUrl(invoice.file_path, 3600);
    if (data?.signedUrl) {
      setSignedUrl(data.signedUrl);
      window.open(data.signedUrl, "_blank");
    }
  };

  const saveAsExpense = async () => {
    if (!form.total_amount || !form.invoice_date) {
      toast.error("חובה למלא תאריך וסכום");
      return;
    }
    if (!form.agency_id && !form.client_id) {
      toast.error("יש לבחור סוכנות או לקוח");
      return;
    }
    setSaving(true);
    try {
      // Resolve agency from client if missing
      let agencyId = form.agency_id;
      if (!agencyId && form.client_id) {
        const c = clients.find((x) => x.id === form.client_id);
        agencyId = c?.agency_id || "";
      }
      if (!agencyId) {
        toast.error("חסרה סוכנות לשיוך ההוצאה");
        setSaving(false);
        return;
      }
      // finance.client_id is NOT NULL — fall back to a placeholder if needed
      let clientId = form.client_id;
      if (!clientId) {
        const { data: anyClient } = await supabase
          .from("clients")
          .select("id")
          .eq("tenant_id", tenantId)
          .eq("agency_id", agencyId)
          .limit(1)
          .maybeSingle();
        clientId = anyClient?.id || "";
      }
      if (!clientId) {
        toast.error("יש לבחור לקוח (אין לקוח ברירת מחדל לסוכנות)");
        setSaving(false);
        return;
      }

      const { data: fin, error: finErr } = await supabase
        .from("finance")
        .insert({
          tenant_id: tenantId,
          agency_id: agencyId,
          client_id: clientId,
          supplier_id: form.supplier_id || null,
          type: "expense",
          amount: Number(form.total_amount),
          date: form.invoice_date,
          category: "חשבונית",
          notes: `${form.vendor_name || ""}${form.description ? " — " + form.description : ""}`.trim(),
        })
        .select("id")
        .single();
      if (finErr) throw finErr;

      const { error: upErr } = await supabase
        .from("invoice_uploads")
        .update({
          vendor_name: form.vendor_name || null,
          invoice_date: form.invoice_date || null,
          total_amount: Number(form.total_amount),
          vat_amount: form.vat_amount ? Number(form.vat_amount) : null,
          description: form.description || null,
          supplier_id: form.supplier_id || null,
          client_id: form.client_id || null,
          agency_id: form.agency_id || agencyId,
          status: "linked",
          finance_id: fin.id,
        })
        .eq("id", invoice.id);
      if (upErr) throw upErr;

      toast.success("נשמר כהוצאה");
      onChanged();
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "שגיאה בשמירה");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!confirm("למחוק חשבונית זו?")) return;
    await supabase.storage.from("invoices").remove([invoice.file_path]);
    await supabase.from("invoice_uploads").delete().eq("id", invoice.id);
    toast.success("נמחק");
    onChanged();
  };

  const statusBadge = () => {
    switch (invoice.status) {
      case "pending":
        return <Badge variant="secondary"><Loader2 className="h-3 w-3 ml-1 animate-spin" />בעיבוד</Badge>;
      case "processed":
        return <Badge>זוהה</Badge>;
      case "linked":
        return <Badge variant="default" className="bg-green-600"><CheckCircle2 className="h-3 w-3 ml-1" />נשמר</Badge>;
      case "failed":
        return <Badge variant="destructive"><AlertCircle className="h-3 w-3 ml-1" />נכשל</Badge>;
      default:
        return <Badge variant="outline">{invoice.status}</Badge>;
    }
  };

  const isImage = (invoice.mime_type || "").startsWith("image/");
  const linked = invoice.status === "linked";

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={openFile}>
              {isImage ? <ImageIcon className="h-4 w-4 ml-1" /> : <FileText className="h-4 w-4 ml-1" />}
              פתח קובץ
              <ExternalLink className="h-3 w-3 mr-1" />
            </Button>
            {statusBadge()}
            <span className="text-xs text-muted-foreground">
              הועלה {format(new Date(invoice.created_at), "dd/MM/yyyy HH:mm")}
            </span>
          </div>
          <Button variant="ghost" size="sm" onClick={remove}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <Label className="text-xs">ספק (טקסט)</Label>
            <Input
              value={form.vendor_name}
              onChange={(e) => setForm({ ...form, vendor_name: e.target.value })}
              disabled={linked}
            />
          </div>
          <div>
            <Label className="text-xs">תאריך</Label>
            <Input
              type="date"
              value={form.invoice_date}
              onChange={(e) => setForm({ ...form, invoice_date: e.target.value })}
              disabled={linked}
            />
          </div>
          <div>
            <Label className="text-xs">סכום כולל</Label>
            <Input
              type="number"
              step="0.01"
              value={form.total_amount}
              onChange={(e) => setForm({ ...form, total_amount: e.target.value })}
              disabled={linked}
            />
          </div>
          <div>
            <Label className="text-xs">מע"מ</Label>
            <Input
              type="number"
              step="0.01"
              value={form.vat_amount}
              onChange={(e) => setForm({ ...form, vat_amount: e.target.value })}
              disabled={linked}
            />
          </div>
          <div className="md:col-span-2 lg:col-span-4">
            <Label className="text-xs">תיאור</Label>
            <Input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              disabled={linked}
            />
          </div>

          <div>
            <Label className="text-xs">שיוך לספק</Label>
            <Select
              value={form.supplier_id || "none"}
              onValueChange={(v) => setForm({ ...form, supplier_id: v === "none" ? "" : v })}
              disabled={linked}
            >
              <SelectTrigger><SelectValue placeholder="ללא" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">ללא</SelectItem>
                {suppliers.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">שיוך ללקוח</Label>
            <Select
              value={form.client_id || "none"}
              onValueChange={(v) => setForm({ ...form, client_id: v === "none" ? "" : v })}
              disabled={linked}
            >
              <SelectTrigger><SelectValue placeholder="ללא" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">ללא</SelectItem>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">שיוך לסוכנות</Label>
            <Select
              value={form.agency_id || "none"}
              onValueChange={(v) => setForm({ ...form, agency_id: v === "none" ? "" : v })}
              disabled={linked}
            >
              <SelectTrigger><SelectValue placeholder="ללא" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">ללא</SelectItem>
                {agencies.map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            {!linked && (
              <Button onClick={saveAsExpense} disabled={saving} className="w-full">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "שמור כהוצאה"}
              </Button>
            )}
          </div>
        </div>

        {invoice.error_message && (
          <p className="text-xs text-destructive mt-2">{invoice.error_message}</p>
        )}
      </CardContent>
    </Card>
  );
}
