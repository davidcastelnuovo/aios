import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const shareToken = url.searchParams.get("token");
    const viewerEmail = url.searchParams.get("email");
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

    // Check email restriction
    const allowedEmails: string[] = share.allowed_emails || [];
    if (allowedEmails.length > 0) {
      if (!viewerEmail) {
        return new Response(
          JSON.stringify({ error: "email_required", message: "This table requires email verification" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const normalizedEmail = viewerEmail.toLowerCase().trim();
      const isAllowed = allowedEmails.some((e) => e.toLowerCase().trim() === normalizedEmail);
      if (!isAllowed) {
        return new Response(
          JSON.stringify({ error: "email_not_allowed", message: "Your email is not authorized to view this table" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const table = share.crm_tables;
    if (!table) {
      return new Response(
        JSON.stringify({ error: "Table not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch fields
    const { data: fields } = await supabase
      .from("crm_fields")
      .select("*")
      .eq("table_id", table.id)
      .order("sort_order");

    // Calculate date range
    const now = new Date();
    let startDate: Date;
    switch (dateFilter) {
      case "today":
        startDate = new Date(now); startDate.setHours(0, 0, 0, 0); break;
      case "yesterday":
        startDate = new Date(now); startDate.setDate(startDate.getDate() - 1); startDate.setHours(0, 0, 0, 0); break;
      case "last_7_days":
        startDate = new Date(now); startDate.setDate(startDate.getDate() - 7); break;
      case "this_month":
        startDate = new Date(now.getFullYear(), now.getMonth(), 1); break;
      case "last_month":
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1); break;
      default:
        startDate = new Date(now); startDate.setDate(startDate.getDate() - 30); break;
    }

    // Fetch records
    const { data: records } = await supabase
      .from("crm_records")
      .select("*")
      .eq("table_id", table.id);

    const filteredRecords = (records || []).filter((r: any) => {
      const recordDate = r.data?.date || r.data?.date_start;
      if (!recordDate) return true;
      const d = new Date(recordDate);
      return d >= startDate && d <= now;
    });

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
        has_email_restriction: allowedEmails.length > 0,
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
