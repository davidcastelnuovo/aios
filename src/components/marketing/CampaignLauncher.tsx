/**
 * CampaignLauncher
 * Shown inside WorkItemSidePanel when the current stage is `target_paid`.
 * Lets the user pick a Meta ad account (loaded from tenant_integrations),
 * set a budget and objective, then launch via fb-campaign-control / google-ads-auth.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Megaphone,
  Loader2,
  CheckCircle2,
  ExternalLink,
  Facebook,
  Globe,
  AlertTriangle,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type Platform = "meta" | "google";

interface AdAccount {
  id: string;
  name: string;
  platform: Platform;
  account_id: string;
}

interface LaunchResult {
  platform: Platform;
  success: boolean;
  campaign_id?: string;
  error?: string;
}

// ─── Meta objectives ──────────────────────────────────────────────────────────

const META_OBJECTIVES = [
  { value: "OUTCOME_AWARENESS", label: "מודעות למותג" },
  { value: "OUTCOME_TRAFFIC", label: "תנועה לאתר" },
  { value: "OUTCOME_ENGAGEMENT", label: "מעורבות" },
  { value: "OUTCOME_LEADS", label: "לידים" },
  { value: "OUTCOME_SALES", label: "מכירות" },
];

const GOOGLE_OBJECTIVES = [
  { value: "SEARCH", label: "חיפוש (Search)" },
  { value: "DISPLAY", label: "תצוגה (Display)" },
  { value: "PERFORMANCE_MAX", label: "Performance Max" },
  { value: "SHOPPING", label: "Shopping" },
];

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  workItemId: string;
  tenantId: string;
  clientId: string;
  /** Copy text extracted from the work item payload */
  copyText?: string;
  /** Image URL from the work item payload */
  imageUrl?: string;
  /** Campaign name suggestion */
  campaignName?: string;
}

export function CampaignLauncher({
  workItemId,
  tenantId,
  clientId,
  copyText,
  imageUrl,
  campaignName = "קמפיין חדש",
}: Props) {
  const [platform, setPlatform] = useState<Platform>("meta");
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [objective, setObjective] = useState("OUTCOME_LEADS");
  const [dailyBudget, setDailyBudget] = useState("50");
  const [name, setName] = useState(campaignName);
  const [launching, setLaunching] = useState(false);
  const [result, setResult] = useState<LaunchResult | null>(null);

  // ─── Load ad accounts from tenant_integrations ───────────────────────────

  const { data: accounts = [], isLoading: loadingAccounts } = useQuery({
    queryKey: ["ad-accounts", tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("tenant_integrations")
        .select("id, integration_type, settings, display_name")
        .eq("tenant_id", tenantId)
        .eq("is_active", true)
        .in("integration_type", ["facebook_ads", "google_ads", "meta_ads"]);

      const accounts: AdAccount[] = [];
      (data ?? []).forEach((row: any) => {
        const isMeta =
          row.integration_type === "facebook_ads" ||
          row.integration_type === "meta_ads";
        const isGoogle = row.integration_type === "google_ads";
        const accountId =
          row.settings?.ad_account_id ??
          row.settings?.account_id ??
          row.company_id ??
          row.id;
        accounts.push({
          id: row.id,
          name: row.display_name ?? (isMeta ? "Meta Ads" : "Google Ads"),
          platform: isMeta ? "meta" : "google",
          account_id: accountId,
        });
      });
      return accounts;
    },
  });

  const filteredAccounts = accounts.filter((a) => a.platform === platform);

  // ─── Launch ───────────────────────────────────────────────────────────────

  const handleLaunch = async () => {
    if (!selectedAccountId && filteredAccounts.length > 0) {
      toast.error("בחר חשבון פרסום");
      return;
    }
    setLaunching(true);
    setResult(null);

    try {
      if (platform === "meta") {
        // Create a new campaign via Meta Graph API through fb-campaign-control
        // First we need to create a campaign (not just update) — use the Graph API directly
        const account = filteredAccounts.find((a) => a.id === selectedAccountId) ?? filteredAccounts[0];
        if (!account) throw new Error("לא נמצא חשבון Meta Ads מחובר");

        const { data, error } = await supabase.functions.invoke("fb-campaign-control", {
          body: {
            tenant_id: tenantId,
            action: "create_campaign",
            ad_account_id: account.account_id,
            name: name,
            objective,
            daily_budget: parseFloat(dailyBudget),
            status: "PAUSED", // Start paused — user activates manually
            special_ad_categories: [],
          },
        });

        if (error || data?.error) {
          throw new Error(data?.error ?? error?.message ?? "שגיאה בהשקת קמפיין Meta");
        }

        // Save campaign reference to work item payload
        await supabase
          .from("marketing_work_items")
          .update({
            payload: {
              campaign_platform: "meta",
              campaign_id: data.campaign_id,
              campaign_name: name,
              ad_account_id: account.account_id,
              launched_at: new Date().toISOString(),
            },
            status: "in_progress",
          })
          .eq("id", workItemId);

        setResult({ platform: "meta", success: true, campaign_id: data.campaign_id });
        toast.success("קמפיין Meta הושק בהצלחה! (במצב מושהה)");
      } else {
        // Google Ads — invoke google-ads-auth with create_campaign action
        const account = filteredAccounts.find((a) => a.id === selectedAccountId) ?? filteredAccounts[0];
        if (!account) throw new Error("לא נמצא חשבון Google Ads מחובר");

        const { data, error } = await supabase.functions.invoke("google-ads-auth", {
          body: {
            action: "create_campaign",
            customer_id: account.account_id,
            name,
            advertising_channel_type: objective,
            daily_budget_micros: Math.round(parseFloat(dailyBudget) * 1_000_000),
            status: "PAUSED",
          },
        });

        if (error || data?.error) {
          throw new Error(data?.error ?? error?.message ?? "שגיאה בהשקת קמפיין Google");
        }

        await supabase
          .from("marketing_work_items")
          .update({
            payload: {
              campaign_platform: "google",
              campaign_id: data.campaign_id ?? data.resource_name,
              campaign_name: name,
              customer_id: account.account_id,
              launched_at: new Date().toISOString(),
            },
            status: "in_progress",
          })
          .eq("id", workItemId);

        setResult({ platform: "google", success: true, campaign_id: data.campaign_id ?? data.resource_name });
        toast.success("קמפיין Google Ads הושק בהצלחה! (במצב מושהה)");
      }
    } catch (err: any) {
      const msg = err.message ?? "שגיאה לא ידועה";
      setResult({ platform, success: false, error: msg });
      toast.error(msg);
    } finally {
      setLaunching(false);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  if (result?.success) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-right" dir="rtl">
        <div className="flex items-center gap-2 text-emerald-700">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <span className="font-semibold">
            קמפיין {result.platform === "meta" ? "Meta" : "Google"} הושק!
          </span>
        </div>
        <p className="mt-1 text-sm text-emerald-600">
          הקמפיין נוצר במצב <strong>מושהה</strong> — כנס לממשק הפרסום כדי להפעיל אותו.
        </p>
        {result.campaign_id && (
          <div className="mt-2 flex items-center gap-2">
            <code className="rounded bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800">
              {result.campaign_id}
            </code>
            {result.platform === "meta" && (
              <a
                href={`https://business.facebook.com/adsmanager/manage/campaigns?act=${result.campaign_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-emerald-700 hover:underline"
              >
                <ExternalLink className="h-3 w-3" />
                פתח ב-Ads Manager
              </a>
            )}
          </div>
        )}
        <Button
          variant="outline"
          size="sm"
          className="mt-3"
          onClick={() => setResult(null)}
        >
          השק קמפיין נוסף
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-xl border p-4" dir="rtl">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-100">
          <Megaphone className="h-4 w-4 text-rose-600" />
        </div>
        <div>
          <p className="text-sm font-semibold">השקת קמפיין ממומן</p>
          <p className="text-xs text-muted-foreground">בחר פלטפורמה, חשבון ותקציב</p>
        </div>
      </div>

      <Separator />

      {/* Platform toggle */}
      <div className="flex gap-2">
        {(["meta", "google"] as Platform[]).map((p) => (
          <button
            key={p}
            onClick={() => { setPlatform(p); setSelectedAccountId(""); setObjective(p === "meta" ? "OUTCOME_LEADS" : "SEARCH"); }}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-lg border py-2 text-sm font-medium transition-all",
              platform === p
                ? p === "meta"
                  ? "border-blue-500 bg-blue-50 text-blue-700"
                  : "border-orange-400 bg-orange-50 text-orange-700"
                : "border-border text-muted-foreground hover:border-muted-foreground/50"
            )}
          >
            {p === "meta" ? <Facebook className="h-4 w-4" /> : <Globe className="h-4 w-4" />}
            {p === "meta" ? "Meta Ads" : "Google Ads"}
          </button>
        ))}
      </div>

      {/* Ad account selector */}
      {loadingAccounts ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          טוען חשבונות פרסום...
        </div>
      ) : filteredAccounts.length === 0 ? (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            לא נמצא חשבון {platform === "meta" ? "Meta Ads" : "Google Ads"} מחובר לטנאנט.
            חבר חשבון בהגדרות האינטגרציות.
          </span>
        </div>
      ) : (
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">חשבון פרסום</label>
          <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
            <SelectTrigger>
              <SelectValue placeholder="בחר חשבון..." />
            </SelectTrigger>
            <SelectContent>
              {filteredAccounts.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name} ({a.account_id})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Campaign name */}
      <div>
        <label className="mb-1 block text-xs text-muted-foreground">שם הקמפיין</label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="שם הקמפיין..." />
      </div>

      {/* Objective */}
      <div>
        <label className="mb-1 block text-xs text-muted-foreground">מטרת הקמפיין</label>
        <Select value={objective} onValueChange={setObjective}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(platform === "meta" ? META_OBJECTIVES : GOOGLE_OBJECTIVES).map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Budget */}
      <div>
        <label className="mb-1 block text-xs text-muted-foreground">תקציב יומי (₪)</label>
        <Input
          type="number"
          min="5"
          step="5"
          value={dailyBudget}
          onChange={(e) => setDailyBudget(e.target.value)}
          placeholder="50"
        />
      </div>

      {/* Content preview */}
      {(copyText || imageUrl) && (
        <div className="rounded-lg bg-muted/50 p-3">
          <p className="mb-1 text-xs font-medium text-muted-foreground">תוכן שיצורף לקמפיין</p>
          {imageUrl && (
            <img src={imageUrl} alt="" className="mb-2 h-20 w-full rounded object-cover" />
          )}
          {copyText && (
            <p className="line-clamp-3 text-xs text-muted-foreground">{copyText}</p>
          )}
        </div>
      )}

      {/* Launch button */}
      <Button
        className="w-full gap-2"
        onClick={handleLaunch}
        disabled={launching || (filteredAccounts.length > 0 && !selectedAccountId && filteredAccounts.length > 1)}
      >
        {launching ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Zap className="h-4 w-4" />
        )}
        {launching ? "מקים קמפיין..." : `השק קמפיין ${platform === "meta" ? "Meta" : "Google"}`}
      </Button>

      <p className="text-center text-[10px] text-muted-foreground">
        הקמפיין יופעל במצב מושהה — תצטרך להפעיל אותו ידנית בממשק הפרסום
      </p>
    </div>
  );
}
