import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ADS_ENTITY_LEVEL_LABELS,
  ADS_ENTITY_LEVELS,
  hasEntityLevelData,
  type AdsEntityLevel,
} from '@/lib/adsEntityLevel';

interface AdsEntityLevelTabsProps {
  value: AdsEntityLevel;
  onChange: (level: AdsEntityLevel) => void;
  records: Array<{ data?: Record<string, any> }>;
  className?: string;
}

export function AdsEntityLevelTabs({
  value,
  onChange,
  records,
  className,
}: AdsEntityLevelTabsProps) {
  return (
    <Tabs
      value={value}
      onValueChange={(next) => onChange(next as AdsEntityLevel)}
      className={className}
    >
      <TabsList className="h-auto w-full justify-start gap-1 bg-muted/40 p-1 flex-wrap">
        {ADS_ENTITY_LEVELS.map((level) => {
          const available = hasEntityLevelData(records, level);
          return (
            <TabsTrigger
              key={level}
              value={level}
              disabled={!available}
              className="rounded-md px-3 py-1.5 text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm"
            >
              {ADS_ENTITY_LEVEL_LABELS[level]}
            </TabsTrigger>
          );
        })}
      </TabsList>
    </Tabs>
  );
}
