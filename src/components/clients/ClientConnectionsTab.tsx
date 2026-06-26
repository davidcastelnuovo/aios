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
import { Plus, Trash2, Megaphone, Share2, Link2 } from "lucide-react";
import {
  CLIENT_CHANNELS,
  isChannelActive,
  ALL_CHANNEL_FIELD_KEYS,
  type ChannelFieldKey,
} from "@/config/clientChannels";

interface Props {
  clientId: string;
  tenantId: string;
}

export function ClientConnectionsTab({ clientId, tenantId }: Props) {
  const conns = useClientConnections(clientId);

  // Local edits keyed by client column; falls back to the saved value when untouched.
  const [edits, setEdits] = useState<Partial<Record<ChannelFieldKey, string>>>({});
  const [saving, setSaving] = useState(false);

  const [newPagePlatform, setNewPagePlatform] = useState("facebook");
  const [newPageId, setNewPageId] = useState("");
  const [newPageName, setNewPageName] = useState("");

  if (conns.isLoading || !conns.data) return <div className="p-4 text-sm text-muted-foreground">טוען חיבורים...</div>;

  const c = conns.data.client as Record<string, any> | null;
  const services: string[] = Array.isArray(c?.services) ? c!.services : [];
  const activeChannels = CLIENT_CHANNELS.filter((ch) => isChannelActive(ch, services));

  const fieldValue = (key: ChannelFieldKey): string => edits[key] ?? (c?.[key] ?? "") ?? "";
  const setFieldValue = (key: ChannelFieldKey, value: string) => setEdits((prev) => ({ ...prev, [key]: value }));

  const saveClientFields = async () => {
    setSaving(true);
    // Only persist fields belonging to channels currently active for this client.
    const activeKeys = new Set<ChannelFieldKey>(activeChannels.flatMap((ch) => ch.fields.map((f) => f.key)));
    const payload: Record<string, string | null> = {};
    for (const key of ALL_CHANNEL_FIELD_KEYS) {
      if (!activeKeys.has(key)) continue;
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

  const showFacebookPages = activeChannels.some((ch) => ch.showFacebookPages);

  return (
    <div className="space-y-4" dir="rtl">
      {/* Per-channel connection fields — only channels the client is marked for */}
      {activeChannels.map((ch) => {
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
          </Card>
        );
      })}

      <Button size="sm" onClick={saveClientFields} disabled={saving}>
        {saving ? "שומר..." : "שמור חיבורים"}
      </Button>

      {/* Social pages — shown only when a channel that uses Facebook pages is active */}
      {showFacebookPages && (
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
      )}

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
