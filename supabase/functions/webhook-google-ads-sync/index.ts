import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret",
};

interface GoogleAdsLeadRecord {
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

interface GoogleAdsEcommerceRecord {
  campaign_id: string;
  campaign_name: string;
  date: string;
  impressions: number;
  clicks: number;
  cost: number;
  purchases: number;
  purchase_value: number;
  add_to_cart: number;
  roas: number;
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

    // Get campaign type from integration settings
    const integrationSettings = table.integration_settings as { campaign_type?: string } | null;
    const campaignType = integrationSettings?.campaign_type || "leads";
    
    console.log(`Table campaign type: ${campaignType}`);

    // Verify webhook secret if configured
    if (integrationSettings && (integrationSettings as any).webhook_secret) {
      if (webhookSecret !== (integrationSettings as any).webhook_secret) {
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

    // Define the expected fields based on campaign type
    const leadFields = [
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

    const ecommerceFields = [
      { key: "campaign_id", name: "מזהה קמפיין", type: "text" },
      { key: "campaign_name", name: "שם קמפיין", type: "text" },
      { key: "date", name: "תאריך", type: "date" },
      { key: "impressions", name: "חשיפות", type: "number" },
      { key: "clicks", name: "קליקים", type: "number" },
      { key: "cost", name: "עלות", type: "number" },
      { key: "purchases", name: "רכישות", type: "number" },
      { key: "purchase_value", name: "שווי רכישות", type: "number" },
      { key: "add_to_cart", name: "הוספות לעגלה", type: "number" },
      { key: "roas", name: "ROAS", type: "number" },
    ];

    const expectedFields = campaignType === "ecommerce" ? ecommerceFields : leadFields;

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

    // Check if we should clear existing records (optional parameter)
    const clearExisting = body.clear_existing === true;
    
    if (clearExisting) {
      const { error: deleteError } = await supabase
        .from("crm_records")
        .delete()
        .eq("table_id", table_id);

      if (deleteError) {
        console.error("Error deleting existing records:", deleteError);
      }
    }

    // Upsert records - update if exists (same campaign_id + date), insert if not
    let upsertedCount = 0;
    let updatedCount = 0;
    let insertedCount = 0;

    for (const record of records) {
      let recordData: Record<string, any>;
      
      if (campaignType === "ecommerce") {
        // E-commerce record mapping
        const cost = Number(record.cost) || Number(record.cost_micros) / 1000000 || 0;
        const conversionsValue = Number(record.conversions_value) || Number(record.purchase_value) || 0;
        const conversions = Number(record.conversions) || Number(record.purchases) || 0;
        const allConversions = Number(record.all_conversions) || 0;
        
        recordData = {
          campaign_id: record.campaign_id || record.id || "",
          campaign_name: record.campaign_name || record.name || "",
          date: record.date || "",
          impressions: Number(record.impressions) || 0,
          clicks: Number(record.clicks) || 0,
          cost: cost,
          purchases: conversions,
          purchase_value: conversionsValue,
          add_to_cart: Math.max(0, allConversions - conversions), // Estimate add to cart
          roas: cost > 0 ? Number((conversionsValue / cost).toFixed(2)) : 0,
        };
      } else {
        // Leads record mapping
        const cost = Number(record.cost) || Number(record.cost_micros) / 1000000 || 0;
        const conversions = Number(record.conversions) || 0;
        
        recordData = {
          campaign_id: record.campaign_id || record.id || "",
          campaign_name: record.campaign_name || record.name || "",
          date: record.date || "",
          impressions: Number(record.impressions) || 0,
          clicks: Number(record.clicks) || 0,
          cost: cost,
          conversions: conversions,
          ctr: Number(record.ctr) || 0,
          cpc: Number(record.cpc) || Number(record.average_cpc) / 1000000 || 0,
          cost_per_conversion: conversions > 0 ? Number((cost / conversions).toFixed(2)) : 0,
        };
      }

      // Check if record with same campaign_id and date already exists
      const { data: existingRecords } = await supabase
        .from("crm_records")
        .select("id, data")
        .eq("table_id", table_id);

      // Check for matching record based on campaign type unique key
      const uniqueKeyField = campaignType === "ecommerce" ? "campaign_id" : "campaign_id";
      
      const existingRecord = existingRecords?.find((r: any) => {
        const data = r.data as any;
        return data?.campaign_id === recordData.campaign_id && data?.date === recordData.date;
      });

      if (existingRecord) {
        // Update existing record
        const { error: updateError } = await supabase
          .from("crm_records")
          .update({ 
            data: recordData,
            updated_at: new Date().toISOString()
          })
          .eq("id", existingRecord.id);

        if (updateError) {
          console.error("Error updating record:", updateError);
        } else {
          updatedCount++;
        }
      } else {
        // Insert new record
        const { error: insertError } = await supabase
          .from("crm_records")
          .insert({
            table_id,
            tenant_id: table.tenant_id,
            agency_id: table.agency_id || null,
            data: recordData,
          });

        if (insertError) {
          console.error("Error inserting record:", insertError);
        } else {
          insertedCount++;
        }
      }
      upsertedCount++;
    }

    // Update last_sync_at on the table
    await supabase
      .from("crm_tables")
      .update({ last_sync_at: new Date().toISOString() })
      .eq("id", table_id);

    console.log("Successfully synced", upsertedCount, "records for table", table_id, `(${insertedCount} inserted, ${updatedCount} updated)`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Data synced successfully",
        records_synced: upsertedCount,
        records_inserted: insertedCount,
        records_updated: updatedCount,
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
