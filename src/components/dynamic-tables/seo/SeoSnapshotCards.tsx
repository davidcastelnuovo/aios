import { Card, CardContent } from "@/components/ui/card";
import { ArrowUp, ArrowDown, Minus } from "lucide-react";

interface SeoSnapshotCardsProps {
  snapshot: Record<string, any>;
  prevMonth: Record<string, any>;
  campaignStart: Record<string, any>;
  /** Latest GA organic sessions (current month) — overrides Ahrefs org_traffic */
  gaOrganicSessions?: number | null;
  /** Previous month GA organic sessions */
  gaOrganicSessionsPrev?: number | null;
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

export function SeoSnapshotCards({ snapshot, prevMonth, campaignStart, gaOrganicSessions, gaOrganicSessionsPrev }: SeoSnapshotCardsProps) {
  const metrics = [
    { keys: ['domain_rating', 'dr'], label: 'דירוג דומיין (DR)', icon: '🏆', isOrganic: false },
    { keys: ['org_traffic'], label: 'תנועה אורגנית', icon: '📈', isOrganic: true },
    
    { keys: ['org_keywords_top3'], label: 'מילות מפתח (Top 3)', icon: '🥇', isOrganic: false },
    { keys: ['org_keywords_top10'], label: 'מילות מפתח (Top 10)', icon: '🔟', isOrganic: false },
    { keys: ['org_keywords_total'], label: 'סה״כ מילות מפתח', icon: '🔑', isOrganic: false },
    { keys: ['referring_domains', 'referring_domains_all_time'], label: 'דומיינים מפנים', icon: '🔗', isOrganic: false },
    { keys: ['backlinks_live'], label: 'קישורים נכנסים (פעילים)', icon: '🌐', isOrganic: false },
    { keys: ['backlinks_all_time'], label: 'קישורים נכנסים (כולל)', icon: '📊', isOrganic: false },
  ].map(m => {
    // For organic traffic: use GA sessions if available, otherwise Ahrefs
    if (m.isOrganic && gaOrganicSessions != null) {
      return {
        ...m,
        value: gaOrganicSessions,
        prevValue: gaOrganicSessionsPrev ?? undefined,
        campaignValue: undefined, // no campaign comparison for GA organic
        gaSource: true,
      };
    }
    return {
      ...m,
      value: getVal(snapshot, ...m.keys),
      prevValue: getVal(prevMonth, ...m.keys),
      campaignValue: getVal(campaignStart, ...m.keys),
      gaSource: false,
    };
  }).filter(m => m.value !== undefined);

  if (metrics.length === 0) return null;

  return (
    <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
      {metrics.map((metric, idx) => (
        <Card key={idx} className="border-primary/10">
          <CardContent className="p-4 text-center">
            <span className="text-xl mb-1 block">{metric.icon}</span>
            <p className="text-xs text-muted-foreground mb-1">
              {metric.label}
              {(metric as any).gaSource && (
                <span className="ml-1 text-[10px] text-green-600 font-medium">(Analytics)</span>
              )}
            </p>
            <p className="text-2xl font-bold text-primary">
              {typeof metric.value === 'number' ? metric.value.toLocaleString() : metric.value}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
