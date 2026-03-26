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
    setClientSearch("");
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
              <Popover open={clientPopoverOpen} onOpenChange={setClientPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className="w-full justify-between font-normal"
                  >
                    {clientId && clientId !== 'none'
                      ? clients.find((c) => c.id === clientId)?.name || 'לקוח נבחר'
                      : 'ללא שיוך - כל הלקוחות'}
                    <ChevronsUpDown className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <div className="flex items-center border-b px-3">
                    <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    <Input
                      placeholder="חפש לקוח..."
                      value={clientSearch}
                      onChange={(e) => setClientSearch(e.target.value)}
                      className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
                    />
                  </div>
                  <div className="max-h-[200px] overflow-y-auto p-1">
                    <button
                      type="button"
                      className="relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent"
                      onClick={() => { setClientId("none"); setClientPopoverOpen(false); setClientSearch(""); }}
                    >
                      <Check className={`ml-2 h-4 w-4 ${clientId === 'none' ? 'opacity-100' : 'opacity-0'}`} />
                      ללא שיוך - כל הלקוחות
                    </button>
                    {clients
                      .filter((c) => c.name.toLowerCase().includes(clientSearch.toLowerCase()))
                      .map((client) => (
                        <button
                          type="button"
                          key={client.id}
                          className="relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent"
                          onClick={() => { setClientId(client.id); setClientPopoverOpen(false); setClientSearch(""); }}
                        >
                          <Check className={`ml-2 h-4 w-4 ${clientId === client.id ? 'opacity-100' : 'opacity-0'}`} />
                          {client.name}
                        </button>
                      ))}
                    {clients.filter((c) => c.name.toLowerCase().includes(clientSearch.toLowerCase())).length === 0 && (
                      <p className="py-4 text-center text-sm text-muted-foreground">לא נמצאו לקוחות</p>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
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
