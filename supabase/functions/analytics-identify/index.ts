import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface IdentifyPayload {
  tracking_id: string;
  visitor_fingerprint: string;
  email?: string;
  phone?: string;
  name?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload: IdentifyPayload = await req.json();
    const { tracking_id, visitor_fingerprint, email, phone, name } = payload;

    if (!tracking_id || !visitor_fingerprint) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!email && !phone) {
      return new Response(
        JSON.stringify({ error: "Email or phone required for identification" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get tracking config
    const { data: config, error: configError } = await supabase
      .from("site_tracking_configs")
      .select("id, tenant_id, client_id")
      .eq("tracking_id", tracking_id)
      .single();

    if (configError || !config) {
      return new Response(
        JSON.stringify({ error: "Invalid tracking ID" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Find the visitor
    const { data: visitor, error: visitorError } = await supabase
      .from("site_visitors")
      .select("id, lead_id")
      .eq("tracking_config_id", config.id)
      .eq("visitor_fingerprint", visitor_fingerprint)
      .single();

    if (visitorError || !visitor) {
      return new Response(
        JSON.stringify({ error: "Visitor not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If already linked to a lead, return early
    if (visitor.lead_id) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          already_linked: true,
          lead_id: visitor.lead_id 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Try to find existing lead by email or phone
    let leadQuery = supabase
      .from("leads")
      .select("id")
      .eq("tenant_id", config.tenant_id);

    if (email) {
      leadQuery = leadQuery.eq("email", email);
    } else if (phone) {
      // Normalize phone for matching
      const normalizedPhone = phone.replace(/\D/g, "");
      leadQuery = leadQuery.or(`phone.eq.${phone},phone.eq.${normalizedPhone}`);
    }

    const { data: existingLead } = await leadQuery.limit(1).single();

    let lead_id = existingLead?.id;

    // If no existing lead and we're tracking for a specific client, 
    // we might want to create one (optional feature)
    // For now, just link if lead exists

    if (lead_id) {
      // Link visitor to lead
      const { error: updateError } = await supabase
        .from("site_visitors")
        .update({ lead_id })
        .eq("id", visitor.id);

      if (updateError) {
        console.error("Error linking visitor to lead:", updateError);
        return new Response(
          JSON.stringify({ error: "Failed to link visitor to lead" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Log an event for the identification
      const { data: latestSession } = await supabase
        .from("site_sessions")
        .select("id")
        .eq("visitor_id", visitor.id)
        .order("started_at", { ascending: false })
        .limit(1)
        .single();

      if (latestSession) {
        await supabase.from("site_events").insert({
          session_id: latestSession.id,
          visitor_id: visitor.id,
          tracking_config_id: config.id,
          event_name: "visitor_identified",
          event_category: "system",
          event_data: { email, phone, name, lead_id },
          tenant_id: config.tenant_id,
        });
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        linked: !!lead_id,
        lead_id 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Analytics identify error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
