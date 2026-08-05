import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Flame,
  Loader2,
  Pause,
  Play,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const CONFIRM_PHRASE = "אני מאשר שליחת חימום";

type Props = {
  tenantId: string;
  integrationId: string;
  displayPhone?: string;
  qualityRating?: string | null;
  initialAutoReplyEnabled?: boolean;
  initialThanksText?: string;
};

type Campaign = {
  id: string;
  name: string;
  status: string;
  stats?: Record<string, number>;
  optin_template_name?: string;
  audience_source?: string;
  created_at?: string;
  daily_cap?: number;
};

async function invokeWarm(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("meta-whatsapp-warm", { body });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}

export function MetaWhatsAppWarming({
  tenantId,
  integrationId,
  displayPhone,
  qualityRating,
  initialAutoReplyEnabled,
  initialThanksText,
}: Props) {
  const queryClient = useQueryClient();
  const [audienceSource, setAudienceSource] = useState("prior_meta_chats");
  const [manualPhones, setManualPhones] = useState("");
  const [campaignName, setCampaignName] = useState("חימום מספר לידים");
  const [thanksText, setThanksText] = useState(
    initialThanksText ||
      "תודה שפניתם אלינו. זהו מספר טלפון לשליחת לידים ועדכונים. תודה שאישרתם קבלת לידים.",
  );
  const [autoReplyEnabled, setAutoReplyEnabled] = useState(initialAutoReplyEnabled ?? false);
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [draftCampaignId, setDraftCampaignId] = useState<string | null>(null);
  const [draftPending, setDraftPending] = useState(0);
  const [confirmPhrase, setConfirmPhrase] = useState("");
  const [confirmCount, setConfirmCount] = useState("");
  const [understood, setUnderstood] = useState(false);
  const [dispatching, setDispatching] = useState(false);

  const campaignsQuery = useQuery({
    queryKey: ["wa-warm-campaigns", integrationId],
    queryFn: async () => {
      const data = await invokeWarm({
        action: "list_campaigns",
        tenant_id: tenantId,
        integration_id: integrationId,
      });
      return (data.campaigns ?? []) as Campaign[];
    },
  });

  const previewMutation = useMutation({
    mutationFn: async () =>
      invokeWarm({
        action: "preview_audience",
        tenant_id: tenantId,
        integration_id: integrationId,
        audience_source: audienceSource,
        manual_phones: manualPhones.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean),
      }),
    onSuccess: (data) => {
      setPreviewCount(data.count ?? 0);
      toast.success(`נמצאו ${data.count ?? 0} נמענים (אחרי סינון מי שכבר אישר)`);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "שגיאה"),
  });

  const ensureTemplateMutation = useMutation({
    mutationFn: async () =>
      invokeWarm({
        action: "ensure_optin_template",
        tenant_id: tenantId,
        integration_id: integrationId,
      }),
    onSuccess: (data) => toast.success(data.note || "תבנית מוכנה"),
    onError: (e) => toast.error(e instanceof Error ? e.message : "יצירת תבנית נכשלה"),
  });

  const autoReplyMutation = useMutation({
    mutationFn: async () =>
      invokeWarm({
        action: "configure_auto_reply",
        tenant_id: tenantId,
        integration_id: integrationId,
        enabled: autoReplyEnabled,
        thanks_text: thanksText,
        suppress_carmen: true,
      }),
    onSuccess: () => toast.success("הגדרות תגובה אוטומטית נשמרו"),
    onError: (e) => toast.error(e instanceof Error ? e.message : "שגיאה"),
  });

  const createMutation = useMutation({
    mutationFn: async () =>
      invokeWarm({
        action: "create_campaign",
        tenant_id: tenantId,
        integration_id: integrationId,
        name: campaignName,
        audience_source: audienceSource,
        manual_phones: manualPhones.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean),
        thanks_text: thanksText,
      }),
    onSuccess: (data) => {
      setDraftCampaignId(data.campaign?.id ?? null);
      setDraftPending(data.recipient_count ?? 0);
      setConfirmCount(String(data.recipient_count ?? 0));
      setUnderstood(false);
      setConfirmPhrase("");
      toast.success(`טיוטה נוצרה עם ${data.recipient_count} נמענים — נדרש אישור לפני שליחה`);
      queryClient.invalidateQueries({ queryKey: ["wa-warm-campaigns", integrationId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "שגיאה"),
  });

  const launchMutation = useMutation({
    mutationFn: async () => {
      if (!draftCampaignId) throw new Error("אין קמפיין");
      return invokeWarm({
        action: "confirm_and_launch",
        tenant_id: tenantId,
        integration_id: integrationId,
        campaign_id: draftCampaignId,
        confirm_phrase: confirmPhrase.trim(),
        confirm_count: Number(confirmCount),
      });
    },
    onSuccess: async (data) => {
      toast.success(`הקמפיין רץ (${data.pending} ממתינים)`);
      queryClient.invalidateQueries({ queryKey: ["wa-warm-campaigns", integrationId] });
      // Kick first batches from the UI (controlled, not fire-and-forget bulk)
      await runDispatchLoop(draftCampaignId!);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "אישור נכשל"),
  });

  const runDispatchLoop = async (campaignId: string) => {
    setDispatching(true);
    try {
      for (let i = 0; i < 40; i++) {
        const data = await invokeWarm({
          action: "dispatch_batch",
          tenant_id: tenantId,
          integration_id: integrationId,
          campaign_id: campaignId,
          batch_size: 3,
        });
        if (data.paused_daily_cap) {
          toast.message("הגעתם לתקרת היום — המשיכו מחר");
          break;
        }
        if (data.completed || (data.pending_left ?? 0) === 0) {
          toast.success("קמפיין החימום הסתיים");
          break;
        }
        await new Promise((r) => setTimeout(r, 15000));
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "שגיאה בשליחה");
    } finally {
      setDispatching(false);
      queryClient.invalidateQueries({ queryKey: ["wa-warm-campaigns", integrationId] });
    }
  };

  const canLaunch = useMemo(
    () =>
      Boolean(draftCampaignId) &&
      understood &&
      confirmPhrase.trim() === CONFIRM_PHRASE &&
      Number(confirmCount) === draftPending &&
      draftPending > 0,
    [draftCampaignId, understood, confirmPhrase, confirmCount, draftPending],
  );

  return (
    <section className="space-y-4 rounded-lg border bg-muted/20 p-4">
      <div>
        <h3 className="flex items-center gap-2 font-semibold">
          <Flame className="h-4 w-4 text-orange-600" />
          חימום מספר / אישור קבלת לידים
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          שולח תבנית אישור מאושרת לנמענים רלוונטיים, מתעד opt-in, ועונה אוטומטית על פניות נכנסות.
          מספר: <span dir="ltr">{displayPhone || "—"}</span>
          {qualityRating ? ` · איכות ${qualityRating}` : ""}
        </p>
      </div>

      <Alert>
        <ShieldCheck className="h-4 w-4" />
        <AlertTitle>לפני שליחה מסיבית</AlertTitle>
        <AlertDescription className="text-xs space-y-1">
          <p>1) צרו/המתינו לאישור תבנית <code dir="ltr">lead_optin_confirm_he</code> ב-Meta.</p>
          <p>2) העדיפו מספר עם Quality Rating ירוק (למשל DMM +972-77) אחרי Billing תקין.</p>
          <p>3) שליחה דורשת הקלדת משפט אישור + מספר נמענים מדויק — אין שליחה בטעות.</p>
          <p>4) אל תריצו מחדש על כשלונות 131049/131042 — זה מחמיר את Meta.</p>
        </AlertDescription>
      </Alert>

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => ensureTemplateMutation.mutate()}
          disabled={ensureTemplateMutation.isPending}
        >
          {ensureTemplateMutation.isPending ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : null}
          צור/בדוק תבנית אישור
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => campaignsQuery.refetch()}
          disabled={campaignsQuery.isFetching}
        >
          <RefreshCw className={`ml-2 h-4 w-4 ${campaignsQuery.isFetching ? "animate-spin" : ""}`} />
          רענן קמפיינים
        </Button>
      </div>

      <div className="space-y-2 rounded-md border p-3">
        <Label className="font-medium">תגובה אוטומטית נכנסת</Label>
        <div className="flex items-center gap-2">
          <Checkbox
            checked={autoReplyEnabled}
            onCheckedChange={(v) => setAutoReplyEnabled(v === true)}
            id="warm-auto-reply"
          />
          <Label htmlFor="warm-auto-reply" className="text-sm font-normal">
            כשמישהו כותב למספר הזה — שלח תגובת תודה/אישור (וכבה כרמן על המספר)
          </Label>
        </div>
        <Textarea
          value={thanksText}
          onChange={(e) => setThanksText(e.target.value)}
          rows={3}
          className="text-sm"
        />
        <Button
          size="sm"
          onClick={() => autoReplyMutation.mutate()}
          disabled={autoReplyMutation.isPending}
        >
          שמור תגובה אוטומטית
        </Button>
      </div>

      <div className="space-y-3 rounded-md border p-3">
        <Label className="font-medium">קמפיין חימום חדש</Label>
        <Input value={campaignName} onChange={(e) => setCampaignName(e.target.value)} />
        <div className="grid gap-2 sm:grid-cols-2">
          <div>
            <Label className="text-xs">קהל יעד</Label>
            <Select value={audienceSource} onValueChange={setAudienceSource}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="prior_meta_chats">מי שכבר דיבר עם המספר (Meta)</SelectItem>
                <SelectItem value="clients_with_phone">לקוחות פעילים עם טלפון</SelectItem>
                <SelectItem value="manual">רשימת מספרים ידנית</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {previewCount !== null && (
            <div className="flex items-end">
              <Badge variant="outline">{previewCount} נמענים בתצוגה מקדימה</Badge>
            </div>
          )}
        </div>
        {audienceSource === "manual" && (
          <Textarea
            placeholder="מספר בכל שורה"
            value={manualPhones}
            onChange={(e) => setManualPhones(e.target.value)}
            rows={4}
            dir="ltr"
          />
        )}
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => previewMutation.mutate()}
            disabled={previewMutation.isPending}
          >
            תצוגה מקדימה
          </Button>
          <Button
            size="sm"
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isPending}
          >
            צור טיוטה (בלי לשלוח)
          </Button>
        </div>
      </div>

      {draftCampaignId && (
        <div className="space-y-3 rounded-md border border-amber-300 bg-amber-50/60 p-3 dark:bg-amber-950/20">
          <p className="text-sm font-medium">אישור שליחה מבוקרת</p>
          <p className="text-xs text-muted-foreground">
            קמפיין <code dir="ltr">{draftCampaignId.slice(0, 8)}</code> · {draftPending} נמענים
          </p>
          <div className="flex items-center gap-2">
            <Checkbox
              checked={understood}
              onCheckedChange={(v) => setUnderstood(v === true)}
              id="warm-understood"
            />
            <Label htmlFor="warm-understood" className="text-xs font-normal">
              אני מבין/ה שזו שליחת תבניות Meta בתשלום/מגבלה, ושלא אריץ מחדש על 131049
            </Label>
          </div>
          <div>
            <Label className="text-xs">הקלידו בדיוק: {CONFIRM_PHRASE}</Label>
            <Input value={confirmPhrase} onChange={(e) => setConfirmPhrase(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">מספר נמענים לאישור</Label>
            <Input
              type="number"
              value={confirmCount}
              onChange={(e) => setConfirmCount(e.target.value)}
            />
          </div>
          <Button
            onClick={() => launchMutation.mutate()}
            disabled={!canLaunch || launchMutation.isPending || dispatching}
          >
            {dispatching || launchMutation.isPending ? (
              <Loader2 className="ml-2 h-4 w-4 animate-spin" />
            ) : (
              <Play className="ml-2 h-4 w-4" />
            )}
            אשר והתחל שליחה מדורגת
          </Button>
        </div>
      )}

      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">קמפיינים אחרונים</Label>
        {(campaignsQuery.data ?? []).length === 0 ? (
          <p className="text-xs text-muted-foreground">אין עדיין קמפייני חימום.</p>
        ) : (
          <ul className="space-y-2">
            {(campaignsQuery.data ?? []).map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-2 rounded border p-2 text-xs">
                <Badge variant="outline">{c.status}</Badge>
                <span className="font-medium">{c.name}</span>
                <span className="text-muted-foreground">
                  סה״כ {c.stats?.total ?? "—"} · נשלח {c.stats?.sent ?? 0} · נכשל {c.stats?.failed ?? 0} ·
                  אישר {c.stats?.opted_in ?? 0}
                </span>
                {c.status === "running" && (
                  <>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={dispatching}
                      onClick={() => runDispatchLoop(c.id)}
                    >
                      <Play className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={async () => {
                        await invokeWarm({
                          action: "pause_campaign",
                          tenant_id: tenantId,
                          integration_id: integrationId,
                          campaign_id: c.id,
                        });
                        campaignsQuery.refetch();
                      }}
                    >
                      <Pause className="h-3 w-3" />
                    </Button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
