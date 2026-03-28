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

export function SeoSnapshotCards({ snapshot, prevMonth, campaignStart }: SeoSnapshotCardsProps) {
  const metrics = [
    { key: 'dr', label: 'דירוג דומיין (DR)', icon: '🏆' },
    { key: 'org_traffic', label: 'תנועה אורגנית', icon: '📈' },
    { key: 'org_keywords_top3', label: 'מילות מפתח (Top 3)', icon: '🥇' },
    { key: 'org_keywords_top10', label: 'מילות מפתח (Top 10)', icon: '🔟' },
    { key: 'org_keywords_total', label: 'סה״כ מילות מפתח', icon: '🔑' },
    { key: 'referring_domains', label: 'דומיינים מפנים', icon: '🔗' },
    { key: 'backlinks_live', label: 'קישורים נכנסים (פעילים)', icon: '🌐' },
    { key: 'backlinks_all_time', label: 'קישורים נכנסים (כולל)', icon: '📊' },
    { key: 'referring_domains_all_time', label: 'דומיינים מפנים (כולל)', icon: '🔗' },
  ].filter(m => snapshot[m.key] !== undefined && snapshot[m.key] !== null);

  if (metrics.length === 0) return null;

  return (
    <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
      {metrics.map((metric) => (
        <Card key={metric.key} className="border-primary/10">
          <CardContent className="p-4 text-center">
            <span className="text-xl mb-1 block">{metric.icon}</span>
            <p className="text-xs text-muted-foreground mb-1">{metric.label}</p>
            <p className="text-2xl font-bold text-primary">
              {typeof snapshot[metric.key] === 'number' ? snapshot[metric.key].toLocaleString() : snapshot[metric.key]}
            </p>
            <div className="flex flex-col items-center gap-0.5 mt-1">
              <ChangeIndicator
                current={snapshot[metric.key]}
                previous={prevMonth[metric.key]}
                label="מחודש קודם"
              />
              <ChangeIndicator
                current={snapshot[metric.key]}
                previous={campaignStart[metric.key]}
                label="מתחילת קמפיין"
              />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
