import { useMemo, type ReactNode, type RefObject } from "react";
import { cn } from "@/lib/utils";
import type { SeoMonthlyShareSnapshot } from "@/lib/seoMonthlyShareSnapshot";
import {
  ArticlesSlide,
  ClosingSlide,
  CoverSlide,
  KeywordsSlide,
  LinksSlide,
  MetricsSlide,
  OnsiteSlide,
  SummarySlide,
  buildSeoMonthlySlides,
} from "@/components/seo/SeoMonthlyReportSections";

type Props = {
  snapshot: SeoMonthlyShareSnapshot;
  captureMode?: boolean;
  className?: string;
  /** Controls rendered inside the sticky header (e.g. back to dashboard). */
  headerAction?: ReactNode;
};

function ReportSection({
  kind,
  snapshot,
}: {
  kind: string;
  snapshot: SeoMonthlyShareSnapshot;
}) {
  if (kind === "cover") return <CoverSlide snapshot={snapshot} />;
  if (kind === "metrics") return <MetricsSlide snapshot={snapshot} />;
  if (kind === "keywords") return <KeywordsSlide snapshot={snapshot} />;
  if (kind === "summary") return <SummarySlide snapshot={snapshot} />;
  if (kind === "onsite") return <OnsiteSlide snapshot={snapshot} />;
  if (kind === "articles") return <ArticlesSlide snapshot={snapshot} />;
  if (kind === "links") return <LinksSlide snapshot={snapshot} />;
  return <ClosingSlide snapshot={snapshot} />;
}

export function SeoMonthlyLandingPage({
  snapshot,
  captureMode = false,
  className,
  headerAction,
}: Props) {
  const sections = useMemo(() => buildSeoMonthlySlides(snapshot), [snapshot]);

  return (
    <article
      dir="rtl"
      className={cn(
        // `overflow-x-clip` (not hidden) keeps the sticky header pinned — hidden would
        // make this article a scroll container and break `position: sticky`.
        "seo-monthly-report min-h-full overflow-x-clip bg-[#f6f8f5] font-heebo text-[#172a32]",
        captureMode ? "w-[1120px]" : "w-full",
        className,
      )}
    >
      <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-[#f6f8f5]/95 px-4 py-3 backdrop-blur md:px-12 md:py-4">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-2 sm:gap-3">
            {!captureMode && headerAction}
            <div className={cn("min-w-0", !captureMode && headerAction && "hidden sm:block")}>
              <p className="text-xs font-bold tracking-[0.18em] text-[#0f766e]">AIOS SEO</p>
              <p className="truncate text-sm text-slate-500">{snapshot.monthLabel}</p>
            </div>
          </div>
          {!captureMode && (
            <nav className="hidden items-center gap-5 text-xs text-slate-500 lg:flex" aria-label="תוכן הדוח">
              {sections.map((section, index) => (
                <a
                  key={section.kind}
                  href={`#seo-section-${section.kind}`}
                  className="transition-colors hover:text-[#0f766e]"
                >
                  {String(index + 1).padStart(2, "0")} · {section.title}
                </a>
              ))}
            </nav>
          )}
        </div>
      </header>

      <main>
        {sections.map((section, index) => (
          <section
            id={`seo-section-${section.kind}`}
            key={section.kind}
            className={cn(
              "seo-report-section flex min-h-[680px] scroll-mt-20 items-center border-b border-slate-200 px-7 py-20 md:px-14",
              index % 2 === 0 ? "bg-[#f6f8f5]" : "bg-white",
            )}
          >
            <div className="mx-auto w-full max-w-6xl">
              <div className="mb-10 flex items-center gap-3 text-xs font-semibold text-[#0f766e]">
                <span>{String(index + 1).padStart(2, "0")}</span>
                <span className="h-px w-10 bg-[#0f766e]/40" />
                <span>{section.title}</span>
              </div>
              <ReportSection kind={section.kind} snapshot={snapshot} />
            </div>
          </section>
        ))}
      </main>
    </article>
  );
}

export function SeoMonthlyLandingPageCapture({
  snapshot,
  reportRef,
}: {
  snapshot: SeoMonthlyShareSnapshot;
  reportRef: RefObject<HTMLDivElement | null>;
}) {
  return (
    <div
      ref={reportRef}
      aria-hidden
      className="pointer-events-none fixed -left-[10000px] top-0 z-[-1] [&_a]:pointer-events-auto"
    >
      <SeoMonthlyLandingPage snapshot={snapshot} captureMode />
    </div>
  );
}
