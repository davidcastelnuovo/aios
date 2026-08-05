import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface DeleteUserRequest {
  userId?: string;
  email?: string;
  tenantId?: string;
  /** When true (default from UI), remove from tenant only. When false, delete globally. */
  removeFromTenantOnly?: boolean;
}

async function findUserIdByEmail(
  supabaseAdmin: ReturnType<typeof createClient>,
  email: string,
): Promise<string | null> {
  const normalized = email.trim().toLowerCase();
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .ilike("email", normalized)
    .maybeSingle();
  return profile?.id ?? null;
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

    const { data: roles, error: rolesError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .in("role", ["owner", "agency_owner"]);

    if (rolesError || !roles || roles.length === 0) {
      throw new Error("Only owners and agency owners can delete users");
    }

    const { userId, email, tenantId, removeFromTenantOnly = true }: DeleteUserRequest = await req.json();

    if (!userId && !email) {
      throw new Error("User ID or email is required");
    }

    let targetUserId = userId;

    if (email && !targetUserId) {
      targetUserId = await findUserIdByEmail(supabaseAdmin, email) ?? undefined;
      if (!targetUserId) {
        throw new Error(`User with email ${email} not found`);
      }
    }

    if (!targetUserId) {
      throw new Error("Could not determine user ID");
    }

    if (targetUserId === user.id) {
      throw new Error("Cannot delete yourself");
    }

    // Tenant-scoped removal (default) — fast, does not touch auth
    if (removeFromTenantOnly && tenantId) {
      await supabaseAdmin
        .from("user_managed_agencies")
        .delete()
        .eq("user_id", targetUserId);

      await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", targetUserId)
        .eq("tenant_id", tenantId);

      await supabaseAdmin
        .from("tenant_users")
        .delete()
        .eq("user_id", targetUserId)
        .eq("tenant_id", tenantId);

      // Clear active tenant if it was this one
      await supabaseAdmin
        .from("user_active_tenant")
        .delete()
        .eq("user_id", targetUserId)
        .eq("tenant_id", tenantId);

    // Mark unused invitations for this tenant
    const { data: targetProfile } = await supabaseAdmin
      .from("profiles")
      .select("email")
      .eq("id", targetUserId)
      .maybeSingle();

    const targetEmail = (email ?? targetProfile?.email)?.trim().toLowerCase();
    if (targetEmail) {
      await supabaseAdmin
        .from("invitation_tokens")
        .update({ used: true })
        .eq("email", targetEmail)
        .eq("tenant_id", tenantId)
        .eq("used", false);
    }

      const { count: remainingTenants } = await supabaseAdmin
        .from("tenant_users")
        .select("id", { count: "exact", head: true })
        .eq("user_id", targetUserId);

      // If user has no tenants left and profile is pending, clean up profile row
      if (remainingTenants === 0) {
        const { data: profile } = await supabaseAdmin
          .from("profiles")
          .select("status")
          .eq("id", targetUserId)
          .maybeSingle();

        if (profile?.status === "pending") {
          await supabaseAdmin.from("user_permissions").delete().eq("user_id", targetUserId);
          await supabaseAdmin.from("profiles").delete().eq("id", targetUserId);
          await supabaseAdmin.auth.admin.deleteUser(targetUserId);
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: "User removed from organization",
          removedFromTenant: true,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Full global delete
    await supabaseAdmin
      .from("user_managed_agencies")
      .delete()
      .eq("user_id", targetUserId);

    await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", targetUserId);

    await supabaseAdmin
      .from("user_permissions")
      .delete()
      .eq("user_id", targetUserId);

    await supabaseAdmin
      .from("tenant_users")
      .delete()
      .eq("user_id", targetUserId);

    await supabaseAdmin
      .from("profiles")
      .delete()
      .eq("id", targetUserId);

    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(targetUserId);

    if (deleteError) {
      if (!deleteError.message?.includes("User not found") && deleteError.status !== 404) {
        console.error("Error deleting user from auth:", deleteError);
        throw deleteError;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "User deleted successfully",
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
          error.message === "Only owners and agency owners can delete users"
            ? 403
            : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
