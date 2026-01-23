import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { ChevronsUpDown, Check, Facebook, ShoppingCart, FileSpreadsheet } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { useNavigate } from "react-router-dom";
import { useTenantPath } from "@/hooks/useTenantPath";

interface CreateDashboardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateDashboardDialog({ open, onOpenChange }: CreateDashboardDialogProps) {
  const navigate = useNavigate();
  const { buildPath } = useTenantPath();
  const queryClient = useQueryClient();
  const { tenantId } = useCurrentTenant();
  
  const [name, setName] = useState("");
  const [agencyId, setAgencyId] = useState<string>("");
  const [clientId, setClientId] = useState<string>("");
  const [clientPopoverOpen, setClientPopoverOpen] = useState(false);

  // Fetch agencies
  const { data: agencies = [] } = useQuery({
    queryKey: ['agencies', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from('agencies')
        .select('id, name')
        .eq('tenant_id', tenantId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  // Fetch clients filtered by agency
  const { data: allClients = [] } = useQuery({
    queryKey: ['clients-all', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from('clients')
        .select('id, name, agency_id');
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  const filteredClients = useMemo(() => {
    if (!agencyId) return [];
    return allClients.filter(c => c.agency_id === agencyId);
  }, [allClients, agencyId]);

  // Fetch tables for selected client (preview)
  const { data: clientTables = [] } = useQuery({
    queryKey: ['crm-tables-client', clientId],
    queryFn: async () => {
      if (!clientId) return [];
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await supabase.functions.invoke('crm-tables', {
        method: 'GET',
      });

      if (response.error) throw response.error;
      const tables = Array.isArray(response.data) ? response.data : [];
      return tables.filter((t: any) => t.client_id === clientId);
    },
    enabled: !!clientId,
  });

  const selectedClient = allClients.find(c => c.id === clientId);

  const createDashboardMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId || !clientId || !name.trim()) {
        throw new Error('Missing required fields');
      }

      const { data, error } = await supabase
        .from('crm_dashboards')
        .insert({
          tenant_id: tenantId,
          name: name.trim(),
          agency_id: agencyId || null,
          client_id: clientId,
          settings: {},
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['crm-dashboards'] });
      toast.success('הדשבורד נוצר בהצלחה');
      onOpenChange(false);
      resetForm();
      // Navigate to the new dashboard
      navigate(buildPath(`/dashboard/${data.id}`));
    },
    onError: (error: any) => {
      toast.error('שגיאה ביצירת הדשבורד: ' + error.message);
    },
  });

  const resetForm = () => {
    setName("");
    setAgencyId("");
    setClientId("");
  };

  const handleAgencyChange = (value: string) => {
    setAgencyId(value);
    setClientId(""); // Reset client when agency changes
  };

  const getIntegrationIcon = (type: string | null) => {
    switch (type) {
      case 'facebook_insights':
        return <Facebook className="h-4 w-4 text-blue-600" />;
      case 'facebook_ecommerce':
        return <ShoppingCart className="h-4 w-4 text-green-600" />;
      case 'google_ads':
        return (
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none">
            <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z" fill="#4285F4"/>
          </svg>
        );
      default:
        return <FileSpreadsheet className="h-4 w-4" />;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>יצירת דשבורד חדש</DialogTitle>
          <DialogDescription>
            בחר לקוח כדי ליצור דשבורד שמרכז את כל הנתונים שלו ממקורות שונים
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Dashboard Name */}
          <div className="space-y-2">
            <Label htmlFor="dashboard-name">שם הדשבורד</Label>
            <Input
              id="dashboard-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="לדוגמה: דשבורד ארבע על ארבע"
            />
          </div>

          {/* Agency Select */}
          <div className="space-y-2">
            <Label>סוכנות</Label>
            <Select value={agencyId} onValueChange={handleAgencyChange}>
              <SelectTrigger>
                <SelectValue placeholder="בחר סוכנות" />
              </SelectTrigger>
              <SelectContent>
                {agencies.map((agency) => (
                  <SelectItem key={agency.id} value={agency.id}>
                    {agency.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Client Select */}
          {agencyId && (
            <div className="space-y-2">
              <Label>לקוח</Label>
              <Popover open={clientPopoverOpen} onOpenChange={setClientPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={clientPopoverOpen}
                    className="w-full justify-between"
                  >
                    {selectedClient?.name || "בחר לקוח..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0">
                  <Command>
                    <CommandInput placeholder="חפש לקוח..." />
                    <CommandList>
                      <CommandEmpty>לא נמצאו לקוחות</CommandEmpty>
                      <CommandGroup>
                        {filteredClients.map((client) => (
                          <CommandItem
                            key={client.id}
                            value={client.name}
                            onSelect={() => {
                              setClientId(client.id);
                              setClientPopoverOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                clientId === client.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {client.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          )}

          {/* Preview of tables that will be included */}
          {clientId && clientTables.length > 0 && (
            <div className="space-y-2">
              <Label className="text-muted-foreground text-sm">
                טבלאות שיכללו בדשבורד:
              </Label>
              <div className="flex flex-wrap gap-2">
                {clientTables.map((table: any) => (
                  <Badge
                    key={table.id}
                    variant="secondary"
                    className="flex items-center gap-1"
                  >
                    {getIntegrationIcon(table.integration_type)}
                    {table.name}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {clientId && clientTables.length === 0 && (
            <div className="text-sm text-muted-foreground bg-muted p-3 rounded-lg">
              לא נמצאו טבלאות עבור לקוח זה. צור קודם טבלאות ושייך אותן ללקוח.
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            ביטול
          </Button>
          <Button
            onClick={() => createDashboardMutation.mutate()}
            disabled={!name.trim() || !clientId || createDashboardMutation.isPending}
          >
            {createDashboardMutation.isPending ? 'יוצר...' : 'צור דשבורד'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
