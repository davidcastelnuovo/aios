import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const body = await req.json().catch(() => ({}));
    const { backfill_from, backfill_to, table_ids } = body as {
      backfill_from?: string;
      backfill_to?: string;
      table_ids?: string[];
    };

    // Determine date range
    let startDate: string;
    let endDate: string;

    if (backfill_from && backfill_to) {
      // Backfill mode: use provided range
      startDate = backfill_from;
      endDate = backfill_to;
      console.log(`BACKFILL mode: ${startDate} to ${endDate}`);
    } else {
      // Daily mode: yesterday 07:00 to today 07:00 → effectively yesterday's date
      const now = new Date();
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      startDate = yesterday.toISOString().slice(0, 10);
      endDate = yesterday.toISOString().slice(0, 10);
      console.log(`DAILY mode: syncing ${startDate}`);
    }

    // Get all Google Ads tables
    let query = supabase
      .from("crm_tables")
      .select("*")
      .eq("integration_type", "google_ads");

    if (table_ids && table_ids.length > 0) {
      query = query.in("id", table_ids);
    }

    const { data: tables, error: tablesError } = await query;

    if (tablesError) {
      throw new Error(`Failed to fetch tables: ${tablesError.message}`);
    }

    if (!tables || tables.length === 0) {
      return new Response(
        JSON.stringify({ message: "No Google Ads tables found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${tables.length} Google Ads tables to sync`);

    const results: any[] = [];

    // Group tables by tenant to reuse Make API credentials
    const tablesByTenant = new Map<string, typeof tables>();
    for (const table of tables) {
      const tid = table.tenant_id;
      if (!tablesByTenant.has(tid)) {
        tablesByTenant.set(tid, []);
      }
      tablesByTenant.get(tid)!.push(table);
    }

    for (const [tenantId, tenantTables] of tablesByTenant) {
      // Get Make API credentials for this tenant
      const { data: makeIntegration } = await supabase
        .from("tenant_integrations")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("integration_type", "make_api")
        .single();

      if (!makeIntegration) {
        console.warn(`No Make API integration found for tenant ${tenantId}`);
        for (const t of tenantTables) {
          results.push({ table_id: t.id, name: t.name, status: "skipped", reason: "No Make API integration" });
        }
        continue;
      }

      const settings = makeIntegration.settings as any;
      const apiToken = settings?.api_token;
      const region = settings?.region || "eu2";

      if (!apiToken) {
        console.warn(`No API token for Make integration in tenant ${tenantId}`);
        for (const t of tenantTables) {
          results.push({ table_id: t.id, name: t.name, status: "skipped", reason: "No Make API token" });
        }
        continue;
      }

      const teamId = settings?.team_id;

      for (const table of tenantTables) {
        const intSettings = table.integration_settings as any;
        const scenarioId = intSettings?.make_scenario_id;
        const customerId = intSettings?.customer_id;
        const campaignType = intSettings?.campaign_type || "leads";

        if (!scenarioId) {
          results.push({ table_id: table.id, name: table.name, status: "skipped", reason: "No scenario ID" });
          continue;
        }

        console.log(`Syncing table "${table.name}" (${table.id}), scenario ${scenarioId}, dates ${startDate} to ${endDate}`);

        try {
          const webhookUrl = `${supabaseUrl}/functions/v1/webhook-google-ads-sync`;

          // Step 1: Patch the scenario blueprint with the correct dates
          const patchResponse = await fetch(`${supabaseUrl}/functions/v1/make-api`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({
              action: "patch_scenario_blueprint",
              api_token: apiToken,
              team_id: teamId,
              region,
              scenario_id: String(Math.floor(Number(scenarioId))),
              table_id: table.id,
              tenant_id: tenantId,
              customer_id: customerId ? String(customerId) : undefined,
              campaign_type: campaignType,
              webhook_url: webhookUrl,
              start_date: startDate,
              end_date: endDate,
            }),
          });

          const patchResult = await patchResponse.json();

          if (!patchResult.success) {
            console.error(`Failed to patch scenario for ${table.name}:`, patchResult.error);
            results.push({ table_id: table.id, name: table.name, status: "error", reason: `Patch failed: ${patchResult.error}` });
            continue;
          }

          // Step 2: Run the scenario
          const runResponse = await fetch(`${supabaseUrl}/functions/v1/make-api`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({
              action: "run_and_sync_google_ads",
              api_token: apiToken,
              team_id: teamId,
              region,
              scenario_id: String(Math.floor(Number(scenarioId))),
              table_id: table.id,
            }),
          });

          const runResult = await runResponse.json();

          if (runResult.success) {
            console.log(`Successfully triggered sync for ${table.name}`);
            results.push({ table_id: table.id, name: table.name, status: "triggered", dates: `${startDate} to ${endDate}` });
          } else {
            console.error(`Failed to run scenario for ${table.name}:`, runResult.error);
            results.push({ table_id: table.id, name: table.name, status: "error", reason: runResult.error });
          }

          // Wait 2 seconds between scenarios to avoid rate limiting
          await new Promise((r) => setTimeout(r, 2000));
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          console.error(`Error syncing ${table.name}:`, errMsg);
          results.push({ table_id: table.id, name: table.name, status: "error", reason: errMsg });
        }
      }
    }

    console.log(`Sync complete. Results:`, JSON.stringify(results));

    return new Response(
      JSON.stringify({ success: true, tables_processed: results.length, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Cron sync error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
