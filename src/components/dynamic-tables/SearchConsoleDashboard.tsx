import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, TrendingUp, TrendingDown, MousePointerClick, Eye, Target, ArrowUpDown, ArrowUp, ArrowDown, Minus, Award, Upload, X, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import Papa from "papaparse";
import { toast } from "sonner";

type LangFilter = "all" | "he" | "en";

const HEBREW_REGEX = /[\u0590-\u05FF]/;
const ENGLISH_REGEX = /[A-Za-z]/;

interface SearchConsoleDashboardProps {
  tableId: string;
  initialLangFilter?: LangFilter;
  onLangFilterChange?: (lang: LangFilter) => void;
}

interface AggregatedData {
  queries: Array<{
    query: string;
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  }>;
  totals: {
    clicks: number;
    impressions: number;
    avgCtr: number;
    firstPageQueries: number;
    totalQueries: number;
  };
  totalRecords: number;
}

type GscDateFilter = 'last_7_days' | 'last_30_days' | 'last_90_days' | 'last_365_days' | 'all';

const DATE_FILTER_LABELS: Record<GscDateFilter, string> = {
  last_7_days: '7 ימים',
  last_30_days: 'חודש אחרון',
  last_90_days: '3 חודשים',
  last_365_days: 'שנה',
  all: 'הכל',
};

export function SearchConsoleDashboard({ tableId, initialLangFilter, onLangFilterChange }: SearchConsoleDashboardProps) {
  // Default: sort by position ascending (best rank = lowest number = first)
  const [sortBy, setSortBy] = useState<string>("position");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [searchFilter, setSearchFilter] = useState("");
  const [trackedKeywords, setTrackedKeywords] = useState<string[]>([]);
  const [newKeyword, setNewKeyword] = useState("");
  const [dateFilter, setDateFilter] = useState<GscDateFilter>('last_7_days');
  const [langFilter, setLangFilterState] = useState<LangFilter>(initialLangFilter ?? 'all');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync if parent changes saved value
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

  // Fetch aggregated data from the server
  const { data: aggregatedData, isLoading } = useQuery({
    queryKey: ['search-console-aggregated', tableId, dateFilter],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      
      const params = new URLSearchParams({ 
        table_id: tableId,
        aggregated: 'search_console',
        date_filter: dateFilter,
      });
      
      const response = await supabase.functions.invoke(`crm-records?${params.toString()}`, {
        method: 'GET',
      });
      
      if (response.error) throw response.error;
      return response.data as AggregatedData;
    },
    enabled: !!tableId,
  });

  const formatNumber = (num: number) => new Intl.NumberFormat('he-IL').format(num);

  // Handle column header click — toggle direction if same column, else smart default
  const handleSortColumn = (col: string) => {
    if (sortBy === col) {
      setSortOrder(o => o === "asc" ? "desc" : "asc");
    } else {
      setSortBy(col);
      // position: ascending = best first; everything else: descending = highest first
      setSortOrder(col === "position" ? "asc" : "desc");
    }
  };

  // Compute language counts (over all queries, before search filter)
  const allQueries = aggregatedData?.queries || [];
  const langCounts = (() => {
    let he = 0, en = 0;
    for (const r of allQueries) {
      const k = r.query || "";
      if (HEBREW_REGEX.test(k)) he++;
      else if (ENGLISH_REGEX.test(k)) en++;
    }
    return { he, en, all: allQueries.length };
  })();

  // Sort + filter queries
  const sortedQueries = (() => {
    let rows = allQueries.slice();
    if (langFilter !== 'all') {
      rows = rows.filter(r => {
        const k = r.query || "";
        if (langFilter === 'he') return HEBREW_REGEX.test(k);
        if (langFilter === 'en') return ENGLISH_REGEX.test(k) && !HEBREW_REGEX.test(k);
        return true;
      });
    }
    if (searchFilter.trim()) {
      const q = searchFilter.toLowerCase();
      rows = rows.filter(r => r.query.toLowerCase().includes(q));
    }
    rows.sort((a, b) => {
      const aVal = a[sortBy as keyof typeof a] as number;
      const bVal = b[sortBy as keyof typeof b] as number;
      return sortOrder === "desc" ? bVal - aVal : aVal - bVal;
    });
    return rows;
  })();

  const SortIcon = ({ col }: { col: string }) => {
    if (sortBy !== col) return <ArrowUpDown className="h-3 w-3 opacity-30 inline ml-1" />;
    return sortOrder === "asc"
      ? <ArrowUp className="h-3 w-3 text-primary inline ml-1" />
      : <ArrowDown className="h-3 w-3 text-primary inline ml-1" />;
  };

  // Find tracked keywords in the data
  const trackedKeywordsData = trackedKeywords.map(keyword => {
    const normalizedKeyword = keyword.toLowerCase().trim();
    const matchingQuery = sortedQueries.find(q => 
      q.query.toLowerCase() === normalizedKeyword ||
      q.query.toLowerCase().includes(normalizedKeyword)
    );
    
    return {
      keyword,
      found: !!matchingQuery,
      data: matchingQuery || null,
    };
  });

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      complete: (results) => {
        const keywords: string[] = [];
        results.data.forEach((row: any) => {
          const keyword = row['keyword'] || row['ביטוי'] || row['query'] || row['מילת מפתח'] || 
                         (Array.isArray(row) ? row[0] : Object.values(row)[0]);
          if (keyword && typeof keyword === 'string' && keyword.trim()) {
            keywords.push(keyword.trim());
          }
        });
        
        if (keywords.length > 0) {
          setTrackedKeywords(prev => {
            const newKeywords = [...new Set([...prev, ...keywords])];
            return newKeywords;
          });
          toast.success(`נטענו ${keywords.length} ביטויים מהקובץ`);
        } else {
          toast.error('לא נמצאו ביטויים בקובץ');
        }
      },
      header: true,
      skipEmptyLines: true,
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const addKeyword = () => {
    if (newKeyword.trim() && !trackedKeywords.includes(newKeyword.trim())) {
      setTrackedKeywords(prev => [...prev, newKeyword.trim()]);
      setNewKeyword("");
    }
  };

  const removeKeyword = (keyword: string) => {
    setTrackedKeywords(prev => prev.filter(k => k !== keyword));
  };

  const clearAllKeywords = () => {
    setTrackedKeywords([]);
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6" dir="rtl">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-4">
                <Skeleton className="h-4 w-20 mb-2" />
                <Skeleton className="h-8 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-48 w-full" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {[...Array(10)].map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!aggregatedData || aggregatedData.totalRecords === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>אין נתונים להצגה. לחץ על "סנכרון" כדי למשוך נתונים מ-Google Search Console.</p>
      </div>
    );
  }

  const { totals } = aggregatedData;

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header with date range selector */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Search className="h-4 w-4" />
          <span>טווח: <strong>{DATE_FILTER_LABELS[dateFilter]}</strong></span>
        </div>
        <Select value={dateFilter} onValueChange={(v) => setDateFilter(v as GscDateFilter)}>
          <SelectTrigger className="h-8 text-xs w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(DATE_FILTER_LABELS) as GscDateFilter[]).map((k) => (
              <SelectItem key={k} value={k} className="text-xs">
                {DATE_FILTER_LABELS[k]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <MousePointerClick className="h-4 w-4 text-primary" />
              <span className="text-sm text-muted-foreground">קליקים</span>
            </div>
            <p className="text-2xl font-bold mt-1">{formatNumber(totals.clicks)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-blue-500" />
              <span className="text-sm text-muted-foreground">חשיפות</span>
            </div>
            <p className="text-2xl font-bold mt-1">{formatNumber(totals.impressions)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-green-500" />
              <span className="text-sm text-muted-foreground">CTR ממוצע</span>
            </div>
            <p className="text-2xl font-bold mt-1">{totals.avgCtr.toFixed(2)}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Award className="h-4 w-4 text-amber-500" />
              <span className="text-sm text-muted-foreground">ביטויים בעמוד הראשון</span>
            </div>
            <p className="text-2xl font-bold mt-1">{formatNumber(totals.firstPageQueries)}</p>
            <p className="text-xs text-muted-foreground">מתוך {formatNumber(totals.totalQueries)} ביטויים</p>
          </CardContent>
        </Card>
      </div>

      {/* Tracked Keywords Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Target className="h-5 w-5" />
            מעקב ביטויים
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Upload and Add Controls */}
          <div className="flex flex-wrap gap-3 items-center">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="hidden"
            />
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              className="gap-2"
            >
              <Upload className="h-4 w-4" />
              טען ביטויים מ-CSV
            </Button>
            
            <div className="flex gap-2 flex-1 min-w-[200px]">
              <Input
                placeholder="הוסף ביטוי..."
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addKeyword()}
                className="max-w-[300px]"
              />
              <Button onClick={addKeyword} variant="secondary">
                הוסף
              </Button>
            </div>
            
            {trackedKeywords.length > 0 && (
              <Button variant="ghost" size="sm" onClick={clearAllKeywords} className="text-destructive">
                נקה הכל
              </Button>
            )}
          </div>

          {/* CSV Format Hint */}
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <FileText className="h-3 w-3" />
            פורמט CSV: עמודה עם הכותרת "keyword", "ביטוי", "query" או "מילת מפתח"
          </p>

          {/* Tracked Keywords List */}
          {trackedKeywords.length > 0 ? (
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground mb-2">
                {trackedKeywordsData.filter(k => k.found).length} מתוך {trackedKeywords.length} ביטויים נמצאו בנתונים
              </div>
              
              <div className="grid gap-2">
                {trackedKeywordsData.map((item, index) => (
                  <div 
                    key={index} 
                    className={`flex items-center justify-between p-3 rounded-lg transition-colors ${
                      item.found ? 'bg-muted/30 hover:bg-muted/50' : 'bg-destructive/10 hover:bg-destructive/20'
                    }`}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 hover:bg-destructive/20"
                        onClick={() => removeKeyword(item.keyword)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                      <span className="text-sm truncate flex-1" title={item.keyword}>
                        {item.keyword}
                      </span>
                    </div>
                    
                    {item.found && item.data ? (
                      <div className="flex items-center gap-4 text-sm shrink-0">
                        <div className="text-center min-w-[60px]">
                          <span className="text-muted-foreground text-xs">חשיפות</span>
                          <p className="font-medium">{formatNumber(item.data.impressions)}</p>
                        </div>
                        <div className="text-center min-w-[50px]">
                          <span className="text-muted-foreground text-xs">קליקים</span>
                          <p className="font-medium">{formatNumber(item.data.clicks)}</p>
                        </div>
                        <div className="text-center min-w-[50px]">
                          <span className="text-muted-foreground text-xs">CTR</span>
                          <p className="font-medium">{item.data.ctr.toFixed(2)}%</p>
                        </div>
                        <Badge variant={item.data.position <= 10 ? "default" : item.data.position <= 20 ? "secondary" : "outline"}>
                          {item.data.position.toFixed(1)}
                        </Badge>
                      </div>
                    ) : (
                      <Badge variant="outline" className="text-destructive border-destructive">
                        לא נמצא
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-6 text-muted-foreground">
              <Target className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">הוסף ביטויים למעקב או טען קובץ CSV</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Queries Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center justify-between flex-wrap gap-2">
            <span>ביטויי חיפוש ({formatNumber(sortedQueries.length)})</span>
            <div className="flex items-center gap-2 flex-wrap">
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
              <Input
                placeholder="חפש ביטוי..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="h-8 w-[220px] text-sm font-normal"
              />
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="text-right py-2 px-3 font-medium">ביטוי</th>
                  <th
                    className="text-center py-2 px-3 font-medium cursor-pointer hover:bg-muted/70 select-none whitespace-nowrap"
                    onClick={() => handleSortColumn("position")}
                  >
                    מיקום <SortIcon col="position" />
                  </th>
                  <th
                    className="text-center py-2 px-3 font-medium cursor-pointer hover:bg-muted/70 select-none whitespace-nowrap"
                    onClick={() => handleSortColumn("clicks")}
                  >
                    קליקים <SortIcon col="clicks" />
                  </th>
                  <th
                    className="text-center py-2 px-3 font-medium cursor-pointer hover:bg-muted/70 select-none whitespace-nowrap"
                    onClick={() => handleSortColumn("impressions")}
                  >
                    חשיפות <SortIcon col="impressions" />
                  </th>
                  <th
                    className="text-center py-2 px-3 font-medium cursor-pointer hover:bg-muted/70 select-none whitespace-nowrap"
                    onClick={() => handleSortColumn("ctr")}
                  >
                    CTR <SortIcon col="ctr" />
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedQueries.map((query, index) => (
                  <tr key={index} className="border-b hover:bg-muted/50">
                    <td className="py-2 px-3 font-medium max-w-[300px] truncate" title={query.query}>
                      {query.query.length > 60 ? query.query.substring(0, 60) + '...' : query.query}
                    </td>
                    <td className="text-center py-2 px-3">
                      <span className={cn(
                        "inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-medium",
                        query.position <= 3 ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" :
                        query.position <= 10 ? "bg-primary/10 text-primary" :
                        query.position <= 20 ? "bg-muted text-muted-foreground" :
                        "text-muted-foreground"
                      )}>
                        {query.position.toFixed(1)}
                      </span>
                    </td>
                    <td className="text-center py-2 px-3">{formatNumber(query.clicks)}</td>
                    <td className="text-center py-2 px-3">{formatNumber(query.impressions)}</td>
                    <td className="text-center py-2 px-3">{query.ctr.toFixed(2)}%</td>
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
