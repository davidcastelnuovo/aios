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
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const payload = await req.json();
    console.log("Paycall webhook received:", JSON.stringify(payload));

    const {
      call_id,
      status,
      duration,
      recording_url,
      recording_duration,
    } = payload;

    if (!call_id) {
      return new Response(JSON.stringify({ error: "Missing call_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find the call log by provider_call_id
    const { data: existingLog } = await supabase
      .from("call_logs")
      .select("*")
      .eq("provider_call_id", call_id)
      .maybeSingle();

    if (existingLog) {
      // Update existing call log
      const updateData: Record<string, unknown> = {};
      if (status) updateData.status = status;
      if (duration !== undefined) updateData.duration = duration;
      if (recording_url) updateData.recording_url = recording_url;
      if (recording_duration !== undefined) updateData.recording_duration = recording_duration;

      await supabase
        .from("call_logs")
        .update(updateData)
        .eq("id", existingLog.id);
    } else {
      console.log("No matching call log found for provider_call_id:", call_id);
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in paycall-webhook:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
