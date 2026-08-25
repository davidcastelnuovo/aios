import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArchiveRestore, Trash2, ArrowRight, Search } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { he } from "date-fns/locale";
import {
  permanentlyDeleteArchivedLeads,
  restoreArchivedLeads,
} from "@/lib/leadArchive";
import { leadMatchesPhoneSearch, leadSearchOrFilter } from "@/lib/leadPhone";
import { PermanentDeleteLeadDialog } from "@/components/leads/PermanentDeleteLeadDialog";

export default function LeadsArchive() {
  const { tenantId } = useCurrentTenant();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [deleteIds, setDeleteIds] = useState<string[] | null>(null);

  const { data: leads = [], isLoading, refetch } = useQuery({
    queryKey: ["leads-archive", tenantId, search],
    enabled: !!tenantId,
    queryFn: async () => {
      if (!tenantId) return [];
      let query = supabase
        .from("leads")
        .select("id, contact_name, company_name, phone, email, status, campaign_name, archived_at, created_at")
        .eq("tenant_id", tenantId)
        .not("archived_at", "is", null)
        .order("archived_at", { ascending: false })
        .limit(500);
      const q = search.trim();
      if (q) {
        query = query.or(leadSearchOrFilter(q));
      }
      const { data, error } = await query;
      if (error) throw error;
      if (!q) return data || [];
      return (data || []).filter(
        (lead) =>
          leadMatchesPhoneSearch(lead.phone, q) ||
          (lead.contact_name || "").toLowerCase().includes(q.toLowerCase()) ||
          (lead.company_name || "").toLowerCase().includes(q.toLowerCase()) ||
          (lead.email || "").toLowerCase().includes(q.toLowerCase()) ||
          (lead.campaign_name || "").toLowerCase().includes(q.toLowerCase()),
      );
    },
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["leads-archive", tenantId] });
    queryClient.invalidateQueries({ queryKey: ["leads-kanban", tenantId] });
    queryClient.invalidateQueries({ queryKey: ["leads-table", tenantId] });
    queryClient.invalidateQueries({ queryKey: ["leads-count", tenantId] });
  };

  const restore = async (ids: string[]) => {
    setBusy(true);
    try {
      const n = await restoreArchivedLeads(ids);
      toast.success(n === 1 ? "הליד שוחזר ל-Pipeline" : `${n} לידים שוחזרו ל-Pipeline`);
      setSelected(new Set());
      invalidate();
      await refetch();
    } catch (error: any) {
      toast.error(error.message || "שגיאה בשחזור");
    } finally {
      setBusy(false);
    }
  };

  const permanentlyDelete = async (ids: string[]) => {
    setBusy(true);
    try {
      const n = await permanentlyDeleteArchivedLeads(ids);
      toast.success(n === 1 ? "הליד נמחק לצמיתות" : `${n} לידים נמחקו לצמיתות`);
      setSelected(new Set());
      setDeleteIds(null);
      invalidate();
      await refetch();
    } catch (error: any) {
      toast.error(error.message || "שגיאה במחיקה לצמיתות");
    } finally {
      setBusy(false);
    }
  };

  const allSelected = leads.length > 0 && selected.size === leads.length;

  return (
    <div className="container mx-auto p-6 space-y-6" dir="rtl">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">ארכיון לידים</h1>
          <p className="text-sm text-muted-foreground mt-1">
            לידים שהועברו מה-Pipeline. מחיקה לצמיתות דורשת אישור מפורש ונמחקת מהמסד.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link to="../leads" className="gap-2">
            <ArrowRight className="h-4 w-4" />
            חזרה ל-Pipeline
          </Link>
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="חיפוש לפי שם, טלפון או חברה..."
            className="pr-9"
          />
        </div>
        <Badge variant="secondary">{leads.length} בארכיון</Badge>
      </div>

      {selected.size > 0 && (
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" disabled={busy} onClick={() => restore(Array.from(selected))}>
            <ArchiveRestore className="h-4 w-4 ml-1" />
            שחזר ({selected.size})
          </Button>
          <Button
            size="sm"
            variant="destructive"
            disabled={busy}
            onClick={() => setDeleteIds(Array.from(selected))}
          >
            <Trash2 className="h-4 w-4 ml-1" />
            מחק לצמיתות ({selected.size})
          </Button>
        </div>
      )}

      <div className="border rounded-lg overflow-hidden bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={(checked) => {
                    if (checked) setSelected(new Set(leads.map((l) => l.id)));
                    else setSelected(new Set());
                  }}
                />
              </TableHead>
              <TableHead>איש קשר</TableHead>
              <TableHead>חברה</TableHead>
              <TableHead>טלפון</TableHead>
              <TableHead>נשמר בארכיון</TableHead>
              <TableHead className="w-[180px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                  טוען...
                </TableCell>
              </TableRow>
            ) : leads.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                  הארכיון ריק
                </TableCell>
              </TableRow>
            ) : (
              leads.map((lead) => (
                <TableRow key={lead.id}>
                  <TableCell>
                    <Checkbox
                      checked={selected.has(lead.id)}
                      onCheckedChange={(checked) => {
                        setSelected((prev) => {
                          const next = new Set(prev);
                          if (checked) next.add(lead.id);
                          else next.delete(lead.id);
                          return next;
                        });
                      }}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{lead.contact_name || "—"}</TableCell>
                  <TableCell>{lead.company_name || "—"}</TableCell>
                  <TableCell className="font-mono text-sm" dir="ltr">
                    {lead.phone || "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {lead.archived_at
                      ? format(new Date(lead.archived_at), "dd/MM/yyyy HH:mm", { locale: he })
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 justify-end">
                      <Button size="sm" variant="outline" disabled={busy} onClick={() => restore([lead.id])}>
                        שחזר
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        disabled={busy}
                        onClick={() => setDeleteIds([lead.id])}
                      >
                        מחק לצמיתות
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <PermanentDeleteLeadDialog
        open={!!deleteIds}
        count={deleteIds?.length || 0}
        onOpenChange={(open) => {
          if (!open) setDeleteIds(null);
        }}
        onConfirm={() => {
          if (deleteIds) return permanentlyDelete(deleteIds);
        }}
      />
    </div>
  );
}
