import { Facebook, FileSpreadsheet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { CampaignRecord, ClientCampaignTableData } from "@/lib/agencyCampaignData";
import type { OverallStatus } from "@/lib/healthScore";
import {
  formatGoalChange,
  formatGoalEfficiency,
  formatGoalOutcomes,
  formatLastClientCall,
  formatMetaChangeDetails,
  formatPulseMoney,
  metaChangeSummary,
  overallStatusLabel,
  pulseSpendColumnLabel,
  pulseStatusLabel,
  type PulsePeriod,
  type PulsePlatformDisplayRow,
  type PulseSnapshotRow,
} from "@/lib/pulseDashboard";
import { ExternalLink, Pencil } from "lucide-react";
import type { PulseCampaignGoalRow } from "@/lib/pulseCampaignGoals";

const PLATFORM_CONFIG: Record<string, { name: string; color: string }> = {
  facebook_insights: { name: "Facebook", color: "text-blue-600" },
  facebook_ecommerce: { name: "Facebook", color: "text-blue-600" },
  google_ads: { name: "Google Ads", color: "text-red-500" },
};

const formatCurrency = (num: number) =>
  new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS", maximumFractionDigits: 0 }).format(num);

const formatNumber = (num: number) => new Intl.NumberFormat("he-IL").format(Math.round(num));

const campaignGoalLabel = (goal: PulseCampaignGoalRow["goal"]) => {
  if (goal === "ecommerce") return "איקומרס";
  if (goal === "engagement") return "אינגייג׳מנט";
  if (goal === "leads") return "לידים";
  return "טעון סיווג";
};

const outcomeLabel = (kind: string | null) => {
  const labels: Record<string, string> = {
    leads: "לידים",
    purchases: "רכישות",
    conversations: "שיחות",
    messages: "הודעות",
    video_views: "צפיות",
    engagements: "אינטראקציות",
    landing_page_views: "צפיות בדף",
    link_clicks: "קליקים",
    clicks: "קליקים",
    results: "תוצאות",
  };
  return kind ? labels[kind] || "תוצאות" : "תוצאה חסרה";
};

const formatDate = (value: string | null) =>
  value
    ? new Date(value.length === 10 ? `${value}T12:00:00Z` : value).toLocaleString("he-IL", {
        timeZone: "Asia/Jerusalem",
        dateStyle: "short",
        ...(value.length === 10 ? {} : { timeStyle: "short" as const }),
      })
    : "לא זמין";

export function PulseCampaignGoalCard({
  row,
  clientName,
  campaignerName,
  onOpenClient,
}: {
  row: PulseCampaignGoalRow;
  clientName: string;
  campaignerName: string;
  onOpenClient: () => void;
}) {
  const statusColor =
    row.status === "critical"
      ? "border-red-200 bg-surface-status-red"
      : row.status === "warning" || row.goal === "unknown"
        ? "border-yellow-200 bg-surface-status-yellow"
        : "";
  const efficiencyLabel =
    row.target_kind === "roas" || (row.goal === "ecommerce" && row.target_kind !== "cpa")
      ? "ROAS"
      : row.goal === "leads"
        ? "CPL"
        : row.goal === "ecommerce"
          ? "CPA"
          : "עלות לתוצאה";

  return (
    <Card className={statusColor}>
      <CardHeader className="pb-3 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <CardTitle className="flex min-w-0 items-center gap-2 text-lg">
            <StatusDot status={row.status === "critical" ? "red" : row.status === "healthy" ? "green" : "yellow"} />
            <span className="truncate">{clientName}</span>
            <Badge variant="outline">{campaignGoalLabel(row.goal)}</Badge>
          </CardTitle>
          <div className="text-left">
            <div className="font-semibold">{row.campaign_name}</div>
            <div className="text-xs text-muted-foreground">{row.platform === "meta" ? "Meta" : "Google Ads"}</div>
          </div>
        </div>

        <div className="rounded-md border bg-background/70 p-3 text-sm">
          <div className="font-medium">{row.status_reason}</div>
          <div className="mt-1 text-xs text-muted-foreground">
            {row.target_value === null
              ? "אין יעד מאושר — המגמה מוצגת עם מגבלת מסקנה"
              : `יעד מאושר: ${String(row.target_kind || "יעד").toUpperCase()} ${row.target_value}`}
          </div>
        </div>

        <div className="grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-4">
          <div><span className="text-muted-foreground">קמפיינר: </span>{campaignerName}</div>
          <div><span className="text-muted-foreground">נתונים עד: </span>{formatDate(row.data_fresh_through)}</div>
          <div><span className="text-muted-foreground">שינוי אחרון: </span>{formatDate(row.last_change_at)}</div>
          <div><span className="text-muted-foreground">סיווג: </span>{row.classification_source === "unclassified" ? "לא מזוהה" : "מטרת קמפיין"}</div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-2 rounded-md bg-muted/30 p-3 text-sm sm:grid-cols-4 lg:grid-cols-6">
          <div><span className="text-muted-foreground">הוצאה 7 ימים: </span><strong>{formatCurrency(row.spend_7d)}</strong></div>
          <div><span className="text-muted-foreground">{outcomeLabel(row.outcome_kind)}: </span><strong>{row.outcomes_7d ?? "חסר"}</strong></div>
          <div><span className="text-muted-foreground">{efficiencyLabel}: </span><strong>{row.efficiency_7d ?? "—"}</strong></div>
          {row.goal === "ecommerce" ? (
            <div><span className="text-muted-foreground">הכנסה (לא רווח): </span><strong>{formatCurrency(row.revenue_7d)}</strong></div>
          ) : (
            <div><span className="text-muted-foreground">חשיפות: </span><strong>{formatNumber(row.impressions_7d)}</strong></div>
          )}
          {row.goal === "engagement" ? (
            <>
              <div><span className="text-muted-foreground">תפוצה: </span><strong>{formatNumber(row.reach_7d)}</strong></div>
              <div><span className="text-muted-foreground">תדירות: </span><strong>{row.frequency_7d ?? "—"}</strong></div>
            </>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="text-muted-foreground">
            מגמה מול בסיס 28 יום מותאם לימי השבוע: 3 ימים {row.trend_3d_pct ?? "—"}% · 7 ימים {row.trend_7d_pct ?? "—"}%
            {" · "}היום החלקי לא נכלל
          </span>
          <Button variant="outline" size="sm" onClick={onOpenClient}>
            <ExternalLink className="ml-1 h-3.5 w-3.5" />
            פתח כרטיס
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function getIntegrationIcon(type: string) {
  switch (type) {
    case "facebook_insights":
    case "facebook_ecommerce":
      return <Facebook className="h-4 w-4 text-blue-600" />;
    case "google_ads":
      return (
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M3.654 14.916l6.26-10.857c.68-1.18 2.184-1.59 3.361-.916l.004.003c1.178.68 1.586 2.184.909 3.361l-6.26 10.857c-.68 1.18-2.184 1.59-3.361.916l-.004-.003c-1.178-.68-1.586-2.184-.909-3.361z" fill="#FBBC04" />
          <path d="M14.088 14.916l6.26-10.857c.68-1.18.27-2.684-.909-3.361l-.004-.003c-1.177-.674-2.681-.264-3.361.916l-6.26 10.857c-.68 1.18-.27 2.684.909 3.361l.004.003c1.177.674 2.681.264 3.361-.916z" fill="#4285F4" />
          <circle cx="6" cy="18" r="3.5" fill="#34A853" />
        </svg>
      );
    default:
      return <FileSpreadsheet className="h-4 w-4" />;
  }
}

function LeadsTable({ records, totals }: { records: CampaignRecord[]; totals: CampaignRecord }) {
  const getCpl = (spend: number, leads: number) => (leads > 0 ? spend / leads : 0);

  return (
    <Table dir="rtl">
      <TableHeader>
        <TableRow>
          <TableHead className="text-right">קמפיין</TableHead>
          <TableHead className="text-right">חשיפות</TableHead>
          <TableHead className="text-right">קליקים</TableHead>
          <TableHead className="text-right">לידים</TableHead>
          <TableHead className="text-right">הוצאה</TableHead>
          <TableHead className="text-right">עלות לליד</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {records.map((record, idx) => (
          <TableRow key={idx}>
            <TableCell className="font-medium">{record.campaignName || "ללא שם"}</TableCell>
            <TableCell>{formatNumber(record.impressions)}</TableCell>
            <TableCell>{formatNumber(record.clicks)}</TableCell>
            <TableCell>{formatNumber(record.leads)}</TableCell>
            <TableCell>{formatCurrency(record.spend)}</TableCell>
            <TableCell>{formatCurrency(getCpl(record.spend, record.leads))}</TableCell>
          </TableRow>
        ))}
        <TableRow className="bg-muted/50 font-bold border-t-2">
          <TableCell>סה&quot;כ</TableCell>
          <TableCell>{formatNumber(totals.impressions)}</TableCell>
          <TableCell>{formatNumber(totals.clicks)}</TableCell>
          <TableCell>{formatNumber(totals.leads)}</TableCell>
          <TableCell>{formatCurrency(totals.spend)}</TableCell>
          <TableCell>{formatCurrency(getCpl(totals.spend, totals.leads))}</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  );
}

function EcommerceTable({ records, totals }: { records: CampaignRecord[]; totals: CampaignRecord }) {
  const getRoas = (revenue: number, spend: number) => (spend > 0 ? revenue / spend : 0);

  return (
    <Table dir="rtl">
      <TableHeader>
        <TableRow>
          <TableHead className="text-right">קמפיין</TableHead>
          <TableHead className="text-right">חשיפות</TableHead>
          <TableHead className="text-right">קליקים</TableHead>
          <TableHead className="text-right">רכישות</TableHead>
          <TableHead className="text-right">הוצאה</TableHead>
          <TableHead className="text-right">הכנסה</TableHead>
          <TableHead className="text-right">ROAS</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {records.map((record, idx) => {
          const roas = getRoas(record.revenue, record.spend);
          return (
            <TableRow key={idx}>
              <TableCell className="font-medium">{record.campaignName || "ללא שם"}</TableCell>
              <TableCell>{formatNumber(record.impressions)}</TableCell>
              <TableCell>{formatNumber(record.clicks)}</TableCell>
              <TableCell>{formatNumber(record.purchases)}</TableCell>
              <TableCell>{formatCurrency(record.spend)}</TableCell>
              <TableCell>{formatCurrency(record.revenue)}</TableCell>
              <TableCell>{roas.toFixed(2)}</TableCell>
            </TableRow>
          );
        })}
        <TableRow className="bg-muted/50 font-bold border-t-2">
          <TableCell>סה&quot;כ</TableCell>
          <TableCell>{formatNumber(totals.impressions)}</TableCell>
          <TableCell>{formatNumber(totals.clicks)}</TableCell>
          <TableCell>{formatNumber(totals.purchases)}</TableCell>
          <TableCell>{formatCurrency(totals.spend)}</TableCell>
          <TableCell>{formatCurrency(totals.revenue)}</TableCell>
          <TableCell>{getRoas(totals.revenue, totals.spend).toFixed(2)}</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  );
}

function StatusDot({ status }: { status: OverallStatus }) {
  const label = status === "red" ? "דורש טיפול" : status === "yellow" ? "לתשומת לב" : "תקין";
  const dot = status === "red" ? "🔴" : status === "yellow" ? "🟡" : "🟢";
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="cursor-default text-xl leading-none">{dot}</span>
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export type PulseClientCampaignCardProps = {
  data: ClientCampaignTableData;
  goalRow: PulsePlatformDisplayRow | null;
  pulse: PulseSnapshotRow | null;
  overall: OverallStatus;
  manualOverride: boolean;
  algorithmOverall: OverallStatus;
  flags: string[];
  campaignerName: string;
  period: PulsePeriod;
  onOverride: () => void;
  onOpenClient: () => void;
  onCallLog: () => void;
};

export function PulseClientCampaignCard({
  data,
  goalRow,
  pulse,
  overall,
  manualOverride,
  algorithmOverall,
  flags,
  campaignerName,
  period,
  onOverride,
  onOpenClient,
  onCallLog,
}: PulseClientCampaignCardProps) {
  const platformConfig = PLATFORM_CONFIG[data.integrationType];
  const metaSource = goalRow || pulse;
  const statusText = manualOverride
    ? `${goalRow ? pulseStatusLabel(goalRow.status) : pulse ? pulseStatusLabel(pulse.status) : overallStatusLabel(algorithmOverall)} → ${overallStatusLabel(overall)}`
    : goalRow
      ? pulseStatusLabel(goalRow.status)
      : pulse
        ? pulseStatusLabel(pulse.status)
        : "🟡 ממתין לבדיקה";

  return (
    <Card
      className={
        overall === "red"
          ? "border-red-200 bg-surface-status-red"
          : overall === "yellow"
            ? "border-yellow-200 bg-surface-status-yellow"
            : ""
      }
    >
      <CardHeader className="pb-3 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <CardTitle className="text-lg flex items-center gap-2 min-w-0">
            <StatusDot status={overall} />
            <Badge variant="outline" className="font-semibold text-base max-w-full truncate">
              {data.clientName}
            </Badge>
            {manualOverride ? (
              <Badge variant="secondary" className="text-[10px]">ידני</Badge>
            ) : null}
          </CardTitle>
          <div className="flex items-center gap-2 shrink-0">
            {getIntegrationIcon(data.integrationType)}
            <span className={`font-medium ${platformConfig?.color || ""}`}>
              {platformConfig?.name || data.integrationType}
            </span>
            <Badge variant="secondary" className="text-xs">
              {data.campaignType === "leads" ? "לידים" : "איקומרס"}
            </Badge>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 text-xs sm:text-sm">
          <div>
            <span className="text-muted-foreground">סטטוס: </span>
            <span>{statusText}</span>
          </div>
          <div>
            <span className="text-muted-foreground">קמפיינר: </span>
            <span>{campaignerName}</span>
          </div>
          <div>
            <span className="text-muted-foreground">שיחת לקוח: </span>
            {pulse ? (
              <button
                type="button"
                className={`hover:text-primary ${
                  pulse.last_client_call_at
                    ? "underline decoration-dotted underline-offset-2"
                    : "text-amber-700 underline decoration-dotted underline-offset-2 font-medium"
                }`}
                onClick={onCallLog}
              >
                {formatLastClientCall(pulse)}
              </button>
            ) : (
              "—"
            )}
          </div>
          <div>
            <span className="text-muted-foreground">נגיעה בקמפיין: </span>
            {metaSource ? (
              metaSource.last_meta_change_at ? (
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="underline decoration-dotted underline-offset-2 hover:text-primary"
                    >
                      {metaChangeSummary(metaSource)}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-72 text-sm whitespace-pre-wrap" align="start">
                    {formatMetaChangeDetails(metaSource)}
                  </PopoverContent>
                </Popover>
              ) : (
                metaChangeSummary(metaSource)
              )
            ) : (
              "—"
            )}
          </div>
        </div>

        {flags.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {flags.slice(0, 4).map((flag) => (
              <Badge
                key={flag}
                variant="outline"
                className={`text-xs ${
                  flag.includes("אין טבלת") || flag.includes("ממתין")
                    ? "bg-amber-100 text-amber-900 border-amber-300"
                    : ""
                }`}
              >
                {flag}
              </Badge>
            ))}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-1">
          <Button variant="outline" size="sm" className="h-8 px-2 gap-1" onClick={onOverride}>
            <Pencil className="h-3.5 w-3.5" />
            <span className="text-xs">ערוך צבע</span>
          </Button>
          <Button variant="outline" size="sm" className="h-8 px-2 gap-1" onClick={onOpenClient}>
            <ExternalLink className="h-3.5 w-3.5" />
            <span className="text-xs">פתח כרטיס</span>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {goalRow ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm rounded-md bg-muted/30 p-3">
            <div>
              <span className="text-muted-foreground">{pulseSpendColumnLabel(period).split(" ")[0]}: </span>
              <span className="font-medium tabular-nums">{formatPulseMoney(goalRow.spend_7d)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">לידים/רכישות: </span>
              <span className="font-medium tabular-nums">{formatGoalOutcomes(goalRow)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">CPL/ROAS: </span>
              <span className="font-medium tabular-nums">{formatGoalEfficiency(goalRow)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">שינוי: </span>
              <span className="font-medium tabular-nums">{formatGoalChange(goalRow)}</span>
            </div>
          </div>
        ) : pulse ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm rounded-md bg-muted/30 p-3">
            <div>
              <span className="text-muted-foreground">הוצאה (snapshot): </span>
              <span className="font-medium tabular-nums">{formatPulseMoney(pulse.spend_7d)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">לידים: </span>
              <span className="font-medium tabular-nums">{pulse.leads_7d ?? "—"}</span>
            </div>
            <div>
              <span className="text-muted-foreground">רכישות: </span>
              <span className="font-medium tabular-nums">{pulse.purchases_7d ?? "—"}</span>
            </div>
          </div>
        ) : null}
        <div className="overflow-x-auto">
          {data.campaignType === "leads" ? (
            <LeadsTable records={data.records} totals={data.totals} />
          ) : (
            <EcommerceTable records={data.records} totals={data.totals} />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
