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
      startDate = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
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

    console.log(`📊 Public table: returning ${filteredRecords.length} records (total: ${allRecords.length})`);

    return new Response(
      JSON.stringify({
        table: {
          id: table.id,
          name: table.name,
          integration_type: table.integration_type,
          integration_settings: table.integration_settings,
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
