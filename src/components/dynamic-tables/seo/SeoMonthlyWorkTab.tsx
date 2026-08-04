import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router-dom";
import { format, startOfMonth, subMonths } from "date-fns";
import { he } from "date-fns/locale";
import {
  Copy,
  Download,
  FileText,
  Link2,
  Loader2,
  Plus,
  Presentation,
  Save,
  Trash2,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useAhrefsReports } from "@/hooks/useAhrefsReports";
import { useSeoScope } from "@/hooks/useSeoScope";
import { useSeoMonthlyGsc } from "@/hooks/useSeoMonthlyGsc";
import { useSeoKeywordRelevance } from "@/hooks/useSeoKeywordRelevance";
import { filterValidSeoReports } from "@/components/dynamic-tables/seo/reportValidity";
import { filterSeoReportsByDomain, normalizeSeoDomain, seoDomainsMatch } from "@/lib/seoDomain";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ONSITE_KIND_LABELS,
  SeoArticleItem,
  SeoLinkItem,
  SeoMonthlyWork,
  SeoOnsiteItem,
  SeoOnsiteKind,
  createArticleItem,
  createLinkItem,
  createOnsiteItem,
  emptySeoMonthlyWork,
  parseSeoMonthlyWork,
  sanitizeSeoMonthlyWork,
} from "@/lib/seoMonthlyWork";
import { buildDefaultShareToken } from "@/lib/share-slug";
import {
  buildSeoMonthlyShareSnapshot,
  SeoMonthlyShareSnapshot,
  SeoShareRecentLink,
} from "@/lib/seoMonthlyShareSnapshot";
import { SeoMonthlySlideshowCaptureStack } from "@/components/seo/SeoMonthlySlideshow";
import { downloadSeoMonthlySlideshowPdf } from "@/lib/seoMonthlyPdf";

type Props = {
  clientId: string;
  /** Prefer the SEO report tenant (shared-agency aware). Falls back to current tenant. */
  tenantId?: string;
};

const SHARE_ORIGIN = "https://aios.co.il";

export function SeoMonthlyWorkTab({ clientId, tenantId: tenantIdProp }: Props) {
  const { tenantId: currentTenantId } = useCurrentTenant();
  const { user } = useCurrentUser();
  const tenantId = tenantIdProp || currentTenantId || "";
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const captureStackRef = useRef<HTMLDivElement>(null);

  const monthOptions = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => {
        const d = startOfMonth(subMonths(new Date(), i));
        return {
          value: format(d, "yyyy-MM-dd"),
          label: format(d, "MMMM yyyy", { locale: he }),
        };
      }),
    [],
  );

  // Default to last calendar month — monthly client reports are usually for the month that just closed.
  const [selectedMonth, setSelectedMonth] = useState(
    monthOptions[1]?.value ||
      monthOptions[0]?.value ||
      format(startOfMonth(subMonths(new Date(), 1)), "yyyy-MM-dd"),
  );
  const [status, setStatus] = useState<"up" | "stable" | "down">("stable");
  const [work, setWork] = useState<SeoMonthlyWork>(emptySeoMonthlyWork());
  const [dirty, setDirty] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [openingDeck, setOpeningDeck] = useState(false);

  const { data: client } = useQuery({
    queryKey: ["client-for-seo-monthly-share", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name, website, tenant_id")
        .eq("id", clientId)
        .maybeSingle();
      if (error) throw error;
      return data as {
        id: string;
        name: string;
        website: string | null;
        tenant_id: string;
      } | null;
    },
    enabled: !!clientId,
  });

  // Natural key is (client_id, month). Do NOT filter by session/report tenant —
  // shared-agency rows often live on the client's home tenant (DMM) while the
  // viewer is on MarketingCaptain.
  const { data: row, isLoading, isFetching } = useQuery({
    queryKey: ["seo-monthly-work", clientId, selectedMonth],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("seo_monthly_updates")
        .select("id, month, status, notes, work, tenant_id")
        .eq("client_id", clientId)
        .eq("month", selectedMonth)
        .maybeSingle();
      if (error) throw error;
      return data as {
        id: string;
        month: string;
        status: "up" | "stable" | "down";
        notes: string | null;
        work: unknown;
        tenant_id: string;
      } | null;
    },
    enabled: !!clientId && !!selectedMonth,
  });

  // SEO artifacts can live in a sibling tenant for shared-agency clients.
  const { data: seoScope } = useSeoScope(clientId);
  const accessibleTenantIds = seoScope?.accessibleTenantIds?.length
    ? seoScope.accessibleTenantIds
    : tenantId
      ? [tenantId]
      : [];

  // Same query key family as the positions dashboard — refreshes flow through here.
  const { data: ahrefsReports } = useAhrefsReports({
    clientId,
    limit: 20,
    tenantIds: accessibleTenantIds,
  });

  /** The one domain this client's SEO data may come from. */
  const expectedDomain = seoScope?.expectedDomain || normalizeSeoDomain(client?.website);

  /**
   * Reports for another site are dropped before anything is read from them — a
   * stray report synced under this client must not reach the report slides.
   */
  const ownDomainReports = useMemo(
    () => filterValidSeoReports(filterSeoReportsByDomain(ahrefsReports || [], expectedDomain)),
    [ahrefsReports, expectedDomain],
  );

  const latestReportData = useMemo(
    () => (ownDomainReports[0]?.report_data as Record<string, unknown> | undefined) || null,
    [ownDomainReports],
  );

  const reportDomain = useMemo(
    () => (ownDomainReports[0] as any)?.domain || client?.website || expectedDomain || undefined,
    [ownDomainReports, client?.website, expectedDomain],
  );

  /** Same localStorage overrides as the positions table ("לא רלוונטי"). */
  const { forceRelevant, forceIrrelevant } = useSeoKeywordRelevance(clientId);

  /** Every month this client has a work log for — drives the campaign baseline. */
  const { data: monthsWithWork } = useQuery({
    queryKey: ["seo-monthly-months", clientId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("seo_monthly_updates")
        .select("month")
        .eq("client_id", clientId)
        .order("month", { ascending: true });
      if (error) throw error;
      return (data as Array<{ month: string }>).map((r) => r.month.slice(0, 10));
    },
    enabled: !!clientId,
    staleTime: 5 * 60 * 1000,
  });

  const campaignStartMonth = monthsWithWork?.[0] ?? null;

  /** Links published in the two months before the selected one. */
  const { data: priorMonthsWork } = useQuery({
    queryKey: ["seo-monthly-recent-links", clientId, selectedMonth],
    queryFn: async () => {
      const from = format(startOfMonth(subMonths(new Date(`${selectedMonth}T12:00:00`), 2)), "yyyy-MM-dd");
      const { data, error } = await (supabase as any)
        .from("seo_monthly_updates")
        .select("month, work")
        .eq("client_id", clientId)
        .gte("month", from)
        .lte("month", selectedMonth)
        .order("month", { ascending: false });
      if (error) throw error;
      return data as Array<{ month: string; work: unknown }>;
    },
    enabled: !!clientId && !!selectedMonth,
    staleTime: 60 * 1000,
  });

  // A linked property for a different site is dropped, so Search Console
  // numbers can only ever come from this client's own property.
  const linkedGscSiteUrl = seoScope?.seoTable?.integration_settings?.linkedGscSiteUrl || undefined;
  const savedSiteUrl =
    linkedGscSiteUrl && expectedDomain && !seoDomainsMatch(linkedGscSiteUrl, expectedDomain)
      ? undefined
      : linkedGscSiteUrl;

  const gsc = useSeoMonthlyGsc({
    clientId,
    tenantIds: accessibleTenantIds,
    month: selectedMonth,
    campaignStartMonth,
    savedSiteUrl,
    domain: reportDomain,
    expectedDomain,
  });

  /**
   * External links over a three-month window. The current month comes from the
   * live editor state so unsaved rows show up in the preview too.
   */
  const recentLinks = useMemo<SeoShareRecentLink[]>(() => {
    const out: SeoShareRecentLink[] = [];
    const seen = new Set<string>();
    const push = (month: string, link: { id?: string; url?: string; anchor?: string; notes?: string }) => {
      const url = (link.url || "").trim();
      if (!url || seen.has(url.toLowerCase())) return;
      seen.add(url.toLowerCase());
      let monthLabel = month;
      try {
        monthLabel = format(new Date(`${month}T12:00:00`), "MMMM yyyy", { locale: he });
      } catch {
        /* keep raw */
      }
      out.push({
        id: link.id || `${month}-${url}`,
        url,
        anchor: link.anchor?.trim() || undefined,
        notes: link.notes?.trim() || undefined,
        month,
        monthLabel,
      });
    };
    for (const link of work.links) push(selectedMonth, link);
    for (const row of priorMonthsWork || []) {
      const month = row.month.slice(0, 10);
      if (month === selectedMonth) continue;
      const parsed = parseSeoMonthlyWork(row.work);
      for (const link of parsed.links) push(month, link);
    }
    return out.sort((a, b) => b.month.localeCompare(a.month));
  }, [work.links, priorMonthsWork, selectedMonth]);

  const { data: existingShare } = useQuery({
    queryKey: ["seo-monthly-share", clientId, selectedMonth],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("seo_monthly_shares")
        .select("share_token, is_active, updated_at")
        .eq("client_id", clientId)
        .eq("month", selectedMonth)
        .maybeSingle();
      if (error) {
        // Table may not exist yet on prod before migration
        if (String(error.message || "").includes("seo_monthly_shares")) return null;
        throw error;
      }
      return data as { share_token: string; is_active: boolean; updated_at: string } | null;
    },
    enabled: !!clientId && !!selectedMonth,
  });

  useEffect(() => {
    if (isFetching) return;
    if (!row) {
      setStatus("stable");
      setWork(emptySeoMonthlyWork());
      setDirty(false);
      return;
    }
    setStatus(row.status || "stable");
    const parsed = parseSeoMonthlyWork(row.work);
    // Backfill summary from legacy free-text notes when work.summary is empty
    if (!parsed.summary && row.notes) parsed.summary = row.notes;
    setWork(parsed);
    setDirty(false);
  }, [row, isFetching, selectedMonth]);

  const patchWork = (updater: (prev: SeoMonthlyWork) => SeoMonthlyWork) => {
    setWork((prev) => updater(prev));
    setDirty(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("חסר משתמש");
      // Prefer the existing row's tenant, then the client's home tenant, then
      // the SEO-report / session tenant — never invent a second row under MC
      // for a DMM-MC client.
      const saveTenantId =
        row?.tenant_id || client?.tenant_id || tenantId || "";
      if (!saveTenantId) throw new Error("חסר טננט לשמירה");
      const cleaned = sanitizeSeoMonthlyWork(work);
      const { error } = await (supabase as any)
        .from("seo_monthly_updates")
        .upsert(
          {
            client_id: clientId,
            tenant_id: saveTenantId,
            month: selectedMonth,
            status,
            notes: cleaned.summary || null,
            work: cleaned,
            updated_by: user.id,
          },
          { onConflict: "client_id,month" },
        );
      if (error) throw error;
      return cleaned;
    },
    onSuccess: async (cleaned) => {
      setWork(cleaned);
      setDirty(false);
      toast.success("סיכום העבודה החודשית נשמר");
      queryClient.invalidateQueries({ queryKey: ["seo-monthly-work", clientId, selectedMonth] });
      queryClient.invalidateQueries({ queryKey: ["seo-monthly-months", clientId] });
      queryClient.invalidateQueries({ queryKey: ["seo-monthly-recent-links", clientId] });
      queryClient.invalidateQueries({ queryKey: ["seo-monthly-history", clientId] });
      queryClient.invalidateQueries({ queryKey: ["seo-monthly-latest"] });
      queryClient.invalidateQueries({ queryKey: ["seo-monthly-single", clientId] });
      // Keep the public share deck identical to the in-app slideshow whenever a share exists.
      if (existingShare?.share_token) {
        try {
          await upsertShare({ work: cleaned });
          queryClient.invalidateQueries({ queryKey: ["seo-monthly-share", clientId, selectedMonth] });
        } catch (err) {
          console.warn("Failed to refresh public SEO monthly snapshot after save", err);
        }
      }
    },
    onError: (err: any) => {
      const msg = String(err?.message || "");
      if (msg.includes("work") && (msg.includes("column") || msg.includes("schema"))) {
        toast.error("עמודת העבודה עדיין לא קיימת בפרודקשן — צריך להריץ את המיגרציה seo_monthly_work_jsonb");
        return;
      }
      toast.error(msg || "שגיאה בשמירה");
    },
  });

  const monthLabel = monthOptions.find((m) => m.value === selectedMonth)?.label || selectedMonth;

  const snapshot: SeoMonthlyShareSnapshot = useMemo(
    () =>
      buildSeoMonthlyShareSnapshot({
        clientName: client?.name || "לקוח",
        domain: reportDomain,
        month: selectedMonth,
        status,
        work,
        reportData: latestReportData,
        gsc: {
          current: gsc.current,
          prev: gsc.prev,
          baseline: gsc.baseline,
          baselineMonth: gsc.baselineMonth,
        },
        recentLinks,
        relevance: { forceRelevant, forceIrrelevant },
      }),
    [
      client?.name,
      reportDomain,
      selectedMonth,
      status,
      work,
      latestReportData,
      gsc.current,
      gsc.prev,
      gsc.baseline,
      gsc.baselineMonth,
      recentLinks,
      forceRelevant,
      forceIrrelevant,
    ],
  );

  const shareUrl =
    existingShare?.share_token && existingShare.is_active
      ? `${SHARE_ORIGIN}/shared/seo-monthly/${existingShare.share_token}`
      : null;

  const upsertShare = async (overrides?: { work?: SeoMonthlyWork }): Promise<string> => {
    if (!tenantId || !user?.id) throw new Error("חסר משתמש או טננט");
    const workForShare = overrides?.work ?? work;
    // Rebuild recent links from the work we're publishing so the public deck matches.
    const linksForShare: SeoShareRecentLink[] = [];
    const seenUrls = new Set<string>();
    const pushLink = (month: string, link: { id?: string; url?: string; anchor?: string; notes?: string }) => {
      const url = (link.url || "").trim();
      if (!url || seenUrls.has(url.toLowerCase())) return;
      seenUrls.add(url.toLowerCase());
      let label = month;
      try {
        label = format(new Date(`${month}T12:00:00`), "MMMM yyyy", { locale: he });
      } catch {
        /* keep raw */
      }
      linksForShare.push({
        id: link.id || `${month}-${url}`,
        url,
        anchor: link.anchor?.trim() || undefined,
        notes: link.notes?.trim() || undefined,
        month,
        monthLabel: label,
      });
    };
    for (const link of workForShare.links) pushLink(selectedMonth, link);
    for (const row of priorMonthsWork || []) {
      const month = row.month.slice(0, 10);
      if (month === selectedMonth) continue;
      for (const link of parseSeoMonthlyWork(row.work).links) pushLink(month, link);
    }
    linksForShare.sort((a, b) => b.month.localeCompare(a.month));

    const frozen = buildSeoMonthlyShareSnapshot({
      clientName: client?.name || "לקוח",
      domain: reportDomain,
      month: selectedMonth,
      status,
      work: workForShare,
      reportData: latestReportData,
      gsc: {
        current: gsc.current,
        prev: gsc.prev,
        baseline: gsc.baseline,
        baselineMonth: gsc.baselineMonth,
      },
      recentLinks: linksForShare,
      relevance: { forceRelevant, forceIrrelevant },
    });

    if (existingShare?.share_token) {
      const { error } = await (supabase as any)
        .from("seo_monthly_shares")
        .update({
          snapshot: frozen,
          is_active: true,
          tenant_id: tenantId,
          updated_at: new Date().toISOString(),
        })
        .eq("client_id", clientId)
        .eq("month", selectedMonth);
      if (error) throw error;
      return existingShare.share_token;
    }

    const token = buildDefaultShareToken({
      website: client?.website,
      fallbackName: client?.name || "seo",
      defaultPrefix: "seo",
    });

    const { data, error } = await (supabase as any)
      .from("seo_monthly_shares")
      .insert({
        tenant_id: tenantId,
        client_id: clientId,
        month: selectedMonth,
        share_token: token,
        snapshot: frozen,
        is_active: true,
        created_by: user.id,
      })
      .select("share_token")
      .single();
    if (error) throw error;
    return (data as any).share_token as string;
  };

  /** Persist dirty edits, refresh the share token/snapshot, then open the live deck. */
  const handleOpenPresentation = async () => {
    setOpeningDeck(true);
    try {
      if (dirty) await saveMutation.mutateAsync();
      const token = await upsertShare();
      queryClient.invalidateQueries({ queryKey: ["seo-monthly-share", clientId, selectedMonth] });
      navigate(`/shared/seo-monthly/${token}`, {
        state: {
          fromApp: true,
          returnTo: `${location.pathname}${location.search}${location.hash}`,
        },
      });
    } catch (err: any) {
      const msg = String(err?.message || "");
      if (msg.includes("seo_monthly_shares") || msg.includes("schema cache") || err?.code === "42P01") {
        toast.error("טבלת השיתוף עדיין לא קיימת בפרודקשן — צריך להריץ את המיגרציה seo_monthly_shares");
      } else {
        toast.error(msg || "שגיאה בפתיחת המצגת");
      }
    } finally {
      setOpeningDeck(false);
    }
  };

  const handleCopyShareLink = async () => {
    setOpeningDeck(true);
    try {
      if (dirty) await saveMutation.mutateAsync();
      const token = await upsertShare();
      const url = `${SHARE_ORIGIN}/shared/seo-monthly/${token}`;
      await navigator.clipboard.writeText(url);
      queryClient.invalidateQueries({ queryKey: ["seo-monthly-share", clientId, selectedMonth] });
      toast.success("קישור השיתוף הועתק — נפתח תמיד עם העדכונים האחרונים");
    } catch (err: any) {
      const msg = String(err?.message || "");
      if (msg.includes("seo_monthly_shares") || msg.includes("schema cache") || err?.code === "42P01") {
        toast.error("טבלת השיתוף עדיין לא קיימת בפרודקשן — צריך להריץ את המיגרציה seo_monthly_shares");
      } else {
        toast.error(msg || "שגיאה ביצירת קישור");
      }
    } finally {
      setOpeningDeck(false);
    }
  };

  const handleExportPdf = async () => {
    setExportingPdf(true);
    try {
      if (dirty) await saveMutation.mutateAsync();
      await new Promise((r) => setTimeout(r, 100));
      if (!captureStackRef.current) throw new Error("אין שקפים ליצוא");
      const safeName = `${snapshot.clientName}-${snapshot.monthLabel}`
        .replace(/[^\w\u0590-\u05FF-]+/g, "-")
        .slice(0, 60);
      await downloadSeoMonthlySlideshowPdf(captureStackRef.current, `seo-${safeName}.pdf`);
      toast.success("ה־PDF הורד (כולל קישורים לחיצים)");
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "שגיאה ביצוא PDF");
    } finally {
      setExportingPdf(false);
    }
  };

  return (
    <div className="space-y-4" dir="rtl">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" />
              עבודה שבוצעה החודש
            </CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={selectedMonth} onValueChange={(v) => setSelectedMonth(v)}>
                <SelectTrigger className="w-[180px] h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {monthOptions.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={status} onValueChange={(v) => { setStatus(v as any); setDirty(true); }}>
                <SelectTrigger className="w-[130px] h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="up">עלייה ↑</SelectItem>
                  <SelectItem value="stable">יציב →</SelectItem>
                  <SelectItem value="down">ירידה ↓</SelectItem>
                </SelectContent>
              </Select>
              <Button
                size="sm"
                className="h-8 gap-1.5"
                disabled={!dirty || saveMutation.isPending || isLoading}
                onClick={() => saveMutation.mutate()}
              >
                {saveMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                שמור
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            סיכום העבודה ל־{monthLabel}: באתר (מטא/כותרות), מאמרים שכתבנו, וקישורים.
            המצגת נפתחת תמיד עם העדכונים האחרונים שנשמרו.
            {dirty && <Badge variant="outline" className="mr-2 text-[10px]">יש שינויים שלא נשמרו</Badge>}
          </p>
          <div className="flex flex-wrap items-center gap-2 pt-2">
            <Button
              type="button"
              size="sm"
              className="h-8 gap-1.5"
              disabled={openingDeck || saveMutation.isPending || isLoading}
              onClick={handleOpenPresentation}
            >
              {openingDeck ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Presentation className="h-3.5 w-3.5" />}
              פתח מצגת
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1.5"
              disabled={openingDeck || saveMutation.isPending || isLoading}
              onClick={handleCopyShareLink}
            >
              <Copy className="h-3.5 w-3.5" />
              העתק קישור שיתוף
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1.5"
              disabled={exportingPdf || openingDeck || saveMutation.isPending}
              onClick={handleExportPdf}
            >
              {exportingPdf ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
              יצוא PDF
            </Button>
          </div>
          {shareUrl && (
            <p className="mt-1 truncate text-[11px] text-muted-foreground" dir="ltr">
              {shareUrl}
            </p>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-sm">סיכום כללי</Label>
            <Textarea
              value={work.summary || ""}
              onChange={(e) => patchWork((p) => ({ ...p, summary: e.target.value }))}
              placeholder="מה עשינו החודש במשפט־שניים..."
              rows={2}
              className="resize-none"
            />
          </div>
        </CardContent>
      </Card>

      {(isLoading || isFetching) && !row ? (
        <div className="flex items-center justify-center py-10 text-muted-foreground text-sm gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          טוען...
        </div>
      ) : (
        <>
          <OnsiteSection
            items={work.onsite}
            onChange={(onsite) => patchWork((p) => ({ ...p, onsite }))}
          />
          <ArticlesSection
            items={work.articles}
            onChange={(articles) => patchWork((p) => ({ ...p, articles }))}
          />
          <LinksSection
            items={work.links}
            onChange={(links) => patchWork((p) => ({ ...p, links }))}
          />
        </>
      )}

      {/* Offscreen capture stack for PDF */}
      <SeoMonthlySlideshowCaptureStack snapshot={snapshot} stackRef={captureStackRef} />
    </div>
  );
}

function OnsiteSection({
  items,
  onChange,
}: {
  items: SeoOnsiteItem[];
  onChange: (next: SeoOnsiteItem[]) => void;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Wrench className="h-4 w-4" />
            עבודה באתר
            <Badge variant="secondary" className="text-[10px]">{items.length}</Badge>
          </CardTitle>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 gap-1 text-xs"
            onClick={() => onChange([...items, createOnsiteItem({ kind: "meta" })])}
          >
            <Plus className="h-3.5 w-3.5" />
            הוסף
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">מטא־תיאורים, כותרות (H1/כותרות מאמרים באתר), ותיקוני תוכן פנימיים.</p>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.length === 0 ? (
          <EmptyHint text="עדיין אין פריטי עבודה באתר לחודש הזה" />
        ) : (
          items.map((item, idx) => (
            <div key={item.id} className="grid gap-2 rounded-md border p-2 md:grid-cols-[140px_1fr_1fr_auto]">
              <Select
                value={item.kind}
                onValueChange={(v) => {
                  const next = [...items];
                  next[idx] = { ...item, kind: v as SeoOnsiteKind };
                  onChange(next);
                }}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(ONSITE_KIND_LABELS) as SeoOnsiteKind[]).map((k) => (
                    <SelectItem key={k} value={k}>
                      {ONSITE_KIND_LABELS[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                className="h-8 text-sm"
                placeholder="מה שונה (למשל: כותרת עמוד שירותים)"
                value={item.title}
                onChange={(e) => {
                  const next = [...items];
                  next[idx] = { ...item, title: e.target.value };
                  onChange(next);
                }}
              />
              <Input
                className="h-8 text-sm"
                dir="ltr"
                placeholder="https://... (אופציונלי)"
                value={item.url || ""}
                onChange={(e) => {
                  const next = [...items];
                  next[idx] = { ...item, url: e.target.value };
                  onChange(next);
                }}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground"
                onClick={() => onChange(items.filter((x) => x.id !== item.id))}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function ArticlesSection({
  items,
  onChange,
}: {
  items: SeoArticleItem[];
  onChange: (next: SeoArticleItem[]) => void;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <FileText className="h-4 w-4" />
            מאמרים שכתבנו
            <Badge variant="secondary" className="text-[10px]">{items.length}</Badge>
          </CardTitle>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 gap-1 text-xs"
            onClick={() => onChange([...items, createArticleItem()])}
          >
            <Plus className="h-3.5 w-3.5" />
            הוסף מאמר
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">כותרת המאמר, נושא, וקישור לפרסום אם יש.</p>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.length === 0 ? (
          <EmptyHint text="עדיין אין מאמרים רשומים לחודש הזה" />
        ) : (
          items.map((item, idx) => (
            <div key={item.id} className="grid gap-2 rounded-md border p-2 md:grid-cols-[1.2fr_1fr_1.2fr_auto]">
              <Input
                className="h-8 text-sm"
                placeholder="כותרת המאמר"
                value={item.title}
                onChange={(e) => {
                  const next = [...items];
                  next[idx] = { ...item, title: e.target.value };
                  onChange(next);
                }}
              />
              <Input
                className="h-8 text-sm"
                placeholder="נושא / פוקוס"
                value={item.topic}
                onChange={(e) => {
                  const next = [...items];
                  next[idx] = { ...item, topic: e.target.value };
                  onChange(next);
                }}
              />
              <Input
                className="h-8 text-sm"
                dir="ltr"
                placeholder="https://... קישור למאמר"
                value={item.url || ""}
                onChange={(e) => {
                  const next = [...items];
                  next[idx] = { ...item, url: e.target.value };
                  onChange(next);
                }}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground"
                onClick={() => onChange(items.filter((x) => x.id !== item.id))}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function LinksSection({
  items,
  onChange,
}: {
  items: SeoLinkItem[];
  onChange: (next: SeoLinkItem[]) => void;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Link2 className="h-4 w-4" />
            קישורים
            <Badge variant="secondary" className="text-[10px]">{items.length}</Badge>
          </CardTitle>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 gap-1 text-xs"
            onClick={() => onChange([...items, createLinkItem()])}
          >
            <Plus className="h-3.5 w-3.5" />
            הוסף קישור
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">קישורים שנבנו/הושגו החודש — כתובת, עוגן והערה.</p>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.length === 0 ? (
          <EmptyHint text="עדיין אין קישורים לחודש הזה" />
        ) : (
          items.map((item, idx) => (
            <div key={item.id} className="grid gap-2 rounded-md border p-2 md:grid-cols-[1.4fr_1fr_1fr_auto]">
              <Input
                className="h-8 text-sm"
                dir="ltr"
                placeholder="https://..."
                value={item.url}
                onChange={(e) => {
                  const next = [...items];
                  next[idx] = { ...item, url: e.target.value };
                  onChange(next);
                }}
              />
              <Input
                className="h-8 text-sm"
                placeholder="טקסט עוגן"
                value={item.anchor || ""}
                onChange={(e) => {
                  const next = [...items];
                  next[idx] = { ...item, anchor: e.target.value };
                  onChange(next);
                }}
              />
              <Input
                className="h-8 text-sm"
                placeholder="הערה (אופציונלי)"
                value={item.notes || ""}
                onChange={(e) => {
                  const next = [...items];
                  next[idx] = { ...item, notes: e.target.value };
                  onChange(next);
                }}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground"
                onClick={() => onChange(items.filter((x) => x.id !== item.id))}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function EmptyHint({ text }: { text: string }) {
  return <p className="text-sm text-muted-foreground text-center py-4 border border-dashed rounded-md">{text}</p>;
}
