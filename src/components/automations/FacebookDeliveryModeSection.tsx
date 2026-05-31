import { useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Copy, Loader2, Webhook, RefreshCw, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Props {
  integrationId?: string;
  pageId?: string;
  pageName?: string;
  tenantId?: string;
}

const CALLBACK_URL = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/facebook-lead-webhook`;

export function FacebookDeliveryModeSection({ integrationId, pageId, pageName }: Props) {
  const { toast } = useToast();
  const [mode, setMode] = useState<"pull" | "webhook">("pull");
  const [pageSubs, setPageSubs] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);
  const [subscribing, setSubscribing] = useState(false);

  const loadSettings = async () => {
    if (!integrationId) return;
    setLoading(true);
    const { data } = await supabase
      .from("tenant_integrations")
      .select("settings")
      .eq("id", integrationId)
      .maybeSingle();
    const s = (data?.settings as any) ?? {};
    setMode(s.delivery_mode === "webhook" ? "webhook" : "pull");
    setPageSubs(s.page_subscriptions ?? {});
    setLoading(false);
  };

  useEffect(() => { loadSettings(); }, [integrationId]);

  const updateMode = async (newMode: "pull" | "webhook") => {
    if (!integrationId) return;
    setMode(newMode);
    const { data } = await supabase
      .from("tenant_integrations")
      .select("settings")
      .eq("id", integrationId)
      .maybeSingle();
    const s = (data?.settings as any) ?? {};
    await supabase
      .from("tenant_integrations")
      .update({ settings: { ...s, delivery_mode: newMode } })
      .eq("id", integrationId);
    toast({ title: "מצב נשמר", description: newMode === "webhook" ? "Webhook מיידי" : "משיכה כל דקה" });
  };

  const subscribePage = async () => {
    if (!integrationId || !pageId) return;
    setSubscribing(true);
    try {
      const { data, error } = await supabase.functions.invoke("facebook-subscribe-page", {
        body: { integration_id: integrationId, page_id: pageId, action: "subscribe" },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast({ title: "העמוד נרשם ל-Webhook" });
      await loadSettings();
    } catch (e: any) {
      toast({
        title: "שגיאה ברישום העמוד",
        description: e?.message || "בדוק שה-Access Token כולל pages_manage_metadata",
        variant: "destructive",
      });
    } finally {
      setSubscribing(false);
    }
  };

  const copy = (txt: string, label: string) => {
    navigator.clipboard.writeText(txt);
    toast({ title: "הועתק!", description: label });
  };

  const pageStatus = pageId ? pageSubs[pageId] : null;

  return (
    <div className="rounded-lg border bg-card p-3 space-y-3">
      <div className="flex items-center justify-between">
        <Webhook className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium">מצב קבלת לידים</span>
      </div>

      <RadioGroup
        dir="rtl"
        value={mode}
        onValueChange={(v) => updateMode(v as "pull" | "webhook")}
        disabled={loading}
        className="gap-2"
      >
        <label className="flex items-center justify-end gap-2 text-xs cursor-pointer">
          <span>משיכה אוטומטית (כל דקה) — ברירת מחדל</span>
          <RadioGroupItem value="pull" id="dm-pull" />
        </label>
        <label className="flex items-center justify-end gap-2 text-xs cursor-pointer">
          <span>Webhook מיידי מ-Meta</span>
          <RadioGroupItem value="webhook" id="dm-webhook" />
        </label>
      </RadioGroup>

      {mode === "webhook" && (
        <div className="space-y-3 pt-2 border-t">
          <div className="space-y-2 text-right">
            <p className="text-[10px] text-muted-foreground">
              העתק את הפרטים האלה ל-Meta App → Webhooks → Page:
            </p>
            <div className="flex items-center gap-1">
              <Button size="sm" variant="ghost" className="h-6 px-2" onClick={() => copy(CALLBACK_URL, "Callback URL")}>
                <Copy className="h-3 w-3" />
              </Button>
              <code className="text-[10px] flex-1 truncate bg-muted px-2 py-1 rounded">{CALLBACK_URL}</code>
              <Label className="text-[10px]">Callback URL:</Label>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Verify Token: השתמש בערך שהוגדר ב-Secret <code>META_WEBHOOK_VERIFY_TOKEN</code>. סמן את השדה <code>leadgen</code>.
            </p>
          </div>

          {pageId && (
            <div className="space-y-2 pt-2 border-t">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {pageStatus?.status === "subscribed" ? (
                    <Badge variant="default" className="text-[10px] gap-1">
                      <CheckCircle2 className="h-3 w-3" /> רשום
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-[10px]">לא רשום</Badge>
                  )}
                </div>
                <span className="text-xs">{pageName || pageId}</span>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="w-full text-xs"
                onClick={subscribePage}
                disabled={subscribing}
              >
                {subscribing ? (
                  <Loader2 className="h-3 w-3 me-1 animate-spin" />
                ) : (
                  <RefreshCw className="h-3 w-3 me-1" />
                )}
                {pageStatus?.status === "subscribed" ? "רשום מחדש את העמוד" : "רשום עמוד ל-Webhook"}
              </Button>
              {pageStatus?.subscribed_at && (
                <p className="text-[10px] text-muted-foreground text-right">
                  נרשם: {new Date(pageStatus.subscribed_at).toLocaleString("he-IL")}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
