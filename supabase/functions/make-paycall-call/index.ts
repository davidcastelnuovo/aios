import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: { user }, error: authError } = await createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    ).auth.getUser();

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { to_number, lead_id, client_id, tenant_id } = await req.json();

    if (!to_number || !tenant_id) {
      return new Response(JSON.stringify({ error: "Missing required fields: to_number, tenant_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if Paycall is configured
    const { data: integration } = await supabase
      .from("tenant_integrations")
      .select("*")
      .eq("tenant_id", tenant_id)
      .eq("integration_type", "paycall")
      .eq("is_active", true)
      .maybeSingle();

    if (!integration) {
      // Create a log entry with failed status
      const { data: callLog } = await supabase.from("call_logs").insert({
        tenant_id,
        lead_id: lead_id || null,
        client_id: client_id || null,
        caller_user_id: user.id,
        to_number,
        status: "failed",
        notes: "Paycall לא מוגדר - יש להגדיר את האינטגרציה בדף הגדרות טלפוניה",
      }).select().single();

      return new Response(JSON.stringify({
        error: "Paycall not configured",
        message: "יש להגדיר את אינטגרציית Paycall בהגדרות הטלפוניה לפני ביצוע שיחות",
        call_log: callLog,
      }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get user's telephony settings
    const { data: settings } = await supabase
      .from("telephony_settings")
      .select("*")
      .eq("tenant_id", tenant_id)
      .eq("user_id", user.id)
      .maybeSingle();

    const fromNumber = settings?.personal_phone || settings?.virtual_number;

    // Create call log with initiated status
    const { data: callLog, error: insertError } = await supabase.from("call_logs").insert({
      tenant_id,
      lead_id: lead_id || null,
      client_id: client_id || null,
      caller_user_id: user.id,
      from_number: fromNumber,
      to_number,
      status: "initiated",
      provider: "paycall",
    }).select().single();

    if (insertError) {
      throw insertError;
    }

    // TODO: Call Paycall API here when credentials are available
    // const paycallApiKey = integration.settings?.api_key;
    // const paycallResponse = await fetch('https://api.paycall.co.il/...', { ... });

    return new Response(JSON.stringify({
      success: true,
      message: "שיחה יזומה - בהמתנה לחיבור API של Paycall",
      call_log: callLog,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in make-paycall-call:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
