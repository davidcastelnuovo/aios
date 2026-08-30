import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ReportDataFreshnessProps {
  lastSyncAt?: string | null;
  dataUpdatedAt?: number;
  isFetching?: boolean;
  className?: string;
}

function formatHebrewDateTime(value: string | number): string {
  const date = typeof value === "number" ? new Date(value) : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("he-IL", { dateStyle: "short", timeStyle: "short" });
}

export function ReportDataFreshness({
  lastSyncAt,
  dataUpdatedAt,
  isFetching,
  className,
}: ReportDataFreshnessProps) {
  const syncLabel = lastSyncAt ? formatHebrewDateTime(lastSyncAt) : null;
  const loadedLabel = dataUpdatedAt ? formatHebrewDateTime(dataUpdatedAt) : null;

  if (!syncLabel && !loadedLabel && !isFetching) return null;

  return (
    <p className={cn("text-xs text-muted-foreground flex flex-wrap items-center gap-x-1.5 gap-y-0.5", className)}>
      {isFetching && <Loader2 className="h-3 w-3 animate-spin shrink-0" />}
      {syncLabel && <span>עדכון מקור: {syncLabel}</span>}
      {loadedLabel && (
        <span>
          {syncLabel ? "·" : ""}
          טעינה: {loadedLabel}
        </span>
      )}
      {isFetching && <span>{syncLabel || loadedLabel ? "·" : ""} מעדכן ברקע...</span>}
    </p>
  );
}
