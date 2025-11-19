import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface UpdateRoleRequest {
  userId: string;
  role: string;
  tenantId: string;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Verify requesting user is an owner
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    // Check if the user is an owner or super_admin
    const { data: roles, error: rolesError } = await supabaseAdmin
      .from("user_roles")
      .select("role, tenant_id")
      .eq("user_id", user.id);

    if (rolesError) {
      throw new Error("Error checking user roles");
    }

    const isSuperAdmin = roles?.some(r => r.role === "super_admin" && r.tenant_id === null);
    const isOwnerInAnyTenant = roles?.some(r => r.role === "owner");

    if (!isSuperAdmin && !isOwnerInAnyTenant) {
      throw new Error("Only owners or super admins can update user roles");
    }

    const { userId, role, tenantId }: UpdateRoleRequest = await req.json();

    if (!userId || !role || !tenantId) {
      throw new Error("User ID, role, and tenant ID are required");
    }

    // Validate role
    const validRoles = ["owner", "agency_owner", "team_manager", "campaigner", "sales_person", "super_admin", "seo"];
    if (!validRoles.includes(role)) {
      throw new Error("Invalid role");
    }

    // Check if target user is currently an owner
    const { data: existingRoles, error: existingRolesError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("tenant_id", tenantId);

    if (existingRolesError) {
      console.error("Error checking existing roles:", existingRolesError);
      throw existingRolesError;
    }

    const isCurrentlyOwner = existingRoles?.some(r => r.role === "owner");

    // Prevent removing owner role (changing owner to something else)
    // Only exception: if the new role is also owner (which is just a re-assignment)
    if (isCurrentlyOwner && role !== "owner") {
      throw new Error("Cannot demote an owner. Owner role cannot be changed to a different role.");
    }

    console.log(`Updating user ${userId} to role: ${role} in tenant: ${tenantId}`);

    // Delete existing roles for this user IN THIS TENANT (don't touch super_admin or other tenants)
    const { error: deleteError } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", userId)
      .eq("tenant_id", tenantId); // Only delete roles for this specific tenant

    if (deleteError) {
      console.error("Error deleting roles:", deleteError);
      throw deleteError;
    }

    // Insert new role with tenant_id
    const { error: insertError } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: userId, role, tenant_id: tenantId });

    if (insertError) {
      console.error("Error inserting role:", insertError);
      throw insertError;
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Role updated successfully",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in update-user-role function:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: error.message === "Unauthorized" || error.message === "Only owners or super admins can update user roles" ? 403 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
