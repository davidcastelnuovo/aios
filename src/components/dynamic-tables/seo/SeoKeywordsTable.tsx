import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowUp,
  ArrowDown,
  Trophy,
  TrendingUp,
  Calendar,
  MousePointerClick,
  Eye,
  CalendarRange,
  Target,
  Filter,
  Plus,
  EyeOff,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  filterRelevantKeywords,
  normalizeKeywordPhrase,
} from "@/lib/seoKeywordRelevance";
import { useSeoKeywordRelevance } from "@/hooks/useSeoKeywordRelevance";
import { toast } from "sonner";

const HEBREW_REGEX = /[\u0590-\u05FF]/;
const ENGLISH_REGEX = /[A-Za-z]/;
type LangFilter = "all" | "he" | "en";

function matchesLang(keyword: string, lang: LangFilter): boolean {
  if (lang === "all") return true;
  if (lang === "he") return HEBREW_REGEX.test(keyword);
  if (lang === "en") return ENGLISH_REGEX.test(keyword) && !HEBREW_REGEX.test(keyword);
  return true;
}

function normalizeKw(raw: string): string {
  return normalizeKeywordPhrase(raw);
}

interface SeoKeywordsTableProps {
  keywords: any[];
  trackedKeywords?: any[];
  gscOnlyKeywords?: any[];
  hasGscData?: boolean;
  show3Month?: boolean;
  showYearly?: boolean;
  /** Default tab. Top 20 is the primary SEO landing view (legacy value name kept for compatibility). */
  defaultTab?: "tracked" | "top10" | "3month" | "yearly" | "monthly" | "all";
  /** Persistence key for relevance overrides (usually clientId UUID). */
  relevancePersistKey?: string;
  /** Server-provided overrides (public share links). */
  initialForceRelevant?: string[];
  initialForceIrrelevant?: string[];
  /** Hide mark actions and skip writes (anonymous share viewers). */
  relevanceReadOnly?: boolean;
  initialLangFilter?: LangFilter;
  onLangFilterChange?: (lang: LangFilter) => void;
  /** Called when the user marks a keyword as relevant / worth tracking. */
  onMarkRelevant?: (keyword: string) => void;
}

function fmt(n: number, digits = 1): string {
  if (Number.isInteger(n)) return String(n);
  return Number(n.toFixed(digits)).toString();
}

function safePathname(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

function PositionChange({ value }: { value: number | null }) {
  if (value === null || value === undefined) return <span className="text-xs text-muted-foreground">—</span>;
  const rounded = Math.round(value * 10) / 10;
  if (rounded === 0) return <span className="text-xs text-muted-foreground">ללא שינוי</span>;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${rounded > 0 ? 'text-green-600' : 'text-red-500'}`}>
      {rounded > 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
      {fmt(Math.abs(rounded))}
    </span>
  );
}

function KeywordRow({
  kw,
  show3Month,
  showYearly,
  showPrevMonth,
  showGsc,
  dimmed,
  onMarkRelevant,
  onMarkIrrelevant,
  showIrrelevantAction,
}: {
  kw: any;
  show3Month?: boolean;
  showYearly?: boolean;
  showPrevMonth?: boolean;
  showGsc?: boolean;
  dimmed?: boolean;
  onMarkRelevant?: (keyword: string) => void;
  onMarkIrrelevant?: (keyword: string) => void;
  /** Show "לא רלוונטי" even when the row is not dimmed. */
  showIrrelevantAction?: boolean;
}) {
  const posChangeMonth = kw.position_prev_month != null && kw.position != null
    ? kw.position_prev_month - kw.position : null;
  const posChange3m = kw.position_3month != null && kw.position != null
    ? kw.position_3month - kw.position : null;
  const posChangeYear = kw.position_yearly != null && kw.position != null
    ? kw.position_yearly - kw.position : null;
  const gscClicks = kw.gsc_clicks != null ? Number(kw.gsc_clicks) : null;
  const ahrefsTraffic = kw.traffic != null ? Number(kw.traffic) : null;
  const displayClicks = gscClicks && gscClicks > 0 ? gscClicks : (ahrefsTraffic && ahrefsTraffic > 0 ? ahrefsTraffic : gscClicks);

  return (
    <tr className={cn("border-b last:border-0 hover:bg-muted/30", dimmed && "opacity-55 bg-muted/20")}>
      <td className="p-3 font-medium text-right">
        <span className="inline-flex items-center gap-1.5 flex-wrap justify-end">
          {String(kw.keyword || '')}
          {kw._source === 'gsc' && (
            <Badge variant="outline" className="text-[10px] px-1 py-0 font-normal text-muted-foreground">GSC</Badge>
          )}
          {dimmed && (
            <Badge variant="outline" className="text-[10px] px-1 py-0 font-normal text-amber-700 border-amber-300">
              לא רלוונטי?
            </Badge>
          )}
          {dimmed && onMarkRelevant && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 px-1.5 text-[11px] gap-1 text-primary"
              onClick={(e) => {
                e.stopPropagation();
                onMarkRelevant(String(kw.keyword || ""));
              }}
              title="סמן כרלוונטי והוסף למעקב המקומי"
            >
              <Plus className="h-3 w-3" />
              רלוונטי
            </Button>
          )}
          {(dimmed || showIrrelevantAction) && onMarkIrrelevant && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 px-1.5 text-[11px] gap-1 text-muted-foreground hover:text-amber-800"
              onClick={(e) => {
                e.stopPropagation();
                onMarkIrrelevant(String(kw.keyword || ""));
              }}
              title="סמן כלא רלוונטי והסתר מכל רשימות הביטויים"
            >
              <EyeOff className="h-3 w-3" />
              לא רלוונטי
            </Button>
          )}
        </span>
      </td>
      <td className="p-3 text-center">
        {kw.position != null ? (
          <span className="inline-flex items-center gap-1">
            <Badge variant={kw.position <= 3 ? 'default' : kw.position <= 10 ? 'secondary' : 'outline'} className="font-mono">
              {fmt(kw.position)}
            </Badge>
            {kw._position_source === 'gsc' && (
              <Badge variant="outline" className="text-[9px] px-1 py-0 font-normal text-blue-600 border-blue-300" title="מיקום ממוצע מ-Google Search Console">GSC</Badge>
            )}
          </span>
        ) : <span className="text-muted-foreground">—</span>}
      </td>
      {showPrevMonth && (
        <td className="p-3 text-center"><PositionChange value={posChangeMonth} /></td>
      )}
      {show3Month && (
        <td className="p-3 text-center"><PositionChange value={posChange3m} /></td>
      )}
      {showYearly && (
        <td className="p-3 text-center"><PositionChange value={posChangeYear} /></td>
      )}
      {showGsc && (
        <>
          <td className="p-3 text-center text-xs" title={displayClicks === ahrefsTraffic && (!gscClicks || gscClicks === 0) ? "הערכת תנועה מ-Ahrefs" : undefined}>
            {displayClicks != null ? displayClicks.toLocaleString() : <span className="text-muted-foreground">—</span>}
          </td>
          <td className="p-3 text-center text-xs">
            {kw.gsc_impressions != null ? Number(kw.gsc_impressions).toLocaleString() : <span className="text-muted-foreground">—</span>}
          </td>
          <td className="p-3 text-center text-xs">
            {kw.gsc_ctr != null ? `${(Number(kw.gsc_ctr) * 100).toFixed(1)}%` : <span className="text-muted-foreground">—</span>}
          </td>
        </>
      )}
      <td className="p-3 text-center">{kw.traffic != null ? Number(kw.traffic).toLocaleString() : '—'}</td>
      <td className="p-3 text-center">{kw.volume != null ? Number(kw.volume).toLocaleString() : '—'}</td>

      <td className="p-3 text-right text-xs max-w-[200px] truncate" title={kw.url}>
        {kw.url ? (
          <a
            href={kw.url}
            target="_blank"
            rel="noopener noreferrer"
            dir="ltr"
            className="text-primary hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {safePathname(kw.url)}
          </a>
        ) : <span className="text-muted-foreground">—</span>}
      </td>
    </tr>
  );
}

function KeywordTable({
  keywords,
  title,
  icon,
  show3Month,
  showYearly,
  showPrevMonth,
  showGsc,
  dimmedSet,
  onMarkRelevant,
  onMarkIrrelevant,
  showIrrelevantAction,
}: {
  keywords: any[];
  title: string;
  icon: React.ReactNode;
  show3Month?: boolean;
  showYearly?: boolean;
  showPrevMonth?: boolean;
  showGsc?: boolean;
  dimmedSet?: Set<string>;
  onMarkRelevant?: (keyword: string) => void;
  onMarkIrrelevant?: (keyword: string) => void;
  showIrrelevantAction?: boolean;
}) {
  const [search, setSearch] = useState("");
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return keywords;
    return keywords.filter((kw) => String(kw.keyword || "").toLowerCase().includes(q));
  }, [keywords, search]);

  return (
    <div dir="rtl">
      <div className="flex items-center justify-between gap-3 px-3 py-2 bg-muted/30 border-b flex-wrap">
        <div className="flex items-center gap-2 text-sm font-medium">
          {icon}
          {title}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="חיפוש ביטוי..."
            className="h-8 w-48 rounded-md border border-input bg-background px-2 text-xs outline-none focus:ring-2 focus:ring-ring"
          />
          <Badge variant="outline" className="text-xs">
            {filtered.length}
            {search.trim() ? ` / ${keywords.length}` : ""} ביטויים
          </Badge>
        </div>
      </div>
      {filtered.length === 0 ? (
        <div className="px-3 py-8 text-center text-sm text-muted-foreground">
          {search.trim() ? "לא נמצאו ביטויים מתאימים לחיפוש" : "אין ביטויים להצגה בפילטר הנוכחי"}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-right p-3 font-medium">ביטוי</th>
                <th className="text-center p-3 font-medium">מיקום</th>
                {showPrevMonth && (
                  <th className="text-center p-3 font-medium">שינוי חודשי</th>
                )}
                {show3Month && (
                  <th className="text-center p-3 font-medium">שינוי 3 חודשים</th>
                )}
                {showYearly && (
                  <th className="text-center p-3 font-medium">שינוי שנתי</th>
                )}
                {showGsc && (
                  <>
                    <th className="text-center p-3 font-medium text-xs">
                      <div className="flex items-center justify-center gap-1"><MousePointerClick className="h-3 w-3" />קליקים</div>
                    </th>
                    <th className="text-center p-3 font-medium text-xs">
                      <div className="flex items-center justify-center gap-1"><Eye className="h-3 w-3" />חשיפות</div>
                    </th>
                    <th className="text-center p-3 font-medium text-xs">CTR</th>
                  </>
                )}
                <th className="text-center p-3 font-medium">תנועה</th>
                <th className="text-center p-3 font-medium">נפח חיפוש</th>
                <th className="text-right p-3 font-medium">URL</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((kw, idx) => {
                const key = normalizeKw(String(kw.keyword || ""));
                const dimmed = !!dimmedSet?.has(key);
                return (
                  <KeywordRow
                    key={`${key}-${idx}`}
                    kw={kw}
                    show3Month={show3Month}
                    showYearly={showYearly}
                    showPrevMonth={showPrevMonth}
                    showGsc={showGsc}
                    dimmed={dimmed}
                    onMarkRelevant={onMarkRelevant}
                    onMarkIrrelevant={onMarkIrrelevant}
                    showIrrelevantAction={showIrrelevantAction}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function SeoKeywordsTable({
  keywords,
  trackedKeywords = [],
  gscOnlyKeywords = [],
  hasGscData = false,
  show3Month = false,
  showYearly = false,
  defaultTab = "top10",
  relevancePersistKey,
  initialForceRelevant,
  initialForceIrrelevant,
  relevanceReadOnly = false,
  initialLangFilter,
  onLangFilterChange,
  onMarkRelevant,
}: SeoKeywordsTableProps) {
  const [langFilter, setLangFilterState] = useState<LangFilter>(initialLangFilter ?? "all");
  const [filterIrrelevant, setFilterIrrelevant] = useState(true);
  const [reviewOpen, setReviewOpen] = useState(false);
  const {
    forceRelevant,
    forceIrrelevant,
    markRelevant,
    markIrrelevant,
    readOnly,
  } = useSeoKeywordRelevance(relevancePersistKey, {
    initialForceRelevant,
    initialForceIrrelevant,
    readOnly: relevanceReadOnly,
  });

  useEffect(() => {
    if (initialLangFilter && initialLangFilter !== langFilter) {
      setLangFilterState(initialLangFilter);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialLangFilter]);

  const setLangFilter = (next: LangFilter) => {
    setLangFilterState(next);
    onLangFilterChange?.(next);
  };

  const dedupeByKeyword = (rows: any[]): any[] => {
    const groups = new Map<string, any[]>();
    for (const r of rows) {
      const key = String(r?.keyword || '').trim().toLowerCase();
      if (!key) continue;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(r);
    }
    const mergeFields = [
      'position', 'position_prev_month', 'position_3month', 'position_yearly',
      'traffic', 'volume', 'kd', 'cpc', 'url',
      'gsc_clicks', 'gsc_impressions', 'gsc_ctr',
      '_position_source', '_source',
    ];
    const out: any[] = [];
    for (const [, variants] of groups) {
      const sorted = [...variants].sort((a, b) => {
        const ap = a.position ?? Number.POSITIVE_INFINITY;
        const bp = b.position ?? Number.POSITIVE_INFINITY;
        if (ap !== bp) return ap - bp;
        const at = Number(a.traffic ?? 0), bt = Number(b.traffic ?? 0);
        if (at !== bt) return bt - at;
        return Number(b.volume ?? 0) - Number(a.volume ?? 0);
      });
      const best = { ...sorted[0] };
      for (let i = 1; i < sorted.length; i++) {
        for (const f of mergeFields) {
          if ((best[f] == null || best[f] === '') && sorted[i][f] != null && sorted[i][f] !== '') {
            best[f] = sorted[i][f];
          }
        }
      }
      out.push(best);
    }
    return out;
  };

  const dedupedTrackedKeywords = useMemo(() => dedupeByKeyword(trackedKeywords), [trackedKeywords]);

  // Local "extra tracked" from force-relevant marks (so they also appear under במעקב)
  const localExtraTracked = useMemo(() => {
    const trackedNames = new Set(dedupedTrackedKeywords.map((k: any) => normalizeKw(String(k.keyword || ""))));
    const extras: any[] = [];
    for (const phrase of forceRelevant) {
      const key = normalizeKw(phrase);
      if (!key || trackedNames.has(key)) continue;
      const fromOrganic = [...keywords, ...gscOnlyKeywords].find(
        (k) => normalizeKw(String(k.keyword || "")) === key,
      );
      extras.push(fromOrganic ? { ...fromOrganic, _local_tracked: true } : { keyword: phrase, _local_tracked: true });
    }
    return extras;
  }, [forceRelevant, dedupedTrackedKeywords, keywords, gscOnlyKeywords]);

  const effectiveTracked = useMemo(
    () => [...dedupedTrackedKeywords, ...localExtraTracked],
    [dedupedTrackedKeywords, localExtraTracked],
  );

  const mergedKeywords = useMemo(() => {
    const allKeywords = [...effectiveTracked];
    const trackedNames = new Set(effectiveTracked.map((k: any) => String(k.keyword || '').toLowerCase()));
    for (const kw of keywords) {
      if (!trackedNames.has(String(kw.keyword || '').toLowerCase())) {
        allKeywords.push(kw);
      }
    }
    const allNames = new Set(allKeywords.map((k: any) => String(k.keyword || '').toLowerCase()));
    for (const kw of gscOnlyKeywords) {
      if (!allNames.has(String(kw.keyword || '').toLowerCase())) {
        allKeywords.push(kw);
      }
    }
    return dedupeByKeyword(allKeywords);
  }, [keywords, effectiveTracked, gscOnlyKeywords]);

  const langCounts = useMemo(() => {
    let he = 0, en = 0;
    for (const kw of mergedKeywords) {
      const k = String(kw.keyword || '');
      if (HEBREW_REGEX.test(k)) he++;
      else if (ENGLISH_REGEX.test(k)) en++;
    }
    return { he, en, all: mergedKeywords.length };
  }, [mergedKeywords]);

  const rawAllKeywords = useMemo(
    () => mergedKeywords.filter(kw => matchesLang(String(kw.keyword || ''), langFilter)),
    [mergedKeywords, langFilter]
  );

  const { relevant: relevantKeywords, irrelevant: irrelevantKeywords } = useMemo(
    () =>
      filterRelevantKeywords(rawAllKeywords, effectiveTracked, {
        enabled: true,
        forceRelevant,
        forceIrrelevant,
      }),
    [rawAllKeywords, effectiveTracked, forceRelevant, forceIrrelevant],
  );

  const forceIrrelevantSet = useMemo(
    () => new Set(forceIrrelevant.map((p) => normalizeKw(p))),
    [forceIrrelevant],
  );

  // Share links (readOnly): always hide manually-marked irrelevant keywords.
  // In-app: the "סנן לא רלוונטיים" toggle can reveal auto-filtered rows for review,
  // but force-irrelevant marks stay hidden unless the user opens the review dialog.
  const applyRelevanceFilter = readOnly ? true : filterIrrelevant;

  // The relevance switch applies to every keyword tab, not only the ranking shortcut.
  const allKeywords = useMemo(() => {
    if (applyRelevanceFilter) return relevantKeywords;
    // Toggle off in-app: show auto-filtered again, but keep manual לא רלוונטי hidden.
    return rawAllKeywords.filter(
      (k) => !forceIrrelevantSet.has(normalizeKw(String(k.keyword || ""))),
    );
  }, [applyRelevanceFilter, relevantKeywords, rawAllKeywords, forceIrrelevantSet]);

  const irrelevantSet = useMemo(
    () => new Set(irrelevantKeywords.map((k) => normalizeKw(String(k.keyword || "")))),
    [irrelevantKeywords],
  );

  const trackedFiltered = useMemo(() => {
    const filtered = effectiveTracked.filter((kw) => {
      if (!matchesLang(String(kw.keyword || ''), langFilter)) return false;
      const key = normalizeKw(String(kw.keyword || ""));
      if (forceIrrelevantSet.has(key)) return false;
      return !applyRelevanceFilter || !irrelevantSet.has(key);
    });
    return [...filtered].sort((a, b) => {
      const aPos = a.position ?? Number.POSITIVE_INFINITY;
      const bPos = b.position ?? Number.POSITIVE_INFINITY;
      return aPos - bPos;
    });
  }, [effectiveTracked, langFilter, applyRelevanceFilter, irrelevantSet, forceIrrelevantSet]);

  const keywordRank = (k: any): number | null => {
    const rank = k?.position ?? k?.gsc_position ?? null;
    return typeof rank === "number" && Number.isFinite(rank) ? rank : null;
  };

  const sortByPosition = (arr: any[]) =>
    [...arr].sort((a, b) => {
      const aPos = keywordRank(a) ?? Number.POSITIVE_INFINITY;
      const bPos = keywordRank(b) ?? Number.POSITIVE_INFINITY;
      return aPos - bPos;
    });

  const top20Raw = useMemo(
    () =>
      sortByPosition(
        rawAllKeywords.filter((k) => {
          const rank = keywordRank(k);
          return rank != null && rank <= 20;
        }),
      ),
    [rawAllKeywords],
  );

  const top20 = useMemo(
    () =>
      top20Raw.filter((k) => {
        const key = normalizeKw(String(k.keyword || ""));
        if (forceIrrelevantSet.has(key)) return false;
        return !applyRelevanceFilter || !irrelevantSet.has(key);
      }),
    [applyRelevanceFilter, top20Raw, irrelevantSet, forceIrrelevantSet],
  );
  const allDimmed = useMemo(() => {
    if (applyRelevanceFilter) return new Set<string>();
    // Manual marks are already removed from lists; dim only auto-filtered leftovers.
    const dimmed = new Set<string>();
    for (const key of irrelevantSet) {
      if (!forceIrrelevantSet.has(key)) dimmed.add(key);
    }
    return dimmed;
  }, [applyRelevanceFilter, irrelevantSet, forceIrrelevantSet]);

  const by3MonthChange = sortByPosition(allKeywords.filter(k => k.position != null && k.position_3month != null));
  const byYearlyChange = sortByPosition(allKeywords.filter(k => k.position != null && k.position_yearly != null));
  const byMonthlyChange = sortByPosition(allKeywords.filter(k => k.position != null && k.position_prev_month != null));

  const formatNumber = (num: number) => new Intl.NumberFormat('he-IL').format(num);

  const handleMarkRelevant = (keyword: string) => {
    if (readOnly) return;
    const key = normalizeKw(keyword);
    if (!key) return;
    markRelevant(keyword);
    onMarkRelevant?.(keyword.trim());
    toast.success(`"${keyword.trim()}" סומן כרלוונטי ונוסף למעקב`);
  };

  const handleMarkIrrelevant = (keyword: string) => {
    if (readOnly) return;
    const key = normalizeKw(keyword);
    if (!key) return;
    markIrrelevant(keyword);
    toast.success(`"${keyword.trim()}" סומן כלא רלוונטי`);
  };

  // Manual marks filter even with an empty tracked list; auto-filter needs tracked terms.
  const canFilter = effectiveTracked.length > 0 || forceIrrelevant.length > 0;
  const manuallyHiddenCount = forceIrrelevant.length;
  const markProps = readOnly
    ? {}
    : {
        onMarkRelevant: handleMarkRelevant,
        onMarkIrrelevant: handleMarkIrrelevant,
        showIrrelevantAction: true as const,
      };

  return (
    <>
    <Card dir="rtl">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center justify-between gap-3 flex-wrap">
          <span>ניתוח מילות מפתח</span>
          <div className="flex gap-2 items-center flex-wrap">
            <div className="inline-flex rounded-md border bg-background p-0.5">
              <button
                type="button"
                onClick={() => setLangFilter("all")}
                className={cn(
                  "px-2.5 h-7 text-xs font-medium rounded-sm transition-colors",
                  langFilter === "all" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
                )}
              >
                הכל ({formatNumber(langCounts.all)})
              </button>
              <button
                type="button"
                onClick={() => setLangFilter("he")}
                className={cn(
                  "px-2.5 h-7 text-xs font-medium rounded-sm transition-colors",
                  langFilter === "he" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
                )}
              >
                עברית ({formatNumber(langCounts.he)})
              </button>
              <button
                type="button"
                onClick={() => setLangFilter("en")}
                className={cn(
                  "px-2.5 h-7 text-xs font-medium rounded-sm transition-colors",
                  langFilter === "en" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
                )}
              >
                English ({formatNumber(langCounts.en)})
              </button>
            </div>

            <button
              type="button"
              disabled={!canFilter || readOnly}
              title={
                readOnly
                  ? "בקישור שיתוף ביטויים לא רלוונטיים מסוננים תמיד"
                  : canFilter
                    ? "מסתיר ביטויים שלא קשורים לרשימת המעקב (לפי מילים משותפות)"
                    : "אין ביטויים במעקב — אין על מה לבסס סינון"
              }
              onClick={() => {
                if (readOnly) return;
                setFilterIrrelevant((v) => !v);
              }}
              className={cn(
                "inline-flex items-center gap-1.5 px-2.5 h-7 text-xs font-medium rounded-md border transition-colors",
                applyRelevanceFilter && canFilter
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-muted-foreground hover:bg-muted",
                (!canFilter || readOnly) && "opacity-50 cursor-not-allowed",
              )}
            >
              <Filter className="h-3.5 w-3.5" />
              סנן לא רלוונטיים
              {canFilter && irrelevantKeywords.length > 0 && (
                <Badge
                  variant="secondary"
                  role={readOnly ? undefined : "button"}
                  tabIndex={readOnly ? undefined : 0}
                  title={
                    readOnly
                      ? `${irrelevantKeywords.length} ביטויים מסוננים`
                      : "פתח את רשימת הביטויים שסוננו — סמן רלוונטי / לא רלוונטי"
                  }
                  onClick={(e) => {
                    e.stopPropagation();
                    if (readOnly) return;
                    setReviewOpen(true);
                  }}
                  onKeyDown={(e) => {
                    if (readOnly) return;
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      e.stopPropagation();
                      setReviewOpen(true);
                    }
                  }}
                  className={cn(
                    "text-[10px] h-4 px-1",
                    !readOnly && "cursor-pointer hover:ring-1 hover:ring-offset-1",
                    applyRelevanceFilter ? "bg-primary-foreground/20 text-primary-foreground" : "",
                  )}
                >
                  {applyRelevanceFilter ? `−${irrelevantKeywords.length}` : irrelevantKeywords.length}
                </Badge>
              )}
            </button>

            {manuallyHiddenCount > 0 && !readOnly && (
              <button
                type="button"
                onClick={() => setReviewOpen(true)}
                className="inline-flex items-center gap-1 px-2 h-7 text-xs rounded-md border bg-background text-muted-foreground hover:bg-muted"
                title="ביטויים שסימנת ידנית כלא רלוונטיים"
              >
                <EyeOff className="h-3.5 w-3.5" />
                מוסתרים ({manuallyHiddenCount})
              </button>
            )}
            {manuallyHiddenCount > 0 && readOnly && (
              <Badge variant="outline" className="text-xs gap-1">
                <EyeOff className="h-3 w-3" />
                מוסתרים ({manuallyHiddenCount})
              </Badge>
            )}

            <Badge variant={effectiveTracked.length > 0 ? "default" : "outline"} className="text-xs">🎯 {effectiveTracked.length} במעקב</Badge>
            <Badge variant="outline" className="text-xs">{keywords.length} אורגניות</Badge>
            {gscOnlyKeywords.length > 0 && (
              <Badge variant="outline" className="text-xs border-blue-300 text-blue-600">🔍 {gscOnlyKeywords.length} GSC בלבד</Badge>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Tabs defaultValue={defaultTab} className="w-full">
          <TabsList dir="rtl" className="w-full justify-start rounded-none border-b bg-transparent h-auto p-0 gap-0">
            <TabsTrigger value="top10" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2.5 text-xs">
              🏆 Top 20 מקודמים ({top20.length})
            </TabsTrigger>
            <TabsTrigger value="tracked" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2.5 text-xs">
              🎯 ביטויים במעקב ({trackedFiltered.length})
            </TabsTrigger>
            <TabsTrigger value="all" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2.5 text-xs">
              📋 כל הביטויים ({allKeywords.length})
            </TabsTrigger>
            <TabsTrigger value="3month" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2.5 text-xs">
              📈 שינוי 3 חודשים
            </TabsTrigger>
            <TabsTrigger value="yearly" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2.5 text-xs">
              📅 שינוי שנתי
            </TabsTrigger>
            <TabsTrigger value="monthly" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2.5 text-xs">
              📅 שינוי חודשי
            </TabsTrigger>
          </TabsList>

          <TabsContent value="tracked" className="mt-0">
            <KeywordTable
              keywords={trackedFiltered}
              title={`ביטויים במעקב (${trackedFiltered.length})`}
              icon={<Target className="h-4 w-4 text-primary" />}
              show3Month={show3Month}
              showYearly={showYearly}
              showPrevMonth
              showGsc={hasGscData}
              dimmedSet={allDimmed}
              {...markProps}
            />
          </TabsContent>

          <TabsContent value="top10" className="mt-0">
            {!applyRelevanceFilter && !readOnly && irrelevantKeywords.length > 0 && (
              <div className="px-3 py-2 text-xs text-amber-800 bg-amber-50 border-b border-amber-100 flex items-center justify-between gap-2 flex-wrap">
                <span>
                  מוצגים גם ביטויים שסוננו אוטומטית — לחץ &quot;רלוונטי&quot; / &quot;לא רלוונטי&quot;. ביטויים שסומנו ידנית כלא רלוונטיים נשארים מוסתרים.
                </span>
                <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => setReviewOpen(true)}>
                  סקור מסוננים
                </Button>
              </div>
            )}
            <KeywordTable
              keywords={top20}
              title={`${top20.length} ביטויים ב-Top 20${applyRelevanceFilter && irrelevantKeywords.length > 0 ? ` · סוננו ${irrelevantKeywords.length} מכל הרשימות` : ""}`}
              icon={<Trophy className="h-4 w-4 text-primary" />}
              show3Month={show3Month}
              showYearly={showYearly}
              showPrevMonth
              showGsc={hasGscData}
              dimmedSet={allDimmed}
              {...markProps}
            />
          </TabsContent>

          <TabsContent value="3month" className="mt-0">
            <KeywordTable
              keywords={by3MonthChange}
              title="כל הביטויים — שינוי 3 חודשים"
              icon={<TrendingUp className="h-4 w-4 text-primary" />}
              show3Month
              showGsc={hasGscData}
              dimmedSet={allDimmed}
              {...markProps}
            />
          </TabsContent>

          <TabsContent value="yearly" className="mt-0">
            <KeywordTable
              keywords={byYearlyChange}
              title="כל הביטויים — שינוי שנתי"
              icon={<CalendarRange className="h-4 w-4 text-primary" />}
              showYearly
              showGsc={hasGscData}
              dimmedSet={allDimmed}
              {...markProps}
            />
          </TabsContent>

          <TabsContent value="monthly" className="mt-0">
            <KeywordTable
              keywords={byMonthlyChange}
              title="כל הביטויים — שינוי חודשי"
              icon={<Calendar className="h-4 w-4 text-primary" />}
              showPrevMonth
              showGsc={hasGscData}
              dimmedSet={allDimmed}
              {...markProps}
            />
          </TabsContent>

          <TabsContent value="all" className="mt-0">
            <KeywordTable
              keywords={[...allKeywords].sort((a, b) => (a.position ?? 999) - (b.position ?? 999))}
              title={`כל הביטויים (${allKeywords.length})`}
              icon={<span>📋</span>}
              show3Month={show3Month}
              showYearly={showYearly}
              showPrevMonth
              showGsc={hasGscData}
              dimmedSet={allDimmed}
              {...markProps}
            />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>

    <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
      <DialogContent className="max-w-xl max-h-[80vh] overflow-hidden flex flex-col" dir="rtl">
        <DialogHeader>
          <DialogTitle>ביטויים שסוננו מכל הרשימות</DialogTitle>
          <DialogDescription>
            סמן &quot;רלוונטי&quot; כדי להחזיר למעקב, או &quot;לא רלוונטי&quot; כדי להסתיר באופן קבוע גם בקישורי שיתוף.
          </DialogDescription>
        </DialogHeader>
        <div className="overflow-y-auto flex-1 -mx-1 px-1 space-y-1">
          {irrelevantKeywords.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">אין ביטויים מסוננים כרגע</p>
          ) : (
            irrelevantKeywords.map((kw, idx) => {
              const phrase = String(kw.keyword || "");
              const key = normalizeKw(phrase);
              const manual = forceIrrelevantSet.has(key);
              return (
                <div
                  key={`${key}-${idx}`}
                  className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
                >
                  <div className="min-w-0 text-right">
                    <div className="font-medium truncate">{phrase}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-2 justify-end mt-0.5">
                      {kw.position != null && <span>מיקום {kw.position}</span>}
                      {manual ? (
                        <Badge variant="outline" className="text-[10px] h-4 px-1 text-amber-700 border-amber-300">
                          הוסתר ידנית
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] h-4 px-1">
                          אוטומטי
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs gap-1"
                      onClick={() => handleMarkRelevant(phrase)}
                    >
                      <Plus className="h-3 w-3" />
                      רלוונטי
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs gap-1 text-muted-foreground"
                      onClick={() => handleMarkIrrelevant(phrase)}
                    >
                      <EyeOff className="h-3 w-3" />
                      לא רלוונטי
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}
