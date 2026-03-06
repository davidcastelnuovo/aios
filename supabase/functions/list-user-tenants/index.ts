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

    // Read scope_tenant_id from request body
    let scopeTenantId: string | null = null;
    try {
      const body = await req.json();
      scopeTenantId = body?.scope_tenant_id || null;
      console.log("📍 Received scope_tenant_id:", scopeTenantId);
    } catch (e) {
      console.log("⚠️ No body or invalid JSON, proceeding without scope");
    }

    // Check if user is super admin
    const { data: rolesData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);
    
    const isSuperAdmin = rolesData?.some((r: any) => r.role === "super_admin");

    // Validate scope_tenant_id: check if user is a member of that tenant
    let effectiveTenantId: string | null = null;
    if (scopeTenantId) {
      const { data: memberCheck } = await supabase
        .from("tenant_users")
        .select("tenant_id")
        .eq("user_id", user.id)
        .eq("tenant_id", scopeTenantId)
        .maybeSingle();
      
      if (memberCheck) {
        effectiveTenantId = scopeTenantId;
        console.log("✅ User is member of scope tenant, using:", effectiveTenantId);
      } else {
        console.log("⚠️ User is NOT member of scope tenant, ignoring");
      }
    }

    // If no valid scope, fall back to user_active_tenant or first tenant
    if (!effectiveTenantId) {
      const { data: activeTenant } = await supabase
        .from("user_active_tenant")
        .select("tenant_id")
        .eq("user_id", user.id)
        .maybeSingle();
      
      effectiveTenantId = activeTenant?.tenant_id || null;
      
      if (!effectiveTenantId) {
        const { data: firstTenant } = await supabase
          .from("tenant_users")
          .select("tenant_id")
          .eq("user_id", user.id)
          .limit(1)
          .maybeSingle();
        
        effectiveTenantId = firstTenant?.tenant_id || null;
      }
      
      console.log("📌 Using fallback tenant:", effectiveTenantId);
    }

    // Get effective tenant details
    let effectiveTenantSlug: string | null = null;
    if (effectiveTenantId) {
      const { data: tenantDetails } = await supabase
        .from("tenants")
        .select("slug")
        .eq("id", effectiveTenantId)
        .single();
      
      effectiveTenantSlug = tenantDetails?.slug || null;
      console.log("🏢 Effective tenant slug:", effectiveTenantSlug);
    }

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

    if (isSuperAdmin) {
      // Super admins see ALL tenants
      console.log("👑 Super admin: showing all tenants");
      const { data: allTenants, error: allTenantsError } = await supabase
        .from("tenants")
        .select("id, name, slug, org_type, parent_tenant_id, subdomain, contact_name, contact_email, status, notes, trial_ends_at")
        .order("name");

      if (allTenantsError) {
        console.error("Error fetching tenants:", allTenantsError);
        throw new Error("Failed to fetch tenants");
      }

      tenants = allTenants || [];
    } else if (isOwnerOfMarketingCaptain && effectiveTenantSlug === 'marketingcaptain') {
      // Only show all tenants when actively using MarketingCaptain
      console.log("🎯 MC Owner in MC context: showing all tenants");
      const { data: allTenants, error: allTenantsError } = await supabase
        .from("tenants")
        .select("id, name, slug, org_type, parent_tenant_id, subdomain, contact_name, contact_email, status, notes, trial_ends_at")
        .order("name");

      if (allTenantsError) {
        console.error("Error fetching tenants:", allTenantsError);
        throw new Error("Failed to fetch tenants");
      }

      tenants = allTenants || [];
    } else {
      // Regular users see only their tenants
      const { data, error } = await supabase
        .from("tenant_users")
        .select("tenant_id, tenants(id, name, slug, org_type, parent_tenant_id, subdomain, contact_name, contact_email, status, notes, trial_ends_at)")
        .eq("user_id", user.id);

      if (error) {
        console.error("Error fetching user tenants:", error);
        throw new Error("Failed to fetch user tenants");
      }

      let userTenants = (data || []).map((row: any) => row.tenants).filter((t: any) => t && t.id && t.name);

      // Always show ALL tenants the user is a member of so they can switch between them
      console.log("📋 Showing all user's tenants (no filtering)");
      tenants = userTenants;
    }

    console.log(`✅ Returning ${tenants.length} tenants for user ${user.id}`);

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
