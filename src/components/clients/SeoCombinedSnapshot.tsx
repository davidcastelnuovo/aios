import { forwardRef, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserIntegrations } from "@/hooks/useUserIntegrations";
import { format } from "date-fns";

interface Props {
  tableId: string;
  tableName: string;
}

function formatCompactNumber(num: number): string {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return String(num);
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

/**
 * Combined SEO snapshot: Ahrefs Top 10 + GSC Top 10 stacked vertically.
 * Fetches data directly (no UI side-effects) for fast, deterministic capture.
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
    const clientId =
      (tableMeta?.integration_settings?.clientId as string | undefined) ||
      (tableMeta?.integration_settings?.client_id as string | undefined) ||
      tableMeta?.client_id ||
      "";
    const targetDomain = (tableMeta?.integration_settings?.targetDomain as string | undefined) || "";

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

    // GSC integration (per-user/shared)
    const { data: gscIntegrations = [] } = useUserIntegrations(
      tenantId,
      "google_search_console",
    );
    const gscIntegration = gscIntegrations[0] || null;
    const gscSettings = (gscIntegration?.settings as any) || {};
    const gscClientSites = gscSettings?.client_sites || {};

    // Resolve GSC site URL: per-client mapping → match by domain → single property fallback
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

    // Build Ahrefs Top 10
    const ahrefsTop10 = useMemo(() => {
      const rd = latestSeoReport?.report_data || {};
      const organic = Array.isArray(rd.organic_keywords) ? rd.organic_keywords : [];
      const tracked = Array.isArray(rd.tracked_keywords) ? rd.tracked_keywords : [];
      const map = new Map<string, any>();
      for (const kw of [...tracked, ...organic]) {
        const key = String(kw.keyword || "").toLowerCase().trim();
        if (!key) continue;
        const prev = map.get(key);
        const pos = kw.position ?? kw.best_position ?? null;
        const prevPos = prev?.position ?? prev?.best_position ?? null;
        if (
          !prev ||
          (pos != null && (prevPos == null || pos < prevPos))
        ) {
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
    }, [latestSeoReport]);

    // Build GSC Top 10 (first page = position <= 10)
    const gscTop10 = useMemo(() => {
      return [...gscData]
        .filter((r: any) => r.position != null && r.position <= 10)
        .sort((a: any, b: any) => b.clicks - a.clicks)
        .slice(0, 10);
    }, [gscData]);

    const snapshot = (latestSeoReport?.report_data as any)?.snapshot || {};

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

        {/* Snapshot metrics */}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
          <MetricCard title="תנועה אורגנית" value={formatCompactNumber(Number(snapshot.org_traffic ?? 0))} />
          <MetricCard title="Top 3" value={formatCompactNumber(Number(snapshot.org_keywords_top3 ?? 0))} />
          <MetricCard title="Top 10" value={formatCompactNumber(Number(snapshot.org_keywords_top10 ?? 0))} />
          <MetricCard title="סה״כ ביטויים" value={formatCompactNumber(Number(snapshot.org_keywords_total ?? 0))} />
        </div>

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
                      <td style={tdStyle}>
                        {kw.volume ? formatCompactNumber(Number(kw.volume)) : "—"}
                      </td>
                      <td style={tdStyle}>
                        {kw.traffic ? formatCompactNumber(Number(kw.traffic)) : "—"}
                      </td>
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
                    <td style={tdStyle}>{formatCompactNumber(Number(kw.clicks || 0))}</td>
                    <td style={tdStyle}>{formatCompactNumber(Number(kw.impressions || 0))}</td>
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

function MetricCard({ title, value }: { title: string; value: string }) {
  return (
    <div
      style={{
        flex: "1 1 160px",
        minWidth: 160,
        padding: "12px 14px",
        background: "linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)",
        border: "1px solid #d1fae5",
        borderRadius: 8,
      }}
    >
      <div style={{ fontSize: 11, color: "#5b6b80", marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: "#0A1526" }}>{value}</div>
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
