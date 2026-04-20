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

export type GscDateRange = '28d' | '3m' | '12m';

export interface GscMultiPeriodData {
  current: GscKeywordData[];
  prevMonth: GscKeywordData[];
  threeMonth: GscKeywordData[];
  yearly: GscKeywordData[];
}

interface GscIntegrationProps {
  tenantId: string;
  clientId: string;
  domain?: string;
  keywords?: string[];
  onDataLoaded?: (data: GscKeywordData[]) => void;
  /** When set (and hideTable=true), fetches 4 historical periods (current, prevMonth, 3m ago, 1y ago) in parallel. */
  onMultiPeriodLoaded?: (data: GscMultiPeriodData) => void;
  /** Called whenever a GSC site is selected/auto-linked, so callers can persist it on their own entity. */
  onSiteSelected?: (siteUrl: string) => void;
  /** When true, hides the raw queries table — data is still fetched and passed via onDataLoaded */
  hideTable?: boolean;
  /** Date range to fetch from GSC (default 28d) */
  dateRange?: GscDateRange;
  /** Show the in-card date range selector (default true). Set false when controlled externally. */
  showDateRangeSelector?: boolean;
  /** Called when the user changes the date range from the in-card selector */
  onDateRangeChange?: (range: GscDateRange) => void;
  /** Site URL persisted at the report/table level (source of truth — survives shared integrations & RLS). */
  initialSiteUrl?: string;
  /** Language filter persisted at the report/table level. */
  initialLangFilter?: "all" | "he" | "en";
  /** Called whenever the language filter changes — parent persists to DB. */
  onLangFilterChange?: (lang: "all" | "he" | "en") => void;
}

const DATE_RANGE_DAYS: Record<GscDateRange, number> = {
  '28d': 28,
  '3m': 90,
  '12m': 365,
};

const DATE_RANGE_LABELS: Record<GscDateRange, string> = {
  '28d': 'חודש אחרון',
  '3m': '3 חודשים',
  '12m': 'שנה',
};

function computeRange(range: GscDateRange): { startDate: string; endDate: string } {
  const days = DATE_RANGE_DAYS[range];
  const end = new Date();
  const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
  return {
    startDate: start.toISOString().split('T')[0],
    endDate: end.toISOString().split('T')[0],
  };
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

export function GscIntegration({
  tenantId,
  clientId,
  domain,
  keywords,
  onDataLoaded,
  onMultiPeriodLoaded,
  onSiteSelected,
  hideTable = false,
  dateRange,
  showDateRangeSelector = true,
  onDateRangeChange,
  initialSiteUrl,
  initialLangFilter,
  onLangFilterChange,
}: GscIntegrationProps) {
  const queryClient = useQueryClient();
  const [selectedSite, setSelectedSite] = useState<string>("");
  const [sitePopoverOpen, setSitePopoverOpen] = useState(false);
  const [internalDateRange, setInternalDateRange] = useState<GscDateRange>('28d');
  const effectiveDateRange: GscDateRange = dateRange ?? internalDateRange;

  // Use per-user integration filtering (own + shared)
  const { data: gscIntegrations = [], isLoading: isLoadingIntegration } = useUserIntegrations(
    tenantId, 'google_search_console'
  );

  // When multiple GSC integrations exist for this tenant, prefer the one
  // that already has a verified mapping for this client (i.e. the mapped
  // siteUrl is NOT 'siteUnverifiedUser'). This avoids 403s from picking
  // an integration whose stored mapping points at a property the user
  // doesn't have API access to.
  const gscIntegration = useMemo(() => {
    if (!gscIntegrations.length) return null;
    const withGoodMapping = gscIntegrations.find((i: any) => {
      const mapped = (i.settings as any)?.client_sites?.[clientId];
      if (!mapped) return false;
      const sites = (i.settings as any)?.available_sites || [];
      const site = sites.find((s: any) => s.siteUrl === mapped);
      // Accept if we don't have permission metadata, or if it's not 'siteUnverifiedUser'
      return !site || site.permissionLevel !== 'siteUnverifiedUser';
    });
    return withGoodMapping || gscIntegrations[0];
  }, [gscIntegrations, clientId]);

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
  // Source-of-truth order: explicit user pick > report-level saved URL (initialSiteUrl) > integration mapping.
  const clientSites = settings?.client_sites || {};

  // Filter out properties we have no API access to (siteUnverifiedUser → 403).
  // We still keep them in `availableSites` for diagnostics, but never auto-select them.
  const usableSites = useMemo(
    () => availableSites.filter((s) => s.permissionLevel !== 'siteUnverifiedUser'),
    [availableSites]
  );

  const isUsableSite = (siteUrl?: string) => {
    if (!siteUrl) return false;
    const meta = availableSites.find((s) => s.siteUrl === siteUrl);
    // If we don't have metadata yet, allow it (avoids flicker before sites load)
    return !meta || meta.permissionLevel !== 'siteUnverifiedUser';
  };

  // Drop a stored mapping that points at an unverified (no-access) property.
  const storedClientSite = clientSites[clientId];
  const storedClientSiteIsUsable = isUsableSite(storedClientSite);

  const persistedSiteUrl =
    selectedSite ||
    (isUsableSite(initialSiteUrl) ? initialSiteUrl : "") ||
    (storedClientSiteIsUsable ? storedClientSite : "") ||
    "";

  const normalizedDomain = normalizeDomain(domain);
  const matchedSite = normalizedDomain
    ? usableSites.find((site) => {
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
  const fallbackSiteUrl =
    matchedSite?.siteUrl || (usableSites.length === 1 ? usableSites[0].siteUrl : "");
  const effectiveSiteUrl = persistedSiteUrl || fallbackSiteUrl;

  useEffect(() => {
    if (!effectiveSiteUrl) {
      onDataLoaded?.([]);
    }
  }, [effectiveSiteUrl, onDataLoaded, clientId]);

  // Auto-link useEffect is declared further down (after updateSiteMutation is defined).

  const { data: gscData, isLoading: isLoadingData, refetch: refetchData } = useQuery({
    queryKey: ["gsc-keyword-data", gscIntegration?.id, effectiveSiteUrl, effectiveDateRange, keywords?.join(",")],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const { startDate, endDate } = computeRange(effectiveDateRange);

      const response = await supabase.functions.invoke("fetch-gsc-data", {
        body: {
          integrationId: gscIntegration!.id,
          siteUrl: effectiveSiteUrl,
          keywords: keywords || [],
          startDate,
          endDate,
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

  // Multi-period fetch: when caller wants historical comparisons (only in hideTable mode + callback present)
  const enableMultiPeriod = !!onMultiPeriodLoaded && hideTable;
  useQuery({
    queryKey: ["gsc-multi-period", gscIntegration?.id, effectiveSiteUrl],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const dateMinus = (days: number) => {
        const d = new Date();
        d.setDate(d.getDate() - days);
        return d.toISOString().split('T')[0];
      };

      // Each period: 28-day window ending at the given offset.
      const periods = {
        current:    { startOffset: 28,  endOffset: 0   },
        prevMonth:  { startOffset: 58,  endOffset: 30  },
        threeMonth: { startOffset: 118, endOffset: 90  },
        yearly:     { startOffset: 393, endOffset: 365 },
      } as const;

      const entries = Object.entries(periods) as Array<[keyof typeof periods, { startOffset: number; endOffset: number }]>;
      const responses = await Promise.all(
        entries.map(([, p]) =>
          supabase.functions.invoke("fetch-gsc-data", {
            body: {
              integrationId: gscIntegration!.id,
              siteUrl: effectiveSiteUrl,
              startDate: dateMinus(p.startOffset),
              endDate: dateMinus(p.endOffset),
            },
            headers: { Authorization: `Bearer ${session.access_token}` },
          })
        )
      );

      const result: GscMultiPeriodData = {
        current: [],
        prevMonth: [],
        threeMonth: [],
        yearly: [],
      };
      entries.forEach(([key], idx) => {
        const rows = Array.isArray(responses[idx].data?.rows) ? responses[idx].data.rows : [];
        result[key] = rows as GscKeywordData[];
      });

      onMultiPeriodLoaded?.(result);
      return result;
    },
    enabled: !!gscIntegration?.id && !!effectiveSiteUrl && enableMultiPeriod,
    staleTime: 10 * 60 * 1000,
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
      if (!gscIntegration?.id) return { siteUrl, dbUpdated: false };
      const updatedClientSites = { ...clientSites, [clientId]: siteUrl };
      // Strip any legacy global site_url/siteUrl to prevent cross-client leakage.
      const { site_url: _legacySnake, siteUrl: _legacyCamel, ...cleanSettings } = settings || {};
      try {
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
        return { siteUrl, dbUpdated: true };
      } catch (err) {
        // RLS may block updating an integration shared by another user.
        // Swallow the error — the report-level save (onSiteSelected) is the real source of truth.
        console.warn('[GSC] tenant_integrations update blocked (likely shared integration RLS):', err);
        return { siteUrl, dbUpdated: false };
      }
    },
    onSuccess: ({ siteUrl }) => {
      queryClient.invalidateQueries({ queryKey: ["user-integrations"] });
      queryClient.invalidateQueries({ queryKey: ["gsc-keyword-data"] });
      onSiteSelected?.(siteUrl);
      toast.success("הנכס עודכן");
    },
  });

  // Auto-link by domain: when no per-client mapping exists (or the existing
  // mapping points at a no-access property), and the report's domain matches
  // a usable GSC property, persist it automatically (per-client only).
  useEffect(() => {
    if (
      gscIntegration?.id &&
      clientId &&
      (!clientSites[clientId] || !storedClientSiteIsUsable) &&
      matchedSite?.siteUrl &&
      !updateSiteMutation.isPending
    ) {
      updateSiteMutation.mutate(matchedSite.siteUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gscIntegration?.id, clientId, matchedSite?.siteUrl, storedClientSiteIsUsable]);

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
            {showDateRangeSelector && (
              <Select
                value={effectiveDateRange}
                onValueChange={(v) => {
                  const next = v as GscDateRange;
                  setInternalDateRange(next);
                  onDateRangeChange?.(next);
                }}
              >
                <SelectTrigger className="h-7 text-xs w-[130px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(DATE_RANGE_LABELS) as GscDateRange[]).map((k) => (
                    <SelectItem key={k} value={k} className="text-xs">
                      {DATE_RANGE_LABELS[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {usableSites.length > 0 && (
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
                        {usableSites.map((site) => {
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

      {!isLoadingSites && availableSites.length > 0 && usableSites.length === 0 && (
        <CardContent className="px-4 pb-3 pt-0">
          <p className="text-xs text-muted-foreground text-center">
            אין הרשאת גישה לאף נכס ב-Search Console. בקש מבעל הנכס לאמת אותך כמשתמש מורשה, או חבר חשבון Google אחר.
          </p>
        </CardContent>
      )}

      {!effectiveSiteUrl && usableSites.length > 0 && !isLoadingSites && (
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
          <GscQueriesTable
            data={gscData}
            initialLangFilter={initialLangFilter}
            onLangFilterChange={onLangFilterChange}
          />
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

const HEBREW_REGEX = /[\u0590-\u05FF]/;
const ENGLISH_REGEX = /[A-Za-z]/;

type LangFilter = "all" | "he" | "en";

function GscQueriesTable({
  data,
  initialLangFilter,
  onLangFilterChange,
}: {
  data: GscKeywordData[];
  initialLangFilter?: LangFilter;
  onLangFilterChange?: (lang: LangFilter) => void;
}) {
  const [sortBy, setSortBy] = useState<keyof GscKeywordData>("position");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [searchFilter, setSearchFilter] = useState("");
  const [langFilter, setLangFilterState] = useState<LangFilter>(initialLangFilter ?? "all");

  // Sync if the parent changes the saved value (e.g., after async DB load)
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

  const langCounts = useMemo(() => {
    let he = 0, en = 0, other = 0;
    for (const row of data) {
      const k = row.keyword || "";
      if (HEBREW_REGEX.test(k)) he++;
      else if (ENGLISH_REGEX.test(k)) en++;
      else other++;
    }
    return { he, en, other, all: data.length };
  }, [data]);

  const sortedData = useMemo(() => {
    let filtered = data;
    if (langFilter !== "all") {
      filtered = filtered.filter(row => {
        const k = row.keyword || "";
        if (langFilter === "he") return HEBREW_REGEX.test(k);
        if (langFilter === "en") return ENGLISH_REGEX.test(k) && !HEBREW_REGEX.test(k);
        return true;
      });
    }
    if (searchFilter.trim()) {
      const q = searchFilter.toLowerCase();
      filtered = filtered.filter(row => row.keyword.toLowerCase().includes(q));
    }
    return filtered.slice().sort((a, b) => {
      const aVal = a[sortBy] as number;
      const bVal = b[sortBy] as number;
      return sortOrder === "desc" ? bVal - aVal : aVal - bVal;
    });
  }, [data, sortBy, sortOrder, searchFilter, langFilter]);

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
