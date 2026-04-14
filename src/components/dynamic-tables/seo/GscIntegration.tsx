import { useEffect, useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Link2, RefreshCw, Search, MousePointerClick, Eye, Target, ChevronsUpDown, Check, ArrowUpDown, Award } from "lucide-react";
import { cn } from "@/lib/utils";

interface GscIntegrationProps {
  tenantId: string;
  clientId: string;
  domain?: string;
  keywords?: string[];
  onDataLoaded?: (data: GscKeywordData[]) => void;
}

interface GscSite {
  siteUrl: string;
  permissionLevel?: string;
}

export interface GscKeywordData {
  keyword: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

function normalizeDomain(value?: string) {
  return String(value || "")
    .replace(/^sc-domain:/, "")
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/+$/, "")
    .toLowerCase();
}

export function GscIntegration({ tenantId, clientId, domain, keywords, onDataLoaded }: GscIntegrationProps) {
  const queryClient = useQueryClient();
  const [selectedSite, setSelectedSite] = useState<string>("");
  const [sitePopoverOpen, setSitePopoverOpen] = useState(false);

  const { data: gscIntegration, isLoading: isLoadingIntegration } = useQuery({
    queryKey: ["gsc-integration", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenant_integrations")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("integration_type", "google_search_console")
        .eq("is_active", true)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
    refetchOnMount: "always",
  });

  const settings = (gscIntegration?.settings as any) || {};

  const {
    data: availableSites = [],
    isLoading: isLoadingSites,
    refetch: refetchSites,
  } = useQuery({
    queryKey: ["gsc-sites", gscIntegration?.id],
    queryFn: async () => {
      if (!gscIntegration?.id) return [] as GscSite[];

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const response = await supabase.functions.invoke("google-search-console-auth?action=get_sites", {
        body: { integrationId: gscIntegration.id },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (response.error) throw response.error;
      return Array.isArray(response.data?.sites) ? (response.data.sites as GscSite[]) : [];
    },
    enabled: !!gscIntegration?.id,
    staleTime: 5 * 60 * 1000,
  });

  const persistedSiteUrl = selectedSite || settings?.site_url || settings?.siteUrl || "";
  const normalizedDomain = normalizeDomain(domain);
  const matchedSite = normalizedDomain
    ? availableSites.find((site) => {
        const normalizedSite = normalizeDomain(site.siteUrl);
        return (
          normalizedSite === normalizedDomain ||
          normalizedSite.includes(normalizedDomain) ||
          normalizedDomain.includes(normalizedSite)
        );
      })
    : null;

  const fallbackSiteUrl = matchedSite?.siteUrl || (availableSites.length === 1 ? availableSites[0].siteUrl : "");
  const effectiveSiteUrl = persistedSiteUrl || fallbackSiteUrl;

  useEffect(() => {
    if (!effectiveSiteUrl) {
      onDataLoaded?.([]);
    }
  }, [effectiveSiteUrl, onDataLoaded, clientId]);

  const { data: gscData, isLoading: isLoadingData, refetch: refetchData } = useQuery({
    queryKey: ["gsc-keyword-data", gscIntegration?.id, effectiveSiteUrl, keywords?.join(",")],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const response = await supabase.functions.invoke("fetch-gsc-data", {
        body: {
          integrationId: gscIntegration!.id,
          siteUrl: effectiveSiteUrl,
          keywords: keywords || [],
        },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (response.error) throw response.error;
      const rows = Array.isArray(response.data?.rows) ? response.data.rows : [];
      onDataLoaded?.(rows);
      return rows as GscKeywordData[];
    },
    enabled: !!gscIntegration?.id && !!effectiveSiteUrl,
  });

  const connectMutation = useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const response = await supabase.functions.invoke("google-search-console-auth?action=authorize", {
        body: {
          tenantId,
          userId: session.user.id,
          siteUrl: domain || "",
        },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (response.error) throw response.error;
      return response.data;
    },
    onSuccess: (data) => {
      if (data?.authUrl) {
        window.open(data.authUrl, "_blank", "width=600,height=700");
      }
    },
    onError: (error) => {
      toast.error("שגיאה בחיבור ל-Google Search Console");
      console.error(error);
    },
  });

  const updateSiteMutation = useMutation({
    mutationFn: async (siteUrl: string) => {
      if (!gscIntegration?.id) return;
      const { error } = await supabase
        .from("tenant_integrations")
        .update({
          settings: {
            ...settings,
            site_url: siteUrl,
            siteUrl: siteUrl,
            available_sites: availableSites,
          },
        })
        .eq("id", gscIntegration.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gsc-integration"] });
      queryClient.invalidateQueries({ queryKey: ["gsc-keyword-data"] });
      toast.success("הנכס עודכן");
    },
  });

  if (isLoadingIntegration) return null;

  if (!gscIntegration) {
    return (
      <Card className="border-dashed border-primary/30">
        <CardContent className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              חבר Google Search Console כדי להשלים נתוני קליקים, חשיפות ו-CTR
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => connectMutation.mutate()}
            disabled={connectMutation.isPending}
            className="gap-2"
          >
            <Link2 className="h-4 w-4" />
            {connectMutation.isPending ? "מתחבר..." : "חבר GSC"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/20">
      <CardHeader className="py-3 px-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-medium">Google Search Console</CardTitle>
            <Badge variant="secondary" className="text-xs">
              {settings?.google_email || "מחובר"}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            {availableSites.length > 0 && (
              <Popover open={sitePopoverOpen} onOpenChange={setSitePopoverOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" className="h-7 text-xs w-[220px] justify-between">
                    {effectiveSiteUrl
                      ? effectiveSiteUrl.replace("sc-domain:", "").replace("https://", "")
                      : "בחר נכס Search Console"}
                    <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[260px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="חפש נכס..." className="h-8 text-xs" />
                    <CommandList>
                      <CommandEmpty>לא נמצאו נכסים</CommandEmpty>
                      <CommandGroup>
                        {availableSites.map((site) => {
                          const label = site.siteUrl.replace("sc-domain:", "").replace("https://", "");
                          return (
                            <CommandItem
                              key={site.siteUrl}
                              value={label}
                              onSelect={() => {
                                setSelectedSite(site.siteUrl);
                                updateSiteMutation.mutate(site.siteUrl);
                                setSitePopoverOpen(false);
                              }}
                              className="text-xs"
                            >
                              <Check className={cn("mr-2 h-3 w-3", effectiveSiteUrl === site.siteUrl ? "opacity-100" : "opacity-0")} />
                              {label}
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => {
                refetchSites();
                refetchData();
              }}
              disabled={isLoadingData || isLoadingSites}
            >
              <RefreshCw className={`h-3 w-3 ${(isLoadingData || isLoadingSites) ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
      </CardHeader>

      {!isLoadingSites && availableSites.length === 0 && (
        <CardContent className="px-4 pb-3 pt-0">
          <p className="text-xs text-muted-foreground text-center">
            החיבור קיים אבל לא נטענו נכסים מ-Search Console. נסה רענון או חיבור מחדש.
          </p>
        </CardContent>
      )}

      {!effectiveSiteUrl && availableSites.length > 0 && !isLoadingSites && (
        <CardContent className="px-4 pb-3 pt-0">
          <p className="text-xs text-muted-foreground text-center">בחר נכס Search Console כדי למשוך נתונים</p>
        </CardContent>
      )}

      {gscData && gscData.length > 0 && (
        <CardContent className="px-4 pb-4 pt-0 space-y-4">
          {/* Summary Stats */}
          <div className="grid grid-cols-4 gap-3">
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
                <MousePointerClick className="h-3 w-3" />
                קליקים
              </div>
              <p className="text-sm font-bold">
                {gscData.reduce((sum: number, row: GscKeywordData) => sum + row.clicks, 0).toLocaleString()}
              </p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
                <Eye className="h-3 w-3" />
                חשיפות
              </div>
              <p className="text-sm font-bold">
                {gscData.reduce((sum: number, row: GscKeywordData) => sum + row.impressions, 0).toLocaleString()}
              </p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
                <Target className="h-3 w-3" />
                CTR ממוצע
              </div>
              <p className="text-sm font-bold">
                {(gscData.reduce((sum: number, row: GscKeywordData) => sum + row.ctr, 0) / gscData.length).toFixed(1)}%
              </p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
                <Award className="h-3 w-3" />
                עמוד ראשון
              </div>
              <p className="text-sm font-bold">
                {gscData.filter((row: GscKeywordData) => row.position <= 10).length}
              </p>
            </div>
          </div>

          {/* Queries Table */}
          <GscQueriesTable data={gscData} />
        </CardContent>
      )}

      {effectiveSiteUrl && !gscData && !isLoadingData && (
        <CardContent className="px-4 pb-3 pt-0">
          <p className="text-xs text-muted-foreground text-center">אין נתונים זמינים עבור הנכס שנבחר</p>
        </CardContent>
      )}
    </Card>
  );
}

function GscQueriesTable({ data }: { data: GscKeywordData[] }) {
  const [sortBy, setSortBy] = useState<keyof GscKeywordData>("impressions");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [searchFilter, setSearchFilter] = useState("");

  const sortedData = useMemo(() => {
    let filtered = data;
    if (searchFilter.trim()) {
      const q = searchFilter.toLowerCase();
      filtered = data.filter(row => row.keyword.toLowerCase().includes(q));
    }
    return filtered.slice().sort((a, b) => {
      const aVal = a[sortBy] as number;
      const bVal = b[sortBy] as number;
      return sortOrder === "desc" ? bVal - aVal : aVal - bVal;
    });
  }, [data, sortBy, sortOrder, searchFilter]);

  const formatNumber = (num: number) => new Intl.NumberFormat('he-IL').format(num);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h4 className="text-sm font-medium flex items-center gap-1.5">
          <Search className="h-4 w-4" />
          ביטויי חיפוש ({formatNumber(sortedData.length)})
        </h4>
        <div className="flex items-center gap-2">
          <Input
            placeholder="חפש ביטוי..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="h-8 w-[200px] text-sm"
          />
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as keyof GscKeywordData)}>
            <SelectTrigger className="w-[110px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="clicks">קליקים</SelectItem>
              <SelectItem value="impressions">חשיפות</SelectItem>
              <SelectItem value="ctr">CTR</SelectItem>
              <SelectItem value="position">מיקום</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => setSortOrder(o => o === "asc" ? "desc" : "asc")}
          >
            <ArrowUpDown className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto max-h-[500px] overflow-y-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm">
            <tr className="border-b">
              <th className="text-right py-2 px-3 font-medium">ביטוי</th>
              <th className="text-center py-2 px-3 font-medium">קליקים</th>
              <th className="text-center py-2 px-3 font-medium">חשיפות</th>
              <th className="text-center py-2 px-3 font-medium">CTR</th>
              <th className="text-center py-2 px-3 font-medium">מיקום</th>
            </tr>
          </thead>
          <tbody>
            {sortedData.slice(0, 200).map((row, index) => (
              <tr key={index} className="border-b hover:bg-muted/50">
                <td className="py-1.5 px-3 font-medium max-w-[300px] truncate" title={row.keyword}>
                  {row.keyword}
                </td>
                <td className="text-center py-1.5 px-3">{formatNumber(row.clicks)}</td>
                <td className="text-center py-1.5 px-3">{formatNumber(row.impressions)}</td>
                <td className="text-center py-1.5 px-3">{row.ctr.toFixed(2)}%</td>
                <td className="text-center py-1.5 px-3">
                  <span className={cn(
                    "inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-medium",
                    row.position <= 3 ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" :
                    row.position <= 10 ? "bg-primary/10 text-primary" :
                    row.position <= 20 ? "bg-muted text-muted-foreground" :
                    "text-muted-foreground"
                  )}>
                    {row.position.toFixed(1)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {sortedData.length > 200 && (
        <p className="text-xs text-muted-foreground text-center">מציג 200 מתוך {formatNumber(sortedData.length)} ביטויים</p>
      )}
    </div>
  );
}
