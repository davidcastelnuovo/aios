import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { callerCanDeleteUsers, detachUserReferences } from "../_shared/user-admin-helpers.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface DeleteUserRequest {
  userId?: string;
  email?: string;
  tenantId?: string;
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

    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    const { userId, email, tenantId }: DeleteUserRequest = await req.json();

    if (!userId && !email) {
      throw new Error("User ID or email is required");
    }

    const canDelete = await callerCanDeleteUsers(supabaseAdmin, user.id, tenantId);
    if (!canDelete) {
      throw new Error("Only owners and agency owners can delete users");
    }

    let targetUserId = userId;

    if (email && !targetUserId) {
      const { data: profileByEmail } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("email", email)
        .maybeSingle();

      if (profileByEmail?.id) {
        targetUserId = profileByEmail.id;
      } else {
        const { data: authUser, error: authLookupError } = await supabaseAdmin.auth.admin.getUserByEmail(email);
        if (authLookupError || !authUser?.user?.id) {
          throw new Error(`User with email ${email} not found`);
        }
        targetUserId = authUser.user.id;
      }
    }

    if (!targetUserId) {
      throw new Error("Could not determine user ID");
    }

    if (targetUserId === user.id) {
      throw new Error("Cannot delete yourself");
    }

    const { data: tenantMemberships } = await supabaseAdmin
      .from("tenant_users")
      .select("tenant_id")
      .eq("user_id", targetUserId);

    const membershipTenantIds = (tenantMemberships || []).map((row) => row.tenant_id);
    const scopedTenantId = tenantId || membershipTenantIds[0] || null;

    if (tenantId && membershipTenantIds.length > 0 && !membershipTenantIds.includes(tenantId)) {
      throw new Error("User is not a member of this organization");
    }

    const removeFromTenantOnly =
      scopedTenantId &&
      membershipTenantIds.length > 1 &&
      membershipTenantIds.includes(scopedTenantId);

    if (removeFromTenantOnly) {
      await supabaseAdmin
        .from("user_managed_agencies")
        .delete()
        .eq("user_id", targetUserId);

      await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", targetUserId)
        .eq("tenant_id", scopedTenantId);

      const { error: tenantError } = await supabaseAdmin
        .from("tenant_users")
        .delete()
        .eq("user_id", targetUserId)
        .eq("tenant_id", scopedTenantId);

      if (tenantError) {
        console.error("Error removing tenant membership:", tenantError);
        throw tenantError;
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: "User removed from organization",
          removedFromTenantOnly: true,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    await detachUserReferences(supabaseAdmin, targetUserId, user.id);

    await supabaseAdmin.from("user_managed_agencies").delete().eq("user_id", targetUserId);

    await supabaseAdmin.from("user_roles").delete().eq("user_id", targetUserId);
    await supabaseAdmin.from("user_permissions").delete().eq("user_id", targetUserId);
    await supabaseAdmin.from("tenant_users").delete().eq("user_id", targetUserId);

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .delete()
      .eq("id", targetUserId);

    if (profileError) {
      console.error("Error deleting profile:", profileError);
    }

    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(targetUserId);

    if (deleteError) {
      if (deleteError.message?.includes("User not found") || deleteError.status === 404) {
        // Auth user already gone — tenant data was cleaned above.
      } else {
        console.error("Error deleting user from auth:", deleteError);
        throw new Error(
          deleteError.message || "Failed to delete user account. Related records may still reference this user.",
        );
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "User deleted successfully",
        removedFromTenantOnly: false,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error: any) {
    console.error("Error in delete-user function:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status:
          error.message === "Unauthorized" ||
          error.message === "Only owners and agency owners can delete users" ||
          error.message === "User is not a member of this organization"
            ? 403
            : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
