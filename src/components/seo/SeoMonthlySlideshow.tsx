import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  SeoMonthlyShareSnapshot,
  STATUS_LABELS,
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

export function buildSeoMonthlySlides(snapshot: SeoMonthlyShareSnapshot): Slide[] {
  const slides: Slide[] = [{ kind: "cover", title: "פתיחה" }];
  if (snapshot.metrics.length > 0) slides.push({ kind: "metrics", title: "מדדים מרכזיים" });
  if (snapshot.keywords.length > 0) slides.push({ kind: "keywords", title: "ביטויים מרכזיים" });
  if (snapshot.work.summary?.trim()) slides.push({ kind: "summary", title: "סיכום" });
  if (snapshot.work.onsite.length > 0) slides.push({ kind: "onsite", title: "עבודה באתר" });
  if (snapshot.work.articles.length > 0) slides.push({ kind: "articles", title: "מאמרים" });
  if (snapshot.work.links.length > 0) slides.push({ kind: "links", title: "קישורים" });
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
      {snapshot.work.summary?.trim() && (
        <p className="max-w-2xl text-base leading-relaxed text-[#F4F0E6]/70 md:text-lg">
          {snapshot.work.summary.trim()}
        </p>
      )}
    </div>
  );
}

function MetricsSlide({ snapshot }: { snapshot: SeoMonthlyShareSnapshot }) {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold md:text-4xl">הפרמטרים המרכזיים</h2>
        <p className="mt-2 text-[#F4F0E6]/60">תמונת מצב SEO לחודש זה</p>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        {snapshot.metrics.map((m) => {
          const delta = deltaLabel(m.value, m.prevValue);
          return (
            <div
              key={m.key}
              className="border-b border-white/10 pb-4 pt-1"
            >
              <p className="text-xs text-[#F4F0E6]/55">{m.label}</p>
              <p className="mt-2 text-3xl font-bold tabular-nums tracking-tight md:text-4xl">
                {formatNum(m.value)}
              </p>
              {delta && <p className="mt-1 text-[11px] text-[#2DA89E]">{delta}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function KeywordsSlide({ snapshot }: { snapshot: SeoMonthlyShareSnapshot }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold md:text-4xl">ביטויים מרכזיים</h2>
        <p className="mt-2 text-[#F4F0E6]/60">המיקומים החזקים ביותר ברשימת המעקב</p>
      </div>
      <div className="grid gap-2">
        {snapshot.keywords.slice(0, 10).map((kw, i) => {
          const change =
            kw.position != null && kw.prevPosition != null
              ? kw.prevPosition - kw.position
              : null;
          return (
            <div
              key={`${kw.keyword}-${i}`}
              className="grid grid-cols-[2.5rem_1fr_auto] items-center gap-3 border-b border-white/8 py-2.5"
            >
              <span className="font-mono text-sm text-[#D4A574]">
                {kw.position != null ? `#${kw.position}` : "—"}
              </span>
              <span className="truncate text-base md:text-lg">{kw.keyword}</span>
              <span className="text-xs tabular-nums text-[#F4F0E6]/50">
                {change == null
                  ? kw.volume != null
                    ? `${formatNum(kw.volume)} חיפושים`
                    : ""
                  : change > 0
                    ? `↑ ${change}`
                    : change < 0
                      ? `↓ ${Math.abs(change)}`
                      : "→"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SummarySlide({ snapshot }: { snapshot: SeoMonthlyShareSnapshot }) {
  return (
    <div className="max-w-3xl space-y-6">
      <h2 className="text-3xl font-bold md:text-4xl">סיכום העבודה</h2>
      <p className="whitespace-pre-wrap text-xl leading-relaxed text-[#F4F0E6]/85 md:text-2xl">
        {snapshot.work.summary}
      </p>
    </div>
  );
}

function OnsiteSlide({ snapshot }: { snapshot: SeoMonthlyShareSnapshot }) {
  const items = snapshot.work.onsite.slice(0, 8);
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold md:text-4xl">עבודה באתר</h2>
        <p className="mt-2 text-[#F4F0E6]/60">{snapshot.work.onsite.length} פעולות</p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {items.map((item) => (
          <div key={item.id} className="border-r-2 border-[#2DA89E]/70 pr-4">
            <p className="text-[11px] tracking-wide text-[#D4A574]">{onsiteKindLabel(item.kind)}</p>
            <p className="mt-1 text-lg font-medium">{item.title}</p>
            {item.url && (
              <p className="mt-1 truncate font-mono text-xs text-[#F4F0E6]/45" dir="ltr">
                {item.url}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ArticlesSlide({ snapshot }: { snapshot: SeoMonthlyShareSnapshot }) {
  const items = snapshot.work.articles.slice(0, 6);
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold md:text-4xl">מאמרים שכתבנו</h2>
        <p className="mt-2 text-[#F4F0E6]/60">{snapshot.work.articles.length} מאמרים</p>
      </div>
      <div className="space-y-4">
        {items.map((item, i) => (
          <div key={item.id} className="flex items-start gap-4 border-b border-white/10 pb-4">
            <span className="font-mono text-sm text-[#2DA89E]">
              {String(i + 1).padStart(2, "0")}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xl font-semibold">{item.title}</p>
              {item.topic && <p className="mt-1 text-sm text-[#F4F0E6]/55">{item.topic}</p>}
              {item.url && (
                <a
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-xs text-[#D4A574] hover:underline"
                  dir="ltr"
                >
                  <ExternalLink className="h-3 w-3" />
                  {item.url}
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function LinksSlide({ snapshot }: { snapshot: SeoMonthlyShareSnapshot }) {
  const items = snapshot.work.links.slice(0, 8);
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold md:text-4xl">קישורים</h2>
        <p className="mt-2 text-[#F4F0E6]/60">{snapshot.work.links.length} קישורים החודש</p>
      </div>
      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.id} className="grid gap-1 border-b border-white/8 py-3 md:grid-cols-[1fr_auto]">
            <div className="min-w-0">
              <p className="truncate font-mono text-sm text-[#2DA89E]" dir="ltr">
                {item.url}
              </p>
              {item.anchor && <p className="mt-1 text-base">עוגן: {item.anchor}</p>}
              {item.notes && <p className="mt-0.5 text-sm text-[#F4F0E6]/50">{item.notes}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ClosingSlide({ snapshot }: { snapshot: SeoMonthlyShareSnapshot }) {
  const counts = [
    { label: "עבודה באתר", value: snapshot.work.onsite.length },
    { label: "מאמרים", value: snapshot.work.articles.length },
    { label: "קישורים", value: snapshot.work.links.length },
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
      className="pointer-events-none fixed -left-[10000px] top-0 z-[-1] flex flex-col gap-0"
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
