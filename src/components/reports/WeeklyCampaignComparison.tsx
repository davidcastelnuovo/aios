import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  buildWeeklyCampaignSections,
  formatWeeklyRange,
  type WeeklyAdsRecord,
  type WeeklyAdsSource,
} from "@/lib/weeklyAdsComparison";

type Props = {
  records: WeeklyAdsRecord[];
  currency?: string;
  defaultSource?: WeeklyAdsSource;
  sourceModes?: Partial<Record<WeeklyAdsSource, "leads" | "ecommerce">>;
  isLoading?: boolean;
};

const sourceLabel: Record<WeeklyAdsSource, string> = {
  facebook_insights: "Facebook",
  facebook_ecommerce: "Facebook",
  google_ads: "Google Ads",
};

const number = (value: number, digits = 0) =>
  value.toLocaleString("he-IL", { maximumFractionDigits: digits });

export function WeeklyCampaignComparison({
  records,
  currency = "₪",
  defaultSource,
  sourceModes,
  isLoading = false,
}: Props) {
  const weeks = buildWeeklyCampaignSections(records, {
    defaultSource,
    sourceModes,
    maxWeeks: 53,
  });
  const sources = new Set(weeks.flatMap((week) => week.rows.map((row) => row.source)));
  const showPlatform = sources.size > 1;

  if (isLoading) {
    return <Card className="p-8 text-center text-sm text-muted-foreground">טוען השוואה שבועית…</Card>;
  }

  if (weeks.length === 0) {
    return (
      <Card className="p-8 text-center text-sm text-muted-foreground" dir="rtl">
        אין עדיין נתונים שבועיים להשוואה.
      </Card>
    );
  }

  return (
    <div className="space-y-5" dir="rtl">
      <div>
        <h2 className="text-lg font-semibold">השוואה שבועית לפי קמפיין</h2>
        <p className="text-sm text-muted-foreground">
          כל שבוע מוצג מראשון עד שבת, מהשבוע האחרון ועד שנה אחורה לפי הנתונים הזמינים.
        </p>
      </div>

      {weeks.map((week) => {
        const kinds = new Set(week.rows.map((row) => row.kind));
        const resultLabel = kinds.size === 1
          ? kinds.has("ecommerce") ? "רכישות" : kinds.has("traffic") ? "קליקים" : "לידים"
          : "תוצאות";
        const costLabel = kinds.size === 1
          ? kinds.has("ecommerce") ? "עלות לרכישה" : kinds.has("traffic") ? "עלות לקליק" : "עלות לליד"
          : "עלות לתוצאה";
        const showRevenue = week.rows.some((row) => row.kind === "ecommerce" || row.revenue > 0);

        return (
          <Card key={week.key} className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/40 px-4 py-3">
              <div>
                <h3 className="font-semibold">
                  {week.index === 0 ? "השבוע" : week.index === 1 ? "שבוע שעבר" : `לפני ${week.index} שבועות`}
                </h3>
                <p className="text-xs text-muted-foreground">{formatWeeklyRange(week.startDate, week.endDate)}</p>
              </div>
              {week.isCurrentWeek && <Badge variant="secondary">שבוע נוכחי · נתונים חלקיים</Badge>}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="border-b bg-muted/20">
                  <tr>
                    {showPlatform && <th className="p-2 text-right font-medium">פלטפורמה</th>}
                    <th className="p-2 text-right font-medium">קמפיין</th>
                    <th className="p-2 text-center font-medium">חשיפות</th>
                    <th className="p-2 text-center font-medium">קליקים</th>
                    <th className="p-2 text-center font-medium">{resultLabel}</th>
                    <th className="p-2 text-center font-medium">הוצאה</th>
                    <th className="p-2 text-center font-medium">{costLabel}</th>
                    {showRevenue && <th className="p-2 text-center font-medium">הכנסה</th>}
                    {showRevenue && <th className="p-2 text-center font-medium">ROAS</th>}
                  </tr>
                </thead>
                <tbody>
                  {week.rows.map((row) => (
                    <tr key={row.key} className="border-b last:border-0 hover:bg-muted/20">
                      {showPlatform && <td className="p-2 text-right">{sourceLabel[row.source]}</td>}
                      <td className="p-2 text-right font-medium">{row.campaign}</td>
                      <td className="p-2 text-center">{number(row.impressions)}</td>
                      <td className="p-2 text-center">{number(row.clicks)}</td>
                      <td className="p-2 text-center font-medium text-green-600">{number(row.results, 1)}</td>
                      <td className="p-2 text-center">{currency}{number(row.spend)}</td>
                      <td className="p-2 text-center font-medium text-blue-600">
                        {row.results > 0 ? `${currency}${number(row.costPerResult, 1)}` : "—"}
                      </td>
                      {showRevenue && <td className="p-2 text-center">{row.revenue > 0 ? `${currency}${number(row.revenue)}` : "—"}</td>}
                      {showRevenue && <td className="p-2 text-center">{row.roas > 0 ? `${number(row.roas, 2)}x` : "—"}</td>}
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-primary/10 font-bold">
                  <tr>
                    {showPlatform && <td />}
                    <td className="p-2 text-right">סה״כ שבועי</td>
                    <td className="p-2 text-center">{number(week.totals.impressions)}</td>
                    <td className="p-2 text-center">{number(week.totals.clicks)}</td>
                    <td className="p-2 text-center text-green-600">{number(week.totals.results, 1)}</td>
                    <td className="p-2 text-center">{currency}{number(week.totals.spend)}</td>
                    <td className="p-2 text-center text-blue-600">
                      {week.totals.results > 0 ? `${currency}${number(week.totals.costPerResult, 1)}` : "—"}
                    </td>
                    {showRevenue && <td className="p-2 text-center">{currency}{number(week.totals.revenue)}</td>}
                    {showRevenue && <td className="p-2 text-center">{week.totals.roas > 0 ? `${number(week.totals.roas, 2)}x` : "—"}</td>}
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
