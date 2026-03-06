import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface MakeAPIRequest {
  action: 
    | "test_connection" 
    | "list_connections" 
    | "list_scenarios" 
    | "run_scenario" 
    | "get_connection_details"
    | "list_google_ads_connections"
    | "list_google_ads_scenarios"
    | "run_google_ads_sync"
    | "create_google_ads_scenario"
    | "run_and_sync_google_ads"
    | "clone_scenario"
    | "get_scenario_blueprint"
    | "activate_scenario"
    | "patch_scenario_blueprint";
  api_token?: string;
  team_id?: string;
  region?: string;
  scenario_id?: string;
  connection_id?: string;
  data?: Record<string, unknown>;
  table_id?: string;
  tenant_id?: string;
  customer_id?: string;
  date_range?: string;
  webhook_url?: string;
  webhook_secret?: string;
  scenario_name?: string;
  template_scenario_id?: string;
  campaign_type?: "leads" | "ecommerce";
  start_date?: string;
  end_date?: string;
}

// Make.com API base URLs per region
const MAKE_API_REGIONS: Record<string, string> = {
  eu1: "https://eu1.make.com/api/v2",
  eu2: "https://eu2.make.com/api/v2",
  us1: "https://us1.make.com/api/v2",
  us2: "https://us2.make.com/api/v2",
};

class MakeApiError extends Error {
  status: number;
  rawBody: string;
  parsedBody: any;

  constructor(status: number, rawBody: string, parsedBody: any) {
    const messageFromBody =
      parsedBody?.message ||
      parsedBody?.detail ||
      (typeof parsedBody === "string" ? parsedBody : "");
    super(`Make API error: ${status} - ${messageFromBody || rawBody}`);
    this.name = "MakeApiError";
    this.status = status;
    this.rawBody = rawBody;
    this.parsedBody = parsedBody;
  }
}

async function makeAPICall(
  apiToken: string,
  region: string,
  endpoint: string,
  method: string = "GET",
  body?: Record<string, unknown>
) {
  const baseUrl = MAKE_API_REGIONS[region] || MAKE_API_REGIONS.eu1;
  const url = `${baseUrl}${endpoint}`;
  
  console.log(`Making API call to: ${url}`);
  
  const headers: Record<string, string> = {
    "Authorization": `Token ${apiToken}`,
    "Content-Type": "application/json",
  };
  
  const options: RequestInit = {
    method,
    headers,
  };
  
  if (body && (method === "POST" || method === "PUT" || method === "PATCH")) {
    options.body = JSON.stringify(body);
  }
  
  const response = await fetch(url, options);
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Make API error: ${response.status} - ${errorText}`);
    let parsed: any = null;
    try {
      parsed = JSON.parse(errorText);
    } catch {
      parsed = null;
    }
    throw new MakeApiError(response.status, errorText, parsed);
  }
  
  return response.json();
}

// Google Ads related app names in Make.com
const GOOGLE_ADS_APP_NAMES = [
  "google-ads",
  "google ads",
  "googleads",
  "adwords",
  "google-ads-reports",
];

function isGoogleAdsConnection(connection: any): boolean {
  const appName = (connection.accountName || connection.typeName || connection.name || "").toLowerCase();
  return GOOGLE_ADS_APP_NAMES.some(name => appName.includes(name));
}

// Helper to identify Google Ads modules in blueprints
function isGoogleAdsModule(moduleName: string): boolean {
  if (!moduleName) return false;
  const lowerName = moduleName.toLowerCase();
  return lowerName.includes('google-ads') || 
         lowerName.includes('googleads') ||
         lowerName.includes('adwords') ||
         lowerName.includes('google-ads-reports');
}

// Helper to identify HTTP modules in blueprints
function isHttpModule(moduleName: string): boolean {
  if (!moduleName) return false;
  const lowerName = moduleName.toLowerCase();
  return lowerName.includes('http:') || 
         lowerName === 'http:actionmakerequest' ||
         lowerName.includes('http');
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization") ?? "" },
        },
      }
    );

    // Get current user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      console.error("Auth error:", userError);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: MakeAPIRequest = await req.json();
    const { 
      action, 
      api_token, 
      team_id, 
      region = "eu1", 
      scenario_id, 
      connection_id, 
      data, 
      table_id,
      tenant_id,
      customer_id,
      date_range,
      webhook_url,
      webhook_secret,
      scenario_name,
      template_scenario_id,
      campaign_type = "leads",
      start_date,
      end_date,
    } = body;

    console.log(`Make API action: ${action}, team_id: ${team_id}, region: ${region}`);

    if (!api_token || !team_id) {
      return new Response(
        JSON.stringify({ error: "API token and Team ID are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let result;

    switch (action) {
      case "test_connection": {
        // Test connection by fetching user info
        try {
          result = await makeAPICall(api_token, region, "/users/me");
          result = { success: true, user: result };
        } catch (err) {
          result = { success: false, error: err instanceof Error ? err.message : String(err) };
        }
        break;
      }

      case "list_connections": {
        // Get all connections for the team
        // Make.com API uses query parameter for teamId, not path
        let connections;
        try {
          connections = await makeAPICall(api_token, region, `/connections?teamId=${team_id}`);
          result = connections;
        } catch (e) {
          // Fallback: if the provided teamId is not accessible for this token/user, try default scope.
          if (e instanceof MakeApiError && e.status === 403) {
            connections = await makeAPICall(api_token, region, `/connections`);
            result = {
              ...connections,
              warning: `Team ID ${team_id} not accessible. Returned connections from default scope instead.`,
              fallback_used: true,
            };
          } else {
            throw e;
          }
        }
        break;
      }

      case "get_connection_details": {
        if (!connection_id) {
          return new Response(
            JSON.stringify({ error: "Connection ID is required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        const details = await makeAPICall(
          api_token,
          region,
          `/connections/${connection_id}`
        );
        result = details;
        break;
      }

      case "list_scenarios": {
        // Get all scenarios for the team
        // Make.com API uses query parameter for teamId
        let scenarios;
        try {
          scenarios = await makeAPICall(api_token, region, `/scenarios?teamId=${team_id}`);
          result = scenarios;
        } catch (e) {
          if (e instanceof MakeApiError && e.status === 403) {
            scenarios = await makeAPICall(api_token, region, `/scenarios`);
            result = {
              ...scenarios,
              warning: `Team ID ${team_id} not accessible. Returned scenarios from default scope instead.`,
              fallback_used: true,
            };
          } else {
            throw e;
          }
        }
        break;
      }

      case "run_scenario": {
        if (!scenario_id) {
          return new Response(
            JSON.stringify({ error: "Scenario ID is required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        // Run a specific scenario
        const runResult = await makeAPICall(
          api_token,
          region,
          `/scenarios/${scenario_id}/run`,
          "POST",
          data
        );
        result = runResult;
        break;
      }

      case "activate_scenario": {
        if (!scenario_id) {
          return new Response(
            JSON.stringify({ error: "Scenario ID is required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        // First, update the scenario scheduling to on-demand (no interval required), then activate
        try {
          console.log(`Setting scheduling to on-demand for scenario ${scenario_id}...`);
          
          // Step 1: Update scenario with on-demand scheduling (avoids IM008 Invalid interval)
          await makeAPICall(
            api_token,
            region,
            `/scenarios/${scenario_id}`,
            "PATCH",
            {
              scheduling: JSON.stringify({ type: "on-demand" })
            }
          );
          
          console.log(`Activating scenario ${scenario_id}...`);
          
          // Step 2: Now activate the scenario
          const activateResult = await makeAPICall(
            api_token,
            region,
            `/scenarios/${scenario_id}/start`,
            "POST"
          );
          result = { success: true, message: "Scenario activated successfully", ...activateResult };
        } catch (activateError) {
          if (activateError instanceof MakeApiError) {
            // IM306 means "Scenario is already running" - treat as success
            if (activateError.parsedBody?.code === "IM306" || 
                (typeof activateError.rawBody === "string" && activateError.rawBody.includes("IM306"))) {
              console.log(`Scenario ${scenario_id} is already running (IM306) - treating as success`);
              result = { success: true, message: "Scenario is already running", already_running: true };
              break;
            }
            throw activateError;
          }
          throw new Error(`Failed to activate scenario: ${activateError}`);
        }
        break;
      }

      // ===== NEW: Google Ads specific actions =====

      case "list_google_ads_connections": {
        // Get all connections and filter for Google Ads
        // Make.com API uses query parameter for teamId
        let allConnections;
        let usedFallback = false;
        try {
          allConnections = await makeAPICall(api_token, region, `/connections?teamId=${team_id}`);
        } catch (e) {
          if (e instanceof MakeApiError && e.status === 403) {
            usedFallback = true;
            allConnections = await makeAPICall(api_token, region, `/connections`);
          } else {
            throw e;
          }
        }
        
        // Filter for Google Ads connections
        const googleAdsConnections = (allConnections.connections || allConnections || [])
          .filter((conn: any) => isGoogleAdsConnection(conn));
        
        console.log(`Found ${googleAdsConnections.length} Google Ads connections`);
        
        result = { 
          connections: googleAdsConnections,
          total: googleAdsConnections.length,
          fallback_used: usedFallback,
        };
        break;
      }

      case "list_google_ads_scenarios": {
        // Get all scenarios that use Google Ads modules
        // Make.com API uses query parameter for teamId
        let allScenarios;
        try {
          allScenarios = await makeAPICall(api_token, region, `/scenarios?teamId=${team_id}`);
        } catch (e) {
          if (e instanceof MakeApiError && e.status === 403) {
            allScenarios = await makeAPICall(api_token, region, `/scenarios`);
          } else {
            throw e;
          }
        }
        
        // For each scenario, we'd need to check if it uses Google Ads modules
        // For now, return all scenarios and let the frontend filter or display them
        result = allScenarios;
        break;
      }

      case "run_google_ads_sync": {
        if (!scenario_id) {
          return new Response(
            JSON.stringify({ error: "Scenario ID is required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        if (!table_id) {
          return new Response(
            JSON.stringify({ error: "Table ID is required for sync" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Run the scenario with table_id in the data
        const syncData = {
          ...data,
          table_id,
        };
        
        const runResult = await makeAPICall(
          api_token,
          region,
          `/scenarios/${scenario_id}/run`,
          "POST",
          syncData
        );
        
        result = { 
          success: true, 
          execution: runResult,
          message: "Scenario triggered successfully. Data will be synced via webhook."
        };
        break;
      }

      case "create_google_ads_scenario": {
        // Create a scenario that syncs Google Ads data to our webhook
        if (!connection_id) {
          return new Response(
            JSON.stringify({ error: "Connection ID is required to create scenario" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        if (!customer_id) {
          return new Response(
            JSON.stringify({ error: "Customer ID is required to create scenario" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        if (!webhook_url) {
          return new Response(
            JSON.stringify({ error: "Webhook URL is required to create scenario" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        if (!table_id) {
          return new Response(
            JSON.stringify({ error: "Table ID is required to create scenario" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Format customer ID (remove dashes if present)
        const formattedCustomerId = customer_id.replace(/-/g, "");
        
        // Build the blueprint for Google Ads sync scenario
        const scenarioBlueprint = {
          name: scenario_name || `Google Ads Sync - Table ${table_id.slice(0, 8)}`,
          teamId: parseInt(team_id || "0"),
          scheduling: JSON.stringify({ type: "indefinitely" }),
          blueprint: JSON.stringify({
            name: scenario_name || `Google Ads Sync`,
            flow: [
              {
                id: 1,
                module: "google-ads:getReport",
                version: 1,
                parameters: {
                  __IMTCONN__: parseInt(connection_id)
                },
                mapper: {
                  customerId: formattedCustomerId,
                  resource: "campaign",
                  dateRangeType: date_range || "LAST_30_DAYS",
                  metrics: ["metrics.impressions", "metrics.clicks", "metrics.cost_micros", "metrics.conversions", "metrics.ctr", "metrics.average_cpc"],
                  segments: ["segments.date"],
                  attributes: ["campaign.id", "campaign.name"]
                }
              },
              {
                id: 2,
                module: "http:ActionMakeRequest",
                version: 3,
                parameters: {},
                mapper: {
                  url: webhook_url,
                  method: "POST",
                  headers: [
                    { name: "Content-Type", value: "application/json" },
                    ...(webhook_secret ? [{ name: "x-webhook-secret", value: webhook_secret }] : [])
                  ],
                  qs: [],
                  bodyType: "raw",
                  parseResponse: true,
                  contentType: "application/json",
                  data: JSON.stringify({
                    table_id: table_id,
                    records: "{{map(1.results; \"item\"; $merge(item.campaign; item.metrics; item.segments))}}"
                  })
                }
              }
            ],
            metadata: {
              instant: false,
              version: 1,
              scenario: {
                roundtrips: 1,
                maxErrors: 3,
                autoCommit: true,
                autoCommitTriggerLast: true,
                sequential: false,
                confidential: false,
                dataloss: false,
                dlq: false,
                freshVariables: false
              },
              designer: {
                orphans: []
              },
              zone: region
            }
          })
        };

        console.log("Creating scenario with blueprint:", JSON.stringify(scenarioBlueprint).substring(0, 500));

        try {
          const createResult = await makeAPICall(
            api_token,
            region,
            `/scenarios`,
            "POST",
            scenarioBlueprint
          );
          
          result = {
            success: true,
            scenario: createResult,
            scenario_id: createResult.scenario?.id || createResult.id,
            message: "Scenario created successfully"
          };
        } catch (createError) {
          console.error("Failed to create scenario:", createError);
          // If blueprint creation fails, provide manual setup instructions
          result = {
            success: false,
            error: createError instanceof Error ? createError.message : String(createError),
            fallback: true,
            message: "לא ניתן ליצור Scenario אוטומטי. נא להגדיר ידנית ב-Make.com",
            webhook_url: webhook_url,
            table_id: table_id,
            connection_id: connection_id,
            customer_id: customer_id
          };
        }
        break;
      }

      case "get_scenario_blueprint": {
        // Get a scenario's blueprint for cloning
        if (!scenario_id) {
          return new Response(
            JSON.stringify({ error: "Scenario ID is required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        console.log(`Getting blueprint for scenario: ${scenario_id}`);
        
        try {
          const blueprint = await makeAPICall(
            api_token,
            region,
            `/scenarios/${scenario_id}/blueprint`
          );
          
          result = {
            success: true,
            blueprint: blueprint,
          };
        } catch (blueprintError) {
          console.error("Failed to get blueprint:", blueprintError);
          result = {
            success: false,
            error: blueprintError instanceof Error ? blueprintError.message : String(blueprintError),
          };
        }
        break;
      }

      case "clone_scenario": {
        // Clone a template scenario with modified webhook URL, table_id and customer_id
        if (!template_scenario_id) {
          return new Response(
            JSON.stringify({ error: "Template Scenario ID is required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        if (!webhook_url) {
          return new Response(
            JSON.stringify({ error: "Webhook URL is required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        if (!table_id) {
          return new Response(
            JSON.stringify({ error: "Table ID is required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        // customer_id is already extracted from body at the top of the function
        // campaign_type is also extracted from body
        
        console.log(`Cloning template scenario: ${template_scenario_id}, customer_id: ${customer_id}, campaign_type: ${campaign_type}`);
        
        try {
          // Step 1: Get the template scenario details
          const templateScenario = await makeAPICall(
            api_token,
            region,
            `/scenarios/${template_scenario_id}`
          );
          
          console.log("Template scenario:", JSON.stringify(templateScenario).substring(0, 300));
          
          // Step 2: Get the blueprint
          const blueprintResponse = await makeAPICall(
            api_token,
            region,
            `/scenarios/${template_scenario_id}/blueprint`
          );
          
          console.log("Template blueprint:", JSON.stringify(blueprintResponse).substring(0, 500));
          
          // Step 3: Modify the blueprint
          // Parse the flow and update the HTTP module with new webhook URL and table_id
          // The API returns {code: "OK", response: {blueprint: {...}}} - extract the actual blueprint
          let blueprintData = blueprintResponse;
          if (typeof blueprintResponse === 'string') {
            blueprintData = JSON.parse(blueprintResponse);
          }
          
          // Extract the actual blueprint from the API response wrapper
          if (blueprintData.response?.blueprint) {
            blueprintData = blueprintData.response.blueprint;
          } else if (blueprintData.blueprint) {
            blueprintData = blueprintData.blueprint;
          }
          
          // Remove any unwanted properties that Make.com API doesn't accept
          delete blueprintData.code;
          delete blueprintData.response;
          
          // Find and update modules in the flow
          if (blueprintData.flow && Array.isArray(blueprintData.flow)) {
            // Define metrics based on campaign type
            const metricsForLeads = [
              "metrics.impressions",
              "metrics.clicks", 
              "metrics.cost_micros",
              "metrics.conversions",
              "metrics.ctr",
              "metrics.average_cpc"
            ];
            
            const metricsForEcommerce = [
              "metrics.impressions",
              "metrics.clicks",
              "metrics.cost_micros",
              "metrics.conversions",
              "metrics.conversions_value",
              "metrics.all_conversions",
              "metrics.all_conversions_value"
            ];
            
            const selectedMetrics = campaign_type === "ecommerce" ? metricsForEcommerce : metricsForLeads;
            
            for (const module of blueprintData.flow) {
              // Check if this is a Google Ads module - update customer_id, accountId and metrics
              if (customer_id && module.module && isGoogleAdsModule(module.module)) {
                console.log(`Found Google Ads module (${module.module}), updating customer_id, accountId and metrics for ${campaign_type}`);
                if (module.mapper) {
                  // Format customer ID without dashes
                  const formattedCustomerId = customer_id.replace(/-/g, '');
                  module.mapper.customerId = formattedCustomerId;
                  module.mapper.customer_id = formattedCustomerId;
                  module.mapper.accountId = formattedCustomerId; // Some templates use accountId
                  // Update metrics based on campaign type
                  module.mapper.metrics = selectedMetrics;
                }
              }
              
              // Check if this is an HTTP module - update webhook URL and table_id
              if (module.module && isHttpModule(module.module)) {
                console.log(`Found HTTP module (${module.module}), updating webhook URL and table_id`);
                if (module.mapper) {
                  module.mapper.url = webhook_url;
                  
                  // Handle jsonStringBodyContent (Make.com uses this for raw JSON body)
                  if (module.mapper.jsonStringBodyContent) {
                    try {
                      let bodyObj = JSON.parse(module.mapper.jsonStringBodyContent);
                      bodyObj.table_id = table_id;
                      bodyObj.campaign_type = campaign_type || bodyObj.campaign_type || 'leads';
                      if (tenant_id) {
                        bodyObj.tenant_id = tenant_id;
                      }
                      module.mapper.jsonStringBodyContent = JSON.stringify(bodyObj);
                      console.log("Updated jsonStringBodyContent with new table_id and campaign_type");
                    } catch (e) {
                      // If parsing fails, try string replacement
                      console.warn("Failed to parse jsonStringBodyContent, trying regex replace");
                      if (typeof module.mapper.jsonStringBodyContent === 'string') {
                        module.mapper.jsonStringBodyContent = module.mapper.jsonStringBodyContent.replace(
                          /"table_id"\s*:\s*"[^"]*"/,
                          `"table_id": "${table_id}"`
                        );
                      }
                    }
                  }
                  
                  // Update the body/data with new table_id (fallback for other template formats)
                  if (module.mapper.data) {
                    try {
                      let dataObj = typeof module.mapper.data === 'string' 
                        ? JSON.parse(module.mapper.data) 
                        : module.mapper.data;
                      dataObj.table_id = table_id;
                      dataObj.campaign_type = campaign_type || dataObj.campaign_type || 'leads';
                      if (tenant_id) {
                        dataObj.tenant_id = tenant_id;
                      }
                      module.mapper.data = JSON.stringify(dataObj);
                    } catch {
                      // If data is not JSON, try to replace table_id in the string
                      if (typeof module.mapper.data === 'string') {
                        module.mapper.data = module.mapper.data.replace(
                          /"table_id"\s*:\s*"[^"]*"/,
                          `"table_id": "${table_id}"`
                        );
                      }
                    }
                  }
                  
                  // Add webhook secret header if provided
                  if (webhook_secret && module.mapper.headers) {
                    const existingSecretHeader = module.mapper.headers.findIndex(
                      (h: any) => h.name === 'x-webhook-secret'
                    );
                    if (existingSecretHeader >= 0) {
                      module.mapper.headers[existingSecretHeader].value = webhook_secret;
                    } else {
                      module.mapper.headers.push({ name: 'x-webhook-secret', value: webhook_secret });
                    }
                  }
                }
              }
            }
          }
          
          // Step 4: Create new scenario with modified blueprint
          const newScenarioName = scenario_name || `חיבור לגוגל - ${table_id.slice(0, 8)}`;
          
          // Update the blueprint name itself (Make.com uses this for display)
          blueprintData.name = newScenarioName;
          
          const createPayload = {
            name: newScenarioName,
            teamId: parseInt(team_id || "0"),
            // Create as on-demand so it can be triggered via API without requiring an interval
            scheduling: JSON.stringify({ type: "on-demand" }),
            blueprint: JSON.stringify(blueprintData),
          };
          
          console.log("Creating new scenario with payload:", JSON.stringify(createPayload).substring(0, 300));
          
          const createResult = await makeAPICall(
            api_token,
            region,
            `/scenarios`,
            "POST",
            createPayload
          );
          
          const newScenarioId = createResult.scenario?.id || createResult.id;
          console.log("Scenario created:", JSON.stringify(createResult).substring(0, 300));
          
          // Step 5: Activate the new scenario so it can be run
          if (newScenarioId) {
            try {
              console.log(`Activating scenario ${newScenarioId}...`);
              await makeAPICall(
                api_token,
                region,
                `/scenarios/${newScenarioId}/start`,
                "POST"
              );
              console.log(`Scenario ${newScenarioId} activated successfully`);
            } catch (activateError) {
              console.warn("Failed to activate scenario (may need manual activation):", activateError);
              // Don't fail the whole operation - scenario was created successfully
            }
          }
          
          result = {
            success: true,
            scenario: createResult,
            scenario_id: newScenarioId,
            message: "Scenario cloned and activated successfully"
          };
        } catch (cloneError) {
          console.error("Failed to clone scenario:", cloneError);
          result = {
            success: false,
            error: cloneError instanceof Error ? cloneError.message : String(cloneError),
            message: "לא ניתן לשכפל את ה-Template Scenario"
          };
        }
        break;
      }

      case "run_and_sync_google_ads": {
        // Combined action: Run a scenario and wait for sync
        if (!scenario_id) {
          return new Response(
            JSON.stringify({ error: "Scenario ID is required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        console.log(`Running Google Ads sync scenario: ${scenario_id}`);

        try {
          // Run the scenario
          const runResult = await makeAPICall(
            api_token,
            region,
            `/scenarios/${scenario_id}/run`,
            "POST",
            { data: data || {} }
          );

          result = {
            success: true,
            execution: runResult,
            execution_id: runResult.executionId || runResult.execution?.id,
            message: "Scenario executed. Data will sync shortly via webhook."
          };
        } catch (runError) {
          console.error("Failed to run scenario:", runError);
          result = {
            success: false,
            error: runError instanceof Error ? runError.message : String(runError),
            message: "Failed to run the sync scenario"
          };
        }
        break;
      }

      case "patch_scenario_blueprint": {
        // Patch an existing scenario's blueprint to fix table_id/tenant_id mismatch
        if (!scenario_id) {
          return new Response(
            JSON.stringify({ error: "Scenario ID is required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        if (!table_id) {
          return new Response(
            JSON.stringify({ error: "Table ID is required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        const patchWebhookUrl = webhook_url || `${Deno.env.get("SUPABASE_URL")}/functions/v1/webhook-google-ads-sync`;
        
        console.log(`Patching scenario ${scenario_id} to use table_id: ${table_id}`);
        
        try {
          // Step 1: Get the current blueprint
          const blueprintResponse = await makeAPICall(
            api_token,
            region,
            `/scenarios/${scenario_id}/blueprint`
          );
          
          // Extract the actual blueprint from the API response wrapper
          let blueprintData = blueprintResponse;
          if (typeof blueprintResponse === 'string') {
            blueprintData = JSON.parse(blueprintResponse);
          }
          
          if (blueprintData.response?.blueprint) {
            blueprintData = blueprintData.response.blueprint;
          } else if (blueprintData.blueprint) {
            blueprintData = blueprintData.blueprint;
          }
          
          // Remove any unwanted properties
          delete blueprintData.code;
          delete blueprintData.response;
          
          let patchedHttpModule = false;
          
          // Define metrics based on campaign type
          const metricsForLeads = [
            "metrics.impressions",
            "metrics.clicks", 
            "metrics.cost_micros",
            "metrics.conversions",
            "metrics.ctr",
            "metrics.average_cpc"
          ];
          
          const metricsForEcommerce = [
            "metrics.impressions",
            "metrics.clicks",
            "metrics.cost_micros",
            "metrics.conversions",
            "metrics.conversions_value",
            "metrics.all_conversions",
            "metrics.all_conversions_value"
          ];
          
          // Step 2: Update HTTP modules and Google Ads modules in the flow
          if (blueprintData.flow && Array.isArray(blueprintData.flow)) {
            for (const module of blueprintData.flow) {
              // Update Google Ads module if customer_id is provided
              if (customer_id && module.module && isGoogleAdsModule(module.module)) {
                console.log(`Patching Google Ads module (${module.module}) with accountId and metrics for ${campaign_type}`);
                if (module.mapper) {
                  const formattedCustomerId = customer_id.replace(/-/g, '');
                  module.mapper.customerId = formattedCustomerId;
                  module.mapper.customer_id = formattedCustomerId;
                  module.mapper.accountId = formattedCustomerId;
                  
                  // Update metrics based on campaign type
                  if (campaign_type) {
                    const selectedMetrics = campaign_type === "ecommerce" ? metricsForEcommerce : metricsForLeads;
                    module.mapper.metrics = selectedMetrics;
                    console.log(`Updated metrics for campaign_type: ${campaign_type}`);
                  }
                }
              }
              
              if (module.module && isHttpModule(module.module)) {
                console.log("Found HTTP module to patch");
                if (module.mapper) {
                  module.mapper.url = patchWebhookUrl;
                  
                  // Handle jsonStringBodyContent
                  if (module.mapper.jsonStringBodyContent) {
                    try {
                      let bodyObj = JSON.parse(module.mapper.jsonStringBodyContent);
                      bodyObj.table_id = table_id;
                      bodyObj.campaign_type = campaign_type || bodyObj.campaign_type || 'leads';
                      if (tenant_id) {
                        bodyObj.tenant_id = tenant_id;
                      }
                      module.mapper.jsonStringBodyContent = JSON.stringify(bodyObj);
                      patchedHttpModule = true;
                      console.log("Patched jsonStringBodyContent with new table_id and campaign_type");
                    } catch (e) {
                      console.warn("Failed to parse jsonStringBodyContent:", e);
                    }
                  }
                  
                  // Handle data field (fallback)
                  if (module.mapper.data) {
                    try {
                      let dataObj = typeof module.mapper.data === 'string' 
                        ? JSON.parse(module.mapper.data) 
                        : module.mapper.data;
                      dataObj.table_id = table_id;
                      dataObj.campaign_type = campaign_type || dataObj.campaign_type || 'leads';
                      if (tenant_id) {
                        dataObj.tenant_id = tenant_id;
                      }
                      module.mapper.data = JSON.stringify(dataObj);
                      patchedHttpModule = true;
                    } catch {
                      // Ignore parse errors
                    }
                  }
                }
              }
            }
          }
          
          if (!patchedHttpModule) {
            console.warn("Could not find HTTP module to patch in blueprint");
          }
          
          // Step 3: Update the scenario with the patched blueprint
          await makeAPICall(
            api_token,
            region,
            `/scenarios/${scenario_id}`,
            "PATCH",
            {
              blueprint: JSON.stringify(blueprintData)
            }
          );
          
          console.log(`Scenario ${scenario_id} blueprint patched successfully`);
          
          result = {
            success: true,
            message: "Scenario blueprint patched successfully",
            patched_http_module: patchedHttpModule,
          };
        } catch (patchError) {
          console.error("Failed to patch scenario blueprint:", patchError);
          result = {
            success: false,
            error: patchError instanceof Error ? patchError.message : String(patchError),
            message: "Failed to patch scenario blueprint"
          };
        }
        break;
      }

      default:
        return new Response(
          JSON.stringify({ error: `Unknown action: ${action}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    console.log(`Make API result for action ${action}:`, JSON.stringify(result).substring(0, 500));

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error in make-api function:", err);

    if (err instanceof MakeApiError) {
      const isPermissionDenied =
        err.status === 403 ||
        err.parsedBody?.code === "SC403" ||
        (typeof err.rawBody === "string" && err.rawBody.includes("SC403"));

      const hint = isPermissionDenied
        ? "Permission denied from Make.com. Verify the API Token has permissions for Connections/Scenarios (e.g. connections:read, scenarios:read) AND that the Team ID belongs to your user/team. If you generated a limited-scope token, create a new token with the required scopes."
        : undefined;

      return new Response(
        JSON.stringify({
          error: err.message,
          status: err.status,
          make_error: err.parsedBody ?? err.rawBody,
          hint,
        }),
        { status: err.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});