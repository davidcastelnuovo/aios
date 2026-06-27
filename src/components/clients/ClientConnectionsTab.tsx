import { useState } from "react";
import { useClientConnections } from "@/components/marketing/lib/useClientConnections";
import { useProvisionClientChannels } from "@/components/clients/useProvisionClientChannels";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Trash2, Megaphone, Share2, Link2, Loader2, LayoutDashboard, Wand2, CheckCircle2, AlertCircle } from "lucide-react";
import {
  CLIENT_CHANNELS,
  ALL_CHANNEL_FIELD_KEYS,
  type ChannelFieldKey,
} from "@/config/clientChannels";

interface Props {
  clientId: string;
  tenantId: string;
  onProvisioned?: () => void;
}

interface ResolvedPage {
  page_id: string;
  page_name: string | null;
  ig_id: string | null;
  ig_username: string | null;
  source: string;
}

export function ClientConnectionsTab({ clientId, tenantId, onProvisioned }: Props) {
  const conns = useClientConnections(clientId);
  const { provision, provisioning } = useProvisionClientChannels();

  // Local edits keyed by client column; falls back to the saved value when untouched.
  const [edits, setEdits] = useState<Partial<Record<ChannelFieldKey, string>>>({});
  const [saving, setSaving] = useState(false);

  // Meta auto-resolve state
  const [resolving, setResolving] = useState(false);
  const [resolvedPage, setResolvedPage] = useState<ResolvedPage | null>(null);

  const [newPagePlatform, setNewPagePlatform] = useState("facebook");
  const [newPageId, setNewPageId] = useState("");
  const [newPageName, setNewPageName] = useState("");

  if (conns.isLoading || !conns.data) return <div className="p-4 text-sm text-muted-foreground">טוען חיבורים...</div>;

  const c = conns.data.client as Record<string, any> | null;

  // Show ALL channels regardless of the client's services configuration
  const allChannels = CLIENT_CHANNELS;

  const fieldValue = (key: ChannelFieldKey): string => edits[key] ?? (c?.[key] ?? "") ?? "";
  const setFieldValue = (key: ChannelFieldKey, value: string) => {
    setEdits((prev) => ({ ...prev, [key]: value }));
    // Clear resolved page preview when meta_ads_account_id changes
    if (key === "meta_ads_account_id") setResolvedPage(null);
  };

  const saveClientFields = async () => {
    setSaving(true);
    // Persist all channel fields regardless of active services
    const payload: Record<string, string | null> = {};
    for (const key of ALL_CHANNEL_FIELD_KEYS) {
      const val = fieldValue(key).trim();
      payload[key] = val || null;
    }
    const { error } = await supabase.from("clients").update(payload as never).eq("id", clientId);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("נשמר");
    setEdits({});
    conns.invalidate();
  };

  /**
   * Call the edge function to resolve the Facebook Page from the Meta Ads Account ID.
   * Upserts the page into social_pages and shows a preview for confirmation.
   */
  const resolveMetaPage = async () => {
    const adAccountId = fieldValue("meta_ads_account_id").trim();
    if (!adAccountId) {
      toast.error("יש להזין Meta Ads Account ID תחילה");
      return;
    }
    setResolving(true);
    setResolvedPage(null);
    try {
      const { data, error } = await supabase.functions.invoke("resolve-meta-page-from-ad-account", {
        body: {
          tenant_id: tenantId,
          client_id: clientId,
          ad_account_id: adAccountId,
          auto_upsert: true,
        },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.message || data.error);

      setResolvedPage(data as ResolvedPage);
      toast.success(
        `עמוד נמצא ושויך: ${data.page_name || data.page_id}` +
          (data.ig_username ? ` + @${data.ig_username}` : ""),
      );
      conns.invalidate();
    } catch (err: unknown) {
      toast.error((err as Error)?.message || "שגיאה בשיוך עמוד");
    } finally {
      setResolving(false);
    }
  };

  const handleProvision = async () => {
    try {
      const summary = await provision(clientId);
      const parts: string[] = [];
      if (summary.created.length) parts.push(`נוצרו: ${summary.created.join(", ")}`);
      if (summary.updated.length) parts.push(`עודכנו: ${summary.updated.join(", ")}`);
      if (summary.dashboardCreated) parts.push("דשבורד נוצר");
      if (summary.skipped.length) parts.push(`דולגו: ${summary.skipped.join(", ")}`);
      toast.success(parts.length ? parts.join(" · ") : "אין ערוצים עם מזהים להקמה");
      onProvisioned?.();
    } catch (err: unknown) {
      toast.error((err as Error)?.message || "שגיאה בהקצאת ערוצים");
    }
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

  const removeWp = async (id: string) => {
    const { error } = await supabase.from("social_media_wordpress_sites").delete().eq("id", id);
    if (error) return toast.error(error.message);
    conns.invalidate();
  };

  return (
    <div className="space-y-4" dir="rtl">
      {/* All channels — shown unconditionally regardless of client services */}
      {allChannels.map((ch) => {
        const isMetaChannel = ch.id === "meta_ads";
        const missing = ch.fields.some((f) => !fieldValue(f.key).trim());
        return (
          <Card key={ch.id} className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-semibold text-sm">
                <Link2 className="h-4 w-4" /> {ch.label}
              </div>
              {missing && (
                <Badge variant="outline" className="text-amber-600 border-amber-300">חסר חיבור</Badge>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {ch.fields.map((f) => (
                <div key={f.key}>
                  <Label>{f.label}</Label>
                  <Input
                    value={fieldValue(f.key)}
                    onChange={(e) => setFieldValue(f.key, e.target.value)}
                    placeholder={f.placeholder}
                  />
                </div>
              ))}
            </div>

            {/* Meta Ads: auto-resolve button + result preview */}
            {isMetaChannel && (
              <div className="space-y-2 pt-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={resolveMetaPage}
                  disabled={resolving || !fieldValue("meta_ads_account_id").trim()}
                  className="gap-2"
                >
                  {resolving
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <Wand2 className="h-3.5 w-3.5" />}
                  {resolving ? "מאתר עמוד..." : "שייך עמוד אוטומטית מחשבון המודעות"}
                </Button>

                {resolvedPage && (
                  <div className="flex items-start gap-2 rounded-md border border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-800 p-3 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                    <div className="space-y-0.5">
                      <p className="font-medium text-green-800 dark:text-green-300">
                        {resolvedPage.page_name || resolvedPage.page_id}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Page ID: {resolvedPage.page_id}
                        {resolvedPage.ig_username && ` · Instagram: @${resolvedPage.ig_username}`}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </Card>
        );
      })}

      <div className="flex gap-2">
        <Button size="sm" onClick={saveClientFields} disabled={saving}>
          {saving ? "שומר..." : "שמור חיבורים"}
        </Button>
        <Button size="sm" variant="secondary" onClick={handleProvision} disabled={provisioning}>
          {provisioning ? <Loader2 className="ml-1 h-4 w-4 animate-spin" /> : <LayoutDashboard className="ml-1 h-4 w-4" />}
          {provisioning ? "מקצה..." : "צור טבלאות + דשבורד"}
        </Button>
      </div>

      {/* Social pages — always shown */}
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
        {/* Manual add */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2 items-end pt-1">
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
          <Button size="sm" onClick={addPage}><Plus className="ml-1 h-4 w-4" /> הוסף ידנית</Button>
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
        <p className="text-xs text-muted-foreground">
          חיבור אתר WordPress חדש דורש פרטי גישה — בצע חיבור דרך מודול האינטגרציות.
        </p>
      </Card>
    </div>
  );
}
