import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Building2, Users, Settings } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AddTenantForm } from "@/components/forms/AddTenantForm";

export default function Tenants() {
  const { toast } = useToast();
  const [selectedTenant, setSelectedTenant] = useState<string | null>(null);

  const { data: tenants, isLoading } = useQuery({
    queryKey: ["tenants"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenants")
        .select("*")
        .order("name");
      
      if (error) throw error;
      return data;
    },
  });

  const { data: currentTenant } = useQuery({
    queryKey: ["current-tenant"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from("tenant_users")
        .select("tenant_id, tenants(name)")
        .eq("user_id", user.id)
        .single();
      
      if (error) throw error;
      return data;
    },
  });

  const handleTenantClick = async (tenantId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast({
        title: "שגיאה",
        description: "יש להתחבר למערכת",
        variant: "destructive",
      });
      return;
    }

    // Check if user has access to this tenant
    const { data: access } = await supabase
      .from("tenant_users")
      .select("*")
      .eq("user_id", user.id)
      .eq("tenant_id", tenantId)
      .single();

    if (!access) {
      toast({
        title: "אין הרשאה",
        description: "אין לך גישה לארגון זה",
        variant: "destructive",
      });
      return;
    }

    // Store selected tenant in localStorage for app to use
    localStorage.setItem("selectedTenantId", tenantId);
    
    // Reload to apply tenant context
    window.location.reload();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-3 md:p-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Building2 className="h-8 w-8" />
            ניהול ארגונים
          </h1>
          {currentTenant && (
            <p className="text-muted-foreground mt-2">
              ארגון נוכחי: <strong>{(currentTenant as any).tenants.name}</strong>
            </p>
          )}
        </div>
        <AddTenantForm />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {tenants?.map((tenant) => (
          <Card
            key={tenant.id}
            className="hover:shadow-lg transition-shadow cursor-pointer"
            onClick={() => handleTenantClick(tenant.id)}
          >
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="h-5 w-5" />
                    {tenant.name}
                  </CardTitle>
                  {tenant.subdomain && (
                    <CardDescription className="text-xs">
                      {tenant.subdomain}.lovableproject.com
                    </CardDescription>
                  )}
                </div>
                <Badge
                  variant={tenant.status === "active" ? "default" : "secondary"}
                >
                  {tenant.status === "active" ? "פעיל" : "לא פעיל"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                {tenant.contact_name && (
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span>{tenant.contact_name}</span>
                  </div>
                )}
                {tenant.contact_email && (
                  <div className="text-muted-foreground">
                    {tenant.contact_email}
                  </div>
                )}
                {tenant.trial_ends_at && (
                  <div className="text-xs text-muted-foreground">
                    תקופת נסיון עד: {new Date(tenant.trial_ends_at).toLocaleDateString("he-IL")}
                  </div>
                )}
                {tenant.notes && (
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {tenant.notes}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {tenants?.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">
              אין עדיין ארגונים במערכת
            </p>
            <AddTenantForm />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
