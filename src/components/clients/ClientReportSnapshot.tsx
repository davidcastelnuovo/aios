import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays } from "date-fns";
import { forwardRef, useMemo } from "react";

interface Props {
  tableId: string;
  tableName: string;
}

export const ClientReportSnapshot = forwardRef<HTMLDivElement, Props>(
  ({ tableId, tableName }, ref) => {
    const { data: tableMeta } = useQuery({
      queryKey: ["snapshot-table-meta", tableId],
      queryFn: async () => {
        const { data, error } = await supabase
          .from("crm_tables")
          .select("id, integration_type, integration_settings")
          .eq("id", tableId)
          .maybeSingle();

        if (error) throw error;
        return data as { integration_type: string | null; integration_settings?: any } | null;
      },
      staleTime: 5 * 60 * 1000,
    });

    // Fetch fields
    const { data: fields } = useQuery({
      queryKey: ["snapshot-fields", tableId],
      queryFn: async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return [];
        const res = await supabase.functions.invoke(`crm-fields?table_id=${tableId}`, { method: "GET" });
        const f = (res.data as any)?.fields || [];
        return (f as any[]).sort((a: any, b: any) => a.position - b.position);
      },
      staleTime: 5 * 60 * 1000,
    });

    // Fetch records
    const { data: records } = useQuery({
      queryKey: ["snapshot-records", tableId],
      queryFn: async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return [];
        const params = new URLSearchParams({ table_id: tableId });
        const res = await supabase.functions.invoke(`crm-records?${params.toString()}`, { method: "GET" });
        return Array.isArray(res.data) ? res.data as any[] : [];
      },
      staleTime: 5 * 60 * 1000,
    });

    const filteredRecords = useMemo(() => {
      if (!records) return [];
      const today = new Date();
      const start = format(subDays(today, 6), "yyyy-MM-dd");
      const end = format(today, "yyyy-MM-dd");

      return records.filter((r: any) => {
        const d = r.data?.date || r.data?.date_start;
        if (!d) return true;
        return d >= start && d <= end;
      });
    }, [records]);

    const isAdsTable = isAdsPlatform(tableMeta?.integration_type);

    const adsSummary = useMemo(() => {
      if (!isAdsTable) return null;

      let spend = 0;
      let impressions = 0;
      let clicks = 0;
      let leads = 0;
      let purchases = 0;
      let revenue = 0;
      let addToCart = 0;

      const campaignMap: Record<string, any> = {};

      filteredRecords.forEach((record: any) => {
        const data = record.data || {};
        const campaignName = data.campaign_name || data.campaign || "ללא שם";

        spend += getSpendFromData(data);
        impressions += Number(data.impressions) || 0;
        clicks += Number(data.clicks) || 0;
        leads += getLeadsFromData(data);
        purchases += getPurchasesFromData(data);
        revenue += getRevenueFromData(data);
        addToCart += getAddToCartFromData(data);

        if (!campaignMap[campaignName]) {
          campaignMap[campaignName] = {
            name: campaignName,
            spend: 0,
            impressions: 0,
            clicks: 0,
            leads: 0,
            purchases: 0,
            revenue: 0,
            addToCart: 0,
          };
        }

        campaignMap[campaignName].spend += getSpendFromData(data);
        campaignMap[campaignName].impressions += Number(data.impressions) || 0;
        campaignMap[campaignName].clicks += Number(data.clicks) || 0;
        campaignMap[campaignName].leads += getLeadsFromData(data);
        campaignMap[campaignName].purchases += getPurchasesFromData(data);
        campaignMap[campaignName].revenue += getRevenueFromData(data);
        campaignMap[campaignName].addToCart += getAddToCartFromData(data);
      });

      const allCampaigns = Object.values(campaignMap).sort((a: any, b: any) => b.spend - a.spend);

      const ecommerceCampaigns = allCampaigns.filter((campaign: any) =>
        (campaign.purchases > 0 || campaign.revenue > 0) ||
        (campaign.addToCart > 0 && !(campaign.leads > 0 && campaign.purchases === 0 && campaign.revenue === 0))
      );

      const leadCampaigns = allCampaigns.filter((campaign: any) =>
        (campaign.leads > 0 && campaign.purchases === 0 && campaign.revenue === 0) ||
        (campaign.leads === 0 && campaign.purchases === 0 && campaign.revenue === 0 && campaign.addToCart === 0)
      );

      return {
        spend,
        impressions,
        clicks,
        leads,
        purchases,
        revenue,
        addToCart,
        roas: spend > 0 ? revenue / spend : 0,
        cpl: leads > 0 ? spend / leads : 0,
        ecommerceCampaigns,
        leadCampaigns,
        hasEcommerce: ecommerceCampaigns.length > 0 || revenue > 0 || purchases > 0 || addToCart > 0,
        hasLeads: leadCampaigns.length > 0 || leads > 0,
      };
    }, [filteredRecords, isAdsTable]);

    // Compute totals for numeric fields
    const numericFields = (fields || []).filter((f: any) =>
      f.type === "number" || filteredRecords.some((r) => {
        const v = r.data?.[f.key];
        return v !== null && v !== undefined && v !== "" && !isNaN(Number(v));
      })
    );

    const totals: Record<string, number> = {};
    for (const f of numericFields) {
      totals[f.key] = filteredRecords.reduce((sum: number, r: any) => {
        const v = Number(r.data?.[f.key]);
        return sum + (isNaN(v) ? 0 : v);
      }, 0);
    }

    const visibleFields = (fields || []).filter((f: any) => !["date", "date_start", "report_type"].includes(f.key)).slice(0, 6);

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
            7 ימים אחרונים • {format(subDays(new Date(), 6), "dd/MM")} - {format(new Date(), "dd/MM/yyyy")}
          </p>
        </div>

        {adsSummary ? (
          <>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
              <SnapshotMetricCard title="הוצאה כוללת" value={formatCurrency(adsSummary.spend)} />
              <SnapshotMetricCard title="חשיפות" value={formatCompactNumber(adsSummary.impressions)} />
              <SnapshotMetricCard title="קליקים" value={formatCompactNumber(adsSummary.clicks)} />
              {adsSummary.hasLeads && (
                <>
                  <SnapshotMetricCard title="לידים" value={formatCompactNumber(adsSummary.leads)} />
                  <SnapshotMetricCard title="עלות לליד" value={formatCurrency(adsSummary.cpl)} />
                </>
              )}
              {adsSummary.hasEcommerce && (
                <>
                  <SnapshotMetricCard title="הכנסות" value={formatCurrency(adsSummary.revenue)} />
                  <SnapshotMetricCard title="רכישות" value={formatCompactNumber(adsSummary.purchases)} />
                  <SnapshotMetricCard title="ROAS" value={adsSummary.roas.toFixed(2)} />
                </>
              )}
            </div>

            {adsSummary.ecommerceCampaigns.length > 0 && (
              <SnapshotSection title="קמפייני איקומרס">
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      <th style={thStyle}>קמפיין</th>
                      <th style={thStyle}>הוצאה</th>
                      <th style={thStyle}>חשיפות</th>
                      <th style={thStyle}>קליקים</th>
                      <th style={thStyle}>הוספות לסל</th>
                      <th style={thStyle}>רכישות</th>
                      <th style={thStyle}>הכנסות</th>
                      <th style={thStyle}>ROAS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {adsSummary.ecommerceCampaigns.slice(0, 8).map((campaign: any, index: number) => {
                      const roas = campaign.spend > 0 ? campaign.revenue / campaign.spend : 0;
                      return (
                        <tr key={`${campaign.name}-${index}`} style={{ background: index % 2 === 0 ? "#ffffff" : "#f9fafb" }}>
                          <td style={tdStyle}>{campaign.name}</td>
                          <td style={tdStyle}>{formatCurrency(campaign.spend)}</td>
                          <td style={tdStyle}>{formatCompactNumber(campaign.impressions)}</td>
                          <td style={tdStyle}>{formatCompactNumber(campaign.clicks)}</td>
                          <td style={tdStyle}>{formatCompactNumber(campaign.addToCart)}</td>
                          <td style={tdStyle}>{formatCompactNumber(campaign.purchases)}</td>
                          <td style={tdStyle}>{formatCurrency(campaign.revenue)}</td>
                          <td style={tdStyle}>{roas.toFixed(2)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </SnapshotSection>
            )}

            {adsSummary.leadCampaigns.length > 0 && (
              <SnapshotSection title="קמפייני לידים">
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      <th style={thStyle}>קמפיין</th>
                      <th style={thStyle}>הוצאה</th>
                      <th style={thStyle}>חשיפות</th>
                      <th style={thStyle}>קליקים</th>
                      <th style={thStyle}>לידים</th>
                      <th style={thStyle}>עלות לליד</th>
                    </tr>
                  </thead>
                  <tbody>
                    {adsSummary.leadCampaigns.slice(0, 8).map((campaign: any, index: number) => {
                      const cpl = campaign.leads > 0 ? campaign.spend / campaign.leads : 0;
                      return (
                        <tr key={`${campaign.name}-${index}`} style={{ background: index % 2 === 0 ? "#ffffff" : "#f9fafb" }}>
                          <td style={tdStyle}>{campaign.name}</td>
                          <td style={tdStyle}>{formatCurrency(campaign.spend)}</td>
                          <td style={tdStyle}>{formatCompactNumber(campaign.impressions)}</td>
                          <td style={tdStyle}>{formatCompactNumber(campaign.clicks)}</td>
                          <td style={tdStyle}>{formatCompactNumber(campaign.leads)}</td>
                          <td style={tdStyle}>{formatCurrency(cpl)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </SnapshotSection>
            )}
          </>
        ) : (
          visibleFields.length > 0 && (
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
            {visibleFields.map((f: any) => (
              <SnapshotMetricCard key={f.key} title={f.name} value={formatFieldNumber(totals[f.key] || 0, f.key)} />
            ))}
          </div>
          )
        )}

        {!adsSummary && filteredRecords.length > 0 && (fields || []).length > 0 && (
          <table
            style={tableStyle}
          >
            <thead>
              <tr>
                {(fields || []).filter((f: any) => ["date", "date_start"].includes(f.key)).length > 0 && (
                  <th style={thStyle}>תאריך</th>
                )}
                {visibleFields.map((f: any) => (
                  <th key={f.key} style={thStyle}>{f.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRecords.slice(0, 10).map((r: any, i: number) => (
                <tr key={r.id} style={{ background: i % 2 === 0 ? "#ffffff" : "#f9fafb" }}>
                    {(fields || []).filter((f: any) => ["date", "date_start"].includes(f.key)).length > 0 && (
                      <td style={tdStyle}>{r.data?.date || r.data?.date_start || "—"}</td>
                  )}
                  {visibleFields.map((f: any) => (
                    <td key={f.key} style={tdStyle}>
                        {formatCellValue(r.data?.[f.key], f.key)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {filteredRecords.length === 0 && (
          <div style={{ textAlign: "center", padding: 32, color: "#9ca3af" }}>
            אין נתונים לתקופה זו
          </div>
        )}
      </div>
    );
  }
);

ClientReportSnapshot.displayName = "ClientReportSnapshot";

const thStyle: React.CSSProperties = {
  padding: "8px 10px",
  textAlign: "right",
  borderBottom: "2px solid #e5e7eb",
  color: "#4b5563",
  fontWeight: 600,
  background: "#f3f4f6",
};

const tdStyle: React.CSSProperties = {
  padding: "6px 10px",
  textAlign: "right",
  borderBottom: "1px solid #f3f4f6",
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: 12,
};

function SnapshotMetricCard({ title, value }: { title: string; value: string }) {
  return (
    <div
      style={{
        flex: "1 1 120px",
        background: "#f0f4ff",
        borderRadius: 8,
        padding: "10px 14px",
        textAlign: "center",
        border: "1px solid #dbeafe",
      }}
    >
      <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: "#1e40af" }}>{value}</div>
    </div>
  );
}

function SnapshotSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: "#1f2937", marginBottom: 8 }}>{title}</div>
      {children}
    </div>
  );
}

function isAdsPlatform(source?: string | null): boolean {
  return ["facebook_insights", "facebook_ecommerce", "google_ads"].includes(source || "");
}

function getSpendFromData(data: any): number {
  return Number(data?.spend) || Number(data?.cost) || 0;
}

function getRevenueFromData(data: any): number {
  return Number(data?.purchase_value) || Number(data?.purchaseRevenue) || Number(data?.conversions_value) || Number(data?.conversion_value) || 0;
}

function getPurchasesFromData(data: any): number {
  return Number(data?.purchases) || Number(data?.ecommercePurchases) || Number(data?.transactions) || 0;
}

function getLeadsFromData(data: any): number {
  return (
    Number(data?.leads) ||
    Number(data?.conversions) ||
    Number(data?.website_leads) ||
    Number(data?.offsite_conversion) ||
    Number(data?.offsite_conversion_fb_pixel_lead) ||
    Number(data?.leadgen_grouped) ||
    Number(data?.lead) ||
    0
  );
}

function getAddToCartFromData(data: any): number {
  return Number(data?.add_to_cart) || Number(data?.addToCarts) || 0;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("he-IL", {
    style: "currency",
    currency: "ILS",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function formatCompactNumber(value: number): string {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return new Intl.NumberFormat("he-IL", { maximumFractionDigits: value % 1 === 0 ? 0 : 2 }).format(value || 0);
}

function formatFieldNumber(val: number, key: string): string {
  if (key.includes("cost") || key.includes("spend") || key.includes("budget") || key.includes("revenue")) {
    return `₪${val.toLocaleString("he-IL", { maximumFractionDigits: 0 })}`;
  }
  if (key.includes("rate") || key.includes("ctr") || key.includes("roas")) {
    return val.toFixed(2);
  }
  return val.toLocaleString("he-IL", { maximumFractionDigits: 0 });
}

function formatCellValue(val: any, key: string): string {
  if (val === null || val === undefined || val === "") return "—";
  const num = Number(val);
  if (!isNaN(num)) return formatFieldNumber(num, key);
  return String(val);
}
