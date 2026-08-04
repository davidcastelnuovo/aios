import { useMemo, useRef, useState } from "react";
import { format, startOfMonth, subMonths } from "date-fns";
import { he } from "date-fns/locale";
import { Download, ExternalLink, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  SeoMonthlySlideshow,
  SeoMonthlySlideshowCaptureStack,
} from "@/components/seo/SeoMonthlySlideshow";
import {
  applyLiveWorkToShareSnapshot,
  buildSeoMonthlyShareSnapshot,
  isSeoMonthlyShareSnapshot,
  SeoMonthlyShareSnapshot,
  SeoShareRecentLink,
} from "@/lib/seoMonthlyShareSnapshot";
import {
  emptySeoMonthlyWork,
  parseSeoMonthlyWork,
} from "@/lib/seoMonthlyWork";
import { downloadSeoMonthlySlideshowPdf } from "@/lib/seoMonthlyPdf";
import { filterValidSeoReports } from "@/components/dynamic-tables/seo/reportValidity";
import { filterSeoReportsByDomain, normalizeSeoDomain } from "@/lib/seoDomain";

type MonthlyRow = {
  month: string;
  status: string;
  work: unknown;
  notes?: string | null;
  share_token?: string | null;
  /** Exact deck published from the in-app עבודה חודשית tab. */
  snapshot?: unknown | null;
};

type Props = {
  clientName?: string | null;
  domain?: string | null;
  months: MonthlyRow[];
  /** @deprecated Prefer per-month share_token on months[]. */
  shareToken?: string | null;
  ahrefsReports?: any[];
  forceRelevant?: string[];
  forceIrrelevant?: string[];
};

function monthLabel(month: string): string {
  try {
    return format(new Date(`${month.slice(0, 10)}T12:00:00`), "MMMM yyyy", { locale: he });
  } catch {
    return month;
  }
}

export function PublicSeoMonthlyWorkView({
  clientName,
  domain,
  months,
  shareToken,
  ahrefsReports = [],
  forceRelevant = [],
  forceIrrelevant = [],
}: Props) {
  const captureStackRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);

  const sortedMonths = useMemo(
    () =>
      [...(months || [])]
        .map((m) => ({ ...m, month: String(m.month || "").slice(0, 10) }))
        .filter((m) => !!m.month)
        .sort((a, b) => b.month.localeCompare(a.month)),
    [months],
  );

  const lastCalendarMonth = format(startOfMonth(subMonths(new Date(), 1)), "yyyy-MM-dd");
  const currentCalendarMonth = format(startOfMonth(new Date()), "yyyy-MM-dd");
  // Prefer last month for the client-facing report; fall back to newest past month, then newest available.
  const defaultMonth =
    sortedMonths.find((m) => m.month === lastCalendarMonth)?.month ||
    sortedMonths.find((m) => m.month < currentCalendarMonth)?.month ||
    sortedMonths[0]?.month ||
    lastCalendarMonth;
  const [selectedMonth, setSelectedMonth] = useState(defaultMonth);

  const selected =
    sortedMonths.find((m) => m.month === selectedMonth) ||
    sortedMonths.find((m) => m.month === defaultMonth) ||
    sortedMonths[0] ||
    null;

  const work = useMemo(() => {
    if (!selected) return emptySeoMonthlyWork();
    const parsed = parseSeoMonthlyWork(selected.work);
    if (!parsed.summary && selected.notes) parsed.summary = selected.notes;
    return parsed;
  }, [selected]);

  const recentLinks = useMemo<SeoShareRecentLink[]>(() => {
    const out: SeoShareRecentLink[] = [];
    const seen = new Set<string>();
    const selectedKey = (selected?.month || selectedMonth).slice(0, 10);
    const windowStart = (() => {
      try {
        const d = new Date(`${selectedKey}T12:00:00`);
        d.setMonth(d.getMonth() - 2);
        return format(startOfMonth(d), "yyyy-MM-dd");
      } catch {
        return selectedKey;
      }
    })();
    for (const row of sortedMonths) {
      if (row.month < windowStart || row.month > selectedKey) continue;
      const parsed = row.month === selectedKey ? work : parseSeoMonthlyWork(row.work);
      for (const link of parsed.links) {
        const key = link.url.trim().toLowerCase();
        if (!key || seen.has(key)) continue;
        seen.add(key);
        out.push({
          id: link.id,
          url: link.url,
          anchor: link.anchor,
          notes: link.notes,
          month: row.month,
          monthLabel: monthLabel(row.month),
        });
      }
    }
    return out.sort((a, b) => b.month.localeCompare(a.month));
  }, [sortedMonths, selected, selectedMonth, work]);

  const expectedDomain = normalizeSeoDomain(domain);
  const latestReportData = useMemo(() => {
    const own = filterValidSeoReports(
      filterSeoReportsByDomain(ahrefsReports || [], expectedDomain),
    );
    return (own[0]?.report_data as Record<string, unknown> | undefined) || null;
  }, [ahrefsReports, expectedDomain]);

  const status: SeoMonthlyShareSnapshot["status"] =
    selected?.status === "up" || selected?.status === "down" || selected?.status === "stable"
      ? selected.status
      : "stable";

  /**
   * Prefer the exact snapshot published from the in-app tab (includes GSC search
   * metrics/keywords). Only refresh live work/links so public matches the system.
   */
  const snapshot = useMemo(() => {
    const month = selected?.month || selectedMonth;
    const label = monthLabel(month);
    const published = isSeoMonthlyShareSnapshot(selected?.snapshot) ? selected!.snapshot : null;
    if (published) {
      return applyLiveWorkToShareSnapshot(published, {
        work,
        status,
        recentLinks,
        clientName: clientName || published.clientName,
        domain: domain || published.domain,
        month,
        monthLabel: label,
      });
    }
    // Fallback when this month was never published from the system yet.
    return buildSeoMonthlyShareSnapshot({
      clientName: clientName || "לקוח",
      domain,
      month,
      status,
      work,
      reportData: latestReportData,
      recentLinks,
      relevance: { forceRelevant, forceIrrelevant },
    });
  }, [
    selected,
    selectedMonth,
    work,
    status,
    recentLinks,
    clientName,
    domain,
    latestReportData,
    forceRelevant,
    forceIrrelevant,
  ]);

  const monthShareToken = selected?.share_token || shareToken || null;

  const hasAnyWork =
    !!work.summary?.trim() ||
    work.onsite.length > 0 ||
    work.articles.length > 0 ||
    work.links.length > 0;

  const handleExportPdf = async () => {
    setExporting(true);
    try {
      await new Promise((r) => setTimeout(r, 80));
      if (!captureStackRef.current) throw new Error("אין שקפים ליצוא");
      const safeName = `${snapshot.clientName}-${snapshot.monthLabel}`
        .replace(/[^\w\u0590-\u05FF-]+/g, "-")
        .slice(0, 60);
      await downloadSeoMonthlySlideshowPdf(captureStackRef.current, `seo-${safeName}.pdf`);
      toast.success("ה־PDF הורד");
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "שגיאה ביצוא PDF");
    } finally {
      setExporting(false);
    }
  };

  if (sortedMonths.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          עדיין אין סיכום עבודה חודשית לשיתוף.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4" dir="rtl">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4" />
              עבודה שבוצעה
            </CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={selected?.month || selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="h-8 w-[180px] text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {sortedMonths.map((m) => (
                    <SelectItem key={m.month} value={m.month}>
                      {monthLabel(m.month)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {monthShareToken && (
                <Button asChild size="sm" variant="outline" className="h-8 gap-1.5">
                  <a href={`/shared/seo-monthly/${monthShareToken}`} target="_blank" rel="noreferrer">
                    <ExternalLink className="h-3.5 w-3.5" />
                    מסך מלא
                  </a>
                </Button>
              )}
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 gap-1.5"
                disabled={exporting || !hasAnyWork}
                onClick={handleExportPdf}
              >
                {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                PDF
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {!hasAnyWork ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            אין פריטי עבודה לחודש {monthLabel(selected?.month || selectedMonth)}.
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-[#071820]">
          <div className="h-[min(70vh,640px)] w-full">
            <SeoMonthlySlideshow
              key={`${snapshot.month}-${snapshot.generatedAt}`}
              snapshot={snapshot}
              className="h-full"
            />
          </div>
        </div>
      )}

      <SeoMonthlySlideshowCaptureStack snapshot={snapshot} stackRef={captureStackRef} />
    </div>
  );
}
