import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // Authenticate via x-api-key header
    const apiKey = req.headers.get("x-api-key");
    const expectedKey = Deno.env.get("AHREFS_WEBHOOK_SECRET");

    if (!expectedKey) {
      console.error("AHREFS_WEBHOOK_SECRET not configured");
      return new Response(JSON.stringify({ error: "Webhook not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!apiKey || apiKey !== expectedKey) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();

    // Support batch: if body is an array, process multiple reports
    const reports = Array.isArray(body) ? body : [body];
    const results: Array<{ success: boolean; id?: string; error?: string }> = [];

    for (const report of reports) {
      const {
        tenant_id,
        client_id,
        agency_id,
        domain,
        report_type,
        report_data,
        metadata,
        report_date,
      } = report;

      // Validate required fields
      if (!tenant_id || !domain || !report_type || !report_data) {
        results.push({
          success: false,
          error: `Missing required fields: tenant_id, domain, report_type, report_data. Got: tenant_id=${!!tenant_id}, domain=${!!domain}, report_type=${!!report_type}, report_data=${!!report_data}`,
        });
        continue;
      }

      const { data: inserted, error: insertError } = await supabase
        .from("ahrefs_reports")
        .insert({
          tenant_id,
          client_id: client_id || null,
          agency_id: agency_id || null,
          domain,
          report_type,
          report_data,
          metadata: metadata || {},
          report_date: report_date || null,
        })
        .select("id")
        .single();

      if (insertError) {
        console.error("Error inserting ahrefs report:", insertError);
        results.push({ success: false, error: insertError.message });
      } else {
        results.push({ success: true, id: inserted.id });
      }
    }

    const allSuccess = results.every((r) => r.success);
    console.log(`Ahrefs webhook: processed ${results.length} reports, ${results.filter(r => r.success).length} succeeded`);

    return new Response(
      JSON.stringify({
        success: allSuccess,
        processed: results.length,
        results,
      }),
      {
        status: allSuccess ? 200 : 207,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in ahrefs-webhook:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
