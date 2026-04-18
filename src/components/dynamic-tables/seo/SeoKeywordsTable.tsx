import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowUp, ArrowDown, Trophy, TrendingUp, Calendar, MousePointerClick, Eye, CalendarRange } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface SeoKeywordsTableProps {
  keywords: any[];
  trackedKeywords?: any[];
  gscOnlyKeywords?: any[];
  hasGscData?: boolean;
  show3Month?: boolean;
  showYearly?: boolean;
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
          <Badge variant={kw.position <= 3 ? 'default' : kw.position <= 10 ? 'secondary' : 'outline'} className="font-mono">
            {fmt(kw.position)}
          </Badge>
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
      <td className="p-3 text-center">{kw.kd != null ? kw.kd : '—'}</td>
      <td className="p-3 text-center">{kw.cpc != null ? `$${kw.cpc}` : '—'}</td>
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
  if (keywords.length === 0) return null;

  return (
    <div dir="rtl">
      <div className="flex items-center justify-between px-3 py-2 bg-muted/30 border-b">
        <div className="flex items-center gap-2 text-sm font-medium">
          {icon}
          {title}
        </div>
        <Badge variant="outline" className="text-xs">{keywords.length} ביטויים</Badge>
      </div>
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
              <th className="text-center p-3 font-medium">KD</th>
              <th className="text-center p-3 font-medium">CPC</th>
              <th className="text-right p-3 font-medium">URL</th>
            </tr>
          </thead>
          <tbody>
            {keywords.map((kw, idx) => (
              <KeywordRow key={idx} kw={kw} show3Month={show3Month} showYearly={showYearly} showPrevMonth={showPrevMonth} showGsc={showGsc} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function SeoKeywordsTable({ keywords, trackedKeywords = [], gscOnlyKeywords = [], hasGscData = false, show3Month = false, showYearly = false }: SeoKeywordsTableProps) {
  // Merge all keywords (tracked + organic + gsc-only), deduplicate by keyword name
  const allKeywords = [...trackedKeywords];
  const trackedNames = new Set(trackedKeywords.map((k: any) => String(k.keyword || '').toLowerCase()));
  for (const kw of keywords) {
    if (!trackedNames.has(String(kw.keyword || '').toLowerCase())) {
      allKeywords.push(kw);
    }
  }
  // Add GSC-only keywords (already deduplicated against Ahrefs in SeoDashboardView)
  const allNames = new Set(allKeywords.map((k: any) => String(k.keyword || '').toLowerCase()));
  for (const kw of gscOnlyKeywords) {
    if (!allNames.has(String(kw.keyword || '').toLowerCase())) {
      allKeywords.push(kw);
    }
  }

  // 1. All keywords in top 10 positions (page 1)
  const top10 = [...allKeywords]
    .filter(k => k.position != null && k.position <= 10)
    .sort((a, b) => (a.position || 999) - (b.position || 999));

  // 2. All keywords sorted by 3-month change (biggest improvement first)
  const by3MonthChange = [...allKeywords]
    .filter(k => k.position != null && k.position_3month != null)
    .sort((a, b) => {
      const changeA = (a.position_3month || 0) - (a.position || 0);
      const changeB = (b.position_3month || 0) - (b.position || 0);
      return changeB - changeA;
    });

  // 3. All keywords sorted by yearly change (biggest improvement first)
  const byYearlyChange = [...allKeywords]
    .filter(k => k.position != null && k.position_yearly != null)
    .sort((a, b) => {
      const changeA = (a.position_yearly || 0) - (a.position || 0);
      const changeB = (b.position_yearly || 0) - (b.position || 0);
      return changeB - changeA;
    });

  // 4. All keywords sorted by monthly change (biggest improvement first)
  const byMonthlyChange = [...allKeywords]
    .filter(k => k.position != null && k.position_prev_month != null)
    .sort((a, b) => {
      const changeA = (a.position_prev_month || 0) - (a.position || 0);
      const changeB = (b.position_prev_month || 0) - (b.position || 0);
      return changeB - changeA;
    });

  if (allKeywords.length === 0) return null;

  return (
    <Card dir="rtl">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center justify-between">
          <span>ניתוח מילות מפתח</span>
          <div className="flex gap-2">
            {trackedKeywords.length > 0 && (
              <Badge variant="default" className="text-xs">🎯 {trackedKeywords.length} tracked</Badge>
            )}
            <Badge variant="outline" className="text-xs">{keywords.length} אורגניות</Badge>
            {gscOnlyKeywords.length > 0 && (
              <Badge variant="outline" className="text-xs border-blue-300 text-blue-600">🔍 {gscOnlyKeywords.length} GSC בלבד</Badge>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Tabs defaultValue="top10" className="w-full">
          <TabsList dir="rtl" className="w-full justify-start rounded-none border-b bg-transparent h-auto p-0 gap-0">
            <TabsTrigger value="top10" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2.5 text-xs">
              🏆 Top 10 מקודמים ({top10.length})
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
            <TabsTrigger value="all" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2.5 text-xs">
              📋 טופ 50 אורגניות
            </TabsTrigger>
          </TabsList>

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
              keywords={[...keywords].sort((a, b) => (a.position || 999) - (b.position || 999)).slice(0, 50)}
              title="טופ 50 ביטויים אורגניים"
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
