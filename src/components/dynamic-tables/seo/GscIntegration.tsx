import { useEffect, useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserIntegrations } from "@/hooks/useUserIntegrations";
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
  /** Called whenever a GSC site is selected/auto-linked, so callers can persist it on their own entity. */
  onSiteSelected?: (siteUrl: string) => void;
  /** When true, hides the raw queries table — data is still fetched and passed via onDataLoaded */
  hideTable?: boolean;
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

export function GscIntegration({ tenantId, clientId, domain, keywords, onDataLoaded, hideTable = false }: GscIntegrationProps) {
  const queryClient = useQueryClient();
  const [selectedSite, setSelectedSite] = useState<string>("");
  const [sitePopoverOpen, setSitePopoverOpen] = useState(false);

  // Use per-user integration filtering (own + shared)
  const { data: gscIntegrations = [], isLoading: isLoadingIntegration } = useUserIntegrations(
    tenantId, 'google_search_console'
  );
  const gscIntegration = gscIntegrations[0] || null;

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

  // STRICT per-client isolation: do NOT fall back to global settings.site_url/siteUrl
  // (those caused selections to leak across clients).
  const clientSites = settings?.client_sites || {};
  const persistedSiteUrl = selectedSite || clientSites[clientId] || "";
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

  // Auto-link by domain: only suggest if the report domain matches a GSC property.
  // Single-property auto-select kept as a convenience when there's nothing else to choose.
  const fallbackSiteUrl = matchedSite?.siteUrl || (availableSites.length === 1 ? availableSites[0].siteUrl : "");
  const effectiveSiteUrl = persistedSiteUrl || fallbackSiteUrl;

  useEffect(() => {
    if (!effectiveSiteUrl) {
      onDataLoaded?.([]);
    }
  }, [effectiveSiteUrl, onDataLoaded, clientId]);

  // Auto-link useEffect is declared further down (after updateSiteMutation is defined).

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
      const updatedClientSites = { ...clientSites, [clientId]: siteUrl };
      // Strip any legacy global site_url/siteUrl to prevent cross-client leakage.
      const { site_url: _legacySnake, siteUrl: _legacyCamel, ...cleanSettings } = settings || {};
      const { error } = await supabase
        .from("tenant_integrations")
        .update({
          settings: {
            ...cleanSettings,
            client_sites: updatedClientSites,
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

  // Auto-link by domain: when no per-client mapping exists and the report's domain
  // matches a GSC property, persist it automatically (per-client only).
  useEffect(() => {
    if (
      gscIntegration?.id &&
      clientId &&
      !clientSites[clientId] &&
      matchedSite?.siteUrl &&
      !updateSiteMutation.isPending
    ) {
      updateSiteMutation.mutate(matchedSite.siteUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gscIntegration?.id, clientId, matchedSite?.siteUrl]);

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
            {hideTable && gscData && gscData.length > 0 && (
              <Badge variant="outline" className="text-xs text-green-700 border-green-300 bg-green-50">
                {gscData.length} ביטויים נטענו
              </Badge>
            )}
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

      {/* When hideTable=true, only show summary stats (no full queries table) */}
      {!hideTable && gscData && gscData.length > 0 && (
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
  const [sortBy, setSortBy] = useState<keyof GscKeywordData>("position");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
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

  const handleSortColumn = (col: keyof GscKeywordData) => {
    if (sortBy === col) {
      setSortOrder(o => o === "asc" ? "desc" : "asc");
    } else {
      setSortBy(col);
      // position: ascending is best (lower = better); others: descending is best
      setSortOrder(col === "position" ? "asc" : "desc");
    }
  };

  const SortIcon = ({ col }: { col: keyof GscKeywordData }) => {
    if (sortBy !== col) return <ArrowUpDown className="h-3 w-3 opacity-30 inline ml-1" />;
    return (
      <span className="inline ml-1 text-primary">
        {sortOrder === "asc" ? "↑" : "↓"}
      </span>
    );
  };

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
        </div>
      </div>

      <div className="overflow-x-auto max-h-[500px] overflow-y-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm">
            <tr className="border-b">
              <th className="text-right py-2 px-3 font-medium">ביטוי</th>
              <th
                className="text-center py-2 px-3 font-medium cursor-pointer hover:bg-muted select-none"
                onClick={() => handleSortColumn("position")}
              >
                מיקום <SortIcon col="position" />
              </th>
              <th
                className="text-center py-2 px-3 font-medium cursor-pointer hover:bg-muted select-none"
                onClick={() => handleSortColumn("clicks")}
              >
                קליקים <SortIcon col="clicks" />
              </th>
              <th
                className="text-center py-2 px-3 font-medium cursor-pointer hover:bg-muted select-none"
                onClick={() => handleSortColumn("impressions")}
              >
                חשיפות <SortIcon col="impressions" />
              </th>
              <th
                className="text-center py-2 px-3 font-medium cursor-pointer hover:bg-muted select-none"
                onClick={() => handleSortColumn("ctr")}
              >
                CTR <SortIcon col="ctr" />
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedData.slice(0, 200).map((row, index) => (
              <tr key={index} className="border-b hover:bg-muted/50">
                <td className="py-1.5 px-3 font-medium max-w-[300px] truncate" title={row.keyword}>
                  {row.keyword}
                </td>
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
                <td className="text-center py-1.5 px-3">{formatNumber(row.clicks)}</td>
                <td className="text-center py-1.5 px-3">{formatNumber(row.impressions)}</td>
                <td className="text-center py-1.5 px-3">{row.ctr.toFixed(2)}%</td>
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
