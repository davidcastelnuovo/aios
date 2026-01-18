import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface MakeAPIRequest {
  action: "test_connection" | "list_connections" | "list_scenarios" | "run_scenario" | "get_connection_details";
  api_token?: string;
  team_id?: string;
  region?: string;
  scenario_id?: string;
  connection_id?: string;
  data?: Record<string, unknown>;
}

// Make.com API base URLs per region
const MAKE_API_REGIONS: Record<string, string> = {
  eu1: "https://eu1.make.com/api/v2",
  eu2: "https://eu2.make.com/api/v2",
  us1: "https://us1.make.com/api/v2",
  us2: "https://us2.make.com/api/v2",
};

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
    throw new Error(`Make API error: ${response.status} - ${errorText}`);
  }
  
  return response.json();
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
    const { action, api_token, team_id, region = "eu1", scenario_id, connection_id, data } = body;

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
        const connections = await makeAPICall(
          api_token,
          region,
          `/teams/${team_id}/connections`
        );
        result = connections;
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
        const scenarios = await makeAPICall(
          api_token,
          region,
          `/teams/${team_id}/scenarios`
        );
        result = scenarios;
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
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
