import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, MousePointerClick, Eye, Target, Award, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";

interface PublicGscViewProps {
  records: Array<{ id: string; data: Record<string, any> }>;
}

type GscDateFilter = "last_7_days" | "last_30_days" | "last_90_days" | "last_365_days" | "all";

const DATE_FILTER_LABELS: Record<GscDateFilter, string> = {
  last_7_days: "7 ימים",
  last_30_days: "חודש אחרון",
  last_90_days: "3 חודשים",
  last_365_days: "שנה",
  all: "הכל",
};

function getCutoffDate(filter: GscDateFilter): string | null {
  if (filter === "all") return null;
  const days =
    filter === "last_7_days" ? 7 :
    filter === "last_30_days" ? 30 :
    filter === "last_90_days" ? 90 : 365;
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split("T")[0];
}

export function PublicGscView({ records }: PublicGscViewProps) {
  const [sortBy, setSortBy] = useState<string>("position");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [searchFilter, setSearchFilter] = useState("");
  const [dateFilter, setDateFilter] = useState<GscDateFilter>("last_7_days");

  // Aggregate per query, weighted by impressions for position/CTR
  const aggregated = useMemo(() => {
    const cutoff = getCutoffDate(dateFilter);
    const map = new Map<string, { clicks: number; impressions: number; posSum: number; ctrSum: number; n: number }>();

    for (const r of records) {
      const d = r.data || {};
      const date = d.date || d.day || d.report_date;
      if (cutoff && date && date < cutoff) continue;
      const query = String(d.query || d.keyword || "").trim();
      if (!query) continue;
      const clicks = Number(d.clicks) || 0;
      const impressions = Number(d.impressions) || 0;
      const position = Number(d.position) || 0;
      const ctr = impressions > 0 ? clicks / impressions : 0;
      const cur = map.get(query) || { clicks: 0, impressions: 0, posSum: 0, ctrSum: 0, n: 0 };
      cur.clicks += clicks;
      cur.impressions += impressions;
      cur.posSum += position * (impressions || 1);
      cur.ctrSum += ctr * (impressions || 1);
      cur.n += impressions || 1;
      map.set(query, cur);
    }

    const queries = Array.from(map.entries()).map(([query, v]) => ({
      query,
      clicks: v.clicks,
      impressions: v.impressions,
      position: v.n > 0 ? v.posSum / v.n : 0,
      ctr: v.n > 0 ? v.ctrSum / v.n : 0,
    }));

    const totals = {
      clicks: queries.reduce((s, q) => s + q.clicks, 0),
      impressions: queries.reduce((s, q) => s + q.impressions, 0),
      avgCtr: 0,
      firstPageQueries: queries.filter((q) => q.position > 0 && q.position <= 10).length,
      totalQueries: queries.length,
    };
    totals.avgCtr = totals.impressions > 0 ? totals.clicks / totals.impressions : 0;

    return { queries, totals };
  }, [records, dateFilter]);

  const sortedQueries = useMemo(() => {
    let rows = aggregated.queries.slice();
    if (searchFilter.trim()) {
      const q = searchFilter.toLowerCase();
      rows = rows.filter((r) => r.query.toLowerCase().includes(q));
    }
    rows.sort((a, b) => {
      const aVal = a[sortBy as keyof typeof a] as number;
      const bVal = b[sortBy as keyof typeof b] as number;
      return sortOrder === "desc" ? bVal - aVal : aVal - bVal;
    });
    return rows.slice(0, 200);
  }, [aggregated, sortBy, sortOrder, searchFilter]);

  const handleSortColumn = (col: string) => {
    if (sortBy === col) setSortOrder((o) => (o === "asc" ? "desc" : "asc"));
    else {
      setSortBy(col);
      setSortOrder(col === "position" ? "asc" : "desc");
    }
  };

  const formatNumber = (n: number) => new Intl.NumberFormat("he-IL").format(Math.round(n));

  const SortIcon = ({ col }: { col: string }) => {
    if (sortBy !== col) return <ArrowUpDown className="h-3 w-3 opacity-30 inline mx-1" />;
    return sortOrder === "asc" ? (
      <ArrowUp className="h-3 w-3 text-primary inline mx-1" />
    ) : (
      <ArrowDown className="h-3 w-3 text-primary inline mx-1" />
    );
  };

  if (records.length === 0) {
    return (
      <Card dir="rtl">
        <CardContent className="p-8 text-center text-muted-foreground">
          אין נתוני Search Console זמינים
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4" dir="rtl">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <MousePointerClick className="h-3 w-3" /> קליקים
            </div>
            <div className="text-2xl font-bold">{formatNumber(aggregated.totals.clicks)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <Eye className="h-3 w-3" /> חשיפות
            </div>
            <div className="text-2xl font-bold">{formatNumber(aggregated.totals.impressions)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <Target className="h-3 w-3" /> CTR ממוצע
            </div>
            <div className="text-2xl font-bold">{(aggregated.totals.avgCtr * 100).toFixed(2)}%</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <Award className="h-3 w-3" /> ביטויים בעמוד 1
            </div>
            <div className="text-2xl font-bold">{aggregated.totals.firstPageQueries}</div>
            <div className="text-xs text-muted-foreground">מתוך {aggregated.totals.totalQueries}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters + table */}
      <Card>
        <CardHeader className="pb-2 flex-row items-center justify-between gap-3 flex-wrap">
          <CardTitle className="text-base">ביטויי חיפוש</CardTitle>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="חפש ביטוי..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="h-8 pr-8 w-[200px] text-sm"
              />
            </div>
            <Select value={dateFilter} onValueChange={(v) => setDateFilter(v as GscDateFilter)}>
              <SelectTrigger className="h-8 w-[140px] text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(DATE_FILTER_LABELS) as GscDateFilter[]).map((k) => (
                  <SelectItem key={k} value={k}>
                    {DATE_FILTER_LABELS[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto" dir="rtl">
            <table className="w-full text-sm table-fixed" dir="rtl">
              <colgroup>
                <col />
                <col className="w-24" />
                <col className="w-24" />
                <col className="w-24" />
                <col className="w-24" />
              </colgroup>
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-right p-3 font-medium">ביטוי</th>
                  <th className="text-center p-3 font-medium cursor-pointer select-none" onClick={() => handleSortColumn("position")}>
                    מיקום <SortIcon col="position" />
                  </th>
                  <th className="text-center p-3 font-medium cursor-pointer select-none" onClick={() => handleSortColumn("clicks")}>
                    קליקים <SortIcon col="clicks" />
                  </th>
                  <th className="text-center p-3 font-medium cursor-pointer select-none" onClick={() => handleSortColumn("impressions")}>
                    חשיפות <SortIcon col="impressions" />
                  </th>
                  <th className="text-center p-3 font-medium cursor-pointer select-none" onClick={() => handleSortColumn("ctr")}>
                    CTR <SortIcon col="ctr" />
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedQueries.map((row) => (
                  <tr key={row.query} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="p-3 text-right font-medium truncate">{row.query}</td>
                    <td className="p-3 text-center">
                      <Badge
                        variant={row.position <= 3 ? "default" : row.position <= 10 ? "secondary" : "outline"}
                        className="font-mono"
                      >
                        {row.position.toFixed(1)}
                      </Badge>
                    </td>
                    <td className="p-3 text-center tabular-nums">{formatNumber(row.clicks)}</td>
                    <td className="p-3 text-center tabular-nums">{formatNumber(row.impressions)}</td>
                    <td className="p-3 text-center tabular-nums">{(row.ctr * 100).toFixed(2)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
