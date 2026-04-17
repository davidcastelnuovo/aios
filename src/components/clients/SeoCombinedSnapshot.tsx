import { forwardRef, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserIntegrations } from "@/hooks/useUserIntegrations";
import { format } from "date-fns";

interface Props {
  tableId: string;
  tableName: string;
}

function fmt(num: number | null | undefined): string {
  if (num == null || isNaN(Number(num))) return "—";
  const n = Number(num);
  return n.toLocaleString();
}

function normalizeDomain(value?: string) {
  return String(value || "")
    .replace(/^sc-domain:/, "")
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/+$/, "")
    .toLowerCase();
}

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: 12,
  background: "#ffffff",
};
const thStyle: React.CSSProperties = {
  padding: "8px 10px",
  textAlign: "right",
  fontWeight: 700,
  background: "#f3f4f6",
  borderBottom: "1px solid #e5e7eb",
  color: "#1f2937",
  fontSize: 11,
};
const tdStyle: React.CSSProperties = {
  padding: "8px 10px",
  textAlign: "right",
  borderBottom: "1px solid #f3f4f6",
  color: "#1f2937",
};

function getVal(obj: Record<string, any>, ...keys: string[]): number | undefined {
  for (const k of keys) {
    if (obj?.[k] !== undefined && obj?.[k] !== null) return obj[k];
  }
  return undefined;
}

/**
 * SEO snapshot — mirrors SeoDashboardView design:
 * - 8 metric cards (DR, Organic Traffic, Top3/Top10/Total Keywords, Referring Domains, Backlinks)
 * - GA organic sessions take priority for "Organic Traffic" when available
 * - Inline change indicator vs previous month
 * - Ahrefs Top 10 + GSC Top 10 keyword tables
 */
export const SeoCombinedSnapshot = forwardRef<HTMLDivElement, Props>(
  ({ tableId, tableName }, ref) => {
    // Table meta
    const { data: tableMeta } = useQuery({
      queryKey: ["seo-snapshot-table-meta", tableId],
      queryFn: async () => {
        const { data, error } = await supabase
          .from("crm_tables")
          .select("id, tenant_id, client_id, integration_settings")
          .eq("id", tableId)
          .maybeSingle();
        if (error) throw error;
        return data as {
          tenant_id: string;
          client_id: string | null;
          integration_settings?: any;
        } | null;
      },
      staleTime: 5 * 60 * 1000,
    });

    const tenantId = tableMeta?.tenant_id || "";
    const settings = tableMeta?.integration_settings || {};
    const clientId =
      (settings?.clientId as string | undefined) ||
      (settings?.client_id as string | undefined) ||
      tableMeta?.client_id ||
      "";
    const targetDomain = (settings?.targetDomain as string | undefined) || "";
    const linkedGaTableId = (settings?.linkedGaTableId as string | undefined) || "";

    // Latest Ahrefs report
    const { data: latestSeoReport } = useQuery({
      queryKey: ["seo-snapshot-ahrefs", tenantId, clientId, targetDomain],
      queryFn: async () => {
        if (!tenantId) return null;
        let query = supabase
          .from("ahrefs_reports")
          .select("domain, report_date, report_data")
          .eq("tenant_id", tenantId)
          .order("report_date", { ascending: false, nullsFirst: false })
          .order("received_at", { ascending: false })
          .limit(1);
        if (clientId) query = query.eq("client_id", clientId);
        if (targetDomain) query = query.eq("domain", targetDomain);
        const { data, error } = await query.maybeSingle();
        if (error) return null;
        return data as { domain: string; report_date: string | null; report_data: any } | null;
      },
      enabled: !!tenantId,
      staleTime: 5 * 60 * 1000,
    });

    // GA records — for organic traffic override
    const { data: gaRecords = [] } = useQuery({
      queryKey: ["seo-snapshot-ga-records", linkedGaTableId],
      queryFn: async () => {
        if (!linkedGaTableId) return [];
        const { data, error } = await supabase
          .from("crm_records")
          .select("data")
          .eq("table_id", linkedGaTableId)
          .limit(5000);
        if (error) return [];
        return data || [];
      },
      enabled: !!linkedGaTableId,
      staleTime: 5 * 60 * 1000,
    });

    // GSC integration (per-user/shared)
    const { data: gscIntegrations = [] } = useUserIntegrations(
      tenantId,
      "google_search_console",
    );
    const gscIntegration = gscIntegrations[0] || null;
    const gscSettings = (gscIntegration?.settings as any) || {};
    const gscClientSites = gscSettings?.client_sites || {};

    const { data: availableSites = [] } = useQuery({
      queryKey: ["seo-snapshot-gsc-sites", gscIntegration?.id],
      queryFn: async () => {
        if (!gscIntegration?.id) return [] as { siteUrl: string }[];
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return [];
        const response = await supabase.functions.invoke(
          "google-search-console-auth?action=get_sites",
          {
            body: { integrationId: gscIntegration.id },
            headers: { Authorization: `Bearer ${session.access_token}` },
          },
        );
        if (response.error) return [];
        return Array.isArray(response.data?.sites) ? response.data.sites : [];
      },
      enabled: !!gscIntegration?.id,
      staleTime: 5 * 60 * 1000,
    });

    const effectiveSiteUrl = useMemo(() => {
      const persisted = clientId ? gscClientSites[clientId] : "";
      if (persisted) return persisted as string;
      const normDomain = normalizeDomain(targetDomain || latestSeoReport?.domain);
      if (normDomain) {
        const match = availableSites.find((s: any) => {
          const ns = normalizeDomain(s.siteUrl);
          return ns === normDomain || ns.includes(normDomain) || normDomain.includes(ns);
        });
        if (match) return match.siteUrl as string;
      }
      if (availableSites.length === 1) return (availableSites[0] as any).siteUrl as string;
      return "";
    }, [clientId, gscClientSites, targetDomain, latestSeoReport?.domain, availableSites]);

    // GSC keywords
    const { data: gscData = [] } = useQuery({
      queryKey: ["seo-snapshot-gsc-data", gscIntegration?.id, effectiveSiteUrl],
      queryFn: async () => {
        if (!gscIntegration?.id || !effectiveSiteUrl) return [];
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return [];
        const response = await supabase.functions.invoke("fetch-gsc-data", {
          body: {
            integrationId: gscIntegration.id,
            siteUrl: effectiveSiteUrl,
            keywords: [],
          },
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (response.error) return [];
        return Array.isArray(response.data?.rows) ? response.data.rows : [];
      },
      enabled: !!gscIntegration?.id && !!effectiveSiteUrl,
      staleTime: 5 * 60 * 1000,
    });

    // GA organic — current/previous month from channel_group records
    const { gaOrganicCurrent, gaOrganicPrev } = useMemo(() => {
      if (!gaRecords || gaRecords.length === 0) {
        return { gaOrganicCurrent: null as number | null, gaOrganicPrev: null as number | null };
      }
      const now = new Date();
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}`;

      const filterOrganic = (r: any) => {
        if (r.data?.report_type !== "channel_group") return false;
        const cg = String(r.data?.channel_group || "").toLowerCase();
        return cg === "organic search" || cg.includes("organic search");
      };

      const sumFor = (monthKey: string) =>
        gaRecords
          .filter(filterOrganic)
          .filter((r: any) => {
            const d = r.data?.date;
            if (!d) return monthKey === currentMonth; // legacy dateless rows count toward current
            return String(d).startsWith(monthKey);
          })
          .reduce(
            (sum: number, r: any) =>
              sum + (Number(r.data?.users) || Number(r.data?.sessions) || 0),
            0,
          );

      const cur = sumFor(currentMonth);
      const prv = sumFor(prevMonth);
      return {
        gaOrganicCurrent: cur > 0 ? cur : null,
        gaOrganicPrev: prv > 0 ? prv : null,
      };
    }, [gaRecords]);

    const reportData = (latestSeoReport?.report_data as any) || {};
    const snapshot = reportData?.snapshot || {};
    const snapshotPrevMonth =
      reportData?.snapshot_prev_month || reportData?.snapshot_prev || {};

    // Build the 8-metric grid (matches SeoSnapshotCards order)
    const metrics = useMemo(() => {
      const defs = [
        { keys: ["domain_rating", "dr"], label: "דירוג דומיין (DR)", icon: "🏆", isOrganic: false },
        { keys: ["org_traffic"], label: "תנועה אורגנית", icon: "📈", isOrganic: true },
        { keys: ["org_keywords_top3"], label: "מילות מפתח (Top 3)", icon: "🥇", isOrganic: false },
        { keys: ["org_keywords_top10"], label: "מילות מפתח (Top 10)", icon: "🔟", isOrganic: false },
        { keys: ["org_keywords_total"], label: "סה״כ מילות מפתח", icon: "🔑", isOrganic: false },
        { keys: ["referring_domains", "referring_domains_all_time"], label: "דומיינים מפנים", icon: "🔗", isOrganic: false },
        { keys: ["backlinks_live"], label: "קישורים נכנסים (פעילים)", icon: "🌐", isOrganic: false },
        { keys: ["backlinks_all_time"], label: "קישורים נכנסים (כולל)", icon: "📊", isOrganic: false },
      ];
      return defs
        .map((m) => {
          if (m.isOrganic && gaOrganicCurrent != null) {
            return {
              ...m,
              value: gaOrganicCurrent,
              prevValue: gaOrganicPrev ?? undefined,
              gaSource: true,
            };
          }
          return {
            ...m,
            value: getVal(snapshot, ...m.keys),
            prevValue: getVal(snapshotPrevMonth, ...m.keys),
            gaSource: false,
          };
        })
        .filter((m) => m.value !== undefined);
    }, [snapshot, snapshotPrevMonth, gaOrganicCurrent, gaOrganicPrev]);

    // Build Ahrefs Top 10
    const ahrefsTop10 = useMemo(() => {
      const organic = Array.isArray(reportData.organic_keywords) ? reportData.organic_keywords : [];
      const tracked = Array.isArray(reportData.tracked_keywords) ? reportData.tracked_keywords : [];
      const map = new Map<string, any>();
      for (const kw of [...tracked, ...organic]) {
        const key = String(kw.keyword || "").toLowerCase().trim();
        if (!key) continue;
        const prev = map.get(key);
        const pos = kw.position ?? kw.best_position ?? null;
        const prevPos = prev?.position ?? prev?.best_position ?? null;
        if (!prev || (pos != null && (prevPos == null || pos < prevPos))) {
          map.set(key, kw);
        }
      }
      return Array.from(map.values())
        .map((kw: any) => ({
          keyword: kw.keyword,
          position: kw.position ?? kw.best_position ?? null,
          position_prev_month: kw.position_prev_month ?? null,
          volume: kw.volume ?? kw.search_volume ?? null,
          traffic: kw.traffic ?? kw.sum_traffic ?? null,
        }))
        .filter((k) => k.position != null && k.position <= 10)
        .sort((a, b) => (a.position || 999) - (b.position || 999))
        .slice(0, 10);
    }, [reportData]);

    // Build GSC Top 10 (first page = position <= 10), sorted by clicks
    const gscTop10 = useMemo(() => {
      return [...gscData]
        .filter((r: any) => r.position != null && r.position <= 10)
        .sort((a: any, b: any) => b.clicks - a.clicks)
        .slice(0, 10);
    }, [gscData]);

    return (
      <div
        ref={ref}
        style={{
          width: 800,
          padding: 24,
          background: "#ffffff",
          fontFamily: "Arial, Helvetica, sans-serif",
          direction: "rtl",
          color: "#0A1526",
        }}
      >
        {/* Header */}
        <div style={{ marginBottom: 16, borderBottom: "2px solid #3FD9B0", paddingBottom: 12 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: "#0A1526" }}>
            📊 {tableName}
          </h2>
          <p style={{ fontSize: 12, color: "#5b6b80", margin: "4px 0 0" }}>
            דוח SEO •{" "}
            {latestSeoReport?.domain || targetDomain || ""}
            {latestSeoReport?.report_date
              ? ` • ${format(new Date(latestSeoReport.report_date), "MM/yyyy")}`
              : ""}
          </p>
        </div>

        {/* 8 Metric Cards — 4 columns × 2 rows */}
        {metrics.length > 0 && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 10,
              marginBottom: 20,
            }}
          >
            {metrics.map((m, idx) => (
              <MetricCard
                key={idx}
                icon={m.icon}
                label={m.label}
                value={fmt(m.value as number)}
                prevValue={m.prevValue as number | undefined}
                current={m.value as number}
                gaSource={(m as any).gaSource}
              />
            ))}
          </div>
        )}

        {/* Ahrefs Top 10 */}
        <Section title="🏆 Ahrefs — Top 10 ביטויים מובילים">
          {ahrefsTop10.length > 0 ? (
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>#</th>
                  <th style={thStyle}>ביטוי</th>
                  <th style={thStyle}>מיקום</th>
                  <th style={thStyle}>שינוי חודשי</th>
                  <th style={thStyle}>נפח</th>
                  <th style={thStyle}>תנועה</th>
                </tr>
              </thead>
              <tbody>
                {ahrefsTop10.map((kw: any, i: number) => {
                  const change =
                    kw.position_prev_month != null && kw.position != null
                      ? kw.position_prev_month - kw.position
                      : null;
                  return (
                    <tr key={i} style={{ background: i % 2 === 0 ? "#ffffff" : "#f9fafb" }}>
                      <td style={tdStyle}>{i + 1}</td>
                      <td style={{ ...tdStyle, fontWeight: 600 }}>{kw.keyword}</td>
                      <td style={tdStyle}>{kw.position}</td>
                      <td
                        style={{
                          ...tdStyle,
                          color:
                            change == null
                              ? "#9ca3af"
                              : change > 0
                              ? "#10b981"
                              : change < 0
                              ? "#ef4444"
                              : "#6b7280",
                        }}
                      >
                        {change == null
                          ? "—"
                          : change > 0
                          ? `▲ ${change}`
                          : change < 0
                          ? `▼ ${Math.abs(change)}`
                          : "—"}
                      </td>
                      <td style={tdStyle}>{kw.volume ? fmt(Number(kw.volume)) : "—"}</td>
                      <td style={tdStyle}>{kw.traffic ? fmt(Number(kw.traffic)) : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <EmptyRow text="אין ביטויים במיקומים 1-10 בדוח האחרון" />
          )}
        </Section>

        {/* GSC Top 10 */}
        <Section title="🔍 Google Search Console — Top 10 עמוד ראשון">
          {gscTop10.length > 0 ? (
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>#</th>
                  <th style={thStyle}>שאילתה</th>
                  <th style={thStyle}>מיקום</th>
                  <th style={thStyle}>קליקים</th>
                  <th style={thStyle}>חשיפות</th>
                  <th style={thStyle}>CTR</th>
                </tr>
              </thead>
              <tbody>
                {gscTop10.map((kw: any, i: number) => (
                  <tr key={i} style={{ background: i % 2 === 0 ? "#ffffff" : "#f9fafb" }}>
                    <td style={tdStyle}>{i + 1}</td>
                    <td style={{ ...tdStyle, fontWeight: 600 }}>{kw.keyword}</td>
                    <td style={tdStyle}>{Number(kw.position).toFixed(1)}</td>
                    <td style={tdStyle}>{fmt(Number(kw.clicks || 0))}</td>
                    <td style={tdStyle}>{fmt(Number(kw.impressions || 0))}</td>
                    <td style={tdStyle}>
                      {kw.ctr != null ? `${(Number(kw.ctr) * 100).toFixed(1)}%` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <EmptyRow
              text={
                !gscIntegration
                  ? "Google Search Console לא מחובר"
                  : !effectiveSiteUrl
                  ? "לא נבחר נכס Search Console עבור לקוח זה"
                  : "אין שאילתות בעמוד הראשון בנתונים האחרונים"
              }
            />
          )}
        </Section>
      </div>
    );
  },
);

SeoCombinedSnapshot.displayName = "SeoCombinedSnapshot";

function MetricCard({
  icon,
  label,
  value,
  prevValue,
  current,
  gaSource,
}: {
  icon: string;
  label: string;
  value: string;
  prevValue?: number;
  current?: number;
  gaSource?: boolean;
}) {
  let changeNode: React.ReactNode = null;
  if (prevValue != null && current != null && !isNaN(Number(current))) {
    const diff = Number(current) - Number(prevValue);
    if (diff === 0) {
      changeNode = <span style={{ color: "#6b7280" }}>—</span>;
    } else {
      const isPositive = diff > 0;
      changeNode = (
        <span style={{ color: isPositive ? "#10b981" : "#ef4444", fontWeight: 600 }}>
          {isPositive ? "▲" : "▼"} {Math.abs(diff).toLocaleString()}
        </span>
      );
    }
  }

  return (
    <div
      style={{
        padding: "12px 10px",
        background: "linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)",
        border: "1px solid #d1fae5",
        borderRadius: 8,
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: 16, marginBottom: 2 }}>{icon}</div>
      <div style={{ fontSize: 10, color: "#5b6b80", marginBottom: 4, lineHeight: 1.3 }}>
        {label}
        {gaSource && (
          <span style={{ color: "#10b981", fontWeight: 600, marginRight: 3 }}>
            {" "}
            (Analytics)
          </span>
        )}
      </div>
      <div style={{ fontSize: 18, fontWeight: 700, color: "#0A1526", marginBottom: 2 }}>
        {value}
      </div>
      {changeNode && <div style={{ fontSize: 10 }}>{changeNode}</div>}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <h3
        style={{
          fontSize: 14,
          fontWeight: 700,
          margin: "0 0 8px",
          color: "#0A1526",
          paddingBottom: 6,
          borderBottom: "1px solid #e5e7eb",
        }}
      >
        {title}
      </h3>
      <div style={{ overflow: "hidden", border: "1px solid #e5e7eb", borderRadius: 6 }}>
        {children}
      </div>
    </div>
  );
}

function EmptyRow({ text }: { text: string }) {
  return (
    <div style={{ textAlign: "center", padding: 24, color: "#9ca3af", fontSize: 12 }}>
      {text}
    </div>
  );
}
