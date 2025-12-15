import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTenant } from "@/contexts/TenantContext";
import { Loader2, BarChart3, ExternalLink } from "lucide-react";

interface GoogleAnalyticsTableDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface GAProperty {
  propertyId: string;
  displayName: string;
  accountDisplayName: string;
}

export function GoogleAnalyticsTableDialog({ open, onOpenChange }: GoogleAnalyticsTableDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { currentTenant, currentTenantId: activeTenantId } = useTenant();
  
  const [tableName, setTableName] = useState("");
  const [category, setCategory] = useState("analytics");
  const [selectedProperty, setSelectedProperty] = useState("");
  const [selectedAgency, setSelectedAgency] = useState("");
  const [selectedClient, setSelectedClient] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  // Fetch GA integration
  const { data: integration, isLoading: integrationLoading } = useQuery({
    queryKey: ['ga-integration', activeTenantId],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      
      const { data } = await supabase
        .from('tenant_integrations')
        .select('*')
        .eq('tenant_id', activeTenantId)
        .eq('integration_type', 'google_analytics')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();
      
      return data;
    },
    enabled: open && !!activeTenantId,
  });

  // Fetch properties
  const { data: properties, isLoading: propertiesLoading } = useQuery({
    queryKey: ['ga-properties', integration?.id],
    queryFn: async () => {
      if (!integration) return [];
      
      const { data, error } = await supabase.functions.invoke('google-analytics-auth', {
        body: { 
          action: 'get_properties',
          integrationId: integration.id
        }
      });
      
      if (error) throw error;
      return (data?.properties || []) as GAProperty[];
    },
    enabled: !!integration,
  });

  // Fetch agencies
  const { data: agencies } = useQuery({
    queryKey: ['agencies-for-table', activeTenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from('agencies')
        .select('id, name')
        .eq('tenant_id', activeTenantId)
        .order('name');
      return data || [];
    },
    enabled: open && !!activeTenantId,
  });

  // Fetch clients based on selected agency
  const { data: clients } = useQuery({
    queryKey: ['clients-for-table', selectedAgency],
    queryFn: async () => {
      if (!selectedAgency) return [];
      const { data } = await supabase
        .from('clients')
        .select('id, name')
        .eq('agency_id', selectedAgency)
        .order('name');
      return data || [];
    },
    enabled: !!selectedAgency,
  });

  const handleCreate = async () => {
    if (!tableName.trim() || !selectedProperty || !integration) {
      toast({ title: "נא למלא את כל השדות הנדרשים", variant: "destructive" });
      return;
    }

    setIsCreating(true);
    try {
      const selectedProp = properties?.find(p => p.propertyId === selectedProperty);
      const slug = tableName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

      const { data, error } = await supabase.functions.invoke('crm-tables', {
        body: {
          action: 'create',
          tenantId: activeTenantId,
          name: tableName,
          slug: `ga-${slug}-${Date.now()}`,
          description: `Google Analytics - ${selectedProp?.displayName}`,
          category,
          icon: 'BarChart3',
          agencyId: selectedAgency || null,
          clientId: selectedClient || null,
          integration_type: 'google_analytics',
          integration_settings: {
            integrationId: integration.id,
            propertyId: selectedProperty,
            propertyName: selectedProp?.displayName,
            accountName: selectedProp?.accountDisplayName,
          },
          integrations: [{
            type: 'google_analytics',
            integrationId: integration.id,
            propertyId: selectedProperty,
            propertyName: selectedProp?.displayName,
            accountName: selectedProp?.accountDisplayName,
          }]
        }
      });

      if (error) throw error;

      toast({ title: "טבלת Google Analytics נוצרה בהצלחה!" });
      queryClient.invalidateQueries({ queryKey: ['crm-tables'] });
      onOpenChange(false);
      resetForm();
    } catch (error: any) {
      toast({ title: "שגיאה ביצירת הטבלה", description: error.message, variant: "destructive" });
    } finally {
      setIsCreating(false);
    }
  };

  const resetForm = () => {
    setTableName("");
    setCategory("analytics");
    setSelectedProperty("");
    setSelectedAgency("");
    setSelectedClient("");
  };

  const isLoading = integrationLoading || propertiesLoading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-orange-500" />
            טבלת Google Analytics חדשה
          </DialogTitle>
          <DialogDescription>
            חבר נכס Google Analytics וצפה בנתוני ביצועים
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : !integration ? (
          <div className="text-center py-6 space-y-4">
            <p className="text-muted-foreground">
              לא נמצא חיבור Google Analytics פעיל
            </p>
            <Button variant="outline" asChild>
              <a href={`/t/${currentTenant?.slug}/google-analytics-settings`}>
                <ExternalLink className="h-4 w-4 ml-2" />
                חבר Google Analytics
              </a>
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>שם הטבלה *</Label>
              <Input
                value={tableName}
                onChange={(e) => setTableName(e.target.value)}
                placeholder="לדוגמה: נתוני GA - אתר ראשי"
              />
            </div>

            <div className="space-y-2">
              <Label>נכס (Property) *</Label>
              <Select value={selectedProperty} onValueChange={setSelectedProperty}>
                <SelectTrigger>
                  <SelectValue placeholder="בחר נכס" />
                </SelectTrigger>
                <SelectContent>
                  {properties?.map((prop) => (
                    <SelectItem key={prop.propertyId} value={prop.propertyId}>
                      {prop.displayName} ({prop.accountDisplayName})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>קטגוריה</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="analytics">אנליטיקס</SelectItem>
                  <SelectItem value="marketing">שיווק</SelectItem>
                  <SelectItem value="reports">דוחות</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>סוכנות (אופציונלי)</Label>
              <Select value={selectedAgency || "all"} onValueChange={(v) => { setSelectedAgency(v === "all" ? "" : v); setSelectedClient(""); }}>
                <SelectTrigger>
                  <SelectValue placeholder="כל הסוכנויות" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">כל הסוכנויות</SelectItem>
                  {agencies?.map((agency) => (
                    <SelectItem key={agency.id} value={agency.id}>
                      {agency.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedAgency && (
              <div className="space-y-2">
                <Label>לקוח (אופציונלי)</Label>
                <Select value={selectedClient || "all"} onValueChange={(v) => setSelectedClient(v === "all" ? "" : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="כל הלקוחות" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">כל הלקוחות</SelectItem>
                    {clients?.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex gap-2 pt-4">
              <Button onClick={handleCreate} disabled={isCreating} className="flex-1">
                {isCreating ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : null}
                צור טבלה
              </Button>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                ביטול
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
