import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, TrendingUp, TrendingDown, CheckCircle } from "lucide-react";
import { format, subDays, subWeeks, subMonths, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";

interface ActiveAlertsProps {
  tableId: string;
  records: any[];
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
  currentValue: number;
  previousValue: number;
  changePercent: number;
  isNegative: boolean;
}

const METRIC_LABELS: Record<string, string> = {
  cost_per_lead: "עלות לליד",
  spend: "הוצאות",
  leads: "לידים",
  impressions: "חשיפות",
  clicks: "קליקים",
  ctr: "CTR",
  cpm: "CPM",
};

export function ActiveAlerts({ tableId, records }: ActiveAlertsProps) {
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
    if (!alerts.length || !records.length) return [];

    const triggered: TriggeredAlert[] = [];
    const today = new Date();

    for (const alert of alerts) {
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
        // vs_target - compare current value to threshold
        const currentMetrics = calculateMetrics(records, subDays(today, 7), today, alert.metric);
        const currentValue = currentMetrics;
        
        if (
          (alert.operator === "above" && currentValue > alert.threshold) ||
          (alert.operator === "below" && currentValue < alert.threshold)
        ) {
          triggered.push({
            alert,
            currentValue,
            previousValue: alert.threshold,
            changePercent: ((currentValue - alert.threshold) / alert.threshold) * 100,
            isNegative: alert.operator === "above" ? 
              (alert.metric === "cost_per_lead" || alert.metric === "cpm") : 
              (alert.metric !== "cost_per_lead" && alert.metric !== "cpm"),
          });
        }
        continue;
      }

      // Calculate metrics for both periods
      const currentValue = calculateMetrics(
        records,
        currentPeriodStart,
        currentPeriodEnd,
        alert.metric
      );
      const previousValue = calculateMetrics(
        records,
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
          currentValue,
          previousValue,
          changePercent,
          isNegative,
        });
      }
    }

    return triggered;
  }, [alerts, records]);

  if (triggeredAlerts.length === 0) return null;

  return (
    <div className="space-y-2 mb-4">
      {triggeredAlerts.map((item) => (
        <AlertCard key={item.alert.id} {...item} />
      ))}
    </div>
  );
}

function AlertCard({
  alert,
  currentValue,
  previousValue,
  changePercent,
  isNegative,
}: TriggeredAlert) {
  const Icon = isNegative ? AlertTriangle : CheckCircle;
  const TrendIcon = changePercent > 0 ? TrendingUp : TrendingDown;

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
        <div className="font-medium flex items-center gap-2">
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
