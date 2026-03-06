import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { table_id, records } = body;

    console.log("Received webhook for table:", table_id, "with", records?.length || 0, "records");

    if (!table_id) {
      return new Response(
        JSON.stringify({ error: "Missing table_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const webhookSecret = req.headers.get("x-webhook-secret");

    // Verify table exists
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

    const integrationSettings = table.integration_settings as { campaign_type?: string; webhook_secret?: string } | null;
    const campaignType = integrationSettings?.campaign_type || "leads";

    // Verify webhook secret
    if (integrationSettings?.webhook_secret) {
      if (webhookSecret !== integrationSettings.webhook_secret) {
        return new Response(
          JSON.stringify({ error: "Invalid webhook secret" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    if (!Array.isArray(records) || records.length === 0) {
      return new Response(
        JSON.stringify({ error: "No records provided", received: 0 }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Ensure fields exist (once)
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

    // Batch check existing fields
    const { data: existingFields } = await supabase
      .from("crm_fields")
      .select("key")
      .eq("table_id", table_id);

    const existingFieldKeys = new Set((existingFields || []).map((f: any) => f.key));
    const missingFields = expectedFields.filter((f, i) => !existingFieldKeys.has(f.key)).map((f, i) => ({
      table_id,
      key: f.key,
      name: f.name,
      type: f.type,
      position: expectedFields.indexOf(f),
      is_visible: true,
      is_required: false,
      config: {},
    }));

    if (missingFields.length > 0) {
      await supabase.from("crm_fields").insert(missingFields);
    }

    // Clear existing if requested
    if (body.clear_existing === true) {
      await supabase.from("crm_records").delete().eq("table_id", table_id);
    }

    // === BATCH UPSERT: fetch all existing records ONCE ===
    const { data: allExisting } = await supabase
      .from("crm_records")
      .select("id, data")
      .eq("table_id", table_id);

    // Build lookup map: "campaign_id|date" -> record id
    const existingMap = new Map<string, string>();
    for (const r of (allExisting || [])) {
      const d = r.data as any;
      if (d?.campaign_id && d?.date) {
        existingMap.set(`${d.campaign_id}|${d.date}`, r.id);
      }
    }

    console.log(`Loaded ${existingMap.size} existing records for dedup`);

    // Process all records and split into inserts vs updates
    const toInsert: any[] = [];
    const toUpdate: { id: string; data: Record<string, any> }[] = [];

    for (const record of records) {
      let recordData: Record<string, any>;

      if (campaignType === "ecommerce") {
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
          cost,
          purchases: conversions,
          purchase_value: conversionsValue,
          add_to_cart: Math.max(0, allConversions - conversions),
          roas: cost > 0 ? Number((conversionsValue / cost).toFixed(2)) : 0,
        };
      } else {
        const cost = Number(record.cost) || Number(record.cost_micros) / 1000000 || 0;
        const conversions = Number(record.conversions) || 0;

        recordData = {
          campaign_id: record.campaign_id || record.id || "",
          campaign_name: record.campaign_name || record.name || "",
          date: record.date || "",
          impressions: Number(record.impressions) || 0,
          clicks: Number(record.clicks) || 0,
          cost,
          conversions,
          ctr: Number(record.ctr) || 0,
          cpc: Number(record.cpc) || Number(record.average_cpc) / 1000000 || 0,
          cost_per_conversion: conversions > 0 ? Number((cost / conversions).toFixed(2)) : 0,
        };
      }

      const key = `${recordData.campaign_id}|${recordData.date}`;
      const existingId = existingMap.get(key);

      if (existingId) {
        toUpdate.push({ id: existingId, data: recordData });
      } else {
        toInsert.push({
          table_id,
          tenant_id: table.tenant_id,
          agency_id: table.agency_id || null,
          data: recordData,
        });
      }
    }

    // Batch insert (Supabase handles arrays)
    let insertedCount = 0;
    if (toInsert.length > 0) {
      // Insert in chunks of 500 to avoid payload limits
      for (let i = 0; i < toInsert.length; i += 500) {
        const chunk = toInsert.slice(i, i + 500);
        const { error } = await supabase.from("crm_records").insert(chunk);
        if (error) {
          console.error("Batch insert error:", error);
        } else {
          insertedCount += chunk.length;
        }
      }
    }

    // Batch update (must be done individually due to different data per row)
    let updatedCount = 0;
    for (const item of toUpdate) {
      const { error } = await supabase
        .from("crm_records")
        .update({ data: item.data, updated_at: new Date().toISOString() })
        .eq("id", item.id);
      if (!error) updatedCount++;
    }

    // Update last_sync_at
    await supabase
      .from("crm_tables")
      .update({ last_sync_at: new Date().toISOString() })
      .eq("id", table_id);

    console.log(`Synced ${records.length} records: ${insertedCount} inserted, ${updatedCount} updated`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Data synced successfully",
        records_synced: records.length,
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
