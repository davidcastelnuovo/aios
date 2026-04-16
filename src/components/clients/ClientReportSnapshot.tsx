import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays } from "date-fns";
import { forwardRef } from "react";

interface Props {
  tableId: string;
  tableName: string;
}

export const ClientReportSnapshot = forwardRef<HTMLDivElement, Props>(
  ({ tableId, tableName }, ref) => {
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

    // Filter to last 7 days
    const filteredRecords = (() => {
      if (!records) return [];
      const today = new Date();
      const start = format(subDays(today, 6), "yyyy-MM-dd");
      const end = format(today, "yyyy-MM-dd");
      return records.filter((r) => {
        const d = r.data?.date;
        if (!d) return true;
        return d >= start && d <= end;
      });
    })();

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

    const visibleFields = (fields || []).filter((f: any) => f.key !== "date").slice(0, 6);

    return (
      <div
        ref={ref}
        style={{
          width: 800,
          padding: 24,
          background: "#ffffff",
          fontFamily: "Arial, Helvetica, sans-serif",
          direction: "rtl",
          color: "#1a1a2e",
        }}
      >
        {/* Header */}
        <div style={{ marginBottom: 16, borderBottom: "2px solid #3b82f6", paddingBottom: 12 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: "#1e40af" }}>
            📊 {tableName}
          </h2>
          <p style={{ fontSize: 12, color: "#6b7280", margin: "4px 0 0" }}>
            7 ימים אחרונים • {format(subDays(new Date(), 6), "dd/MM")} - {format(new Date(), "dd/MM/yyyy")}
          </p>
        </div>

        {/* Summary cards */}
        {visibleFields.length > 0 && (
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
            {visibleFields.map((f: any) => (
              <div
                key={f.key}
                style={{
                  flex: "1 1 120px",
                  background: "#f0f4ff",
                  borderRadius: 8,
                  padding: "10px 14px",
                  textAlign: "center",
                  border: "1px solid #dbeafe",
                }}
              >
                <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 4 }}>{f.name}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#1e40af" }}>
                  {formatNumber(totals[f.key] || 0, f.key)}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Table */}
        {filteredRecords.length > 0 && (fields || []).length > 0 && (
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: 12,
            }}
          >
            <thead>
              <tr>
                {(fields || []).filter((f: any) => f.key === "date").length > 0 && (
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
                  {(fields || []).filter((f: any) => f.key === "date").length > 0 && (
                    <td style={tdStyle}>{r.data?.date || "—"}</td>
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

function formatNumber(val: number, key: string): string {
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
  if (!isNaN(num)) return formatNumber(num, key);
  return String(val);
}
