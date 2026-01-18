import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret",
};

interface GoogleAdsRecord {
  campaign_id: string;
  campaign_name: string;
  date: string;
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  ctr: number;
  cpc: number;
  cost_per_conversion: number;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body
    const body = await req.json();
    const { table_id, records, tenant_id } = body;

    console.log("Received webhook for table:", table_id, "with", records?.length || 0, "records");

    if (!table_id) {
      return new Response(
        JSON.stringify({ error: "Missing table_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the webhook secret from the request headers
    const webhookSecret = req.headers.get("x-webhook-secret");

    // Verify table exists and get its settings
    const { data: table, error: tableError } = await supabase
      .from("crm_tables")
      .select("*")
      .eq("id", table_id)
      .single();

    if (tableError || !table) {
      console.error("Table not found:", tableError);
      return new Response(
        JSON.stringify({ error: "Table not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify webhook secret if configured
    const integrationSettings = table.integration_settings as any;
    if (integrationSettings?.webhook_secret) {
      if (webhookSecret !== integrationSettings.webhook_secret) {
        console.error("Invalid webhook secret");
        return new Response(
          JSON.stringify({ error: "Invalid webhook secret" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Validate records
    if (!Array.isArray(records) || records.length === 0) {
      return new Response(
        JSON.stringify({ error: "No records provided", received: 0 }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Define the expected fields for Google Ads data
    const expectedFields = [
      { key: "campaign_id", name: "מזהה קמפיין", type: "text" },
      { key: "campaign_name", name: "שם קמפיין", type: "text" },
      { key: "date", name: "תאריך", type: "date" },
      { key: "impressions", name: "חשיפות", type: "number" },
      { key: "clicks", name: "קליקים", type: "number" },
      { key: "cost", name: "עלות", type: "number" },
      { key: "conversions", name: "המרות", type: "number" },
      { key: "ctr", name: "CTR", type: "number" },
      { key: "cpc", name: "CPC", type: "number" },
      { key: "cost_per_conversion", name: "עלות להמרה", type: "number" },
    ];

    // Ensure fields exist in crm_fields
    for (let i = 0; i < expectedFields.length; i++) {
      const field = expectedFields[i];
      const { data: existingField } = await supabase
        .from("crm_fields")
        .select("id")
        .eq("table_id", table_id)
        .eq("key", field.key)
        .maybeSingle();

      if (!existingField) {
        await supabase.from("crm_fields").insert({
          table_id,
          key: field.key,
          name: field.name,
          type: field.type,
          position: i,
          is_visible: true,
          is_required: false,
          config: {},
        });
      }
    }

    // Delete existing records for this table
    const { error: deleteError } = await supabase
      .from("crm_records")
      .delete()
      .eq("table_id", table_id);

    if (deleteError) {
      console.error("Error deleting existing records:", deleteError);
    }

    // Insert new records
    const recordsToInsert = records.map((record: GoogleAdsRecord) => ({
      table_id,
      tenant_id: table.tenant_id,
      agency_id: table.agency_id || null,
      data: {
        campaign_id: record.campaign_id || "",
        campaign_name: record.campaign_name || "",
        date: record.date || "",
        impressions: Number(record.impressions) || 0,
        clicks: Number(record.clicks) || 0,
        cost: Number(record.cost) || 0,
        conversions: Number(record.conversions) || 0,
        ctr: Number(record.ctr) || 0,
        cpc: Number(record.cpc) || 0,
        cost_per_conversion: Number(record.cost_per_conversion) || 0,
      },
    }));

    const { data: insertedRecords, error: insertError } = await supabase
      .from("crm_records")
      .insert(recordsToInsert)
      .select();

    if (insertError) {
      console.error("Error inserting records:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to insert records", details: insertError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update last_sync_at on the table
    await supabase
      .from("crm_tables")
      .update({ last_sync_at: new Date().toISOString() })
      .eq("id", table_id);

    console.log("Successfully synced", insertedRecords?.length || 0, "records for table", table_id);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Data synced successfully",
        records_synced: insertedRecords?.length || 0,
        table_id,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Webhook error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
