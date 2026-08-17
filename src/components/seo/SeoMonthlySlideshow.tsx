import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { ArrowDownRight, ArrowUpRight, ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  SeoMonthlyShareSnapshot,
  STATUS_LABELS,
  buildSeoPerformanceSummary,
  onsiteKindLabel,
} from "@/lib/seoMonthlyShareSnapshot";

type SlideKind =
  | "cover"
  | "metrics"
  | "keywords"
  | "summary"
  | "onsite"
  | "articles"
  | "links"
  | "closing";

type Slide = {
  kind: SlideKind;
  title: string;
};

type Props = {
  snapshot: SeoMonthlyShareSnapshot;
  /** When true, hide chrome (for PDF capture). */
  captureMode?: boolean;
  className?: string;
  /** Controlled slide index (optional). */
  slideIndex?: number;
  onSlideIndexChange?: (index: number) => void;
};

function formatNum(n: number): string {
  return n.toLocaleString("he-IL");
}

function deltaLabel(current: number, prev?: number): string | null {
  if (prev == null || !Number.isFinite(prev)) return null;
  const d = current - prev;
  if (d === 0) return "ללא שינוי";
  const sign = d > 0 ? "+" : "";
  return `${sign}${formatNum(d)} מול חודש קודם`;
}

/** Percentage growth against the campaign-start baseline. */
function growthPct(current: number, base?: number | null): number | null {
  if (base == null || !Number.isFinite(base)) return null;
  if (base === 0) return current > 0 ? 100 : null;
  return Math.round(((current - base) / base) * 100);
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url.replace(/^https?:\/\//, "").split("/")[0];
  }
}

/** Same work item written with or without a bullet must render once. */
function dedupeKey(value: string): string {
  return value
    .replace(/^[\s*•\-–—]+/, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.,:;]+$/, "")
    .toLowerCase();
}

function dedupeBy<T>(items: T[], key: (item: T) => string): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    const k = key(item);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(item);
  }
  return out;
}

export function buildSeoMonthlySlides(snapshot: SeoMonthlyShareSnapshot): Slide[] {
  const slides: Slide[] = [{ kind: "cover", title: "פתיחה" }];
  if (snapshot.metrics.length > 0 || snapshot.search) {
    slides.push({ kind: "metrics", title: "מדדים מרכזיים" });
  }
  if (snapshot.keywords.length > 0) slides.push({ kind: "keywords", title: "ביטויים מרכזיים" });
  // Performance + forward plan (from real metrics). Cover carries סיכום כללי separately.
  if (snapshot.search || snapshot.metrics.length > 0 || snapshot.keywords.length > 0) {
    slides.push({ kind: "summary", title: "סיכום ומבט קדימה" });
  }
  if (snapshot.work.onsite.length > 0) slides.push({ kind: "onsite", title: "עבודה באתר" });
  if (snapshot.work.articles.length > 0) slides.push({ kind: "articles", title: "מאמרים" });
  if ((snapshot.recentLinks?.length || snapshot.work.links.length) > 0) {
    slides.push({ kind: "links", title: "קישורים" });
  }
  slides.push({ kind: "closing", title: "סיכום עבודה" });
  return slides;
}

export function SeoMonthlySlideshow({
  snapshot,
  captureMode = false,
  className,
  slideIndex: controlledIndex,
  onSlideIndexChange,
}: Props) {
  const slides = useMemo(() => buildSeoMonthlySlides(snapshot), [snapshot]);
  const [internalIndex, setInternalIndex] = useState(0);
  const index = controlledIndex ?? internalIndex;
  const setIndex = (next: number) => {
    const clamped = Math.max(0, Math.min(slides.length - 1, next));
    if (controlledIndex === undefined) setInternalIndex(clamped);
    onSlideIndexChange?.(clamped);
  };

  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    if (captureMode) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") setIndex(index + 1); // RTL: left = next
      if (e.key === "ArrowRight") setIndex(index - 1);
      if (e.key === "Home") setIndex(0);
      if (e.key === "End") setIndex(slides.length - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, slides.length, captureMode]);

  const slide = slides[index] || slides[0];
  const progress = ((index + 1) / slides.length) * 100;

  return (
    <div
      dir="rtl"
      className={cn(
        "seo-monthly-slideshow relative overflow-hidden select-none",
        "font-heebo text-[#F4F0E6]",
        captureMode ? "w-[1280px] h-[720px]" : "w-full h-full min-h-[420px]",
        className,
      )}
      style={{
        background:
          "radial-gradient(120% 80% at 100% 0%, #1A4A52 0%, transparent 55%), radial-gradient(90% 70% at 0% 100%, #0F3A45 0%, transparent 50%), linear-gradient(155deg, #071820 0%, #0B2C36 45%, #0E4A4A 100%)",
      }}
      onTouchStart={(e) => {
        touchStartX.current = e.changedTouches[0]?.clientX ?? null;
      }}
      onTouchEnd={(e) => {
        const start = touchStartX.current;
        const end = e.changedTouches[0]?.clientX;
        touchStartX.current = null;
        if (start == null || end == null) return;
        const dx = end - start;
        if (Math.abs(dx) < 48) return;
        // Swipe right (positive dx in LTR coords) → previous in RTL deck
        if (dx > 0) setIndex(index - 1);
        else setIndex(index + 1);
      }}
    >
      {/* Atmosphere */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.14]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -left-24 top-1/4 h-72 w-72 rounded-full blur-3xl"
        style={{ background: "rgba(45, 168, 158, 0.22)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 bottom-0 h-64 w-64 rounded-full blur-3xl"
        style={{ background: "rgba(212, 165, 116, 0.12)" }}
      />

      {/* Progress */}
      <div className="absolute inset-x-0 top-0 z-20 h-1 bg-white/10">
        <div
          className="h-full transition-all duration-500 ease-out"
          style={{ width: `${progress}%`, background: "linear-gradient(90deg, #2DA89E, #D4A574)" }}
        />
      </div>

      {/* Slide body */}
      <div
        key={`${slide.kind}-${index}`}
        className={cn(
          "relative z-10 flex h-full flex-col px-8 py-10 md:px-14 md:py-12",
          "animate-in fade-in slide-in-from-left-2 duration-500",
        )}
      >
        <SlideChrome
          brand="AIOS SEO"
          monthLabel={snapshot.monthLabel}
          slideLabel={slide.title}
          index={index}
          total={slides.length}
        />

        <div className="mt-6 flex flex-1 flex-col justify-center">
          {slide.kind === "cover" && <CoverSlide snapshot={snapshot} />}
          {slide.kind === "metrics" && <MetricsSlide snapshot={snapshot} />}
          {slide.kind === "keywords" && <KeywordsSlide snapshot={snapshot} />}
          {slide.kind === "summary" && <SummarySlide snapshot={snapshot} />}
          {slide.kind === "onsite" && <OnsiteSlide snapshot={snapshot} />}
          {slide.kind === "articles" && <ArticlesSlide snapshot={snapshot} />}
          {slide.kind === "links" && <LinksSlide snapshot={snapshot} />}
          {slide.kind === "closing" && <ClosingSlide snapshot={snapshot} />}
        </div>
      </div>

      {!captureMode && (
        <div className="absolute inset-x-0 bottom-0 z-20 flex items-center justify-between gap-3 px-5 pb-5 md:px-8">
          <button
            type="button"
            aria-label="שקף קודם"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/5 backdrop-blur transition hover:bg-white/15 disabled:opacity-30"
            disabled={index <= 0}
            onClick={() => setIndex(index - 1)}
          >
            <ChevronRight className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-1.5">
            {slides.map((s, i) => (
              <button
                key={`${s.kind}-${i}`}
                type="button"
                aria-label={`שקף ${i + 1}`}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  i === index ? "w-6 bg-[#D4A574]" : "w-1.5 bg-white/30 hover:bg-white/50",
                )}
                onClick={() => setIndex(i)}
              />
            ))}
          </div>
          <button
            type="button"
            aria-label="שקף הבא"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/5 backdrop-blur transition hover:bg-white/15 disabled:opacity-30"
            disabled={index >= slides.length - 1}
            onClick={() => setIndex(index + 1)}
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        </div>
      )}
    </div>
  );
}

function SlideChrome({
  brand,
  monthLabel,
  slideLabel,
  index,
  total,
}: {
  brand: string;
  monthLabel: string;
  slideLabel: string;
  index: number;
  total: number;
}) {
  return (
    <div className="flex items-start justify-between gap-4 text-[11px] tracking-[0.18em] uppercase text-[#F4F0E6]/70">
      <div className="space-y-1">
        <p className="text-[#2DA89E]">{brand}</p>
        <p className="normal-case tracking-normal text-sm text-[#F4F0E6]/55">{monthLabel}</p>
      </div>
      <div className="text-left">
        <p>{slideLabel}</p>
        <p className="mt-1 tabular-nums text-[#F4F0E6]/45">
          {String(index + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
        </p>
      </div>
    </div>
  );
}

function CoverSlide({ snapshot }: { snapshot: SeoMonthlyShareSnapshot }) {
  const status = STATUS_LABELS[snapshot.status];
  const intro = snapshot.work.summary?.trim() || "";
  return (
    <div className="max-w-3xl space-y-6">
      <p className="text-sm tracking-[0.2em] text-[#D4A574]">דוח SEO חודשי</p>
      <h1 className="text-4xl font-extrabold leading-[1.1] md:text-6xl">{snapshot.clientName}</h1>
      <p className="text-xl text-[#F4F0E6]/75 md:text-2xl">{snapshot.monthLabel}</p>
      {snapshot.domain && (
        <p className="font-mono text-sm text-[#2DA89E]" dir="ltr">
          {snapshot.domain}
        </p>
      )}
      <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-sm">
        <span className="text-[#F4F0E6]/60">מגמה</span>
        <span className="font-semibold text-[#F4F0E6]">{status}</span>
      </div>
      {intro && (
        <div className="max-w-2xl space-y-2">
          <p className="text-xs tracking-[0.16em] text-[#D4A574]/90">הקדמה</p>
          <p className="whitespace-pre-wrap text-base leading-relaxed text-[#F4F0E6]/75 md:text-lg">
            {intro}
          </p>
        </div>
      )}
    </div>
  );
}

function TrendPill({ value, suffix }: { value: number; suffix?: string }) {
  const up = value > 0;
  const flat = value === 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums",
        flat
          ? "bg-white/10 text-[#F4F0E6]/60"
          : up
            ? "bg-[#2DA89E]/20 text-[#5BE0D2]"
            : "bg-[#D4756B]/20 text-[#F0A79C]",
      )}
    >
      {!flat && (up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />)}
      {up ? "+" : ""}
      {formatNum(value)}
      {suffix}
    </span>
  );
}

function MetricsSlide({ snapshot }: { snapshot: SeoMonthlyShareSnapshot }) {
  const search = snapshot.search;
  const metricOf = (key: string) => snapshot.metrics.find((m) => m.key === key);

  const ahrefsTop20 = metricOf("top20");
  const ahrefsTop3 = metricOf("top3");

  // GSC: clicks + impressions. Rankings: Ahrefs (matches SeoSnapshotCards / positions table).
  const headline = search
    ? [
        {
          key: "clicks",
          label: "קליקים מגוגל",
          value: search.totals.clicks,
          prev: search.prev?.clicks,
          base: search.base?.clicks,
        },
        {
          key: "impressions",
          label: "חשיפות בגוגל",
          value: search.totals.impressions,
          prev: search.prev?.impressions,
          base: search.base?.impressions,
        },
        ...(ahrefsTop20
          ? [{
              key: "top20",
              label: "ביטויים ב-Top 20",
              value: ahrefsTop20.value,
              prev: ahrefsTop20.prevValue,
              base: undefined as number | undefined,
            }]
          : []),
        ...(ahrefsTop3
          ? [{
              key: "top3",
              label: "ביטויים ב-Top 3",
              value: ahrefsTop3.value,
              prev: ahrefsTop3.prevValue,
              base: undefined as number | undefined,
            }]
          : []),
      ]
    : (
        [
          { key: "clicks", label: "קליקים מגוגל", metricKey: "gsc_clicks" },
          { key: "impressions", label: "חשיפות בגוגל", metricKey: "gsc_impressions" },
          { key: "top20", label: "ביטויים ב-Top 20", metricKey: "top20" },
          { key: "keywords", label: "ביטויים עם חשיפות", metricKey: "keywords_total" },
        ] as const
      )
        .map((row) => {
          const m = metricOf(row.metricKey);
          if (!m) return null;
          return {
            key: row.key,
            label: row.label,
            value: m.value,
            prev: m.prevValue,
            base: undefined as number | undefined,
          };
        })
        .filter((row): row is NonNullable<typeof row> => !!row);

  const hasGscHeadline = headline.length > 0;
  const hiddenWithSearch = ["gsc_clicks", "gsc_impressions", "top20", "top3", "org_traffic"];
  const secondary = snapshot.metrics.filter((m) =>
    hasGscHeadline ? !hiddenWithSearch.includes(m.key) : !["gsc_clicks", "gsc_impressions"].includes(m.key),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-3xl font-bold md:text-4xl">הפרמטרים המרכזיים</h2>
          <p className="mt-2 text-[#F4F0E6]/60">
            {hasGscHeadline ? "נתוני Google Search Console לחודש זה" : "תמונת מצב SEO לחודש זה"}
          </p>
        </div>
        {search?.baseLabel && (
          <p className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-[#F4F0E6]/70">
            השוואה מאז תחילת הקידום · {search.baseLabel}
          </p>
        )}
      </div>

      {hasGscHeadline && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {headline.map((m) => {
            const pct = growthPct(m.value, m.base);
            return (
              <div
                key={m.key}
                className="rounded-xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-sm"
              >
                <p className="text-xs text-[#F4F0E6]/55">{m.label}</p>
                <p className="mt-2 text-4xl font-bold tabular-nums tracking-tight">
                  {formatNum(m.value)}
                </p>
                <div className="mt-3 space-y-1.5">
                  {m.prev != null && (
                    <div className="flex items-center gap-2">
                      <TrendPill value={m.value - m.prev} />
                      <span className="text-[10px] text-[#F4F0E6]/45">מול חודש קודם</span>
                    </div>
                  )}
                  {pct != null && (
                    <div className="flex items-center gap-2">
                      <TrendPill value={pct} suffix="%" />
                      <span className="text-[10px] text-[#F4F0E6]/45">מאז תחילת הקידום</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {search?.totals.position != null && (
        <p className="text-sm text-[#F4F0E6]/60">
          מיקום ממוצע החודש:{" "}
          <span className="font-semibold tabular-nums text-[#F4F0E6]">
            {search.totals.position}
          </span>
          {search.base?.position != null && (
            <>
              {" · "}בתחילת הקידום:{" "}
              <span className="tabular-nums text-[#F4F0E6]/80">{search.base.position}</span>
            </>
          )}
        </p>
      )}

      {secondary.length > 0 && (
        <div className="grid grid-cols-2 gap-3 border-t border-white/10 pt-4 md:grid-cols-4">
          {secondary.map((m) => {
            const delta = deltaLabel(m.value, m.prevValue);
            return (
              <div key={m.key}>
                <p className="text-xs text-[#F4F0E6]/55">{m.label}</p>
                <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight">
                  {formatNum(m.value)}
                </p>
                {delta && <p className="mt-1 text-[11px] text-[#2DA89E]">{delta}</p>}
              </div>
            );
          })}
        </div>
      )}

      {search && search.totals.keywords > 0 && (
        <p className="text-sm text-[#F4F0E6]/55 border-t border-white/10 pt-4">
          ביטויים עם חשיפות ב-Search Console:{" "}
          <span className="font-semibold tabular-nums text-[#F4F0E6]">
            {formatNum(search.totals.keywords)}
          </span>
          {search.prev != null && (
            <span className="text-[#F4F0E6]/50">
              {" "}
              ({deltaLabel(search.totals.keywords, search.prev.keywords) ?? "ללא שינוי"})
            </span>
          )}
        </p>
      )}
    </div>
  );
}

function KeywordsSlide({ snapshot }: { snapshot: SeoMonthlyShareSnapshot }) {
  const withSearchData = snapshot.keywords.some((k) => k.impressions != null);
  const rows = snapshot.keywords.slice(0, 20);
  const half = Math.ceil(rows.length / 2);
  const columns = rows.length > 10 ? [rows.slice(0, half), rows.slice(half)] : [rows];

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-3xl font-bold md:text-4xl">ביטויים מרכזיים</h2>
        <p className="mt-2 text-[#F4F0E6]/60">
          {withSearchData
            ? `Top ${rows.length} ביטויים לפי חשיפות וקליקים בגוגל`
            : "המיקומים החזקים ביותר ברשימת המעקב"}
        </p>
      </div>
      <div className={cn("grid gap-x-8 gap-y-1", columns.length > 1 && "md:grid-cols-2")}>
        {columns.map((col, ci) => (
          <div key={ci} className="space-y-1">
            {withSearchData && (
              <div className="grid grid-cols-[2.4rem_1fr_3.6rem_3rem] items-center gap-2 pb-1 text-[10px] uppercase tracking-wide text-[#F4F0E6]/40">
                <span>מיקום</span>
                <span>ביטוי</span>
                <span className="text-left">חשיפות</span>
                <span className="text-left">קליקים</span>
              </div>
            )}
            {col.map((kw, i) => {
              const posChange =
                kw.position != null && kw.basePosition != null
                  ? Math.round((kw.basePosition - kw.position) * 10) / 10
                  : kw.position != null && kw.prevPosition != null
                    ? kw.prevPosition - kw.position
                    : null;
              return (
                <div
                  key={`${kw.keyword}-${ci}-${i}`}
                  className="grid grid-cols-[2.4rem_1fr_3.6rem_3rem] items-center gap-2 border-b border-white/[0.07] py-1.5"
                >
                  <span className="font-mono text-xs text-[#D4A574]">
                    {kw.position != null ? `#${kw.position}` : "—"}
                  </span>
                  <span className="truncate text-sm" title={kw.keyword}>
                    {kw.keyword}
                    {posChange != null && posChange !== 0 && (
                      <span
                        className={cn(
                          "mr-1.5 text-[10px] tabular-nums",
                          posChange > 0 ? "text-[#5BE0D2]" : "text-[#F0A79C]",
                        )}
                      >
                        {posChange > 0 ? "↑" : "↓"}
                        {Math.abs(posChange)}
                      </span>
                    )}
                  </span>
                  <span className="text-left text-xs tabular-nums text-[#F4F0E6]/70">
                    {kw.impressions != null
                      ? formatNum(kw.impressions)
                      : kw.volume != null
                        ? formatNum(kw.volume)
                        : "—"}
                  </span>
                  <span
                    className={cn(
                      "text-left text-xs font-semibold tabular-nums",
                      kw.clicks ? "text-[#2DA89E]" : "text-[#F4F0E6]/30",
                    )}
                  >
                    {kw.clicks != null ? formatNum(kw.clicks) : "—"}
                  </span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function SummarySlide({ snapshot }: { snapshot: SeoMonthlyShareSnapshot }) {
  const narrative = buildSeoPerformanceSummary(snapshot);
  return (
    <div className="max-w-3xl space-y-6">
      <h2 className="text-3xl font-bold md:text-4xl">סיכום ומבט קדימה</h2>
      <p className="text-xl leading-relaxed text-[#F4F0E6]/85 md:text-2xl">{narrative}</p>
    </div>
  );
}

function OnsiteSlide({ snapshot }: { snapshot: SeoMonthlyShareSnapshot }) {
  const unique = dedupeBy(snapshot.work.onsite, (item) => dedupeKey(item.title));
  const items = unique.slice(0, 10);
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold md:text-4xl">עבודה באתר</h2>
        <p className="mt-2 text-[#F4F0E6]/60">{unique.length} פעולות</p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {items.map((item) => (
          <div key={item.id} className="border-r-2 border-[#2DA89E]/70 pr-4">
            <p className="text-[11px] tracking-wide text-[#D4A574]">{onsiteKindLabel(item.kind)}</p>
            {item.url ? (
              <a
                href={item.url}
                target="_blank"
                rel="noreferrer"
                className="mt-1 block text-base font-medium leading-snug hover:text-[#5BE0D2] hover:underline"
              >
                {item.title}
              </a>
            ) : (
              <p className="mt-1 text-base font-medium leading-snug">{item.title}</p>
            )}
          </div>
        ))}
      </div>
      {unique.length > items.length && (
        <p className="text-xs text-[#F4F0E6]/45">ועוד {unique.length - items.length} פעולות</p>
      )}
    </div>
  );
}

function ArticlesSlide({ snapshot }: { snapshot: SeoMonthlyShareSnapshot }) {
  const unique = dedupeBy(snapshot.work.articles, (item) => dedupeKey(item.title));
  const items = unique.slice(0, 8);
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-3xl font-bold md:text-4xl">מאמרים שכתבנו</h2>
        <p className="mt-2 text-[#F4F0E6]/60">{unique.length} מאמרים · לחיצה פותחת את המאמר</p>
      </div>
      <div className="space-y-2.5">
        {items.map((item, i) => (
          <div key={item.id} className="flex items-start gap-3 border-b border-white/10 pb-2.5">
            <span className="mt-1 font-mono text-xs text-[#2DA89E]">
              {String(i + 1).padStart(2, "0")}
            </span>
            <div className="min-w-0 flex-1">
              {item.url ? (
                <a
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  className="group inline-flex items-start gap-1.5 text-lg font-semibold leading-snug text-[#F4F0E6] hover:text-[#5BE0D2]"
                >
                  <span className="underline decoration-[#2DA89E]/50 underline-offset-4 group-hover:decoration-[#5BE0D2]">
                    {item.title}
                  </span>
                  <ExternalLink className="mt-1.5 h-3.5 w-3.5 shrink-0 text-[#D4A574]" />
                </a>
              ) : (
                <p className="text-lg font-semibold leading-snug">{item.title}</p>
              )}
              {item.topic && <p className="mt-0.5 text-sm text-[#F4F0E6]/55">{item.topic}</p>}
            </div>
          </div>
        ))}
      </div>
      {unique.length > items.length && (
        <p className="text-xs text-[#F4F0E6]/45">ועוד {unique.length - items.length} מאמרים</p>
      )}
    </div>
  );
}

function LinksSlide({ snapshot }: { snapshot: SeoMonthlyShareSnapshot }) {
  const fromRecent = snapshot.recentLinks?.length
    ? snapshot.recentLinks
    : snapshot.work.links.map((l) => ({
        ...l,
        month: snapshot.month,
        monthLabel: snapshot.monthLabel,
      }));
  const unique = dedupeBy(fromRecent, (l) => l.url.trim().toLowerCase());

  const byMonth = new Map<string, typeof unique>();
  for (const link of unique) {
    const list = byMonth.get(link.monthLabel) || [];
    list.push(link);
    byMonth.set(link.monthLabel, list);
  }
  const groups = Array.from(byMonth.entries()).slice(0, 3);
  const spansMonths = groups.length > 1;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-3xl font-bold md:text-4xl">קישורים חיצוניים</h2>
        <p className="mt-2 text-[#F4F0E6]/60">
          {unique.length} קישורים{spansMonths ? " בשלושת החודשים האחרונים" : " החודש"}
        </p>
      </div>
      <div className={cn("grid gap-x-8 gap-y-4", spansMonths && "md:grid-cols-3")}>
        {groups.map(([monthLabel, links]) => (
          <div key={monthLabel} className="space-y-1.5">
            {spansMonths && (
              <p className="text-[11px] font-semibold tracking-wide text-[#D4A574]">{monthLabel}</p>
            )}
            {links.slice(0, spansMonths ? 6 : 10).map((link) => (
              <div key={link.id} className="border-b border-white/[0.07] py-1.5">
                <a
                  href={link.url}
                  target="_blank"
                  rel="noreferrer"
                  className="block text-sm leading-snug text-[#F4F0E6] underline decoration-[#2DA89E]/40 underline-offset-4 hover:text-[#5BE0D2]"
                  title={link.anchor || link.url}
                  style={{
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {link.anchor?.trim() || hostOf(link.url)}
                </a>
                <p className="mt-0.5 truncate text-[11px] text-[#F4F0E6]/45" dir="ltr">
                  {hostOf(link.url)}
                </p>
              </div>
            ))}
            {links.length > (spansMonths ? 6 : 10) && (
              <p className="text-[11px] text-[#F4F0E6]/40">
                ועוד {links.length - (spansMonths ? 6 : 10)}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ClosingSlide({ snapshot }: { snapshot: SeoMonthlyShareSnapshot }) {
  // Closing slide is "what we did this month" — never inflate with prior-month links.
  const counts = [
    {
      label: "עבודה באתר",
      value: dedupeBy(snapshot.work.onsite, (i) => dedupeKey(i.title)).length,
    },
    {
      label: "מאמרים",
      value: dedupeBy(snapshot.work.articles, (i) => dedupeKey(i.title)).length,
    },
    {
      label: "קישורים",
      value: dedupeBy(snapshot.work.links, (i) => i.url.trim().toLowerCase()).length,
    },
    { label: "ביטויים מוצגים", value: snapshot.keywords.length },
  ];
  return (
    <div className="space-y-10">
      <div>
        <h2 className="text-3xl font-bold md:text-5xl">זה מה שעשינו החודש</h2>
        <p className="mt-3 text-lg text-[#F4F0E6]/65">
          {snapshot.clientName} · {snapshot.monthLabel}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
        {counts.map((c) => (
          <div key={c.label}>
            <p className="text-4xl font-extrabold tabular-nums text-[#D4A574] md:text-5xl">
              {c.value}
            </p>
            <p className="mt-2 text-sm text-[#F4F0E6]/60">{c.label}</p>
          </div>
        ))}
      </div>
      <p className="text-sm tracking-[0.18em] text-[#2DA89E]">AIOS · דוח SEO</p>
    </div>
  );
}

/**
 * Offscreen stack of all slides for PDF capture (one fixed-size slide per page).
 */
export function SeoMonthlySlideshowCaptureStack({
  snapshot,
  stackRef,
}: {
  snapshot: SeoMonthlyShareSnapshot;
  stackRef: RefObject<HTMLDivElement | null>;
}) {
  const slides = useMemo(() => buildSeoMonthlySlides(snapshot), [snapshot]);
  return (
    <div
      ref={stackRef}
      aria-hidden
      // Keep layout measurable for PDF link hit-boxes (no pointer interaction).
      className="pointer-events-none fixed -left-[10000px] top-0 z-[-1] flex flex-col gap-0 [&_a]:pointer-events-auto"
    >
      {slides.map((_, i) => (
        <SeoMonthlySlideshow
          key={i}
          snapshot={snapshot}
          captureMode
          slideIndex={i}
        />
      ))}
    </div>
  );
}
