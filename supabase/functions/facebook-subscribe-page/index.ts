// Subscribes a Facebook Page to the `leadgen` webhook field on the Meta App.
// Stores per-page subscription status in tenant_integrations.settings.page_subscriptions.
// Also sets settings.delivery_mode = 'webhook' for the integration.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface SubscribeBody {
  integration_id: string;
  page_id: string;
  // Optional: explicit page access token (otherwise we fetch via Graph from the user token)
  page_access_token?: string;
  action?: "subscribe" | "unsubscribe";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Auth: requires logged-in user
    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.replace("Bearer ", "");
    const { data: userData, error: userErr } = await supabase.auth.getUser(jwt);
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as SubscribeBody;
    const { integration_id, page_id, action = "subscribe" } = body;
    if (!integration_id || !page_id) {
      return new Response(JSON.stringify({ error: "integration_id and page_id are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load the integration (use service-role to bypass RLS for ownership-checked lookup)
    const { data: integration, error: intErr } = await supabase
      .from("tenant_integrations")
      .select("id, tenant_id, api_key, shared_from_integration_id, settings, integration_type")
      .eq("id", integration_id)
      .eq("integration_type", "facebook_lead_ads")
      .maybeSingle();

    if (intErr || !integration) {
      return new Response(JSON.stringify({ error: "Integration not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Resolve the user (system) access token
    let userAccessToken = integration.api_key as string | null;
    if (!userAccessToken && integration.shared_from_integration_id) {
      const { data: src } = await supabase
        .from("tenant_integrations")
        .select("api_key")
        .eq("id", integration.shared_from_integration_id)
        .maybeSingle();
      userAccessToken = (src?.api_key as string | null) ?? null;
    }
    if (!userAccessToken) {
      return new Response(JSON.stringify({ error: "No access token on integration" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get a Page Access Token (required to subscribe the page)
    let pageAccessToken = body.page_access_token;
    if (!pageAccessToken) {
      const tokenResp = await fetch(
        `https://graph.facebook.com/v21.0/${page_id}?fields=access_token&access_token=${userAccessToken}`,
      );
      const tokenJson = await tokenResp.json();
      if (!tokenResp.ok || !tokenJson?.access_token) {
        return new Response(
          JSON.stringify({
            error: "Failed to obtain Page Access Token",
            details: tokenJson,
            hint: "Ensure the connected Facebook user has the 'pages_manage_metadata' scope and is an admin on the page.",
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      pageAccessToken = tokenJson.access_token as string;
    }

    let graphResp: Response;
    if (action === "subscribe") {
      graphResp = await fetch(
        `https://graph.facebook.com/v21.0/${page_id}/subscribed_apps`,
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            subscribed_fields: "leadgen",
            access_token: pageAccessToken!,
          }),
        },
      );
    } else {
      graphResp = await fetch(
        `https://graph.facebook.com/v21.0/${page_id}/subscribed_apps?access_token=${pageAccessToken}`,
        { method: "DELETE" },
      );
    }

    const graphJson = await graphResp.json();
    if (!graphResp.ok || graphJson?.success === false) {
      return new Response(
        JSON.stringify({ error: "Graph API error", details: graphJson }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Update integration.settings (delivery_mode + page_subscriptions[page_id])
    const settings = (integration.settings as Record<string, any> | null) ?? {};
    const pageSubs = (settings.page_subscriptions as Record<string, any> | undefined) ?? {};
    if (action === "subscribe") {
      pageSubs[page_id] = { status: "subscribed", subscribed_at: new Date().toISOString() };
    } else {
      pageSubs[page_id] = { status: "unsubscribed", unsubscribed_at: new Date().toISOString() };
    }
    const newSettings = {
      ...settings,
      delivery_mode: action === "subscribe" ? "webhook" : settings.delivery_mode ?? "pull",
      page_subscriptions: pageSubs,
    };

    await supabase
      .from("tenant_integrations")
      .update({ settings: newSettings })
      .eq("id", integration_id);

    return new Response(
      JSON.stringify({ success: true, action, page_id, settings: newSettings }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("facebook-subscribe-page error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
