import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function last9(p: string | null | undefined): string {
  return (p || "").replace(/\D/g, "").slice(-9);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: { user } } = await createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    ).auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const { tenant_id, number, days = 30 } = await req.json();
    if (!tenant_id || !number) {
      return new Response(JSON.stringify({ error: "tenant_id and number required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: settings } = await supabase
      .from("maskyoo_settings")
      .select("*")
      .eq("tenant_id", tenant_id)
      .eq("is_active", true)
      .maybeSingle();
    if (!settings) {
      return new Response(JSON.stringify({ error: "Maskyoo not configured" }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const targetLast9 = last9(number);
    if (targetLast9.length !== 9) {
      return new Response(JSON.stringify({ error: "Invalid Maskyoo number" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Pull recent CDRs from Maskyoo. We pull a wide net (broad to_number match
    // happens client-side on last-9 digits because cdr_ddi may have country code).
    const sql = `SELECT start_call, call_duration, cdr_ani, cdr_ddi, call_status FROM webserviceview WHERE start_call >= DATE_SUB(NOW(), INTERVAL ${Number(days)} DAY) ORDER BY start_call DESC LIMIT 5000`;

    // Normalize base url: strip any query string, trailing slash, and trailing /api
    let rawBase = String(settings.base_url || "").trim();
    rawBase = rawBase.split("?")[0].replace(/\/+$/, "").replace(/\/api$/i, "");
    const params = new URLSearchParams({ service: "cdr_query", sql, format: "json" });
    const url = `${rawBase}/api/?${params.toString()}`;
    console.log("Maskyoo CDR fetch:", url);
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${settings.api_token}` },
    });
    const body = await res.text();
    let data: any = {};
    try { data = JSON.parse(body); } catch { data = { raw: body }; }

    if (!res.ok) {
      return new Response(JSON.stringify({ error: "Maskyoo CDR query failed", details: data }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rows: any[] = Array.isArray(data?.result) ? data.result : Array.isArray(data) ? data : [];

    // Incoming = calls whose destination matches the configured Maskyoo number
    const incoming = rows.filter((r) => last9(r.cdr_ddi).endsWith(targetLast9));

    // Unique = distinct caller phone numbers among incoming
    const uniqueCallers = new Set<string>();
    let answered = 0;
    for (const r of incoming) {
      const caller = last9(r.cdr_ani);
      if (caller) uniqueCallers.add(caller);
      const status = String(r.call_status || "").toUpperCase();
      const dur = Number(r.call_duration || 0);
      if (status === "ANSWERED" || dur > 0) answered++;
    }

    return new Response(JSON.stringify({
      success: true,
      incomingCount: incoming.length,
      uniqueCount: uniqueCallers.size,
      answeredCount: answered,
      total: rows.length,
      days: Number(days),
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("query-maskyoo-calls error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
