import { ArrowDownRight, ArrowUpRight, ExternalLink } from "lucide-react";
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

/**
 * Where every number on the report comes from. Search Console figures are the
 * client's own measured traffic; everything else is a third-party estimate and
 * must be presented as such so the two are never read as the same thing.
 */
const METRIC_SOURCE: Record<string, "gsc" | "ahrefs"> = {
  clicks: "gsc",
  impressions: "gsc",
  gsc_clicks: "gsc",
  gsc_impressions: "gsc",
  dr: "ahrefs",
  org_traffic: "ahrefs",
  top3: "ahrefs",
  top20: "ahrefs",
  keywords: "ahrefs",
  keywords_total: "ahrefs",
  referring_domains: "ahrefs",
  backlinks_live: "ahrefs",
};

const SOURCE_LABELS: Record<"gsc" | "ahrefs", string> = {
  gsc: "Google Search Console",
  ahrefs: "Ahrefs · הערכה",
};

/**
 * Labels are re-derived on render so already-published snapshots pick up
 * wording fixes (e.g. Ahrefs keyword totals were labelled as impressions).
 */
const METRIC_LABELS: Record<string, string> = {
  clicks: "קליקים מגוגל",
  impressions: "חשיפות בגוגל",
  gsc_clicks: "קליקים מגוגל",
  gsc_impressions: "חשיפות בגוגל",
  dr: "דירוג דומיין (DR)",
  org_traffic: "תנועה אורגנית חודשית משוערת",
  top3: "ביטויים ב-Top 3",
  top20: "ביטויים ב-Top 20",
  keywords: "סה״כ ביטויים אורגניים",
  keywords_total: "סה״כ ביטויים אורגניים",
  referring_domains: "דומיינים מפנים",
  backlinks_live: "קישורים נכנסים",
};

function metricLabel(key: string, fallback: string): string {
  return METRIC_LABELS[key] || fallback;
}

function SourceTag({ metricKey }: { metricKey: string }) {
  const source = METRIC_SOURCE[metricKey];
  if (!source) return null;
  return (
    <span className="mt-1 block text-[10px] font-medium text-slate-400">
      מקור: {SOURCE_LABELS[source]}
    </span>
  );
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

export function CoverSlide({ snapshot }: { snapshot: SeoMonthlyShareSnapshot }) {
  const status = STATUS_LABELS[snapshot.status];
  const intro = snapshot.work.summary?.trim() || "";
  return (
    <div className="max-w-3xl space-y-6">
      <p className="text-sm font-semibold tracking-[0.2em] text-[#0f766e]">דוח SEO חודשי</p>
      <h1 className="text-4xl font-extrabold leading-[1.1] md:text-6xl">{snapshot.clientName}</h1>
      <p className="text-xl text-slate-600 md:text-2xl">{snapshot.monthLabel}</p>
      {snapshot.domain && (
        <p className="font-mono text-sm text-[#0f766e]" dir="ltr">
          {snapshot.domain}
        </p>
      )}
      <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-1.5 text-sm">
        <span className="text-slate-500">מגמה</span>
        <span className="font-semibold">{status}</span>
      </div>
      {intro && (
        <div className="max-w-2xl space-y-2">
          <p className="text-xs font-semibold tracking-[0.16em] text-[#0f766e]">הקדמה</p>
          <p className="whitespace-pre-wrap text-base leading-relaxed text-slate-700 md:text-lg">
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
          ? "bg-slate-100 text-slate-500"
          : up
            ? "bg-emerald-50 text-emerald-700"
            : "bg-rose-50 text-rose-700",
      )}
    >
      {!flat && (up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />)}
      {up ? "+" : ""}
      {formatNum(value)}
      {suffix}
    </span>
  );
}

type HeadlineMetric = {
  key: string;
  label: string;
  value: number;
  prev?: number;
  base?: number;
};

export function MetricsSlide({ snapshot }: { snapshot: SeoMonthlyShareSnapshot }) {
  const search = snapshot.search;
  const metricOf = (key: string) => snapshot.metrics.find((m) => m.key === key);

  const fromSnapshot = (key: string): HeadlineMetric | null => {
    const m = metricOf(key);
    if (!m) return null;
    return { key, label: metricLabel(key, m.label), value: m.value, prev: m.prevValue };
  };

  // GSC: clicks + impressions (measured). Rankings and traffic estimates: Ahrefs.
  const headline: HeadlineMetric[] = search
    ? [
        {
          key: "gsc_clicks",
          label: metricLabel("gsc_clicks", "קליקים מגוגל"),
          value: search.totals.clicks,
          prev: search.prev?.clicks,
          base: search.base?.clicks,
        },
        {
          key: "gsc_impressions",
          label: metricLabel("gsc_impressions", "חשיפות בגוגל"),
          value: search.totals.impressions,
          prev: search.prev?.impressions,
          base: search.base?.impressions,
        },
        ...[fromSnapshot("top20"), fromSnapshot("top3")].filter(
          (m): m is HeadlineMetric => !!m,
        ),
      ]
    : ["top3", "top20", "keywords_total", "org_traffic"]
        .map(fromSnapshot)
        .filter((m): m is HeadlineMetric => !!m);

  // Every metric appears once: headline cards first, the rest in the strip below.
  const headlineKeys = new Set(headline.map((m) => m.key));
  const secondary = snapshot.metrics.filter(
    (m) => !headlineKeys.has(m.key) && !["gsc_clicks", "gsc_impressions"].includes(m.key),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-3xl font-bold md:text-4xl">הפרמטרים המרכזיים</h2>
          <p className="mt-2 text-slate-600">
            {search ? "נתוני Google Search Console לחודש זה" : "תמונת מצב SEO לחודש זה"}
          </p>
        </div>
        {search?.baseLabel && (
          <p className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600">
            השוואה מאז תחילת הקידום · {search.baseLabel}
          </p>
        )}
      </div>

      {headline.length > 0 && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {headline.map((m) => {
            const pct = growthPct(m.value, m.base);
            return (
              <div key={m.key} className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-xs font-medium text-slate-500">{m.label}</p>
                <p className="mt-2 text-4xl font-bold tabular-nums tracking-tight">
                  {formatNum(m.value)}
                </p>
                <SourceTag metricKey={m.key} />
                <div className="mt-3 space-y-1.5">
                  {m.prev != null && (
                    <div className="flex items-center gap-2">
                      <TrendPill value={m.value - m.prev} />
                      <span className="text-[10px] text-slate-400">מול חודש קודם</span>
                    </div>
                  )}
                  {pct != null && (
                    <div className="flex items-center gap-2">
                      <TrendPill value={pct} suffix="%" />
                      <span className="text-[10px] text-slate-400">מאז תחילת הקידום</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {search?.totals.position != null && (
        <p className="text-sm text-slate-600">
          מיקום ממוצע בגוגל החודש (משוקלל לפי חשיפות):{" "}
          <span className="font-semibold tabular-nums text-[#172a32]">
            {search.totals.position}
          </span>
          {search.base?.position != null && (
            <>
              {" · "}בתחילת הקידום:{" "}
              <span className="tabular-nums text-slate-700">{search.base.position}</span>
            </>
          )}
        </p>
      )}

      {secondary.length > 0 && (
        <div className="grid grid-cols-2 gap-3 border-t border-slate-200 pt-4 md:grid-cols-4">
          {secondary.map((m) => {
            const delta = deltaLabel(m.value, m.prevValue);
            return (
              <div key={m.key}>
                <p className="text-xs font-medium text-slate-500">{metricLabel(m.key, m.label)}</p>
                <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight">
                  {formatNum(m.value)}
                </p>
                <SourceTag metricKey={m.key} />
                {delta && <p className="mt-1 text-[11px] text-[#0f766e]">{delta}</p>}
              </div>
            );
          })}
        </div>
      )}

      {search && search.totals.keywords > 0 && (
        <p className="border-t border-slate-200 pt-4 text-sm text-slate-600">
          ביטויים שהאתר הופיע עליהם בגוגל (Search Console):{" "}
          <span className="font-semibold tabular-nums text-[#172a32]">
            {formatNum(search.totals.keywords)}
          </span>
          {search.prev != null && (
            <span className="text-slate-500">
              {" "}
              ({deltaLabel(search.totals.keywords, search.prev.keywords) ?? "ללא שינוי"})
            </span>
          )}
        </p>
      )}

      <p className="rounded-lg bg-slate-50 px-4 py-3 text-xs leading-relaxed text-slate-500">
        {search
          ? "קליקים וחשיפות הם נתוני אמת מ-Google Search Console של האתר — חשיפה = כמה פעמים האתר הוצג בתוצאות החיפוש, קליק = כניסה בפועל מתוך התוצאות. מיקומים, תנועה אורגנית משוערת, DR וקישורים מגיעים מ-Ahrefs והם הערכות של כלי חיצוני, לא מדידה באתר."
          : "לחודש זה אין נתוני Google Search Console מחוברים, ולכן כל המספרים כאן הם הערכות Ahrefs (כלי חיצוני) ולא מדידה בפועל של תנועה באתר."}
      </p>
    </div>
  );
}

export function KeywordsSlide({ snapshot }: { snapshot: SeoMonthlyShareSnapshot }) {
  const rows = snapshot.keywords.slice(0, 20);
  const withSearchData = rows.some((k) => k.impressions != null || k.clicks != null);
  const comparedToBase = rows.some((k) => k.position != null && k.basePosition != null);
  const half = Math.ceil(rows.length / 2);
  const columns = rows.length > 10 ? [rows.slice(0, half), rows.slice(half)] : [rows];
  const grid = withSearchData
    ? "grid-cols-[5rem_1fr_4.2rem_3.4rem]"
    : "grid-cols-[5rem_1fr_5.6rem]";

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-3xl font-bold md:text-4xl">ביטויים מרכזיים</h2>
        <p className="mt-2 text-slate-600">
          {withSearchData
            ? `Top ${rows.length} ביטויים לפי חשיפות וקליקים בגוגל · מקור: Google Search Console`
            : `${rows.length} הביטויים במיקומים הגבוהים ביותר ברשימת המעקב · מקור: Ahrefs`}
        </p>
      </div>
      <div className={cn("grid gap-x-8 gap-y-1", columns.length > 1 && "md:grid-cols-2")}>
        {columns.map((col, ci) => (
          <div key={ci} className="space-y-1">
            <div
              className={cn(
                "grid items-end gap-2 border-b border-slate-300 pb-1.5 text-[11px] font-semibold text-slate-500",
                grid,
              )}
            >
              <span>מיקום בגוגל</span>
              <span>ביטוי חיפוש</span>
              <span className="text-left">{withSearchData ? "חשיפות" : "נפח חיפוש"}</span>
              {withSearchData && <span className="text-left">קליקים</span>}
            </div>
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
                  className={cn("grid items-center gap-2 border-b border-slate-200 py-1.5", grid)}
                >
                  <span className="font-mono text-xs font-semibold text-[#0f766e]">
                    {kw.position != null ? `#${kw.position}` : "—"}
                  </span>
                  <span className="truncate text-sm" title={kw.keyword}>
                    {kw.keyword}
                    {posChange != null && posChange !== 0 && (
                      <span
                        className={cn(
                          "mr-1.5 text-[10px] font-semibold tabular-nums",
                          posChange > 0 ? "text-emerald-700" : "text-rose-700",
                        )}
                      >
                        {posChange > 0 ? "↑" : "↓"}
                        {Math.abs(posChange)}
                      </span>
                    )}
                  </span>
                  <span className="text-left text-xs tabular-nums text-slate-600">
                    {kw.impressions != null
                      ? formatNum(kw.impressions)
                      : kw.volume != null
                        ? formatNum(kw.volume)
                        : "—"}
                  </span>
                  {withSearchData && (
                    <span
                      className={cn(
                        "text-left text-xs font-semibold tabular-nums",
                        kw.clicks ? "text-[#0f766e]" : "text-slate-400",
                      )}
                    >
                      {kw.clicks != null ? formatNum(kw.clicks) : "—"}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <p className="rounded-lg bg-slate-50 px-4 py-3 text-xs leading-relaxed text-slate-500">
        <span className="font-semibold text-slate-600">מיקום בגוגל</span> — המקום של האתר בתוצאות
        החיפוש האורגניות לביטוי (‎#1 = ראשון בעמוד הראשון).{" "}
        {withSearchData ? (
          <>
            <span className="font-semibold text-slate-600">חשיפות</span> — כמה פעמים האתר הוצג
            בתוצאות לביטוי הזה החודש,{" "}
            <span className="font-semibold text-slate-600">קליקים</span> — כמה גולשים נכנסו בפועל
            מהתוצאה (נתוני Google Search Console, ולא כלל הכניסות לאתר).
          </>
        ) : (
          <>
            <span className="font-semibold text-slate-600">נפח חיפוש</span> — כמה פעמים בממוצע
            מחפשים את הביטוי בגוגל בחודש (הערכת Ahrefs לשוק כולו, לא תנועה שהגיעה לאתר).
          </>
        )}{" "}
        ↑/↓ מציין שינוי מיקום {comparedToBase ? "מאז תחילת הקידום" : "מול החודש הקודם"}.
      </p>
    </div>
  );
}

export function SummarySlide({ snapshot }: { snapshot: SeoMonthlyShareSnapshot }) {
  const narrative = buildSeoPerformanceSummary(snapshot);
  return (
    <div className="max-w-3xl space-y-6">
      <h2 className="text-3xl font-bold md:text-4xl">סיכום ומבט קדימה</h2>
      <p className="text-xl leading-relaxed text-slate-700 md:text-2xl">{narrative}</p>
    </div>
  );
}

export function OnsiteSlide({ snapshot }: { snapshot: SeoMonthlyShareSnapshot }) {
  const unique = dedupeBy(snapshot.work.onsite, (item) => dedupeKey(item.title));
  const items = unique.slice(0, 10);
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold md:text-4xl">עבודה באתר</h2>
        <p className="mt-2 text-slate-600">{unique.length} פעולות</p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {items.map((item) => (
          <div key={item.id} className="border-r-2 border-[#0f766e]/60 pr-4">
            <p className="text-[11px] font-semibold tracking-wide text-[#0f766e]">
              {onsiteKindLabel(item.kind)}
            </p>
            {item.url ? (
              <a
                href={item.url}
                target="_blank"
                rel="noreferrer"
                className="mt-1 block text-base font-medium leading-snug text-[#0f766e] hover:underline"
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
        <p className="text-xs text-slate-500">ועוד {unique.length - items.length} פעולות</p>
      )}
    </div>
  );
}

export function ArticlesSlide({ snapshot }: { snapshot: SeoMonthlyShareSnapshot }) {
  const unique = dedupeBy(snapshot.work.articles, (item) => dedupeKey(item.title));
  const items = unique.slice(0, 8);
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-3xl font-bold md:text-4xl">מאמרים שכתבנו</h2>
        <p className="mt-2 text-slate-600">{unique.length} מאמרים · לחיצה פותחת את המאמר</p>
      </div>
      <div className="space-y-2.5">
        {items.map((item, i) => (
          <div key={item.id} className="flex items-start gap-3 border-b border-slate-200 pb-2.5">
            <span className="mt-1 font-mono text-xs text-[#0f766e]">
              {String(i + 1).padStart(2, "0")}
            </span>
            <div className="min-w-0 flex-1">
              {item.url ? (
                <a
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  className="group inline-flex items-start gap-1.5 text-lg font-semibold leading-snug text-[#0f766e]"
                >
                  <span className="underline decoration-[#0f766e]/40 underline-offset-4 group-hover:decoration-[#0f766e]">
                    {item.title}
                  </span>
                  <ExternalLink className="mt-1.5 h-3.5 w-3.5 shrink-0" />
                </a>
              ) : (
                <p className="text-lg font-semibold leading-snug">{item.title}</p>
              )}
              {item.topic && <p className="mt-0.5 text-sm text-slate-500">{item.topic}</p>}
            </div>
          </div>
        ))}
      </div>
      {unique.length > items.length && (
        <p className="text-xs text-slate-500">ועוד {unique.length - items.length} מאמרים</p>
      )}
    </div>
  );
}

export function LinksSlide({ snapshot }: { snapshot: SeoMonthlyShareSnapshot }) {
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
        <p className="mt-2 text-slate-600">
          {unique.length} קישורים{spansMonths ? " בשלושת החודשים האחרונים" : " החודש"}
        </p>
      </div>
      <div className={cn("grid gap-x-8 gap-y-4", spansMonths && "md:grid-cols-3")}>
        {groups.map(([monthLabel, links]) => (
          <div key={monthLabel} className="space-y-1.5">
            {spansMonths && (
              <p className="text-[11px] font-semibold tracking-wide text-[#0f766e]">{monthLabel}</p>
            )}
            {links.slice(0, spansMonths ? 6 : 10).map((link) => (
              <div key={link.id} className="border-b border-slate-200 py-1.5">
                <a
                  href={link.url}
                  target="_blank"
                  rel="noreferrer"
                  className="block text-sm leading-snug text-[#0f766e] underline decoration-[#0f766e]/40 underline-offset-4"
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
                <p className="mt-0.5 truncate text-[11px] text-slate-500" dir="ltr">
                  {hostOf(link.url)}
                </p>
              </div>
            ))}
            {links.length > (spansMonths ? 6 : 10) && (
              <p className="text-[11px] text-slate-500">
                ועוד {links.length - (spansMonths ? 6 : 10)}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function ClosingSlide({ snapshot }: { snapshot: SeoMonthlyShareSnapshot }) {
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
        <p className="mt-3 text-lg text-slate-600">
          {snapshot.clientName} · {snapshot.monthLabel}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
        {counts.map((c) => (
          <div key={c.label}>
            <p className="text-4xl font-extrabold tabular-nums text-[#0f766e] md:text-5xl">
              {c.value}
            </p>
            <p className="mt-2 text-sm text-slate-600">{c.label}</p>
          </div>
        ))}
      </div>
      <p className="text-sm font-semibold tracking-[0.18em] text-[#0f766e]">AIOS · דוח SEO</p>
    </div>
  );
}
