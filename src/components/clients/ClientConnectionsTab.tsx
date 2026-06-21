import { useState } from "react";
import { useClientConnections } from "@/components/marketing/lib/useClientConnections";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Trash2, Globe, Megaphone, Share2 } from "lucide-react";

interface Props {
  clientId: string;
  tenantId: string;
}

export function ClientConnectionsTab({ clientId, tenantId }: Props) {
  const conns = useClientConnections(clientId);

  const [website, setWebsite] = useState<string | null>(null);
  const [metaAcct, setMetaAcct] = useState<string | null>(null);
  const [googleAcct, setGoogleAcct] = useState<string | null>(null);

  const [newPagePlatform, setNewPagePlatform] = useState("facebook");
  const [newPageId, setNewPageId] = useState("");
  const [newPageName, setNewPageName] = useState("");

  const [newWpUrl, setNewWpUrl] = useState("");
  const [newWpName, setNewWpName] = useState("");

  if (conns.isLoading || !conns.data) return <div className="p-4 text-sm text-muted-foreground">טוען חיבורים...</div>;

  const c = conns.data.client;
  const websiteVal = website ?? c?.website ?? "";
  const metaVal = metaAcct ?? c?.meta_ads_account_id ?? "";
  const googleVal = googleAcct ?? c?.google_ads_account_id ?? "";

  const saveClientFields = async () => {
    const { error } = await supabase
      .from("clients")
      .update({
        website: websiteVal || null,
        meta_ads_account_id: metaVal || null,
        google_ads_account_id: googleVal || null,
      })
      .eq("id", clientId);
    if (error) return toast.error(error.message);
    toast.success("נשמר");
    conns.invalidate();
  };

  const addPage = async () => {
    if (!newPageId) return;
    const { error } = await supabase.from("social_pages").insert({
      client_id: clientId,
      tenant_id: tenantId,
      platform: newPagePlatform,
      page_id: newPageId,
      page_name: newPageName || null,
      is_active: true,
    });
    if (error) return toast.error(error.message);
    setNewPageId("");
    setNewPageName("");
    toast.success("העמוד נוסף");
    conns.invalidate();
  };

  const removePage = async (id: string) => {
    const { error } = await supabase.from("social_pages").delete().eq("id", id);
    if (error) return toast.error(error.message);
    conns.invalidate();
  };

  const addWp = async () => {
    if (!newWpUrl) return;
    const { error } = await supabase.from("social_media_wordpress_sites").insert({
      client_id: clientId,
      tenant_id: tenantId,
      site_url: newWpUrl,
      site_name: newWpName || null,
    } as any);
    if (error) return toast.error(error.message);
    setNewWpUrl("");
    setNewWpName("");
    toast.success("האתר נוסף");
    conns.invalidate();
  };

  const removeWp = async (id: string) => {
    const { error } = await supabase.from("social_media_wordpress_sites").delete().eq("id", id);
    if (error) return toast.error(error.message);
    conns.invalidate();
  };

  return (
    <div className="space-y-4" dir="rtl">
      {/* Website + Ads accounts */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-2 font-semibold text-sm">
          <Globe className="h-4 w-4" /> אתר וחשבונות מודעות
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <Label>אתר ראשי לקידום</Label>
            <Input value={websiteVal} onChange={(e) => setWebsite(e.target.value)} placeholder="https://" />
          </div>
          <div>
            <Label>Meta Ads Account ID</Label>
            <Input value={metaVal} onChange={(e) => setMetaAcct(e.target.value)} placeholder="act_..." />
          </div>
          <div>
            <Label>Google Ads Account ID</Label>
            <Input value={googleVal} onChange={(e) => setGoogleAcct(e.target.value)} placeholder="123-456-7890" />
          </div>
        </div>
        <Button size="sm" onClick={saveClientFields}>שמור</Button>
      </Card>

      {/* Social pages */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-2 font-semibold text-sm">
          <Share2 className="h-4 w-4" /> עמודי סושיאל מחוברים
        </div>
        {conns.data.socialPages.length === 0 ? (
          <p className="text-xs text-muted-foreground">אין עמודים מחוברים</p>
        ) : (
          <div className="space-y-2">
            {conns.data.socialPages.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded border p-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{p.platform}</Badge>
                  <span className="text-sm font-medium">{p.page_name || p.page_id}</span>
                  <span className="text-xs text-muted-foreground">{p.page_id}</span>
                </div>
                <Button size="icon" variant="ghost" onClick={() => removePage(p.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2 items-end">
          <div>
            <Label>פלטפורמה</Label>
            <Select value={newPagePlatform} onValueChange={setNewPagePlatform}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="facebook">Facebook</SelectItem>
                <SelectItem value="instagram">Instagram</SelectItem>
                <SelectItem value="tiktok">TikTok</SelectItem>
                <SelectItem value="linkedin">LinkedIn</SelectItem>
                <SelectItem value="youtube">YouTube</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Page ID</Label>
            <Input value={newPageId} onChange={(e) => setNewPageId(e.target.value)} />
          </div>
          <div>
            <Label>שם</Label>
            <Input value={newPageName} onChange={(e) => setNewPageName(e.target.value)} />
          </div>
          <Button size="sm" onClick={addPage}><Plus className="ml-1 h-4 w-4" /> הוסף</Button>
        </div>
      </Card>

      {/* WordPress sites */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-2 font-semibold text-sm">
          <Megaphone className="h-4 w-4" /> אתרי WordPress (לפרסום SEO/GEO)
        </div>
        {conns.data.wpSites.length === 0 ? (
          <p className="text-xs text-muted-foreground">אין אתרים מחוברים</p>
        ) : (
          <div className="space-y-2">
            {conns.data.wpSites.map((s) => (
              <div key={s.id} className="flex items-center justify-between rounded border p-2">
                <span className="text-sm">{s.site_name || s.site_url}</span>
                <Button size="icon" variant="ghost" onClick={() => removeWp(s.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-end">
          <div>
            <Label>כתובת אתר</Label>
            <Input value={newWpUrl} onChange={(e) => setNewWpUrl(e.target.value)} placeholder="https://" />
          </div>
          <div>
            <Label>שם תצוגה</Label>
            <Input value={newWpName} onChange={(e) => setNewWpName(e.target.value)} />
          </div>
          <Button size="sm" onClick={addWp}><Plus className="ml-1 h-4 w-4" /> הוסף</Button>
        </div>
      </Card>
    </div>
  );
}
