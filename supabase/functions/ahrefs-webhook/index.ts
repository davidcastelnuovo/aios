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
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    console.log("Ahrefs webhook received:", JSON.stringify(body).substring(0, 500));

    // Support batch: if body is an array, process multiple reports
    const reports = Array.isArray(body) ? body : [body];
    const results: Array<{ success: boolean; id?: string; error?: string; domain?: string }> = [];

    for (const report of reports) {
      // Be flexible: extract fields from wherever they are in the payload
      let tenant_id = report.tenant_id || report.tenantId || null;
      const client_id = report.client_id || report.clientId || null;
      const agency_id = report.agency_id || report.agencyId || null;
      const domain = report.domain || report.target || report.url || report.site || null;
      const report_type = report.report_type || report.reportType || report.type || "general";
      const report_date = report.report_date || report.reportDate || report.date || null;

      // Everything else goes into report_data
      // If there's an explicit report_data field, use it; otherwise store the entire payload
      const report_data = report.report_data || report.reportData || report.data || report;

      // Metadata - any extra info
      const metadata = report.metadata || report.meta || {};

      // Domain is the only truly required field - we need to know what site this is about
      if (!domain) {
        results.push({
          success: false,
          error: `Missing domain. Send at least { "domain": "example.com", ... }. Got keys: ${Object.keys(report).join(", ")}`,
        });
        continue;
      }

      // If no tenant_id provided, try to find one by looking up existing reports for this domain
      if (!tenant_id) {
        const { data: existingReport } = await supabase
          .from("ahrefs_reports")
          .select("tenant_id")
          .eq("domain", domain)
          .not("tenant_id", "is", null)
          .limit(1)
          .single();
        
        if (existingReport?.tenant_id) {
          tenant_id = existingReport.tenant_id;
        } else {
          // Fallback: use the first (and likely only) tenant
          const { data: tenants } = await supabase
            .from("tenants")
            .select("id")
            .limit(1)
            .single();
          if (tenants?.id) {
            tenant_id = tenants.id;
          }
        }
      }

      const insertPayload: Record<string, unknown> = {
        domain,
        report_type,
        report_data,
        metadata: typeof metadata === "object" ? metadata : { raw: metadata },
        report_date: report_date || null,
        tenant_id: tenant_id || null,
      };

      if (client_id) {
        insertPayload.client_id = client_id;
      }
      if (agency_id) {
        insertPayload.agency_id = agency_id;
      }

      const { data: inserted, error: insertError } = await supabase
        .from("ahrefs_reports")
        .insert(insertPayload)
        .select("id")
        .single();

      if (insertError) {
        console.error("Error inserting ahrefs report:", insertError);
        results.push({ success: false, error: insertError.message, domain });
      } else {
        results.push({ success: true, id: inserted.id, domain });
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
