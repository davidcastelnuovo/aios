import { Card, CardContent } from "@/components/ui/card";
import { ArrowUp, ArrowDown, Minus } from "lucide-react";

interface SeoSnapshotCardsProps {
  snapshot: Record<string, any>;
  prevMonth: Record<string, any>;
  campaignStart: Record<string, any>;
}

function ChangeIndicator({ current, previous, label, inverse }: { current?: number; previous?: number; label: string; inverse?: boolean }) {
  if (current == null || previous == null) return null;
  const diff = current - previous;
  if (diff === 0) return <span className="text-xs text-muted-foreground flex items-center gap-0.5"><Minus className="h-3 w-3" />{label}</span>;
  const isPositive = inverse ? diff < 0 : diff > 0;
  return (
    <span className={`text-xs flex items-center gap-0.5 ${isPositive ? 'text-green-600' : 'text-red-500'}`}>
      {isPositive ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
      {Math.abs(diff).toLocaleString()} {label}
    </span>
  );
}

// Helper to get a value from snapshot trying multiple key variants
function getVal(obj: Record<string, any>, ...keys: string[]): number | undefined {
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null) return obj[k];
  }
  return undefined;
}

export function SeoSnapshotCards({ snapshot, prevMonth, campaignStart }: SeoSnapshotCardsProps) {
  const metrics = [
    { keys: ['domain_rating', 'dr'], label: 'דירוג דומיין (DR)', icon: '🏆' },
    { keys: ['org_traffic'], label: 'תנועה אורגנית', icon: '📈' },
    { keys: ['org_keywords_top3'], label: 'מילות מפתח (Top 3)', icon: '🥇' },
    { keys: ['org_keywords_top10'], label: 'מילות מפתח (Top 10)', icon: '🔟' },
    { keys: ['org_keywords_total'], label: 'סה״כ מילות מפתח', icon: '🔑' },
    { keys: ['referring_domains', 'referring_domains_all_time'], label: 'דומיינים מפנים', icon: '🔗' },
    { keys: ['backlinks_live'], label: 'קישורים נכנסים (פעילים)', icon: '🌐' },
    { keys: ['backlinks_all_time'], label: 'קישורים נכנסים (כולל)', icon: '📊' },
  ].map(m => ({
    ...m,
    value: getVal(snapshot, ...m.keys),
    prevValue: getVal(prevMonth, ...m.keys),
    campaignValue: getVal(campaignStart, ...m.keys),
  })).filter(m => m.value !== undefined);

  if (metrics.length === 0) return null;

  return (
    <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
      {metrics.map((metric, idx) => (
        <Card key={idx} className="border-primary/10">
          <CardContent className="p-4 text-center">
            <span className="text-xl mb-1 block">{metric.icon}</span>
            <p className="text-xs text-muted-foreground mb-1">{metric.label}</p>
            <p className="text-2xl font-bold text-primary">
              {typeof metric.value === 'number' ? metric.value.toLocaleString() : metric.value}
            </p>
            <div className="mt-1 flex flex-col items-center gap-0.5">
              {metric.prevValue !== undefined && (
                <ChangeIndicator
                  current={metric.value}
                  previous={metric.prevValue}
                  label="מחודש שעבר"
                  inverse={metric.keys.some(k => k.includes('position') || k.includes('kd'))}
                />
              )}
              {metric.campaignValue !== undefined && metric.campaignValue !== metric.prevValue && (
                <ChangeIndicator
                  current={metric.value}
                  previous={metric.campaignValue}
                  label="מתחילת קמפיין"
                  inverse={metric.keys.some(k => k.includes('position') || k.includes('kd'))}
                />
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
