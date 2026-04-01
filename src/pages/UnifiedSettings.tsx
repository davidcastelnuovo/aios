import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTenant } from "@/contexts/TenantContext";
import { Loader2, Plus, Trash2, ExternalLink, ArrowLeft, Link2, Package, Users, ShoppingCart, Ticket, Briefcase, BarChart3, CalendarDays, Megaphone, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTenantPath } from "@/hooks/useTenantPath";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
  const [showConnectDialog, setShowConnectDialog] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [workspaceId, setWorkspaceId] = useState("");
  const [embedUrl, setEmbedUrl] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [newConnectionId, setNewConnectionId] = useState("");

  // Fetch existing unified connections
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

  const handleConnect = async () => {
    if (!selectedCategory || !workspaceId) {
      toast({ title: "נא למלא את כל השדות", variant: "destructive" });
      return;
    }

    setIsConnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke("unified-connections", {
        body: {
          action: "get_embed_url",
          tenant_id: currentTenantId,
          category: selectedCategory,
          workspace_id: workspaceId,
          success_redirect: window.location.href,
          failure_redirect: window.location.href,
        },
      });

      if (error) throw error;

      if (data?.embed_url) {
        setEmbedUrl(data.embed_url);
        window.open(data.embed_url, "_blank", "width=600,height=700");
        setShowConnectDialog(false);
        setShowSaveDialog(true);
      }
    } catch (error: any) {
      toast({ title: "שגיאה ביצירת קישור", description: error.message, variant: "destructive" });
    } finally {
      setIsConnecting(false);
    }
  };

  const handleSaveConnection = async () => {
    if (!newConnectionId) {
      toast({ title: "נא להזין Connection ID", variant: "destructive" });
      return;
    }

    try {
      const { error } = await supabase.functions.invoke("unified-connections", {
        body: {
          action: "save_connection",
          tenant_id: currentTenantId,
          connection_id: newConnectionId,
          category: selectedCategory,
        },
      });

      if (error) throw error;

      toast({ title: "החיבור נשמר בהצלחה!" });
      queryClient.invalidateQueries({ queryKey: ["unified-connections"] });
      setShowSaveDialog(false);
      setNewConnectionId("");
      setSelectedCategory("");
    } catch (error: any) {
      toast({ title: "שגיאה בשמירת החיבור", description: error.message, variant: "destructive" });
    }
  };

  const handleDelete = async (integrationId: string) => {
    try {
      const { error } = await supabase.functions.invoke("unified-connections", {
        body: {
          action: "delete",
          tenant_id: currentTenantId,
          connection_id: integrationId,
        },
      });

      if (error) throw error;

      toast({ title: "החיבור נותק בהצלחה" });
      queryClient.invalidateQueries({ queryKey: ["unified-connections"] });
    } catch (error: any) {
      toast({ title: "שגיאה בניתוק", description: error.message, variant: "destructive" });
    }
  };

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

      {/* Available Categories */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>קטגוריות זמינות</CardTitle>
              <CardDescription>בחר קטגוריה לחיבור שירות חדש</CardDescription>
            </div>
            <Button onClick={() => setShowConnectDialog(true)}>
              <Plus className="h-4 w-4 ml-2" />
              חבר שירות חדש
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {UNIFIED_CATEGORIES.map((cat) => (
              <Card key={cat.key} className="hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => { setSelectedCategory(cat.key); setShowConnectDialog(true); }}>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary">{cat.icon}</div>
                  <div>
                    <p className="font-medium">{cat.label}</p>
                    <p className="text-xs text-muted-foreground">{cat.description}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Active Connections */}
      <Card>
        <CardHeader>
          <CardTitle>חיבורים פעילים</CardTitle>
          <CardDescription>ניהול חיבורים קיימים דרך Unified.to</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : connections && connections.length > 0 ? (
            <div className="space-y-3">
              {connections.map((conn: any) => {
                const settings = conn.settings || {};
                return (
                  <div key={conn.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <Link2 className="h-5 w-5 text-primary" />
                      <div>
                        <p className="font-medium">{settings.integration_name || conn.integration_type}</p>
                        <p className="text-xs text-muted-foreground">
                          קטגוריה: {settings.unified_category || "—"} | חובר: {settings.connected_at ? new Date(settings.connected_at).toLocaleDateString("he-IL") : "—"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="default" className="bg-green-500/90">פעיל</Badge>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(conn.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">אין חיבורים פעילים עדיין. לחץ &quot;חבר שירות חדש&quot; להתחלה.</p>
          )}
        </CardContent>
      </Card>

      {/* Connect Dialog */}
      <Dialog open={showConnectDialog} onOpenChange={setShowConnectDialog}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>חבר שירות חדש</DialogTitle>
            <DialogDescription>הזן את פרטי ה-Workspace ובחר קטגוריה</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>קטגוריה</Label>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger><SelectValue placeholder="בחר קטגוריה..." /></SelectTrigger>
                <SelectContent>
                  {UNIFIED_CATEGORIES.map((cat) => (
                    <SelectItem key={cat.key} value={cat.key}>{cat.label} - {cat.description}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Workspace ID (מ-Unified.to)</Label>
              <Input value={workspaceId} onChange={(e) => setWorkspaceId(e.target.value)} placeholder="הזן Workspace ID..." />
            </div>
            <Button onClick={handleConnect} disabled={isConnecting} className="w-full">
              {isConnecting ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : <ExternalLink className="h-4 w-4 ml-2" />}
              פתח חלון חיבור
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Save Connection Dialog */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>שמור חיבור</DialogTitle>
            <DialogDescription>לאחר שהחיבור הצליח בחלון Unified.to, הזן את ה-Connection ID שהתקבל</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Connection ID</Label>
              <Input value={newConnectionId} onChange={(e) => setNewConnectionId(e.target.value)} placeholder="הזן Connection ID..." />
            </div>
            <Button onClick={handleSaveConnection} className="w-full">שמור חיבור</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
