import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function getDateRange(filter: string): { startDate: string | null; endDate: string | null } {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let startDate: string | null = null;
  let endDate: string | null = null;

  switch (filter) {
    case "today":
      startDate = today.toISOString().split("T")[0];
      endDate = startDate;
      break;
    case "yesterday": {
      const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
      startDate = yesterday.toISOString().split("T")[0];
      endDate = startDate;
      break;
    }
    case "last_7_days":
      startDate = new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      endDate = today.toISOString().split("T")[0];
      break;
    case "this_month":
      startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
      endDate = today.toISOString().split("T")[0];
      break;
    case "last_month": {
      const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
      startDate = startOfLastMonth.toISOString().split("T")[0];
      endDate = endOfLastMonth.toISOString().split("T")[0];
      break;
    }
    case 'last_70_days':
      startDate = new Date(today.getTime() - 70 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      endDate = today.toISOString().split("T")[0];
      break;
    default: // last_30_days
      startDate = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      endDate = today.toISOString().split("T")[0];
      break;
  }

  return { startDate, endDate };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const shareToken = url.searchParams.get("token");
    const dateFilter = url.searchParams.get("date_filter") || "last_30_days";

    if (!shareToken) {
      return new Response(JSON.stringify({ error: "Missing token" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Look up the share
    const { data: share, error: shareError } = await supabase
      .from("table_shares")
      .select("*, crm_tables(*)")
      .eq("share_token", shareToken)
      .eq("is_active", true)
      .single();

    if (shareError || !share) {
      return new Response(
        JSON.stringify({ error: "Invalid or inactive share link" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const table = share.crm_tables;
    if (!table) {
      return new Response(
        JSON.stringify({ error: "Table not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch agency name via client association
    let agencyName: string | null = null;
    if (table.client_id) {
      const { data: client } = await supabase
        .from("clients")
        .select("agency_id, agencies(name)")
        .eq("id", table.client_id)
        .single();
      agencyName = (client?.agencies as any)?.name || null;
    }

    // Fetch fields
    const { data: fields } = await supabase
      .from("crm_fields")
      .select("*")
      .eq("table_id", table.id)
      .order("sort_order");

    // For Ahrefs/SEO tables — return the actual SEO reports payload so the
    // public viewer can render the visual SEO dashboard instead of a raw table.
    if (table.integration_type === "ahrefs") {
      const settings = (table.integration_settings as any) || {};
      const targetClientId = settings.clientId || table.client_id;
      const targetDomain = settings.targetDomain || null;

      let reportsQuery = supabase
        .from("ahrefs_reports")
        .select("id, domain, report_type, report_date, received_at, report_data, comparison_data, metadata")
        .eq("tenant_id", table.tenant_id)
        .order("report_date", { ascending: false, nullsFirst: false })
        .order("received_at", { ascending: false })
        .limit(50);

      if (targetClientId) reportsQuery = reportsQuery.eq("client_id", targetClientId);
      if (targetDomain) reportsQuery = reportsQuery.eq("domain", targetDomain);

      const { data: ahrefsReports, error: reportsErr } = await reportsQuery;
      if (reportsErr) console.error("Error fetching ahrefs reports:", reportsErr);

      // Fetch linked GA / GSC tables (per integration_settings or by client_id)
      const linkedGaTableId = settings.linkedGaTableId || null;
      const linkedGscTableId = settings.linkedGscTableId || null;

      let gaTable: any = null;
      let gscTable: any = null;
      let gaRecords: any[] = [];
      let gscRecords: any[] = [];

      // Resolve GA table
      try {
        if (linkedGaTableId) {
          const { data } = await supabase
            .from("crm_tables")
            .select("id, name, integration_settings")
            .eq("id", linkedGaTableId)
            .maybeSingle();
          gaTable = data || null;
        } else if (targetClientId) {
          const { data } = await supabase
            .from("crm_tables")
            .select("id, name, integration_settings")
            .eq("tenant_id", table.tenant_id)
            .eq("integration_type", "google_analytics")
            .eq("client_id", targetClientId)
            .limit(1);
          gaTable = data?.[0] || null;
        }
      } catch (e) {
        console.error("Error resolving GA table:", e);
      }

      // Resolve GSC table
      try {
        if (linkedGscTableId) {
          const { data } = await supabase
            .from("crm_tables")
            .select("id, name, integration_settings")
            .eq("id", linkedGscTableId)
            .maybeSingle();
          gscTable = data || null;
        } else if (targetClientId) {
          const { data } = await supabase
            .from("crm_tables")
            .select("id, name, integration_settings")
            .eq("tenant_id", table.tenant_id)
            .eq("integration_type", "google_search_console")
            .eq("client_id", targetClientId)
            .limit(1);
          gscTable = data?.[0] || null;
        }
      } catch (e) {
        console.error("Error resolving GSC table:", e);
      }

      // Fetch GA records (paginated, up to 5000)
      if (gaTable?.id) {
        try {
          for (let from = 0; from < 5000; from += 1000) {
            const { data: page, error } = await supabase
              .from("crm_records")
              .select("id, data")
              .eq("table_id", gaTable.id)
              .order("created_at", { ascending: false })
              .range(from, from + 999);
            if (error || !page || page.length === 0) break;
            gaRecords.push(...page);
            if (page.length < 1000) break;
          }
        } catch (e) {
          console.error("Error fetching GA records:", e);
        }
      }

      // Fetch GSC records (paginated, up to 10000)
      if (gscTable?.id) {
        try {
          for (let from = 0; from < 10000; from += 1000) {
            const { data: page, error } = await supabase
              .from("crm_records")
              .select("id, data")
              .eq("table_id", gscTable.id)
              .order("created_at", { ascending: false })
              .range(from, from + 999);
            if (error || !page || page.length === 0) break;
            gscRecords.push(...page);
            if (page.length < 1000) break;
          }
        } catch (e) {
          console.error("Error fetching GSC records:", e);
        }
      }

      return new Response(
        JSON.stringify({
          table: {
            id: table.id,
            name: table.name,
            integration_type: table.integration_type,
            integration_settings: table.integration_settings,
            agency_name: agencyName,
          },
          fields: fields || [],
          records: [],
          ahrefs_reports: ahrefsReports || [],
          ga_table: gaTable ? { id: gaTable.id, name: gaTable.name, integration_settings: gaTable.integration_settings } : null,
          ga_records: gaRecords,
          gsc_table: gscTable ? { id: gscTable.id, name: gscTable.name, integration_settings: gscTable.integration_settings } : null,
          gsc_records: gscRecords,
          has_email_restriction: false,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Calculate date range
    const { startDate, endDate } = getDateRange(dateFilter);

    // Fetch records WITH PAGINATION (bypass 1000-row default limit)
    const allRecords: any[] = [];
    const pageSize = 1000;

    for (let from = 0; ; from += pageSize) {
      const { data: page, error } = await supabase
        .from("crm_records")
        .select("*")
        .eq("table_id", table.id)
        .order("created_at", { ascending: false })
        .range(from, from + pageSize - 1);

      if (error) {
        console.error("Error fetching records page:", error);
        break;
      }
      if (!page || page.length === 0) break;
      allRecords.push(...page);
      if (page.length < pageSize) break;
    }

    // Filter by date
    const filteredRecords = allRecords.filter((r: any) => {
      const recordDate = r.data?.date || r.data?.date_start;
      if (!recordDate) return true;
      if (startDate && endDate) {
        return recordDate >= startDate && recordDate <= endDate;
      }
      if (startDate) {
        return recordDate >= startDate;
      }
      return true;
    });


    return new Response(
      JSON.stringify({
        table: {
          id: table.id,
          name: table.name,
          integration_type: table.integration_type,
          integration_settings: table.integration_settings,
          agency_name: agencyName,
        },
        fields: fields || [],
        records: filteredRecords,
        has_email_restriction: false,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error in public-table:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
