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
    const reports = Array.isArray(body) ? body : [body];
    const results: Array<{ success: boolean; id?: string; error?: string; domain?: string; action?: string }> = [];

    for (const report of reports) {
      let tenant_id = report.tenant_id || report.tenantId || null;
      const client_id = report.client_id || report.clientId || null;
      const agency_id = report.agency_id || report.agencyId || null;
      const domain = report.domain || report.target || report.url || report.site || null;
      const report_type = report.report_type || report.reportType || report.type || "general";
      const report_date = report.report_date || report.reportDate || report.date || null;
      const report_data = report.report_data || report.reportData || report.data || report;
      const metadata = report.metadata || report.meta || {};

      if (!domain) {
        results.push({
          success: false,
          error: `Missing domain. Send at least { "domain": "example.com", ... }. Got keys: ${Object.keys(report).join(", ")}`,
        });
        continue;
      }

      // Resolve tenant_id
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
          const { data: mcTenant } = await supabase
            .from("tenants")
            .select("id")
            .eq("slug", "marketingcaptain")
            .limit(1)
            .single();
          if (mcTenant?.id) {
            tenant_id = mcTenant.id;
          } else {
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
      }

      // Auto-assign client_id from previous reports for this domain
      let resolved_client_id = client_id;
      if (!resolved_client_id) {
        const { data: prevReport } = await supabase
          .from("ahrefs_reports")
          .select("client_id")
          .eq("domain", domain)
          .not("client_id", "is", null)
          .limit(1)
          .single();
        if (prevReport?.client_id) {
          resolved_client_id = prevReport.client_id;
        }
      }

      // Check for existing report (deduplication) - only when report_date is set
      let action = "inserted";
      if (report_date) {
        const { data: existing } = await supabase
          .from("ahrefs_reports")
          .select("id, client_id")
          .eq("domain", domain)
          .eq("report_date", report_date)
          .eq("report_type", report_type)
          .limit(1)
          .single();

        if (existing) {
          // Update existing report (UPSERT), preserve existing client_id if already set
          const updatePayload: Record<string, unknown> = {
            report_data,
            metadata: typeof metadata === "object" ? metadata : { raw: metadata },
            received_at: new Date().toISOString(),
            tenant_id: tenant_id || null,
          };
          // Keep existing client_id if already assigned, otherwise use resolved
          if (!existing.client_id && resolved_client_id) {
            updatePayload.client_id = resolved_client_id;
          }
          if (agency_id) updatePayload.agency_id = agency_id;

          const { error: updateError } = await supabase
            .from("ahrefs_reports")
            .update(updatePayload)
            .eq("id", existing.id);

          if (updateError) {
            console.error("Error updating ahrefs report:", updateError);
            results.push({ success: false, error: updateError.message, domain });
          } else {
            results.push({ success: true, id: existing.id, domain, action: "updated" });
          }
          continue;
        }
      }

      // Insert new report
      const insertPayload: Record<string, unknown> = {
        domain,
        report_type,
        report_data,
        metadata: typeof metadata === "object" ? metadata : { raw: metadata },
        report_date: report_date || null,
        tenant_id: tenant_id || null,
      };
      if (resolved_client_id) insertPayload.client_id = resolved_client_id;
      if (agency_id) insertPayload.agency_id = agency_id;

      const { data: inserted, error: insertError } = await supabase
        .from("ahrefs_reports")
        .insert(insertPayload)
        .select("id")
        .single();

      if (insertError) {
        console.error("Error inserting ahrefs report:", insertError);
        results.push({ success: false, error: insertError.message, domain });
      } else {
        results.push({ success: true, id: inserted.id, domain, action });

        // Auto-create SEO report table if client was auto-assigned
        if (resolved_client_id && tenant_id) {
          try {
            const { data: existingTables } = await supabase
              .from("crm_tables")
              .select("id")
              .eq("client_id", resolved_client_id)
              .eq("integration_type", "ahrefs");

            if (!existingTables || existingTables.length === 0) {
              await supabase.from("crm_tables").insert({
                tenant_id,
                client_id: resolved_client_id,
                name: `דוח SEO - ${domain}`,
                slug: `seo-${domain.replace(/\./g, "-")}`,
                integration_type: "ahrefs",
                category: "seo",
                description: `דוח SEO אוטומטי עבור ${domain}`,
              });
            }
          } catch (e) {
            console.error("Error auto-creating SEO table:", e);
          }
        }
      }
    }

    const allSuccess = results.every((r) => r.success);

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
