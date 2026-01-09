import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, TrendingUp, TrendingDown, Ban } from "lucide-react";
import { format, subDays } from "date-fns";

interface TableCardAlertsProps {
  tableId: string;
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
  currentValue: number;
  previousValue: number;
  changePercent: number;
  isNegative: boolean;
  isBlocking: boolean;
}

export function TableCardAlerts({ tableId }: TableCardAlertsProps) {
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
    if (!alerts.length || !records.length) {
      // Check for blocking alerts (no data)
      const blockingAlerts = alerts.filter(
        a => a.comparison_type === "no_data" || a.operator === "no_data_days"
      );
      
      if (blockingAlerts.length > 0 && records.length === 0) {
        return blockingAlerts.map(alert => ({
          alert,
          currentValue: 0,
          previousValue: 0,
          changePercent: 0,
          isNegative: true,
          isBlocking: true,
        }));
      }
      return [];
    }

    const triggered: TriggeredAlert[] = [];
    const today = new Date();

    for (const alert of alerts) {
      // Handle blocking/no-data alerts
      if (alert.comparison_type === "no_data" || alert.operator === "no_data_days") {
        const daysThreshold = alert.threshold || 2;
        const recentDate = subDays(today, daysThreshold);
        const recentDateStr = format(recentDate, "yyyy-MM-dd");
        
        const hasRecentData = records.some(r => {
          const recordDate = r.data?.date || r.data?.Date;
          return recordDate && recordDate >= recentDateStr;
        });
        
        if (!hasRecentData) {
          triggered.push({
            alert,
            currentValue: 0,
            previousValue: 0,
            changePercent: 0,
            isNegative: true,
            isBlocking: true,
          });
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
  }, [alerts, records]);

  if (triggeredAlerts.length === 0) return null;

  // Show compact version for card
  const blockingAlerts = triggeredAlerts.filter(t => t.isBlocking);
  const performanceAlerts = triggeredAlerts.filter(t => !t.isBlocking);

  return (
    <div className="flex flex-wrap gap-1 mt-2">
      {blockingAlerts.length > 0 && (
        <div className="flex items-center gap-1 px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-full text-xs">
          <Ban className="h-3 w-3" />
          <span>חסימה</span>
        </div>
      )}
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
