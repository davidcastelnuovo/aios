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
  /** Live tracked-keyword list — used as fallback for Top 3/Top 10 counts */
  trackedKeywords?: Array<any>;
  /** Live organic-keyword list — used as additional fallback for Top 3/Top 10 counts */
  organicKeywords?: Array<any>;
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

function countAtOrBelow(kws: Array<any> | undefined, maxPos: number): number {
  if (!Array.isArray(kws)) return 0;
  let n = 0;
  for (const kw of kws) {
    const p = kw?.position ?? kw?.best_position;
    if (typeof p === "number" && p >= 1 && p <= maxPos) n++;
  }
  return n;
}

export function SeoSnapshotCards({ snapshot, prevMonth, campaignStart, gaOrganicSessions, gaOrganicSessionsPrev, trackedKeywords, organicKeywords }: SeoSnapshotCardsProps) {
  // Live fallback counts (merge tracked + organic, dedup by keyword)
  const mergedByKw = new Map<string, any>();
  for (const kw of trackedKeywords || []) {
    const name = String(kw?.keyword || "").toLowerCase().trim();
    if (name) mergedByKw.set(name, kw);
  }
  for (const kw of organicKeywords || []) {
    const name = String(kw?.keyword || "").toLowerCase().trim();
    if (name && !mergedByKw.has(name)) mergedByKw.set(name, kw);
  }
  const liveList = Array.from(mergedByKw.values());
  const liveTop3 = countAtOrBelow(liveList, 3);
  const liveTop10 = countAtOrBelow(liveList, 10);

  const snapTop3 = getVal(snapshot, "org_keywords_top3");
  const snapTop10 = getVal(snapshot, "org_keywords_top10");
  const effectiveTop3 = liveTop3 > (snapTop3 ?? 0) ? liveTop3 : snapTop3;
  const effectiveTop10 = liveTop10 > (snapTop10 ?? 0) ? liveTop10 : snapTop10;

  const metrics = [
    { keys: ['domain_rating', 'dr'], label: 'דירוג דומיין (DR)', icon: '🏆', isOrganic: false, override: undefined as number | undefined },
    { keys: ['org_traffic'], label: 'תנועה אורגנית', icon: '📈', isOrganic: true, override: undefined as number | undefined },

    { keys: ['org_keywords_top3'], label: 'מילות מפתח (Top 3)', icon: '🥇', isOrganic: false, override: effectiveTop3 },
    { keys: ['org_keywords_top10'], label: 'מילות מפתח (Top 10)', icon: '🔟', isOrganic: false, override: effectiveTop10 },
    { keys: ['org_keywords_total'], label: 'סה״כ מילות מפתח', icon: '🔑', isOrganic: false, override: undefined as number | undefined },
    { keys: ['referring_domains', 'referring_domains_all_time'], label: 'דומיינים מפנים', icon: '🔗', isOrganic: false, override: undefined as number | undefined },
    { keys: ['backlinks_live'], label: 'קישורים נכנסים (פעילים)', icon: '🌐', isOrganic: false, override: undefined as number | undefined },
    { keys: ['backlinks_all_time'], label: 'קישורים נכנסים (כולל)', icon: '📊', isOrganic: false, override: undefined as number | undefined },
  ].map(m => {
    if (m.isOrganic && gaOrganicSessions != null) {
      return {
        ...m,
        value: gaOrganicSessions,
        prevValue: gaOrganicSessionsPrev ?? undefined,
        campaignValue: undefined,
        gaSource: true,
      };
    }
    return {
      ...m,
      value: m.override !== undefined ? m.override : getVal(snapshot, ...m.keys),
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
