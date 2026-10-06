import { Facebook } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  formatLastClientCall,
  formatPulseMoney,
  pulseSpendColumnLabel,
  type PulseSnapshotRow,
} from "@/lib/pulseDashboard";
import {
  campaignDeliveryStatusLabel,
  type PulseCampaignGoal,
  type PulseCampaignGoalRow,
} from "@/lib/pulseCampaignGoals";
import { ExternalLink } from "lucide-react";
import type { PulsePeriod } from "@/lib/pulseDashboard";

const GOAL_SECTION_LABELS: Record<PulseCampaignGoal, string> = {
  leads: "לידים",
  engagement: "אינגייג׳מנט",
  ecommerce: "איקומרס",
  unknown: "טעון סיווג",
};

const GOAL_SECTION_ORDER: PulseCampaignGoal[] = ["leads", "engagement", "ecommerce", "unknown"];

const formatNumber = (value: number | null | undefined) =>
  value === null || value === undefined ? "—" : new Intl.NumberFormat("he-IL").format(Math.round(value));

const formatDate = (value: string | null | undefined) =>
  value
    ? new Date(value.length === 10 ? `${value}T12:00:00Z` : value).toLocaleString("he-IL", {
        timeZone: "Asia/Jerusalem",
        dateStyle: "short",
        ...(value.length === 10 ? {} : { timeStyle: "short" as const }),
      })
    : "—";

const outcomeColumnLabel = (goal: PulseCampaignGoal, outcomeKind: string | null) => {
  if (goal === "leads") return "לידים";
  if (goal === "ecommerce") return "רכישות";
  if (goal === "engagement") {
    const labels: Record<string, string> = {
      video_views: "צפיות",
      conversations: "שיחות",
      messages: "הודעות",
      engagements: "אינטראקציות",
      link_clicks: "קליקים",
      landing_page_views: "צפיות בדף",
    };
    return outcomeKind ? labels[outcomeKind] || "תוצאות" : "תוצאות";
  }
  return "תוצאות";
};

const efficiencyColumnLabel = (row: PulseCampaignGoalRow) => {
  if (row.goal === "ecommerce") return "ROAS";
  if (row.goal === "leads") return "עלות לליד";
  if (row.goal === "engagement") return "עלות לתוצאה";
  return "יעילות";
};

const formatEfficiency = (row: PulseCampaignGoalRow) => {
  if (row.efficiency_7d === null || row.efficiency_7d === undefined) return "—";
  if (row.goal === "ecommerce") return row.efficiency_7d.toFixed(2);
  return formatPulseMoney(row.efficiency_7d);
};

const platformLabel = (platform: PulseCampaignGoalRow["platform"]) =>
  platform === "meta" ? "Meta" : "Google Ads";

function PlatformIcon({ platform }: { platform: PulseCampaignGoalRow["platform"] }) {
  if (platform === "meta") {
    return <Facebook className="h-3.5 w-3.5 text-blue-600 shrink-0" aria-hidden />;
  }
  return (
    <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M3.654 14.916l6.26-10.857c.68-1.18 2.184-1.59 3.361-.916l.004.003c1.178.68 1.586 2.184.909 3.361l-6.26 10.857c-.68 1.18-2.184 1.59-3.361.916l-.004-.003c-1.178-.68-1.586-2.184-.909-3.361z" fill="#FBBC04" />
      <path d="M14.088 14.916l6.26-10.857c.68-1.18.27-2.684-.909-3.361l-.004-.003c-1.177-.674-2.681-.264-3.361.916l-6.26 10.857c-.68 1.18-.27 2.684.909 3.361l.004.003c1.177.674 2.681.264 3.361-.916z" fill="#4285F4" />
      <circle cx="6" cy="18" r="3.5" fill="#34A853" />
    </svg>
  );
}

function CampaignGoalTable({
  goal,
  campaigns,
  period,
}: {
  goal: PulseCampaignGoal;
  campaigns: PulseCampaignGoalRow[];
  period: PulsePeriod;
}) {
  const spendLabel = pulseSpendColumnLabel(period).split(" ")[0];
  const outcomeLabel = outcomeColumnLabel(goal, campaigns[0]?.outcome_kind ?? null);
  const showRevenue = goal === "ecommerce";

  return (
    <div className="overflow-x-auto rounded-md border">
      <Table dir="rtl">
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            <TableHead className="text-right whitespace-nowrap">קמפיין</TableHead>
            <TableHead className="text-right whitespace-nowrap">פלטפורמה</TableHead>
            <TableHead className="text-right whitespace-nowrap">מצב</TableHead>
            <TableHead className="text-right whitespace-nowrap">{spendLabel}</TableHead>
            <TableHead className="text-right whitespace-nowrap">{outcomeLabel}</TableHead>
            {showRevenue ? <TableHead className="text-right whitespace-nowrap">הכנסה</TableHead> : null}
            <TableHead className="text-right whitespace-nowrap">{efficiencyColumnLabel(campaigns[0] ?? { goal } as PulseCampaignGoalRow)}</TableHead>
            <TableHead className="text-right whitespace-nowrap">נתונים עד</TableHead>
            <TableHead className="text-right whitespace-nowrap">שינוי אחרון</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {campaigns.map((row) => (
            <TableRow key={row.campaign_key}>
              <TableCell className="font-medium max-w-[12rem] truncate" title={row.campaign_name}>
                {row.campaign_name}
              </TableCell>
              <TableCell>
                <span className="inline-flex items-center gap-1 text-xs">
                  <PlatformIcon platform={row.platform} />
                  {platformLabel(row.platform)}
                </span>
              </TableCell>
              <TableCell>
                <Badge variant="outline" className="text-[10px] font-normal">
                  {campaignDeliveryStatusLabel(row.delivery_status || "unknown")}
                </Badge>
              </TableCell>
              <TableCell className="tabular-nums">{formatPulseMoney(row.spend_7d)}</TableCell>
              <TableCell className="tabular-nums">{formatNumber(row.outcomes_7d)}</TableCell>
              {showRevenue ? (
                <TableCell className="tabular-nums">{formatPulseMoney(row.revenue_7d)}</TableCell>
              ) : null}
              <TableCell className="tabular-nums">{formatEfficiency(row)}</TableCell>
              <TableCell className="text-xs whitespace-nowrap">{formatDate(row.data_fresh_through)}</TableCell>
              <TableCell className="text-xs whitespace-nowrap">{formatDate(row.last_change_at)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export type PulseClientRawCardProps = {
  clientName: string;
  campaignerName: string;
  agencyName: string;
  period: PulsePeriod;
  pulse: PulseSnapshotRow | null;
  campaignsByGoal: Partial<Record<PulseCampaignGoal, PulseCampaignGoalRow[]>>;
  lastCampaignTouchAt: string | null;
  onOpenClient: () => void;
  onCallLog: () => void;
};

export function PulseClientRawCard({
  clientName,
  campaignerName,
  agencyName,
  period,
  pulse,
  campaignsByGoal,
  lastCampaignTouchAt,
  onOpenClient,
  onCallLog,
}: PulseClientRawCardProps) {
  const callSnapshot: PulseSnapshotRow = pulse ?? {
    client_id: "",
    agency_id: null,
    status: "no_data",
    is_ecommerce: false,
    spend_7d: 0,
    leads_7d: null,
    cpl_7d: null,
    cpl_change_pct: null,
    purchases_7d: null,
    revenue_7d: null,
    roas_7d: null,
    flags: [],
    data_fresh_through: null,
    calculated_at: null,
    last_client_call_at: null,
    last_client_call_by: null,
  };

  const sections = GOAL_SECTION_ORDER
    .map((goal) => ({
      goal,
      label: GOAL_SECTION_LABELS[goal],
      campaigns: (campaignsByGoal[goal] ?? []).slice().sort((a, b) => a.campaign_name.localeCompare(b.campaign_name, "he")),
    }))
    .filter((section) => section.campaigns.length > 0);

  return (
    <Card className="border shadow-sm">
      <CardHeader className="pb-3 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <CardTitle className="text-lg font-semibold">{clientName}</CardTitle>
          <div className="flex flex-wrap gap-1">
            <Button variant="outline" size="sm" className="h-8" onClick={onOpenClient}>
              <ExternalLink className="ml-1 h-3.5 w-3.5" />
              כרטיס לקוח
            </Button>
            {pulse ? (
              <Button variant="outline" size="sm" className="h-8" onClick={onCallLog}>
                שיחת לקוח
              </Button>
            ) : null}
          </div>
        </div>

        <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <span className="text-muted-foreground">סוכנות: </span>
            {agencyName}
          </div>
          <div>
            <span className="text-muted-foreground">קמפיינר: </span>
            {campaignerName}
          </div>
          <div>
            <span className="text-muted-foreground">שיחה אחרונה: </span>
            <button
              type="button"
              className="underline decoration-dotted underline-offset-2 hover:text-primary"
              onClick={onCallLog}
              disabled={!pulse}
            >
              {formatLastClientCall(callSnapshot)}
            </button>
          </div>
          <div>
            <span className="text-muted-foreground">נגיעה בקמפיין: </span>
            {formatDate(lastCampaignTouchAt)}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {sections.length === 0 ? (
          <p className="text-sm text-muted-foreground">אין קמפיינים עם הוצאה בטווח שנבחר</p>
        ) : (
          sections.map((section) => (
            <div key={section.goal} className="space-y-2">
              <h3 className="text-sm font-medium text-foreground">{section.label}</h3>
              <CampaignGoalTable goal={section.goal} campaigns={section.campaigns} period={period} />
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
