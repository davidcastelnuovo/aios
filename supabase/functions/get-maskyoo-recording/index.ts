import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: { user } } = await createClient(
      Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    ).auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

    const url = new URL(req.url);
    const tenant_id = url.searchParams.get("tenant_id");
    const call_uuid = url.searchParams.get("call_uuid");
    const type = url.searchParams.get("type") || "mp3";
    if (!tenant_id || !call_uuid) {
      return new Response(JSON.stringify({ error: "tenant_id and call_uuid required" }), { status: 400, headers: corsHeaders });
    }

    const { data: settings } = await supabase
      .from("maskyoo_settings").select("*")
      .eq("tenant_id", tenant_id).eq("is_active", true).maybeSingle();
    if (!settings) return new Response(JSON.stringify({ error: "Maskyoo not configured" }), { status: 422, headers: corsHeaders });

    const baseUrl = settings.base_url.replace(/\/$/, "");
    const params = new URLSearchParams({
      service: "get_record_by_call_uuid", call_uuid, type, format: "json",
    });
    const res = await fetch(`${baseUrl}/api/?${params.toString()}`, {
      headers: { Authorization: `Bearer ${settings.api_token}` },
    });
    const body = await res.text();
    let data: any = {};
    try { data = JSON.parse(body); } catch { data = { raw: body }; }

    return new Response(JSON.stringify(data), {
      status: res.ok ? 200 : 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
