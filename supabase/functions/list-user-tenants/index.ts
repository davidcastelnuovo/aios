import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Missing environment variables");
    }

    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if user is super admin
    const { data: rolesData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);
    
    const isSuperAdmin = rolesData?.some((r: any) => r.role === "super_admin");

    // Special case: owners of MarketingCaptain can view all tenants
    let isOwnerOfMarketingCaptain = false;
    try {
      const { data: ownedTenants } = await supabase
        .from("tenant_users")
        .select("tenants(slug)")
        .eq("user_id", user.id)
        .eq("role", "owner");
      isOwnerOfMarketingCaptain = (ownedTenants || []).some((r: any) =>
        (r as any)?.tenants?.slug?.toLowerCase() === "marketingcaptain"
      );
    } catch (e) {
      console.warn("Ownership check failed:", e);
    }

    let tenants: any[] = [];

    if (isSuperAdmin || isOwnerOfMarketingCaptain) {
      // Super admins see ALL tenants (no allow_super_admin_access gating)
      const { data: allTenants, error: allTenantsError } = await supabase
        .from("tenants")
        .select("id, name, slug")
        .order("name");

      if (allTenantsError) {
        console.error("Error fetching tenants:", allTenantsError);
        throw new Error("Failed to fetch tenants");
      }

      tenants = (allTenants || []).map((t: any) => ({ id: t.id, name: t.name, slug: t.slug }));
    } else {
      // Regular users see only their tenants
      const { data, error } = await supabase
        .from("tenant_users")
        .select("tenant_id, tenants(id, name, slug)")
        .eq("user_id", user.id);

      if (error) {
        console.error("Error fetching user tenants:", error);
        throw new Error("Failed to fetch user tenants");
      }

      tenants = (data || []).map((row: any) => ({
        id: row.tenants?.id,
        name: row.tenants?.name,
        slug: row.tenants?.slug,
      })).filter((t: any) => t.id && t.name);
    }

    return new Response(JSON.stringify({ tenants }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("list-user-tenants error:", error);
    return new Response(JSON.stringify({ error: error?.message || "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
