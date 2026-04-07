import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTenant } from "@/contexts/TenantContext";
import { Loader2, Trash2, ArrowLeft, Link2, CheckCircle2, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTenantPath } from "@/hooks/useTenantPath";
import UnifiedProviderPicker from "@/components/unified/UnifiedProviderPicker";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

interface WorkspaceIntegration {
  name: string;
  type: string;
  icon_url: string | null;
  categories: string[];
}

export default function UnifiedSettings() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { buildPath } = useTenantPath();
  const queryClient = useQueryClient();
  const { currentTenantId } = useTenant();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<{ key: string; label: string } | null>(null);

  // Fetch active connections from DB
  const { data: connections, isLoading: isLoadingConnections } = useQuery({
    queryKey: ["unified-connections", currentTenantId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("unified-connections", {
        body: { action: "list", tenant_id: currentTenantId },
      });
      if (error) throw error;
      return data?.connections || [];
    },
    enabled: !!currentTenantId,
  });

  // Fetch active workspace integrations from Unified.to
  const { data: workspaceIntegrations, isLoading: isLoadingWorkspace } = useQuery({
    queryKey: ["unified-workspace-integrations", currentTenantId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("unified-connections", {
        body: { action: "list_workspace_integrations", tenant_id: currentTenantId },
      });
      if (error) throw error;
      return (data?.integrations || []) as WorkspaceIntegration[];
    },
    enabled: !!currentTenantId,
  });

  const handleIntegrationClick = (integration: WorkspaceIntegration) => {
    // Use first category of the integration
    const category = integration.categories[0] || integration.type;
    setSelectedCategory({ key: category, label: integration.name });
    setPickerOpen(true);
  };

  const handleDelete = async (integrationId: string) => {
    try {
      const { error } = await supabase.functions.invoke("unified-connections", {
        body: { action: "delete", tenant_id: currentTenantId, connection_id: integrationId },
      });
      if (error) throw error;
      toast({ title: "החיבור נותק בהצלחה" });
      queryClient.invalidateQueries({ queryKey: ["unified-connections"] });
    } catch (error: any) {
      toast({ title: "שגיאה בניתוק", description: error.message, variant: "destructive" });
    }
  };

  const activeConnections = connections || [];
  const availableIntegrations = workspaceIntegrations || [];

  return (
    <div className="container mx-auto p-6 space-y-6" dir="rtl">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(buildPath("integrations"))}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Unified.to - מרכז אינטגרציות</h1>
          <p className="text-muted-foreground mt-1">חבר מאות שירותים חיצוניים דרך API אחד</p>
        </div>
      </div>

      <Tabs defaultValue="active" dir="rtl">
        <TabsList>
          <TabsTrigger value="active">
            חיבורים פעילים
            {activeConnections.length > 0 && (
              <Badge variant="secondary" className="mr-2 text-xs">{activeConnections.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="available">
            אינטגרציות זמינות
            {availableIntegrations.length > 0 && (
              <Badge variant="secondary" className="mr-2 text-xs">{availableIntegrations.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Active Connections Tab */}
        <TabsContent value="active">
          <Card>
            <CardHeader>
              <CardTitle>אינטגרציות פעילות</CardTitle>
              <CardDescription>כל השירותים המחוברים דרך Unified.to</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingConnections ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : activeConnections.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {activeConnections.map((conn: any) => {
                    const settings = conn.settings || {};
                    // Find matching workspace integration for icon
                    const matchingIntegration = availableIntegrations.find(
                      (wi) => wi.type === settings.integration_name || wi.name === settings.integration_name
                    );
                    return (
                      <Card key={conn.id} className="border-green-500/50">
                        <CardContent className="p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              {matchingIntegration?.icon_url ? (
                                <img src={matchingIntegration.icon_url} alt={settings.integration_name} className="h-10 w-10 rounded object-contain" />
                              ) : (
                                <div className="p-2 rounded-lg bg-green-500/10 text-green-600">
                                  <Link2 className="h-5 w-5" />
                                </div>
                              )}
                              <div>
                                <p className="font-medium">{settings.integration_name || conn.integration_type}</p>
                                <p className="text-xs text-muted-foreground">
                                  {settings.unified_category || "—"}
                                </p>
                              </div>
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => handleDelete(conn.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                              <span className="text-green-600 font-medium">פעיל</span>
                            </div>
                            <span>
                              {settings.connected_at ? new Date(settings.connected_at).toLocaleDateString("he-IL") : "—"}
                            </span>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12 space-y-3">
                  <Link2 className="h-12 w-12 text-muted-foreground/40 mx-auto" />
                  <p className="text-muted-foreground">אין חיבורים פעילים עדיין</p>
                  <p className="text-sm text-muted-foreground">עבור ללשונית "אינטגרציות זמינות" כדי לחבר שירות חדש</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Available Integrations Tab - dynamic from Unified.to */}
        <TabsContent value="available">
          <Card>
            <CardHeader>
              <CardTitle>אינטגרציות זמינות</CardTitle>
              <CardDescription>אינטגרציות פעילות ב-Unified.to — לחץ לחיבור</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingWorkspace ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : availableIntegrations.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {availableIntegrations.map((integration) => {
                    // Check if already connected
                    const isConnected = activeConnections.some(
                      (conn: any) => conn.settings?.integration_name === integration.type || conn.settings?.integration_name === integration.name
                    );
                    return (
                      <Card
                        key={integration.type}
                        className={`hover:bg-muted/50 transition-colors cursor-pointer ${isConnected ? 'border-green-500/50' : ''}`}
                        onClick={() => handleIntegrationClick(integration)}
                      >
                        <CardContent className="p-4 flex items-center gap-3">
                          {integration.icon_url ? (
                            <img src={integration.icon_url} alt={integration.name} className="h-10 w-10 rounded object-contain" />
                          ) : (
                            <div className="h-10 w-10 rounded bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                              {integration.name.charAt(0)}
                            </div>
                          )}
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <p className="font-medium">{integration.name}</p>
                              {isConnected && <Badge variant="default" className="bg-green-500/90 text-xs">מחובר</Badge>}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {integration.categories.join(", ")}
                            </p>
                          </div>
                          {!isConnected && <Plus className="h-4 w-4 text-muted-foreground" />}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12 space-y-3">
                  <p className="text-muted-foreground">לא נמצאו אינטגרציות פעילות ב-Unified.to</p>
                  <p className="text-sm text-muted-foreground">הפעל אינטגרציות בדשבורד של Unified.to כדי שיופיעו כאן</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Provider Picker Dialog */}
      <UnifiedProviderPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        selectedCategory={selectedCategory}
        tenantId={currentTenantId || ""}
      />
    </div>
  );
}
