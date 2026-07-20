import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
});

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (request.method !== "POST") return reply({ error: "method_not_allowed" }, 405);

  const authHeader = request.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!token || !supabaseUrl || !serviceKey) return reply({ error: "unauthorized" }, 401);

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: authData, error: authError } = await admin.auth.getUser(token);
  if (authError || !authData.user) return reply({ error: "unauthorized" }, 401);

  const body = await request.json().catch(() => ({}));
  const tenantId = typeof body?.tenant_id === "string" ? body.tenant_id : "";
  if (!tenantId) return reply({ error: "tenant_id_required" }, 400);

  const [{ data: membership }, { data: superAdmin }] = await Promise.all([
    admin.from("tenant_users").select("user_id").eq("tenant_id", tenantId).eq("user_id", authData.user.id).maybeSingle(),
    admin.rpc("is_super_admin", { _user_id: authData.user.id }),
  ]);
  if (!membership && superAdmin !== true) return reply({ error: "forbidden" }, 403);

  const ionosKey = Deno.env.get("IONOS_API_KEY") ?? "";
  const vercelToken = Deno.env.get("VERCEL_TOKEN") ?? "";
  const result: Record<string, unknown> = {
    ionos: { configured: Boolean(ionosKey), connected: false },
    vercel: { configured: Boolean(vercelToken), connected: false, project_access: false },
  };

  if (ionosKey) {
    const response = await fetch("https://api.hosting.ionos.com/dns/v1/zones", {
      headers: { "X-API-Key": ionosKey, Accept: "application/json" },
    });
    const zones = response.ok ? await response.json() : [];
    result.ionos = {
      configured: true,
      connected: response.ok,
      status: response.status,
      paperlief_found: Array.isArray(zones) && zones.some((zone) => String(zone?.zoneName ?? zone?.name ?? "").replace(/\.$/, "").toLowerCase() === "paperlief.com"),
      zone_count: Array.isArray(zones) ? zones.length : 0,
    };
  }

  if (vercelToken) {
    const headers = { Authorization: `Bearer ${vercelToken}`, Accept: "application/json" };
    const [accountResponse, projectResponse] = await Promise.all([
      fetch("https://api.vercel.com/v2/user", { headers }),
      fetch("https://api.vercel.com/v9/projects/prj_rNR7SGvwcSFTMDTauQQlNqabmZLD?teamId=team_anYCth1AhJ3ZrgT0tJGvv63t", { headers }),
    ]);
    result.vercel = {
      configured: true,
      connected: accountResponse.ok,
      status: accountResponse.status,
      project_access: projectResponse.ok,
      project_status: projectResponse.status,
    };
  }

  return reply({ success: true, ...result });
});
