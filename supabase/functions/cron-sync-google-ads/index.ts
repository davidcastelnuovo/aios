import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAKE_API_REGIONS: Record<string, string> = {
  eu1: "https://eu1.make.com/api/v2",
  eu2: "https://eu2.make.com/api/v2",
  us1: "https://us1.make.com/api/v2",
  us2: "https://us2.make.com/api/v2",
};

function isGoogleAdsModule(moduleName: string): boolean {
  if (!moduleName) return false;
  const n = moduleName.toLowerCase();
  return n.includes("google-ads") || n.includes("googleads") || n.includes("adwords");
}

function isHttpModule(moduleName: string): boolean {
  if (!moduleName) return false;
  return moduleName.toLowerCase().includes("http");
}

async function makeAPICall(apiToken: string, region: string, endpoint: string, method = "GET", body?: any) {
  const baseUrl = MAKE_API_REGIONS[region] || MAKE_API_REGIONS.eu2;
  const url = `${baseUrl}${endpoint}`;
  const options: RequestInit = {
    method,
    headers: { Authorization: `Token ${apiToken}`, "Content-Type": "application/json" },
  };
  if (body && method !== "GET") options.body = JSON.stringify(body);
  const res = await fetch(url, options);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Make API ${res.status}: ${text.slice(0, 300)}`);
  }
  return res.json();
}

async function patchAndRunScenario(
  apiToken: string,
  region: string,
  scenarioId: string,
  tableId: string,
  tenantId: string,
  customerId: string | undefined,
  campaignType: string,
  startDate: string,
  endDate: string,
  webhookUrl: string
) {
  // Step 1: Get blueprint
  const bpResponse = await makeAPICall(apiToken, region, `/scenarios/${scenarioId}/blueprint`);
  let bp = bpResponse;
  if (bp.response?.blueprint) bp = bp.response.blueprint;
  else if (bp.blueprint) bp = bp.blueprint;
  delete bp.code;
  delete bp.response;

  // Step 2: Patch blueprint
  if (bp.flow && Array.isArray(bp.flow)) {
    for (const mod of bp.flow) {
      if (mod.module && isGoogleAdsModule(mod.module) && mod.mapper) {
        if (customerId) {
          const fmtId = customerId.replace(/-/g, "");
          mod.mapper.customerId = fmtId;
          mod.mapper.customer_id = fmtId;
          mod.mapper.accountId = fmtId;
        }
        // Set CUSTOM date range
        const formatForMake = (ds: string) => {
          const d = new Date(ds);
          return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
        };
        mod.mapper.dateRangeType = "CUSTOM";
        mod.mapper.startDate = formatForMake(startDate);
        mod.mapper.endDate = formatForMake(endDate);
        mod.mapper.start_date = formatForMake(startDate);
        mod.mapper.end_date = formatForMake(endDate);
        mod.mapper.dateFrom = formatForMake(startDate);
        mod.mapper.dateTo = formatForMake(endDate);

        if (!mod.mapper.segments || !Array.isArray(mod.mapper.segments)) {
          mod.mapper.segments = ["segments.date"];
        } else if (!mod.mapper.segments.includes("segments.date")) {
          mod.mapper.segments.push("segments.date");
        }
        if (!mod.mapper.attributes || !Array.isArray(mod.mapper.attributes)) {
          mod.mapper.attributes = ["campaign.id", "campaign.name"];
        }
      }

      if (mod.module && isHttpModule(mod.module) && mod.mapper) {
        mod.mapper.url = webhookUrl;
        const gid = bp.flow.find((m: any) => m.module && isGoogleAdsModule(m.module))?.id || 3;
        const bodyTemplate = `{"table_id":"${tableId}","campaign_type":"${campaignType}","tenant_id":"${tenantId}","start_date":"${startDate}","end_date":"${endDate}","records":[{"date":"{{${gid}.segments.date}}","campaign_id":"{{${gid}.campaign.id}}","campaign_name":"{{${gid}.campaign.name}}","impressions":"{{${gid}.metrics.impressions}}","clicks":"{{${gid}.metrics.clicks}}","cost_micros":"{{${gid}.metrics.costMicros}}","conversions":"{{${gid}.metrics.conversions}}","ctr":"{{${gid}.metrics.ctr}}","average_cpc":"{{${gid}.metrics.averageCpc}}"}]}`;
        mod.mapper.jsonStringBodyContent = bodyTemplate;
        if (mod.mapper.data) delete mod.mapper.data;
      }
    }
  }

  // Step 3: Save patched blueprint
  await makeAPICall(apiToken, region, `/scenarios/${scenarioId}`, "PATCH", {
    blueprint: JSON.stringify(bp),
  });
  console.log(`Patched scenario ${scenarioId} for dates ${startDate} to ${endDate}`);

  // Step 4: Run scenario
  const runResult = await makeAPICall(apiToken, region, `/scenarios/${scenarioId}/run`, "POST", {});
  console.log(`Ran scenario ${scenarioId}:`, JSON.stringify(runResult).slice(0, 200));
  return runResult;
}

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

    let startDate: string;
    let endDate: string;
    let isBackfill = false;

    if (backfill_from && backfill_to) {
      startDate = backfill_from;
      endDate = backfill_to;
      isBackfill = true;
      console.log(`BACKFILL mode: ${startDate} to ${endDate}`);
    } else {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      startDate = yesterday.toISOString().slice(0, 10);
      endDate = startDate;
      console.log(`DAILY mode: syncing ${startDate}`);
    }

    // Get all Google Ads tables
    let query = supabase.from("crm_tables").select("*").eq("integration_type", "google_ads");
    if (table_ids && table_ids.length > 0) query = query.in("id", table_ids);

    const { data: tables, error: tablesError } = await query;
    if (tablesError) throw new Error(`Failed to fetch tables: ${tablesError.message}`);
    if (!tables || tables.length === 0) {
      return new Response(JSON.stringify({ message: "No Google Ads tables found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Found ${tables.length} Google Ads tables`);
    const results: any[] = [];
    const webhookUrl = `${supabaseUrl}/functions/v1/webhook-google-ads-sync`;

    // Group by tenant
    const byTenant = new Map<string, typeof tables>();
    for (const t of tables) {
      if (!byTenant.has(t.tenant_id)) byTenant.set(t.tenant_id, []);
      byTenant.get(t.tenant_id)!.push(t);
    }

    for (const [tenantId, tenantTables] of byTenant) {
      const { data: makeInt } = await supabase
        .from("tenant_integrations")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("integration_type", "make_api")
        .single();

      if (!makeInt) {
        for (const t of tenantTables) results.push({ table: t.name, status: "skipped", reason: "No Make integration" });
        continue;
      }

      const s = makeInt.settings as any;
      const apiToken = s?.api_token;
      const region = s?.region || "eu2";

      if (!apiToken) {
        for (const t of tenantTables) results.push({ table: t.name, status: "skipped", reason: "No API token" });
        continue;
      }

      for (const table of tenantTables) {
        const intSettings = table.integration_settings as any;
        const scenarioId = intSettings?.make_scenario_id;
        const customerId = intSettings?.customer_id;
        const campaignType = intSettings?.campaign_type || "leads";

        if (!scenarioId) {
          results.push({ table: table.name, status: "skipped", reason: "No scenario ID" });
          continue;
        }

        const sid = String(Math.floor(Number(scenarioId)));

        if (isBackfill) {
          // For backfill: split into daily chunks to avoid overloading
          const current = new Date(startDate);
          const end = new Date(endDate);
          let dayCount = 0;

          while (current <= end) {
            const dayStr = current.toISOString().slice(0, 10);
            try {
              console.log(`Backfill ${table.name}: ${dayStr}`);
              await patchAndRunScenario(apiToken, region, sid, table.id, tenantId, customerId ? String(customerId) : undefined, campaignType, dayStr, dayStr, webhookUrl);
              dayCount++;
              // Wait 5 seconds between days to avoid rate limits
              await new Promise((r) => setTimeout(r, 5000));
            } catch (err) {
              console.error(`Backfill error ${table.name} ${dayStr}:`, err instanceof Error ? err.message : err);
              results.push({ table: table.name, date: dayStr, status: "error", reason: err instanceof Error ? err.message : String(err) });
            }
            current.setDate(current.getDate() + 1);
          }
          results.push({ table: table.name, status: "backfilled", days: dayCount });
        } else {
          // Daily sync: single date
          try {
            await patchAndRunScenario(apiToken, region, sid, table.id, tenantId, customerId ? String(customerId) : undefined, campaignType, startDate, endDate, webhookUrl);
            results.push({ table: table.name, status: "triggered", date: startDate });
          } catch (err) {
            console.error(`Sync error ${table.name}:`, err instanceof Error ? err.message : err);
            results.push({ table: table.name, status: "error", reason: err instanceof Error ? err.message : String(err) });
          }
          // Wait between tables
          await new Promise((r) => setTimeout(r, 2000));
        }
      }
    }

    console.log("Sync complete:", JSON.stringify(results));
    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Cron sync error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
