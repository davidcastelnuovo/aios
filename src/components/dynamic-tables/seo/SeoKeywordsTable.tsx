import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowUp, ArrowDown } from "lucide-react";

interface SeoKeywordsTableProps {
  keywords: any[];
}

export function SeoKeywordsTable({ keywords }: SeoKeywordsTableProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center justify-between">
          <span>מילות מפתח אורגניות</span>
          <Badge variant="outline">{keywords.length} מילים</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-right p-3 font-medium">מילת מפתח</th>
                <th className="text-center p-3 font-medium">מיקום</th>
                <th className="text-center p-3 font-medium">שינוי (חודש)</th>
                <th className="text-center p-3 font-medium">שינוי (קמפיין)</th>
                <th className="text-center p-3 font-medium">תנועה</th>
                <th className="text-center p-3 font-medium">תנועה חודש קודם</th>
                <th className="text-center p-3 font-medium">תנועה תחילת קמפיין</th>
                <th className="text-center p-3 font-medium">נפח חיפוש</th>
                <th className="text-center p-3 font-medium">KD</th>
                <th className="text-center p-3 font-medium">CPC</th>
                <th className="text-right p-3 font-medium">URL</th>
              </tr>
            </thead>
            <tbody>
              {keywords.slice(0, 50).map((kw: any, idx: number) => {
                const posChangeMonth = kw.position_prev_month != null && kw.position != null
                  ? kw.position_prev_month - kw.position
                  : null;
                const posChangeCampaign = kw.position_campaign_start != null && kw.position != null
                  ? kw.position_campaign_start - kw.position
                  : null;
                return (
                  <tr key={idx} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="p-3 font-medium">{String(kw.keyword || '')}</td>
                    <td className="p-3 text-center">
                      <Badge variant="secondary" className="font-mono">
                        {kw.position ?? '-'}
                      </Badge>
                    </td>
                    <td className="p-3 text-center">
                      <PositionChange value={posChangeMonth} />
                    </td>
                    <td className="p-3 text-center">
                      <PositionChange value={posChangeCampaign} />
                    </td>
                    <td className="p-3 text-center">{kw.traffic != null ? Number(kw.traffic).toLocaleString() : '-'}</td>
                    <td className="p-3 text-center">{kw.traffic_prev_month != null ? Number(kw.traffic_prev_month).toLocaleString() : '-'}</td>
                    <td className="p-3 text-center">{kw.traffic_campaign_start != null ? Number(kw.traffic_campaign_start).toLocaleString() : '-'}</td>
                    <td className="p-3 text-center">{kw.volume != null ? Number(kw.volume).toLocaleString() : '-'}</td>
                    <td className="p-3 text-center">
                      {kw.kd != null ? (
                        <Badge variant={kw.kd <= 20 ? 'default' : kw.kd <= 50 ? 'secondary' : 'destructive'} className="text-xs">
                          {kw.kd}
                        </Badge>
                      ) : '-'}
                    </td>
                    <td className="p-3 text-center">{kw.cpc != null ? `$${Number(kw.cpc).toFixed(2)}` : '-'}</td>
                    <td className="p-3 text-right max-w-[200px] truncate">
                      {kw.url ? (
                        <a href={kw.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-xs">
                          {new URL(kw.url).pathname}
                        </a>
                      ) : '-'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {keywords.length > 50 && (
            <p className="text-center text-sm text-muted-foreground py-3">
              +{keywords.length - 50} מילות מפתח נוספות
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function PositionChange({ value }: { value: number | null }) {
  if (value === null || value === undefined) return <span className="text-xs text-muted-foreground">—</span>;
  if (value === 0) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${value > 0 ? 'text-green-600' : 'text-red-500'}`}>
      {value > 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
      {Math.abs(value)}
    </span>
  );
}
