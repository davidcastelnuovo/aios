import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ManageRolesRequest {
  userId: string;
  role: string;
  tenantId: string;
  action: "add" | "remove";
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

    // Verify requesting user
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
      throw new Error("Only owners or super admins can manage user roles");
    }

    const { userId, role, tenantId, action }: ManageRolesRequest = await req.json();

    if (!userId || !role || !tenantId || !action) {
      throw new Error("User ID, role, tenant ID, and action are required");
    }

    // Validate role
    const validRoles = ["owner", "team_manager", "campaigner", "sales_person", "super_admin", "seo"];
    if (!validRoles.includes(role)) {
      throw new Error("Invalid role");
    }

    console.log(`${action === "add" ? "Adding" : "Removing"} role ${role} for user ${userId} in tenant ${tenantId}`);

    if (action === "add") {
      // Check if role already exists
      const { data: existingRole } = await supabaseAdmin
        .from("user_roles")
        .select("id")
        .eq("user_id", userId)
        .eq("role", role)
        .eq("tenant_id", tenantId)
        .maybeSingle();

      if (existingRole) {
        return new Response(
          JSON.stringify({
            success: true,
            message: "Role already exists",
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Insert new role
      const { error: insertError } = await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: userId, role, tenant_id: tenantId });

      if (insertError) {
        console.error("Error inserting role:", insertError);
        throw insertError;
      }
    } else if (action === "remove") {
      // Delete the specific role
      const { error: deleteError } = await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", userId)
        .eq("role", role)
        .eq("tenant_id", tenantId);

      if (deleteError) {
        console.error("Error deleting role:", deleteError);
        throw deleteError;
      }

      // Clean up related links based on the removed role
      if (role === "team_manager") {
        // Remove all managed agencies for this user in this tenant
        console.log(`Cleaning up user_managed_agencies for user ${userId}`);
        const { error: cleanupError } = await supabaseAdmin
          .from("user_managed_agencies")
          .delete()
          .eq("user_id", userId);
        
        if (cleanupError) {
          console.error("Error cleaning up managed agencies:", cleanupError);
          // Don't throw - this is cleanup, not critical
        }
      }

      if (role === "campaigner") {
        // Check if user has campaigner role in another tenant
        const { data: otherCampaignerRoles } = await supabaseAdmin
          .from("user_roles")
          .select("id")
          .eq("user_id", userId)
          .eq("role", "campaigner")
          .neq("tenant_id", tenantId);

        if (!otherCampaignerRoles || otherCampaignerRoles.length === 0) {
          // No other campaigner roles, unlink campaigner from profile
          console.log(`Unlinking campaigner_id from profile for user ${userId}`);
          const { error: unlinkError } = await supabaseAdmin
            .from("profiles")
            .update({ campaigner_id: null })
            .eq("id", userId);
          
          if (unlinkError) {
            console.error("Error unlinking campaigner:", unlinkError);
          }
        }
      }

      if (role === "sales_person") {
        // Check if user has sales_person role in another tenant
        const { data: otherSalesRoles } = await supabaseAdmin
          .from("user_roles")
          .select("id")
          .eq("user_id", userId)
          .eq("role", "sales_person")
          .neq("tenant_id", tenantId);

        if (!otherSalesRoles || otherSalesRoles.length === 0) {
          // No other sales_person roles, unlink sales_person from profile
          console.log(`Unlinking sales_person_id from profile for user ${userId}`);
          const { error: unlinkError } = await supabaseAdmin
            .from("profiles")
            .update({ sales_person_id: null })
            .eq("id", userId);
          
          if (unlinkError) {
            console.error("Error unlinking sales_person:", unlinkError);
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Role ${action === "add" ? "added" : "removed"} successfully`,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in manage-user-roles function:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: error.message === "Unauthorized" || error.message.includes("Only owners") ? 403 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
