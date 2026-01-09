import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, TrendingUp, TrendingDown, Ban, CreditCard, ShieldAlert } from "lucide-react";
import { format, subDays } from "date-fns";

interface TableCardAlertsProps {
  tableId: string;
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

interface CrmRecord {
  id: string;
  data: Record<string, any>;
}

interface TriggeredAlert {
  alert: ReportAlert;
  campaignName?: string;
  currentValue: number;
  previousValue: number;
  changePercent: number;
  isNegative: boolean;
  isBlocking: boolean;
  blockingReason?: string;
}

// Statuses that indicate a real block by Meta (not manually paused)
const BLOCKED_STATUSES = [
  'WITH_ISSUES',
  'DISAPPROVED',
  'PENDING_BILLING_INFO',
  'ADSET_PAUSED',
  'CAMPAIGN_PAUSED',
];

// Account statuses that indicate issues
const BLOCKED_ACCOUNT_STATUSES = [
  'disabled',
  'unsettled',
  'pending_risk_review',
  'pending_settlement',
  'closed',
];

export function TableCardAlerts({ tableId, integrationSettings }: TableCardAlertsProps) {
  // Fetch alerts for this table
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

  // Fetch records for calculations
  const { data: records = [] } = useQuery({
    queryKey: ["crm-records-mini", tableId],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return [];
      
      const response = await supabase.functions.invoke(`crm-records?table_id=${tableId}&date_filter=last_30_days`, {
        method: 'GET',
      });
      if (response.error) return [];
      return Array.isArray(response.data) ? response.data as CrmRecord[] : [];
    },
    enabled: !!tableId && alerts.length > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const triggeredAlerts = useMemo(() => {
    const triggered: TriggeredAlert[] = [];
    const today = new Date();

    // Check account-level blocking first
    const accountStatus = integrationSettings?.account_status;
    if (accountStatus && BLOCKED_ACCOUNT_STATUSES.includes(accountStatus)) {
      const blockingAlert = alerts.find(a => a.comparison_type === "no_data" || a.operator === "no_data_days");
      if (blockingAlert) {
        triggered.push({
          alert: blockingAlert,
          currentValue: 0,
          previousValue: 0,
          changePercent: 0,
          isNegative: true,
          isBlocking: true,
          blockingReason: getAccountBlockReason(accountStatus),
        });
      }
    }

    if (!alerts.length || records.length === 0) {
      return triggered;
    }

    // Group records by campaign
    const campaignGroups = groupRecordsByCampaign(records);

    for (const alert of alerts) {
      // Handle blocking/no-data alerts - check campaign effective_status
      if (alert.comparison_type === "no_data" || alert.operator === "no_data_days") {
        for (const [campaignId, campaignRecords] of Object.entries(campaignGroups)) {
          const latestRecord = getLatestRecord(campaignRecords as CrmRecord[]);
          const effectiveStatus = latestRecord?.data?.effective_status;
          const configuredStatus = latestRecord?.data?.configured_status;
          
          // Only show alert if BLOCKED by Meta (not manually paused)
          if (effectiveStatus && BLOCKED_STATUSES.includes(effectiveStatus)) {
            if (configuredStatus === 'PAUSED') continue;
            
            triggered.push({
              alert,
              campaignName: getCampaignName(campaignRecords as CrmRecord[]),
              currentValue: 0,
              previousValue: 0,
              changePercent: 0,
              isNegative: true,
              isBlocking: true,
              blockingReason: getCampaignBlockReason(effectiveStatus),
            });
          }
        }
        continue;
      }

      let currentPeriodStart: Date;
      let currentPeriodEnd: Date;
      let previousPeriodStart: Date;
      let previousPeriodEnd: Date;

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
        // vs_target
        const currentMetrics = calculateMetric(records, subDays(today, 7), today, alert.metric);
        
        if (
          (alert.operator === "above" && currentMetrics > alert.threshold) ||
          (alert.operator === "below" && currentMetrics < alert.threshold)
        ) {
          triggered.push({
            alert,
            currentValue: currentMetrics,
            previousValue: alert.threshold,
            changePercent: ((currentMetrics - alert.threshold) / alert.threshold) * 100,
            isNegative: alert.operator === "above" ? 
              (alert.metric === "cost_per_lead" || alert.metric === "cpm") : 
              (alert.metric !== "cost_per_lead" && alert.metric !== "cpm"),
            isBlocking: false,
          });
        }
        continue;
      }

      const currentValue = calculateMetric(records, currentPeriodStart, currentPeriodEnd, alert.metric);
      const previousValue = calculateMetric(records, previousPeriodStart, previousPeriodEnd, alert.metric);

      if (previousValue === 0) continue;

      const changePercent = ((currentValue - previousValue) / previousValue) * 100;

      let shouldTrigger = false;
      if (alert.operator === "increase" && changePercent > alert.threshold) {
        shouldTrigger = true;
      } else if (alert.operator === "decrease" && changePercent < -alert.threshold) {
        shouldTrigger = true;
      }

      if (shouldTrigger) {
        const isNegative =
          (alert.metric === "cost_per_lead" || alert.metric === "cpm" || alert.metric === "spend") &&
          alert.operator === "increase";

        triggered.push({
          alert,
          currentValue,
          previousValue,
          changePercent,
          isNegative,
          isBlocking: false,
        });
      }
    }

    return triggered;
  }, [alerts, records, integrationSettings]);

  if (triggeredAlerts.length === 0) return null;

  // Show compact version for card
  const blockingAlerts = triggeredAlerts.filter(t => t.isBlocking);
  const performanceAlerts = triggeredAlerts.filter(t => !t.isBlocking);

  return (
    <div className="flex flex-wrap gap-1 mt-2">
      {blockingAlerts.map((item, idx) => (
        <div 
          key={`block-${idx}`}
          className="flex items-center gap-1 px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-full text-xs"
          title={item.blockingReason}
        >
          {item.blockingReason?.includes('אשראי') || item.blockingReason?.includes('תשלום') ? (
            <CreditCard className="h-3 w-3" />
          ) : item.blockingReason?.includes('מדיניות') ? (
            <ShieldAlert className="h-3 w-3" />
          ) : (
            <Ban className="h-3 w-3" />
          )}
          <span>{item.campaignName ? `חסימה: ${item.campaignName}` : 'חסימה'}</span>
        </div>
      ))}
      {performanceAlerts.map((item, idx) => (
        <div
          key={idx}
          className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${
            item.isNegative
              ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
              : "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
          }`}
        >
          {item.isNegative ? (
            <AlertTriangle className="h-3 w-3" />
          ) : item.changePercent > 0 ? (
            <TrendingUp className="h-3 w-3" />
          ) : (
            <TrendingDown className="h-3 w-3" />
          )}
          <span>
            {item.changePercent > 0 ? "+" : ""}
            {item.changePercent.toFixed(0)}%
          </span>
        </div>
      ))}
    </div>
  );
}

function getAccountBlockReason(status: string): string {
  switch (status) {
    case 'disabled':
      return 'חשבון פרסום מושבת - הפרת מדיניות';
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
      return 'קמפיין עם בעיות';
    case 'DISAPPROVED':
      return 'הפרת מדיניות';
    case 'PENDING_BILLING_INFO':
      return 'בעיית אשראי';
    case 'ADSET_PAUSED':
      return 'מערך מודעות מושהה';
    case 'CAMPAIGN_PAUSED':
      return 'קמפיין מושהה ע"י המערכת';
    default:
      return `קמפיין חסום`;
  }
}

function getLatestRecord(records: CrmRecord[]): CrmRecord | null {
  if (records.length === 0) return null;
  return records.reduce((latest, record) => {
    const recordDate = record.data?.date || record.data?.Date || '';
    const latestDate = latest?.data?.date || latest?.data?.Date || '';
    return recordDate > latestDate ? record : latest;
  }, records[0]);
}

function groupRecordsByCampaign(records: CrmRecord[]): Record<string, CrmRecord[]> {
  const groups: Record<string, CrmRecord[]> = {};
  for (const record of records) {
    const campaignId = record.data?.campaign_id || record.data?.campaignId || record.data?.campaign_name || "unknown";
    if (!groups[campaignId]) groups[campaignId] = [];
    groups[campaignId].push(record);
  }
  return groups;
}

function getCampaignName(records: CrmRecord[]): string {
  if (records.length === 0) return "";
  return records[0].data?.campaign_name || records[0].data?.campaignName || "";
}

function calculateMetric(
  records: CrmRecord[],
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

  // For cost_per_lead: calculate as total spend / total leads
  if (metric === "cost_per_lead") {
    let totalSpend = 0;
    let totalLeads = 0;
    
    for (const record of filtered) {
      const spend = parseFloat(record.data?.spend) || parseFloat(record.data?.amount_spent) || parseFloat(record.data?.Spend) || 0;
      const leads = parseFloat(record.data?.leads) || parseFloat(record.data?.results) || parseFloat(record.data?.Leads) || 0;
      totalSpend += spend;
      totalLeads += leads;
    }
    
    if (totalLeads === 0) return 0;
    return totalSpend / totalLeads;
  }

  // For CPM: calculate as (total spend / total impressions) * 1000
  if (metric === "cpm") {
    let totalSpend = 0;
    let totalImpressions = 0;
    
    for (const record of filtered) {
      const spend = parseFloat(record.data?.spend) || parseFloat(record.data?.amount_spent) || parseFloat(record.data?.Spend) || 0;
      const impressions = parseFloat(record.data?.impressions) || parseFloat(record.data?.Impressions) || 0;
      totalSpend += spend;
      totalImpressions += impressions;
    }
    
    if (totalImpressions === 0) return 0;
    return (totalSpend / totalImpressions) * 1000;
  }

  // For CTR: calculate as (total clicks / total impressions) * 100
  if (metric === "ctr") {
    let totalClicks = 0;
    let totalImpressions = 0;
    
    for (const record of filtered) {
      const clicks = parseFloat(record.data?.clicks) || parseFloat(record.data?.link_clicks) || parseFloat(record.data?.Clicks) || 0;
      const impressions = parseFloat(record.data?.impressions) || parseFloat(record.data?.Impressions) || 0;
      totalClicks += clicks;
      totalImpressions += impressions;
    }
    
    if (totalImpressions === 0) return 0;
    return (totalClicks / totalImpressions) * 100;
  }

  // For other metrics: sum them up
  const metricKeys: Record<string, string[]> = {
    spend: ["spend", "amount_spent", "Spend"],
    leads: ["leads", "results", "Leads"],
    impressions: ["impressions", "Impressions"],
    clicks: ["clicks", "link_clicks", "Clicks"],
  };

  const keys = metricKeys[metric] || [metric];
  let total = 0;

  for (const record of filtered) {
    for (const key of keys) {
      const value = parseFloat(record.data?.[key]);
      if (!isNaN(value)) {
        total += value;
        break;
      }
    }
  }

  return total;
}
