import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTenant } from "@/contexts/TenantContext";
import { Loader2, Plus, Trash2, ArrowLeft, Link2, Package, Users, ShoppingCart, Ticket, Briefcase, BarChart3, CalendarDays, Megaphone, Search, CheckCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTenantPath } from "@/hooks/useTenantPath";
import UnifiedProviderPicker from "@/components/unified/UnifiedProviderPicker";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

const UNIFIED_CATEGORIES = [
  { key: "calendar", label: "Calendar", icon: <CalendarDays className="h-5 w-5" />, description: "Google Calendar, Outlook Calendar, CalDAV" },
  { key: "crm", label: "CRM", icon: <Users className="h-5 w-5" />, description: "Salesforce, HubSpot, Pipedrive ועוד" },
  { key: "ats", label: "ATS - גיוס", icon: <Briefcase className="h-5 w-5" />, description: "Greenhouse, Lever, Workable" },
  { key: "ticketing", label: "Ticketing", icon: <Ticket className="h-5 w-5" />, description: "Zendesk, Freshdesk, Jira" },
  { key: "commerce", label: "Commerce", icon: <ShoppingCart className="h-5 w-5" />, description: "Shopify, WooCommerce, Stripe" },
  { key: "martech", label: "Marketing", icon: <BarChart3 className="h-5 w-5" />, description: "Mailchimp, ActiveCampaign, Klaviyo" },
  { key: "storage", label: "Storage", icon: <Package className="h-5 w-5" />, description: "Google Drive, Dropbox, OneDrive" },
  { key: "social", label: "Social Media", icon: <Megaphone className="h-5 w-5" />, description: "Facebook, Instagram, TikTok, YouTube, LinkedIn" },
  { key: "ads", label: "פרסום ממומן", icon: <BarChart3 className="h-5 w-5" />, description: "Google Ads, Meta Ads, TikTok Ads" },
  { key: "seo", label: "SEO & Analytics", icon: <Search className="h-5 w-5" />, description: "Ahrefs, Google Analytics, Search Console" },
];

export default function UnifiedSettings() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { buildPath } = useTenantPath();
  const queryClient = useQueryClient();
  const { currentTenantId } = useTenant();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<{ key: string; label: string } | null>(null);

  const { data: connections, isLoading } = useQuery({
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

  const handleCategoryClick = (cat: typeof UNIFIED_CATEGORIES[0]) => {
    setSelectedCategory({ key: cat.key, label: cat.label });
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

  // Group active connections by integration_name for individual cards
  const activeConnections = connections || [];

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
          <TabsTrigger value="categories">כל הקטגוריות</TabsTrigger>
        </TabsList>

        {/* Active Connections Tab */}
        <TabsContent value="active">
          <Card>
            <CardHeader>
              <CardTitle>אינטגרציות פעילות</CardTitle>
              <CardDescription>כל השירותים המחוברים דרך Unified.to</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : activeConnections.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {activeConnections.map((conn: any) => {
                    const settings = conn.settings || {};
                    const categoryDef = UNIFIED_CATEGORIES.find(c => c.key === settings.unified_category);
                    return (
                      <Card key={conn.id} className="border-green-500/50">
                        <CardContent className="p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="p-2 rounded-lg bg-green-500/10 text-green-600">
                                {categoryDef?.icon || <Link2 className="h-5 w-5" />}
                              </div>
                              <div>
                                <p className="font-medium">{settings.integration_name || conn.integration_type}</p>
                                <p className="text-xs text-muted-foreground">
                                  {categoryDef?.label || settings.unified_category || "—"}
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
                  <p className="text-sm text-muted-foreground">עבור ללשונית "כל הקטגוריות" כדי לחבר שירות חדש</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Categories Tab */}
        <TabsContent value="categories">
          <Card>
            <CardHeader>
              <CardTitle>קטגוריות זמינות</CardTitle>
              <CardDescription>בחר קטגוריה לחיבור שירות חדש</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {UNIFIED_CATEGORIES.map((cat) => {
                  const connectedProviders = activeConnections.filter(
                    (conn: any) => conn.settings?.unified_category === cat.key
                  );
                  const isConnected = connectedProviders.length > 0;
                  return (
                    <Card key={cat.key} className={`hover:bg-muted/50 transition-colors cursor-pointer ${isConnected ? 'border-green-500/50' : ''}`} onClick={() => handleCategoryClick(cat)}>
                      <CardContent className="p-4 flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${isConnected ? 'bg-green-500/10 text-green-600' : 'bg-primary/10 text-primary'}`}>{cat.icon}</div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{cat.label}</p>
                            {isConnected && <Badge variant="default" className="bg-green-500/90 text-xs">מחובר</Badge>}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {isConnected
                              ? connectedProviders.map((c: any) => c.settings?.integration_name || c.integration_type).join(", ")
                              : cat.description}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
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
