import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, TrendingUp, TrendingDown, CheckCircle, Ban, CreditCard, ShieldAlert } from "lucide-react";
import { format, subDays } from "date-fns";

interface ActiveAlertsProps {
  tableId: string;
  records: any[];
  integrationSettings?: any;
}

interface ReportAlert {
  id: string;
  name: string;
  metric: string;
  comparison_type: string;
  operator: string;
  threshold: number;
  is_percentage: boolean;
  is_active: boolean;
}

interface TriggeredAlert {
  alert: ReportAlert;
  campaignId?: string;
  campaignName?: string;
  currentValue: number;
  previousValue: number;
  changePercent: number;
  isNegative: boolean;
  isBlocking: boolean;
  blockingReason?: string;
}

const METRIC_LABELS: Record<string, string> = {
  cost_per_lead: "עלות לליד",
  spend: "הוצאות",
  leads: "לידים",
  impressions: "חשיפות",
  clicks: "קליקים",
  ctr: "CTR",
  cpm: "CPM",
  account_status: "סטטוס חשבון",
};

// Statuses that indicate a real block by Meta (not manually paused)
const BLOCKED_STATUSES = [
  'WITH_ISSUES',           // Campaign has issues
  'DISAPPROVED',           // Policy violation
  'PENDING_BILLING_INFO',  // Payment issues
  'ADSET_PAUSED',          // Ad set has issues (could be budget/billing)
  'CAMPAIGN_PAUSED',       // Could be due to issues
];

// Statuses that indicate the campaign was manually paused (NOT a block)
const PAUSED_STATUSES = [
  'PAUSED',               // Manually paused
];

// Account statuses that indicate issues
const BLOCKED_ACCOUNT_STATUSES = [
  'disabled',             // Account disabled
  'unsettled',            // Payment issues
  'pending_risk_review',  // Security review
  'pending_settlement',   // Settlement issues
  'closed',               // Account closed
];

export function ActiveAlerts({ tableId, records, integrationSettings }: ActiveAlertsProps) {
  const { data: alerts = [] } = useQuery({
    queryKey: ["report-alerts", tableId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("report_alerts")
        .select("*")
        .eq("table_id", tableId)
        .eq("is_active", true);

      if (error) throw error;
      return data as ReportAlert[];
    },
    enabled: !!tableId,
  });

  const triggeredAlerts = useMemo(() => {
    if (!alerts.length) return [];

    const triggered: TriggeredAlert[] = [];
    const today = new Date();

    // Check account-level blocking first
    const accountStatus = integrationSettings?.account_status;
    if (accountStatus && BLOCKED_ACCOUNT_STATUSES.includes(accountStatus)) {
      const blockingAlert = alerts.find(a => a.comparison_type === "no_data" || a.operator === "no_data_days");
      if (blockingAlert) {
        const reason = getAccountBlockReason(accountStatus, integrationSettings?.account_disable_reason);
        triggered.push({
          alert: blockingAlert,
          campaignId: undefined,
          campaignName: undefined,
          currentValue: 0,
          previousValue: 0,
          changePercent: 0,
          isNegative: true,
          isBlocking: true,
          blockingReason: reason,
        });
      }
    }

    // If no records at all, don't show blocking alerts (might just be no data)
    if (records.length === 0) {
      return triggered;
    }

    // Group records by campaign
    const campaignGroups = groupRecordsByCampaign(records);

    for (const alert of alerts) {
      // Handle blocking/no-data alerts - check campaign effective_status
      if (alert.comparison_type === "no_data" || alert.operator === "no_data_days") {
        // Check each campaign for blocking status
        for (const [campaignId, campaignRecords] of Object.entries(campaignGroups)) {
          const campaignName = getCampaignName(campaignRecords as any[]);
          
          // Get the latest record's effective_status
          const latestRecord = getLatestRecord(campaignRecords as any[]);
          const effectiveStatus = latestRecord?.data?.effective_status;
          const configuredStatus = latestRecord?.data?.configured_status;
          
          // Only show alert if the campaign is BLOCKED by Meta (not manually paused)
          if (effectiveStatus && BLOCKED_STATUSES.includes(effectiveStatus)) {
            // Skip if the user manually paused it (configured_status is PAUSED)
            if (configuredStatus === 'PAUSED') {
              continue;
            }
            
            const reason = getCampaignBlockReason(effectiveStatus);
            triggered.push({
              alert,
              campaignId,
              campaignName,
              currentValue: 0,
              previousValue: 0,
              changePercent: 0,
              isNegative: true,
              isBlocking: true,
              blockingReason: reason,
            });
          }
        }
        continue;
      }

      let currentPeriodStart: Date;
      let currentPeriodEnd: Date;
      let previousPeriodStart: Date;
      let previousPeriodEnd: Date;

      // Calculate periods based on comparison type
      if (alert.comparison_type === "week_over_week") {
        currentPeriodEnd = today;
        currentPeriodStart = subDays(today, 7);
        previousPeriodEnd = subDays(today, 7);
        previousPeriodStart = subDays(today, 14);
      } else if (alert.comparison_type === "month_over_month") {
        currentPeriodEnd = today;
        currentPeriodStart = subDays(today, 30);
        previousPeriodEnd = subDays(today, 30);
        previousPeriodStart = subDays(today, 60);
      } else {
        // vs_target - compare current value to threshold per campaign
        for (const [campaignId, campaignRecords] of Object.entries(campaignGroups)) {
          const campaignName = getCampaignName(campaignRecords as any[]);
          const currentMetrics = calculateMetrics(campaignRecords as any[], subDays(today, 7), today, alert.metric);
          const currentValue = currentMetrics;
          
          if (
            (alert.operator === "above" && currentValue > alert.threshold) ||
            (alert.operator === "below" && currentValue < alert.threshold)
          ) {
            triggered.push({
              alert,
              campaignId,
              campaignName,
              currentValue,
              previousValue: alert.threshold,
              changePercent: ((currentValue - alert.threshold) / alert.threshold) * 100,
              isNegative: alert.operator === "above" ? 
                (alert.metric === "cost_per_lead" || alert.metric === "cpm") : 
                (alert.metric !== "cost_per_lead" && alert.metric !== "cpm"),
              isBlocking: false,
            });
          }
        }
        continue;
      }

      // Calculate metrics for each campaign separately
      for (const [campaignId, campaignRecords] of Object.entries(campaignGroups)) {
        const campaignName = getCampaignName(campaignRecords as any[]);
        
        const currentValue = calculateMetrics(
          campaignRecords as any[],
          currentPeriodStart,
          currentPeriodEnd,
          alert.metric
        );
        const previousValue = calculateMetrics(
          campaignRecords as any[],
          previousPeriodStart,
          previousPeriodEnd,
          alert.metric
        );

        if (previousValue === 0) continue;

        const changePercent = ((currentValue - previousValue) / previousValue) * 100;

        // Check if alert should trigger
        let shouldTrigger = false;
        if (alert.operator === "increase" && changePercent > alert.threshold) {
          shouldTrigger = true;
        } else if (alert.operator === "decrease" && changePercent < -alert.threshold) {
          shouldTrigger = true;
        }

        if (shouldTrigger) {
          // Determine if this is a negative change (bad for user)
          const isNegative =
            (alert.metric === "cost_per_lead" || alert.metric === "cpm" || alert.metric === "spend") &&
            alert.operator === "increase"
              ? true
              : (alert.metric !== "cost_per_lead" && alert.metric !== "cpm" && alert.metric !== "spend") &&
                alert.operator === "decrease";

          triggered.push({
            alert,
            campaignId,
            campaignName,
            currentValue,
            previousValue,
            changePercent,
            isNegative,
            isBlocking: false,
          });
        }
      }
    }

    return triggered;
  }, [alerts, records, integrationSettings]);

  if (triggeredAlerts.length === 0) return null;

  return (
    <div className="space-y-2 mb-4">
      {triggeredAlerts.map((item, index) => (
        <AlertCard key={`${item.alert.id}-${item.campaignId ?? index}`} {...item} />
      ))}
    </div>
  );
}

function AlertCard({
  alert,
  campaignName,
  currentValue,
  previousValue,
  changePercent,
  isNegative,
  isBlocking,
  blockingReason,
}: TriggeredAlert) {
  const Icon = isBlocking 
    ? (blockingReason?.includes('אשראי') || blockingReason?.includes('תשלום') ? CreditCard : 
       blockingReason?.includes('מדיניות') || blockingReason?.includes('אבטחה') ? ShieldAlert : Ban)
    : isNegative ? AlertTriangle : CheckCircle;
  const TrendIcon = changePercent > 0 ? TrendingUp : TrendingDown;

  if (isBlocking) {
    return (
      <div className="rounded-lg p-3 flex items-start gap-3 bg-destructive/10 border border-destructive/30 text-destructive">
        <Icon className="h-5 w-5 mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="font-medium">
            {campaignName && <span className="text-xs bg-destructive/20 px-2 py-0.5 rounded ml-2">{campaignName}</span>}
            {blockingReason || alert.name}
          </div>
          <div className="text-sm opacity-80">
            {blockingReason 
              ? "יש לבדוק את החשבון בממשק הפרסום של מטא"
              : "אין נתונים חדשים - ייתכן שיש חסימת חשבון או בעיית אשראי"
            }
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`rounded-lg p-3 flex items-start gap-3 ${
        isNegative
          ? "bg-destructive/10 border border-destructive/30 text-destructive"
          : "bg-green-500/10 border border-green-500/30 text-green-700 dark:text-green-400"
      }`}
    >
      <Icon className="h-5 w-5 mt-0.5 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="font-medium flex items-center gap-2 flex-wrap">
          {campaignName && (
            <span className={`text-xs px-2 py-0.5 rounded ${
              isNegative 
                ? "bg-destructive/20" 
                : "bg-green-500/20"
            }`}>
              {campaignName}
            </span>
          )}
          {alert.name}
          <TrendIcon className="h-4 w-4" />
          <span className="text-sm">
            {changePercent > 0 ? "+" : ""}
            {changePercent.toFixed(1)}%
          </span>
        </div>
        <div className="text-sm opacity-80">
          {METRIC_LABELS[alert.metric] || alert.metric}:{" "}
          {formatValue(currentValue, alert.metric)} (לפני:{" "}
          {formatValue(previousValue, alert.metric)})
        </div>
      </div>
    </div>
  );
}

function getAccountBlockReason(status: string, disableReason?: string): string {
  switch (status) {
    case 'disabled':
      return disableReason ? `חשבון מושבת - ${disableReason}` : 'חשבון פרסום מושבת - הפרת מדיניות';
    case 'unsettled':
      return 'בעיית תשלום - יש להסדיר את האשראי';
    case 'pending_risk_review':
      return 'החשבון בבדיקת אבטחה';
    case 'pending_settlement':
      return 'ממתין להסדר תשלום';
    case 'closed':
      return 'חשבון הפרסום נסגר';
    default:
      return 'בעיה בחשבון הפרסום';
  }
}

function getCampaignBlockReason(effectiveStatus: string): string {
  switch (effectiveStatus) {
    case 'WITH_ISSUES':
      return 'קמפיין עם בעיות - יש לבדוק בממשק מטא';
    case 'DISAPPROVED':
      return 'קמפיין לא מאושר - הפרת מדיניות';
    case 'PENDING_BILLING_INFO':
      return 'בעיית אשראי - יש להזין פרטי תשלום';
    case 'ADSET_PAUSED':
      return 'מערך מודעות מושהה - ייתכן בעיית תקציב';
    case 'CAMPAIGN_PAUSED':
      return 'קמפיין מושהה ע"י המערכת';
    default:
      return `קמפיין חסום (${effectiveStatus})`;
  }
}

function getLatestRecord(records: any[]): any | null {
  if (records.length === 0) return null;
  
  return records.reduce((latest, record) => {
    const recordDate = record.data?.date || record.data?.Date || '';
    const latestDate = latest?.data?.date || latest?.data?.Date || '';
    return recordDate > latestDate ? record : latest;
  }, records[0]);
}

function groupRecordsByCampaign(records: any[]): Record<string, any[]> {
  const groups: Record<string, any[]> = {};
  
  for (const record of records) {
    const campaignId = record.data?.campaign_id || record.data?.campaignId || record.data?.campaign_name || "unknown";
    if (!groups[campaignId]) {
      groups[campaignId] = [];
    }
    groups[campaignId].push(record);
  }
  
  return groups;
}

function getCampaignName(records: any[]): string {
  if (records.length === 0) return "";
  const firstRecord = records[0];
  return firstRecord.data?.campaign_name || firstRecord.data?.campaignName || firstRecord.data?.campaign_id || "";
}

function calculateMetrics(
  records: any[],
  startDate: Date,
  endDate: Date,
  metric: string
): number {
  const startStr = format(startDate, "yyyy-MM-dd");
  const endStr = format(endDate, "yyyy-MM-dd");

  const filtered = records.filter((r) => {
    const recordDate = r.data?.date || r.data?.Date;
    if (!recordDate) return false;
    return recordDate >= startStr && recordDate <= endStr;
  });

  if (filtered.length === 0) return 0;

  // Map metric names to possible data keys
  const metricKeys: Record<string, string[]> = {
    cost_per_lead: ["cost_per_lead", "costPerLead", "cost_per_result"],
    spend: ["spend", "amount_spent", "Spend"],
    leads: ["leads", "results", "Leads"],
    impressions: ["impressions", "Impressions"],
    clicks: ["clicks", "link_clicks", "Clicks"],
    ctr: ["ctr", "CTR"],
    cpm: ["cpm", "CPM"],
  };

  const keys = metricKeys[metric] || [metric];

  // Sum or average based on metric type
  const isAverageMetric = ["cost_per_lead", "ctr", "cpm"].includes(metric);

  let total = 0;
  let count = 0;

  for (const record of filtered) {
    for (const key of keys) {
      const value = parseFloat(record.data?.[key]);
      if (!isNaN(value)) {
        total += value;
        count++;
        break;
      }
    }
  }

  if (count === 0) return 0;
  return isAverageMetric ? total / count : total;
}

function formatValue(value: number, metric: string): string {
  if (metric === "ctr") {
    return `${value.toFixed(2)}%`;
  }
  if (metric === "cost_per_lead" || metric === "cpm" || metric === "spend") {
    return `₪${value.toFixed(2)}`;
  }
  if (metric === "impressions" || metric === "clicks" || metric === "leads") {
    return value.toLocaleString();
  }
  return value.toFixed(2);
}
