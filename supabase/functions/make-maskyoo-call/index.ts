import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: { user } } = await createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    ).auth.getUser();

    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { to_number, lead_id, client_id, tenant_id, from_number } = await req.json();
    if (!to_number || !tenant_id) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: settings } = await supabase
      .from("maskyoo_settings")
      .select("*")
      .eq("tenant_id", tenant_id)
      .eq("is_active", true)
      .maybeSingle();

    if (!settings) {
      const { data: callLog } = await supabase.from("call_logs").insert({
        tenant_id, lead_id: lead_id || null, client_id: client_id || null,
        caller_user_id: user.id, to_number, status: "failed",
        provider: "maskyoo",
        notes: "Maskyoo לא מוגדר - יש להגדיר אינטגרציה תחת הגדרות מרכזייה",
      }).select().single();
      return new Response(JSON.stringify({
        error: "Maskyoo not configured",
        message: "יש להגדיר את אינטגרציית Maskyoo לפני ביצוע שיחות",
        call_log: callLog,
      }), { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Get user's personal phone (preferred from telephony_settings, fallback to default)
    const { data: telSettings } = await supabase
      .from("telephony_settings")
      .select("personal_phone, virtual_number")
      .eq("tenant_id", tenant_id)
      .eq("user_id", user.id)
      .maybeSingle();

    const userPhone = from_number || telSettings?.personal_phone || settings.default_user_phone;
    if (!userPhone) {
      return new Response(JSON.stringify({
        error: "Missing user phone",
        message: "יש להגדיר מספר אישי בהגדרות הטלפוניה או ב-Maskyoo",
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Create call log
    const { data: callLog, error: insertError } = await supabase.from("call_logs").insert({
      tenant_id, lead_id: lead_id || null, client_id: client_id || null,
      caller_user_id: user.id,
      from_number: userPhone, to_number,
      status: "initiated", provider: "maskyoo",
    }).select().single();
    if (insertError) throw insertError;

    // Trigger Maskyoo Click2Call (onetouch) — connects userPhone to to_number
    const baseUrl = settings.base_url.replace(/\/$/, "");
    const params = new URLSearchParams({
      service: settings.click2call_service || "onetouch",
      user_phone: userPhone,
      destination: to_number,
      format: "json",
    });
    const apiUrl = `${baseUrl}/api/?${params.toString()}`;

    const maskyooRes = await fetch(apiUrl, {
      method: "GET",
      headers: { "Authorization": `Bearer ${settings.api_token}` },
    });
    const maskyooBody = await maskyooRes.text();
    let maskyooData: any = {};
    try { maskyooData = JSON.parse(maskyooBody); } catch { maskyooData = { raw: maskyooBody }; }

    if (!maskyooRes.ok || maskyooData?.status?.code && maskyooData.status.code !== "200") {
      await supabase.from("call_logs").update({
        status: "failed",
        notes: `Maskyoo error: ${JSON.stringify(maskyooData)}`,
      }).eq("id", callLog.id);
      return new Response(JSON.stringify({
        error: "Maskyoo call failed", details: maskyooData, call_log: callLog,
      }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Save provider call uuid if returned
    const callUuid = maskyooData?.result?.call_uuid || maskyooData?.call_uuid || null;
    if (callUuid) {
      await supabase.from("call_logs").update({ provider_call_id: callUuid }).eq("id", callLog.id);
    }

    return new Response(JSON.stringify({
      success: true, call_log: { ...callLog, provider_call_id: callUuid },
      maskyoo_response: maskyooData,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("make-maskyoo-call error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
