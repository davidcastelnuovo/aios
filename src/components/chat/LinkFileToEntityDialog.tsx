import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { User, Target } from "lucide-react";

interface UploadedFile {
  id: string;
  file_name: string;
  file_url: string;
}

interface LinkFileToEntityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  files: UploadedFile[];
  onLinked: () => void;
}

export function LinkFileToEntityDialog({ open, onOpenChange, tenantId, files, onLinked }: LinkFileToEntityDialogProps) {
  const [clientId, setClientId] = useState("");
  const [leadId, setLeadId] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: clients = [] } = useQuery({
    queryKey: ["clients-for-link", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("id, name").eq("tenant_id", tenantId).order("name");
      return data || [];
    },
    enabled: !!tenantId && open,
  });

  const { data: leads = [] } = useQuery({
    queryKey: ["leads-for-link", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("leads").select("id, company_name, contact_name").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(100);
      return data || [];
    },
    enabled: !!tenantId && open,
  });

  const handleLink = async () => {
    if (!clientId && !leadId) {
      onOpenChange(false);
      return;
    }
    setSaving(true);
    try {
      const updates: any = {};
      if (clientId && clientId !== "none") updates.client_id = clientId;
      if (leadId && leadId !== "none") updates.lead_id = leadId;

      for (const file of files) {
        await supabase.from("team_chat_files").update(updates).eq("id", file.id);
      }
      toast.success(`${files.length} קבצים שויכו בהצלחה`);
      onLinked();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>שייך קבצים ללקוח / ליד</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {files.length === 1 ? `קובץ: ${files[0].file_name}` : `${files.length} קבצים הועלו`}
          </p>

          <div>
            <Label className="flex items-center gap-1 text-sm"><User className="h-3.5 w-3.5" /> לקוח</Label>
            <Select value={clientId} onValueChange={(v) => { setClientId(v); if (v !== "none") setLeadId(""); }}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="בחר לקוח (אופציונלי)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">ללא</SelectItem>
                {clients.map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="flex items-center gap-1 text-sm"><Target className="h-3.5 w-3.5" /> ליד</Label>
            <Select value={leadId} onValueChange={(v) => { setLeadId(v); if (v !== "none") setClientId(""); }}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="בחר ליד (אופציונלי)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">ללא</SelectItem>
                {leads.map((l: any) => (
                  <SelectItem key={l.id} value={l.id}>{l.company_name || l.contact_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2 pt-2">
            <Button className="flex-1" onClick={handleLink} disabled={saving}>
              {saving ? "משייך..." : "שייך"}
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              דלג
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
