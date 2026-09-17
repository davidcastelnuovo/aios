import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type ResponsiveTabItem = {
  value: string;
  label: React.ReactNode;
  icon?: LucideIcon;
  iconNode?: React.ReactNode;
  disabled?: boolean;
  triggerClassName?: string;
};

function TabItemVisual({ item }: { item: ResponsiveTabItem }) {
  if (item.iconNode) {
    return (
      <span className="flex items-center gap-2 truncate">
        <span className="shrink-0">{item.iconNode}</span>
        <span className="truncate">{item.label}</span>
      </span>
    );
  }
  if (item.icon) {
    const Icon = item.icon;
    return (
      <span className="flex items-center gap-2 truncate">
        <Icon className="h-4 w-4 shrink-0" />
        <span className="truncate">{item.label}</span>
      </span>
    );
  }
  return <span className="truncate">{item.label}</span>;
}

type ResponsiveTabsListProps = {
  items: ResponsiveTabItem[];
  value: string;
  onValueChange: (value: string) => void;
  className?: string;
  mobileLabel?: string;
  /** When false, mobile uses horizontal scroll instead of dropdown. Default true. */
  mobileDropdown?: boolean;
  variant?: "default" | "underline";
};

export function ResponsiveTabsList({
  items,
  value,
  onValueChange,
  className,
  mobileLabel = "בחר תצוגה",
  mobileDropdown = true,
  variant = "default",
}: ResponsiveTabsListProps) {
  const isMobile = useIsMobile();
  const enabledItems = items.filter((item) => !item.disabled);
  const current =
    items.find((item) => item.value === value && !item.disabled) ??
    enabledItems[0];

  if (isMobile && mobileDropdown) {
    return (
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder={mobileLabel}>
            {current ? <TabItemVisual item={current} /> : mobileLabel}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {enabledItems.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              <TabItemVisual item={item} />
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  const underlineTriggerClass =
    "rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-3 sm:px-4 py-2.5 text-xs shrink-0";
  const defaultTriggerClass = "gap-1.5 shrink-0";

  return (
    <TabsList
      dir="rtl"
      className={cn(
        variant === "underline"
          ? "w-full justify-start rounded-none border-b bg-transparent h-auto p-0 gap-0 overflow-x-auto flex-nowrap"
          : "w-full justify-start gap-1 flex-wrap h-auto md:flex-nowrap overflow-x-auto md:overflow-visible",
        className,
      )}
    >
      {items.map((item) => (
        <TabsTrigger
          key={item.value}
          value={item.value}
          disabled={item.disabled}
          className={cn(
            variant === "underline" ? underlineTriggerClass : defaultTriggerClass,
            item.triggerClassName,
          )}
        >
          {item.iconNode ? (
            <span className="shrink-0">{item.iconNode}</span>
          ) : item.icon ? (
            <item.icon className="h-4 w-4 shrink-0" />
          ) : null}
          {item.label}
        </TabsTrigger>
      ))}
    </TabsList>
  );
}
