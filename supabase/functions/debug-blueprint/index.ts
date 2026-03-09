import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { scenario_id, api_token, region } = await req.json();
    const baseUrl = `https://${region || "eu2"}.make.com/api/v2`;
    const res = await fetch(`${baseUrl}/scenarios/${scenario_id}/blueprint`, {
      headers: { Authorization: `Token ${api_token}`, "Content-Type": "application/json" },
    });
    const data = await res.json();

    // Extract modules
    let bp = data;
    if (bp.response?.blueprint) bp = bp.response.blueprint;
    else if (bp.blueprint) bp = bp.blueprint;

    const modules = (bp.flow || []).map((m: any) => ({
      id: m.id,
      module: m.module,
      mapper_keys: m.mapper ? Object.keys(m.mapper) : [],
      mapper_sample: m.mapper ? JSON.stringify(m.mapper).slice(0, 500) : null,
    }));

    return new Response(JSON.stringify({ modules, raw_keys: Object.keys(bp) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
