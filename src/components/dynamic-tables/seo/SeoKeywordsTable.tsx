import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowUp, ArrowDown, Trophy, TrendingUp, Calendar, MousePointerClick, Eye, CalendarRange, Target } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

const HEBREW_REGEX = /[\u0590-\u05FF]/;
const ENGLISH_REGEX = /[A-Za-z]/;
type LangFilter = "all" | "he" | "en";

function matchesLang(keyword: string, lang: LangFilter): boolean {
  if (lang === "all") return true;
  if (lang === "he") return HEBREW_REGEX.test(keyword);
  if (lang === "en") return ENGLISH_REGEX.test(keyword) && !HEBREW_REGEX.test(keyword);
  return true;
}

interface SeoKeywordsTableProps {
  keywords: any[];
  trackedKeywords?: any[];
  gscOnlyKeywords?: any[];
  hasGscData?: boolean;
  show3Month?: boolean;
  showYearly?: boolean;
  /** Default tab to open. Defaults to "tracked" so the user's tracked keywords are visible first. */
  defaultTab?: "tracked" | "top10" | "3month" | "yearly" | "monthly" | "all";
  /** Initial language filter persisted at the report/table level. */
  initialLangFilter?: LangFilter;
  /** Called whenever the language filter changes — parent persists to DB. */
  onLangFilterChange?: (lang: LangFilter) => void;
}

function fmt(n: number, digits = 1): string {
  if (Number.isInteger(n)) return String(n);
  return Number(n.toFixed(digits)).toString();
}

function PositionChange({ value }: { value: number | null }) {
  if (value === null || value === undefined) return <span className="text-xs text-muted-foreground">—</span>;
  // Round to 1 decimal to avoid floating-point noise like 0.3999999999999999
  const rounded = Math.round(value * 10) / 10;
  if (rounded === 0) return <span className="text-xs text-muted-foreground">ללא שינוי</span>;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${rounded > 0 ? 'text-green-600' : 'text-red-500'}`}>
      {rounded > 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
      {fmt(Math.abs(rounded))}
    </span>
  );
}

function KeywordRow({ kw, show3Month, showYearly, showPrevMonth, showGsc }: { kw: any; show3Month?: boolean; showYearly?: boolean; showPrevMonth?: boolean; showGsc?: boolean }) {
  const posChangeMonth = kw.position_prev_month != null && kw.position != null
    ? kw.position_prev_month - kw.position : null;
  const posChange3m = kw.position_3month != null && kw.position != null
    ? kw.position_3month - kw.position : null;
  const posChangeYear = kw.position_yearly != null && kw.position != null
    ? kw.position_yearly - kw.position : null;

  return (
    <tr className="border-b last:border-0 hover:bg-muted/30">
      <td className="p-3 font-medium text-right">
        <span className="inline-flex items-center gap-1.5">
          {String(kw.keyword || '')}
          {kw._source === 'gsc' && (
            <Badge variant="outline" className="text-[10px] px-1 py-0 font-normal text-muted-foreground">GSC</Badge>
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
          <td className="p-3 text-center text-xs">
            {kw.gsc_clicks != null ? Number(kw.gsc_clicks).toLocaleString() : <span className="text-muted-foreground">—</span>}
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

      <td className="p-3 text-right text-xs max-w-[200px] truncate text-muted-foreground" title={kw.url}>
        {kw.url ? new URL(kw.url).pathname : '—'}
      </td>
    </tr>
  );
}

function KeywordTable({ keywords, title, icon, show3Month, showYearly, showPrevMonth, showGsc }: {
  keywords: any[];
  title: string;
  icon: React.ReactNode;
  show3Month?: boolean;
  showYearly?: boolean;
  showPrevMonth?: boolean;
  showGsc?: boolean;
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
              {filtered.map((kw, idx) => (
                <KeywordRow key={idx} kw={kw} show3Month={show3Month} showYearly={showYearly} showPrevMonth={showPrevMonth} showGsc={showGsc} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function SeoKeywordsTable({ keywords, trackedKeywords = [], gscOnlyKeywords = [], hasGscData = false, show3Month = false, showYearly = false, defaultTab = "tracked", initialLangFilter, onLangFilterChange }: SeoKeywordsTableProps) {
  const [langFilter, setLangFilterState] = useState<LangFilter>(initialLangFilter ?? "all");

  // Sync if the parent loads the saved value asynchronously after first render
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

  // Merge all keywords (tracked + organic + gsc-only), deduplicate by keyword name
  const mergedKeywords = useMemo(() => {
    const allKeywords = [...trackedKeywords];
    const trackedNames = new Set(trackedKeywords.map((k: any) => String(k.keyword || '').toLowerCase()));
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
    return allKeywords;
  }, [keywords, trackedKeywords, gscOnlyKeywords]);

  const langCounts = useMemo(() => {
    let he = 0, en = 0;
    for (const kw of mergedKeywords) {
      const k = String(kw.keyword || '');
      if (HEBREW_REGEX.test(k)) he++;
      else if (ENGLISH_REGEX.test(k)) en++;
    }
    return { he, en, all: mergedKeywords.length };
  }, [mergedKeywords]);

  const allKeywords = useMemo(
    () => mergedKeywords.filter(kw => matchesLang(String(kw.keyword || ''), langFilter)),
    [mergedKeywords, langFilter]
  );

  // Tracked keywords filtered by language and sorted: keywords with position first (asc), then nulls
  const trackedFiltered = useMemo(() => {
    const filtered = trackedKeywords.filter(kw => matchesLang(String(kw.keyword || ''), langFilter));
    return [...filtered].sort((a, b) => {
      const aPos = a.position ?? Number.POSITIVE_INFINITY;
      const bPos = b.position ?? Number.POSITIVE_INFINITY;
      return aPos - bPos;
    });
  }, [trackedKeywords, langFilter]);

  // Sort helper: keywords with valid position first (ascending), then null/undefined positions at the end
  const sortByPosition = (arr: any[]) =>
    [...arr].sort((a, b) => {
      const aPos = a.position ?? Number.POSITIVE_INFINITY;
      const bPos = b.position ?? Number.POSITIVE_INFINITY;
      return aPos - bPos;
    });

  // 1. All keywords in top 10 positions (page 1)
  const top10 = sortByPosition(allKeywords.filter(k => k.position != null && k.position <= 10));

  // 2. All keywords with 3-month data, sorted by current position (best first)
  const by3MonthChange = sortByPosition(allKeywords.filter(k => k.position != null && k.position_3month != null));

  // 3. All keywords with yearly data, sorted by current position (best first)
  const byYearlyChange = sortByPosition(allKeywords.filter(k => k.position != null && k.position_yearly != null));

  // 4. All keywords with monthly data, sorted by current position (best first)
  const byMonthlyChange = sortByPosition(allKeywords.filter(k => k.position != null && k.position_prev_month != null));

  const formatNumber = (num: number) => new Intl.NumberFormat('he-IL').format(num);

  return (
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
            <Badge variant={trackedKeywords.length > 0 ? "default" : "outline"} className="text-xs">🎯 {trackedKeywords.length} במעקב</Badge>
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
              🏆 Top 10 מקודמים ({top10.length})
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
            />
          </TabsContent>

          <TabsContent value="top10" className="mt-0">
            <KeywordTable
              keywords={top10}
              title={`${top10.length} ביטויים בעמוד הראשון`}
              icon={<Trophy className="h-4 w-4 text-primary" />}
              show3Month={show3Month}
              showYearly={showYearly}
              showPrevMonth
              showGsc={hasGscData}
            />
          </TabsContent>

          <TabsContent value="3month" className="mt-0">
            <KeywordTable
              keywords={by3MonthChange}
              title="כל הביטויים — שינוי 3 חודשים"
              icon={<TrendingUp className="h-4 w-4 text-primary" />}
              show3Month
              showGsc={hasGscData}
            />
          </TabsContent>

          <TabsContent value="yearly" className="mt-0">
            <KeywordTable
              keywords={byYearlyChange}
              title="כל הביטויים — שינוי שנתי"
              icon={<CalendarRange className="h-4 w-4 text-primary" />}
              showYearly
              showGsc={hasGscData}
            />
          </TabsContent>

          <TabsContent value="monthly" className="mt-0">
            <KeywordTable
              keywords={byMonthlyChange}
              title="כל הביטויים — שינוי חודשי"
              icon={<Calendar className="h-4 w-4 text-primary" />}
              showPrevMonth
              showGsc={hasGscData}
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
            />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
