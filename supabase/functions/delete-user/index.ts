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

    // Get the authorization header to verify the requesting user is an owner
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    // Check if the user is an owner or agency_owner
    const { data: roles, error: rolesError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .in("role", ["owner", "agency_owner"]);

    if (rolesError || !roles || roles.length === 0) {
      throw new Error("Only owners and agency owners can delete users");
    }

    const { userId, email }: DeleteUserRequest = await req.json();

    if (!userId && !email) {
      throw new Error("User ID or email is required");
    }

    let targetUserId = userId;

    // If email provided, find the user ID from auth
    if (email && !targetUserId) {
      const { data: users } = await supabaseAdmin.auth.admin.listUsers();
      const targetUser = users?.users?.find(u => u.email === email);
      
      if (targetUser) {
        targetUserId = targetUser.id;
        console.log(`Found user by email ${email}: ${targetUserId}`);
      } else {
        throw new Error(`User with email ${email} not found`);
      }
    }

    if (!targetUserId) {
      throw new Error("Could not determine user ID");
    }

    // Prevent deleting yourself
    if (targetUserId === user.id) {
      throw new Error("Cannot delete yourself");
    }

    console.log(`Deleting user: ${targetUserId}`);

    // First, get the user's profile to check for campaigner_id
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("campaigner_id")
      .eq("id", targetUserId)
      .maybeSingle();

    // Delete from user_managed_agencies
    const { error: managedError } = await supabaseAdmin
      .from("user_managed_agencies")
      .delete()
      .eq("user_id", targetUserId);
    
    if (managedError) {
      console.error("Error deleting managed agencies:", managedError);
    }

    // Delete from user_roles
    const { error: userRolesError } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", targetUserId);
    
    if (userRolesError) {
      console.error("Error deleting user roles:", userRolesError);
    }

    // Delete from user_permissions
    const { error: permissionsError } = await supabaseAdmin
      .from("user_permissions")
      .delete()
      .eq("user_id", targetUserId);
    
    if (permissionsError) {
      console.error("Error deleting user permissions:", permissionsError);
    }

    // Delete from tenant_users
    const { error: tenantError } = await supabaseAdmin
      .from("tenant_users")
      .delete()
      .eq("user_id", targetUserId);
    
    if (tenantError) {
      console.error("Error deleting tenant users:", tenantError);
    }

    // Delete from profiles (this will trigger cascade if set up)
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .delete()
      .eq("id", targetUserId);
    
    if (profileError) {
      console.error("Error deleting profile:", profileError);
    }

    // Try to delete user from auth
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(targetUserId);

    if (deleteError) {
      // If user not found in auth, it's okay - we already cleaned up the database
      if (deleteError.message?.includes("User not found") || deleteError.status === 404) {
        console.log("User not found in auth, but database records cleaned up");
      } else {
        console.error("Error deleting user from auth:", deleteError);
        throw deleteError;
      }
    } else {
      console.log("User deleted successfully from auth");
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "User deleted successfully",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in delete-user function:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: error.message === "Unauthorized" || error.message === "Only owners and agency owners can delete users" ? 403 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
