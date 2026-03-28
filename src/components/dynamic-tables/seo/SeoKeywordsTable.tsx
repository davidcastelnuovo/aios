import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowUp, ArrowDown, Trophy, TrendingUp, Calendar } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface SeoKeywordsTableProps {
  keywords: any[];
  trackedKeywords?: any[];
}

function PositionChange({ value }: { value: number | null }) {
  if (value === null || value === undefined) return <span className="text-xs text-muted-foreground">—</span>;
  if (value === 0) return <span className="text-xs text-muted-foreground">ללא שינוי</span>;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${value > 0 ? 'text-green-600' : 'text-red-500'}`}>
      {value > 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
      {Math.abs(value)}
    </span>
  );
}

function KeywordRow({ kw, showCampaignStart, showPrevMonth }: { kw: any; showCampaignStart?: boolean; showPrevMonth?: boolean }) {
  const posChangeMonth = kw.position_prev_month != null && kw.position != null
    ? kw.position_prev_month - kw.position : null;
  const posChangeCampaign = kw.position_campaign_start != null && kw.position != null
    ? kw.position_campaign_start - kw.position : null;

  return (
    <tr className="border-b last:border-0 hover:bg-muted/30">
      <td className="p-3 font-medium text-right">{String(kw.keyword || '')}</td>
      <td className="p-3 text-center">
        {kw.position != null ? (
          <Badge variant={kw.position <= 3 ? 'default' : kw.position <= 10 ? 'secondary' : 'outline'} className="font-mono">
            {kw.position}
          </Badge>
        ) : <span className="text-muted-foreground">—</span>}
      </td>
      {showPrevMonth && (
        <td className="p-3 text-center"><PositionChange value={posChangeMonth} /></td>
      )}
      {showCampaignStart && (
        <td className="p-3 text-center"><PositionChange value={posChangeCampaign} /></td>
      )}
      <td className="p-3 text-center">{kw.traffic != null ? Number(kw.traffic).toLocaleString() : '-'}</td>
      <td className="p-3 text-center">{kw.volume != null ? Number(kw.volume).toLocaleString() : '-'}</td>
      <td className="p-3 text-center">
        {kw.kd != null ? (
          <Badge variant={kw.kd <= 20 ? 'default' : kw.kd <= 50 ? 'secondary' : 'destructive'} className="text-xs">
            {kw.kd}
          </Badge>
        ) : '-'}
      </td>
      <td className="p-3 text-center">{kw.cpc != null ? `$${Number(kw.cpc).toFixed(2)}` : '-'}</td>
      <td className="p-3 text-right max-w-[180px] truncate">
        {kw.url ? (
          <a href={kw.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-xs">
            {(() => { try { return new URL(kw.url).pathname; } catch { return kw.url; } })()}
          </a>
        ) : '-'}
      </td>
    </tr>
  );
}
function KeywordTable({ keywords, title, icon, showCampaignStart, showPrevMonth }: {
  keywords: any[];
  title: string;
  icon: React.ReactNode;
  showCampaignStart?: boolean;
  showPrevMonth?: boolean;
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
                <th className="text-center p-3 font-medium">שינוי מיקום (חודש)</th>
              )}
              {showCampaignStart && (
                <th className="text-center p-3 font-medium">שינוי מיקום (קידום)</th>
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
              <KeywordRow key={idx} kw={kw} showCampaignStart={showCampaignStart} showPrevMonth={showPrevMonth} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function SeoKeywordsTable({ keywords, trackedKeywords = [] }: SeoKeywordsTableProps) {
  // Merge all keywords (tracked + organic), deduplicate by keyword name
  const allKeywords = [...trackedKeywords];
  const trackedNames = new Set(trackedKeywords.map((k: any) => String(k.keyword || '').toLowerCase()));
  for (const kw of keywords) {
    if (!trackedNames.has(String(kw.keyword || '').toLowerCase())) {
      allKeywords.push(kw);
    }
  }

  // 1. Top 10 by position (best ranked)
  const top10 = [...allKeywords]
    .filter(k => k.position != null)
    .sort((a, b) => (a.position || 999) - (b.position || 999))
    .slice(0, 10);

  // 2. All keywords sorted by campaign start change (biggest improvement first)
  const byCampaignChange = [...allKeywords]
    .filter(k => k.position != null && k.position_campaign_start != null)
    .sort((a, b) => {
      const changeA = (a.position_campaign_start || 0) - (a.position || 0);
      const changeB = (b.position_campaign_start || 0) - (b.position || 0);
      return changeB - changeA; // biggest positive change first
    });

  // 3. All keywords sorted by monthly change (biggest improvement first)
  const byMonthlyChange = [...allKeywords]
    .filter(k => k.position != null && k.position_prev_month != null)
    .sort((a, b) => {
      const changeA = (a.position_prev_month || 0) - (a.position || 0);
      const changeB = (b.position_prev_month || 0) - (b.position || 0);
      return changeB - changeA; // biggest positive change first
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
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Tabs defaultValue="top10" className="w-full">
          <TabsList dir="rtl" className="w-full justify-start rounded-none border-b bg-transparent h-auto p-0 gap-0">
            <TabsTrigger value="top10" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2.5 text-xs">
              🏆 Top 10 מקודמים
            </TabsTrigger>
            <TabsTrigger value="campaign" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2.5 text-xs">
              📈 שינוי מתחילת קידום
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
              title="10 הביטויים הכי מקודמים"
              icon={<Trophy className="h-4 w-4 text-primary" />}
              showCampaignStart
              showPrevMonth
            />
          </TabsContent>

          <TabsContent value="campaign" className="mt-0">
            <KeywordTable
              keywords={byCampaignChange}
              title="כל הביטויים — שינוי מתחילת קידום"
              icon={<TrendingUp className="h-4 w-4 text-primary" />}
              showCampaignStart
            />
          </TabsContent>

          <TabsContent value="monthly" className="mt-0">
            <KeywordTable
              keywords={byMonthlyChange}
              title="כל הביטויים — שינוי חודשי"
              icon={<Calendar className="h-4 w-4 text-primary" />}
              showPrevMonth
            />
          </TabsContent>

          <TabsContent value="all" className="mt-0">
            <KeywordTable
              keywords={[...keywords].sort((a, b) => (a.position || 999) - (b.position || 999)).slice(0, 50)}
              title="טופ 50 ביטויים אורגניים"
              icon={<span>📋</span>}
              showCampaignStart
              showPrevMonth
            />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
