import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, Phone, Mail, Calendar, Link as LinkIcon } from "lucide-react";
import { AddAgencyForm } from "@/components/forms/AddAgencyForm";
import { useUserRole } from "@/hooks/useUserRole";
import { useUserAgencies } from "@/hooks/useUserAgencies";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { useTerminology } from "@/hooks/useTerminology";

export default function Agencies() {
  const { userId, isOwner } = useUserRole();
  const { userAgencyIds } = useUserAgencies();
  const { tenantId } = useCurrentTenant();
  const { t } = useTerminology();
  
  const { data: agencies, isLoading } = useQuery({
    queryKey: ["agencies-list", tenantId, userId, userAgencyIds],
    queryFn: async () => {
      if (!tenantId) return [] as any[];
      
      // Get owned agencies
      const { data: ownedAgencies, error: ownedError } = await supabase
        .from("agencies")
        .select("*, is_owned:tenant_id")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });
      
      if (ownedError) throw ownedError;
      
      // Get shared agencies via agency_tenant_access
      const { data: sharedAccess, error: sharedError } = await supabase
        .from("agency_tenant_access")
        .select(`
          agency_id,
          agencies (
            id,
            name,
            status,
            contact_name,
            phone,
            email,
            start_date,
            notes,
            created_at
          )
        `)
        .eq("accessing_tenant_id", tenantId);
      
      if (sharedError) throw sharedError;
      
      // Mark owned agencies
      const markedOwned = (ownedAgencies || []).map(a => ({ ...a, is_owned: true }));
      
      // Extract and mark shared agencies
      const shared = (sharedAccess || [])
        .map(s => s.agencies)
        .filter(Boolean)
        .map(a => ({ ...a, is_owned: false }));
      
      // Combine and remove duplicates
      const combined = [...markedOwned, ...shared];
      const uniqueMap = new Map();
      combined.forEach(agency => {
        if (agency && agency.id && !uniqueMap.has(agency.id)) {
          uniqueMap.set(agency.id, agency);
        }
      });
      
      return Array.from(uniqueMap.values()).sort((a: any, b: any) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    },
    enabled: !!tenantId,
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-success/10 text-success border-success/20";
      case "paused":
        return "bg-yellow-500/10 text-yellow-600 border-yellow-500/20";
      case "former":
        return "bg-muted text-muted-foreground border-border";
      default:
        return "";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "active":
        return "פעיל";
      case "paused":
        return "מושהה";
      case "former":
        return "לשעבר";
      default:
        return status;
    }
  };

  if (isLoading) {
    return <div className="flex justify-center p-8">טוען...</div>;
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">{t('agency', true)}</h2>
        </div>
        <AddAgencyForm />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {agencies?.map((agency) => (
          <Card key={agency.id} className="shadow-card hover:shadow-lg transition-all hover:scale-[1.02]">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Building2 className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-lg">{agency.name}</CardTitle>
                      {!agency.is_owned && (
                        <Badge variant="secondary" className="text-xs">
                          <LinkIcon className="h-3 w-3 mr-1" />
                          משותף
                        </Badge>
                      )}
                    </div>
                    {agency.contact_name && (
                      <p className="text-sm text-muted-foreground">{agency.contact_name}</p>
                    )}
                  </div>
                </div>
                <Badge variant="outline" className={getStatusColor(agency.status)}>
                  {getStatusText(agency.status)}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {agency.phone && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Phone className="h-4 w-4" />
                  <span dir="ltr">{agency.phone}</span>
                </div>
              )}
              {agency.email && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Mail className="h-4 w-4" />
                  <span>{agency.email}</span>
                </div>
              )}
              {agency.start_date && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>{new Date(agency.start_date).toLocaleDateString("he-IL")}</span>
                </div>
              )}
              {agency.notes && (
                <p className="text-sm text-muted-foreground mt-2 pt-2 border-t">
                  {agency.notes}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {agencies?.length === 0 && (
        <Card className="shadow-card">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-1">אין {t('agency', true)}</h3>
            <p className="text-sm text-muted-foreground">התחל בהוספת {t('agency')} ראשונה</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}