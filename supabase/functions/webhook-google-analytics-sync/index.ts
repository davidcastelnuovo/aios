import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret",
};

interface GoogleAnalyticsRecord {
  date?: string;
  source?: string;
  medium?: string;
  source_medium?: string;
  campaign?: string;
  sessions?: number;
  users?: number;
  new_users?: number;
  pageviews?: number;
  bounce_rate?: number;
  avg_session_duration?: number;
  pages_per_session?: number;
  // Top pages data
  page_path?: string;
  page_title?: string;
  // Additional metrics
  transactions?: number;
  revenue?: number;
  conversion_rate?: number;
}

// Field definitions for Google Analytics data
const GA_FIELDS = [
  { key: "date", name: "תאריך", type: "date", position: 0 },
  { key: "source_medium", name: "מקור / מדיום", type: "text", position: 1 },
  { key: "sessions", name: "Sessions", type: "number", position: 2 },
  { key: "users", name: "משתמשים", type: "number", position: 3 },
  { key: "new_users", name: "משתמשים חדשים", type: "number", position: 4 },
  { key: "pageviews", name: "צפיות בדפים", type: "number", position: 5 },
  { key: "bounce_rate", name: "אחוז נטישה", type: "number", position: 6 },
  { key: "avg_session_duration", name: "זמן ממוצע (שניות)", type: "number", position: 7 },
  { key: "pages_per_session", name: "דפים לביקור", type: "number", position: 8 },
  { key: "page_path", name: "נתיב דף", type: "text", position: 9 },
  { key: "page_title", name: "כותרת דף", type: "text", position: 10 },
  { key: "campaign", name: "קמפיין", type: "text", position: 11 },
  { key: "transactions", name: "עסקאות", type: "number", position: 12 },
  { key: "revenue", name: "הכנסות", type: "number", position: 13 },
  { key: "conversion_rate", name: "אחוז המרה", type: "number", position: 14 },
];

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { table_id, records, tenant_id, clear_existing } = body as {
      table_id: string;
      records: GoogleAnalyticsRecord[];
      tenant_id?: string;
      clear_existing?: boolean;
    };

    if (!table_id) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing table_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!records || !Array.isArray(records)) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing or invalid records array" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Received ${records.length} Google Analytics records for table ${table_id}`);

    // Fetch table to validate and get settings
    const { data: tableData, error: tableError } = await supabase
      .from("crm_tables")
      .select("*")
      .eq("id", table_id)
      .single();

    if (tableError || !tableData) {
      console.error("Table not found:", tableError);
      return new Response(
        JSON.stringify({ success: false, error: "Table not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate webhook secret if configured
    const integrationSettings = tableData.integration_settings || {};
    const webhookSecret = integrationSettings.webhook_secret;
    
    if (webhookSecret) {
      const providedSecret = req.headers.get("x-webhook-secret");
      if (providedSecret !== webhookSecret) {
        console.error("Invalid webhook secret");
        return new Response(
          JSON.stringify({ success: false, error: "Unauthorized" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Ensure fields exist
    const existingFieldsRes = await supabase
      .from("crm_fields")
      .select("key")
      .eq("table_id", table_id);

    const existingKeys = new Set((existingFieldsRes.data || []).map((f: any) => f.key));
    
    const fieldsToInsert = GA_FIELDS.filter(f => !existingKeys.has(f.key)).map(f => ({
      table_id,
      ...f,
    }));

    if (fieldsToInsert.length > 0) {
      const { error: fieldsError } = await supabase
        .from("crm_fields")
        .insert(fieldsToInsert);
      
      if (fieldsError) {
        console.error("Error inserting fields:", fieldsError);
      }
    }

    // Optionally clear existing records
    if (clear_existing) {
      await supabase.from("crm_records").delete().eq("table_id", table_id);
    }

    // Process and insert/update records
    let insertedCount = 0;
    let updatedCount = 0;

    for (const record of records) {
      // Build record data
      const recordData: Record<string, any> = {};
      
      // Map incoming data to our field structure
      if (record.date) recordData.date = record.date;
      if (record.source_medium) {
        recordData.source_medium = record.source_medium;
      } else if (record.source || record.medium) {
        recordData.source_medium = `${record.source || ''}/${record.medium || ''}`;
      }
      if (record.campaign) recordData.campaign = record.campaign;
      if (record.sessions !== undefined) recordData.sessions = Number(record.sessions) || 0;
      if (record.users !== undefined) recordData.users = Number(record.users) || 0;
      if (record.new_users !== undefined) recordData.new_users = Number(record.new_users) || 0;
      if (record.pageviews !== undefined) recordData.pageviews = Number(record.pageviews) || 0;
      if (record.bounce_rate !== undefined) recordData.bounce_rate = Number(record.bounce_rate) || 0;
      if (record.avg_session_duration !== undefined) recordData.avg_session_duration = Number(record.avg_session_duration) || 0;
      if (record.pages_per_session !== undefined) recordData.pages_per_session = Number(record.pages_per_session) || 0;
      if (record.page_path) recordData.page_path = record.page_path;
      if (record.page_title) recordData.page_title = record.page_title;
      if (record.transactions !== undefined) recordData.transactions = Number(record.transactions) || 0;
      if (record.revenue !== undefined) recordData.revenue = Number(record.revenue) || 0;
      if (record.conversion_rate !== undefined) recordData.conversion_rate = Number(record.conversion_rate) || 0;

      // Check for existing record by date + source_medium
      const matchCondition: Record<string, any> = { table_id };
      
      if (recordData.date && recordData.source_medium) {
        // Try to find existing record with same date and source
        const { data: existingRecords } = await supabase
          .from("crm_records")
          .select("id, data")
          .eq("table_id", table_id);
        
        const existingRecord = existingRecords?.find((r: any) => 
          r.data?.date === recordData.date && 
          r.data?.source_medium === recordData.source_medium
        );

        if (existingRecord) {
          // Update existing
          await supabase
            .from("crm_records")
            .update({ data: recordData, updated_at: new Date().toISOString() })
            .eq("id", existingRecord.id);
          updatedCount++;
          continue;
        }
      }

      // Insert new record
      const { error: insertError } = await supabase
        .from("crm_records")
        .insert({ table_id, data: recordData });

      if (insertError) {
        console.error("Error inserting record:", insertError);
      } else {
        insertedCount++;
      }
    }

    // Update last_sync_at
    await supabase
      .from("crm_tables")
      .update({ last_sync_at: new Date().toISOString() })
      .eq("id", table_id);

    console.log(`Sync complete: ${insertedCount} inserted, ${updatedCount} updated`);

    return new Response(
      JSON.stringify({
        success: true,
        records_synced: insertedCount + updatedCount,
        inserted: insertedCount,
        updated: updatedCount,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error in webhook-google-analytics-sync:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
