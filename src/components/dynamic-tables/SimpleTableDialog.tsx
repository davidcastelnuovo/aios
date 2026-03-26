import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useTenantPath } from "@/hooks/useTenantPath";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";

interface SimpleTableDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SimpleTableDialog({ open, onOpenChange }: SimpleTableDialogProps) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { buildPath } = useTenantPath();
  const { tenantId } = useCurrentTenant();
  const [tableName, setTableName] = useState("");
  const [category, setCategory] = useState("");
  const [agencyId, setAgencyId] = useState<string>("none");
  const [clientId, setClientId] = useState<string>("none");
  const [clientSearch, setClientSearch] = useState("");
  const [clientPopoverOpen, setClientPopoverOpen] = useState(false);

  // Fetch agencies
  const { data: agencies = [] } = useQuery({
    queryKey: ['agencies', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from('agencies')
        .select('id, name')
        .eq('tenant_id', tenantId)
        .order('name');
      if (error) throw error;
      return data || [];
    },
    enabled: open && !!tenantId,
  });

  // Fetch clients based on selected agency
  const { data: clients = [] } = useQuery({
    queryKey: ['clients-for-table', agencyId],
    queryFn: async () => {
      if (!agencyId) return [];
      const { data, error } = await supabase
        .from('clients')
        .select('id, name')
        .eq('agency_id', agencyId)
        .order('name');
      if (error) throw error;
      return data || [];
    },
    enabled: open && !!agencyId,
  });

  // Reset client when agency changes
  useEffect(() => {
    setClientId("none");
  }, [agencyId]);

  const createMutation = useMutation({
    mutationFn: async (name: string) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const slug = name
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9\-\u0590-\u05FF]/g, '');

      const response = await supabase.functions.invoke('crm-tables', {
        method: 'POST',
        body: { 
          name, 
          slug, 
          description: '', 
          category: category || null,
          agency_id: agencyId && agencyId !== 'none' ? agencyId : null,
          client_id: clientId && clientId !== 'none' ? clientId : null,
        },
      });

      if (response.error) throw response.error;
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['crm-tables'] });
      toast.success('הטבלה נוצרה בהצלחה');
      handleClose();
      navigate(buildPath(`/table/${data.slug}`));
    },
    onError: (error: any) => {
      toast.error('שגיאה ביצירת הטבלה: ' + error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tableName.trim()) {
      toast.error('נא למלא את שם הטבלה');
      return;
    }
    createMutation.mutate(tableName);
  };

  const handleClose = () => {
    setTableName("");
    setCategory("");
    setAgencyId("");
    setClientId("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>טבלה חדשה</DialogTitle>
          <DialogDescription>
            צור טבלה חדשה לניהול נתונים
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="table-name">שם הטבלה</Label>
            <Input
              id="table-name"
              value={tableName}
              onChange={(e) => setTableName(e.target.value)}
              placeholder="לדוגמה: פרויקטים, משימות..."
              dir="rtl"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="category">קבוצה (אופציונלי)</Label>
            <Input
              id="category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="לדוגמה: דוחות, ניהול..."
              dir="rtl"
            />
          </div>
          <div className="space-y-2">
            <Label>שיוך לסוכנות (אופציונלי)</Label>
            <Select value={agencyId} onValueChange={setAgencyId}>
              <SelectTrigger>
                <SelectValue placeholder="ללא שיוך - כל הסוכנויות" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">ללא שיוך - כל הסוכנויות</SelectItem>
                {agencies.map((agency) => (
                  <SelectItem key={agency.id} value={agency.id}>
                    {agency.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {agencyId && agencyId !== 'none' && (
            <div className="space-y-2">
              <Label>שיוך ללקוח (אופציונלי)</Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger>
                  <SelectValue placeholder="ללא שיוך - כל הלקוחות" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">ללא שיוך - כל הלקוחות</SelectItem>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              ביטול
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'יוצר...' : 'צור טבלה'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
