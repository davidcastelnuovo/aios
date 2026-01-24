import { ArrowUp, ArrowDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface ComparisonBadgeProps {
  current: number;
  previous: number;
  format?: "percent" | "value";
  reverseColors?: boolean; // For metrics where decrease is good (like bounce rate)
  className?: string;
}

export function ComparisonBadge({ 
  current, 
  previous, 
  format = "percent", 
  reverseColors = false,
  className 
}: ComparisonBadgeProps) {
  if (previous === 0 && current === 0) {
    return null;
  }

  const change = previous > 0 ? ((current - previous) / previous) * 100 : (current > 0 ? 100 : 0);
  const isIncrease = change > 0;
  const isDecrease = change < 0;
  const isNoChange = change === 0;

  // Determine if change is positive (good) or negative (bad)
  const isPositive = reverseColors ? isDecrease : isIncrease;
  const isNegative = reverseColors ? isIncrease : isDecrease;

  const formattedChange = format === "percent" 
    ? `${Math.abs(change).toFixed(1)}%`
    : Math.abs(current - previous).toLocaleString();

  return (
    <div 
      className={cn(
        "flex items-center gap-1 text-xs font-medium",
        isPositive && "text-emerald-600 dark:text-emerald-500",
        isNegative && "text-destructive",
        isNoChange && "text-muted-foreground",
        className
      )}
    >
      {isIncrease && <ArrowUp className="h-3 w-3" />}
      {isDecrease && <ArrowDown className="h-3 w-3" />}
      {isNoChange && <Minus className="h-3 w-3" />}
      <span>{isIncrease ? "+" : isDecrease ? "-" : ""}{formattedChange}</span>
    </div>
  );
}

interface ComparisonData {
  currentValue: number;
  previousValue: number;
  changePercent: number;
  isIncrease: boolean;
}

export function calculateComparison(current: number, previous: number): ComparisonData {
  const change = previous > 0 ? ((current - previous) / previous) * 100 : (current > 0 ? 100 : 0);
  return {
    currentValue: current,
    previousValue: previous,
    changePercent: Math.abs(change),
    isIncrease: change >= 0
  };
}
