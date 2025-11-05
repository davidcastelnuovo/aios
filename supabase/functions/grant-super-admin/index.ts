import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface GrantSuperAdminRequest {
  user_email: string;
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Missing environment variables");
    }

    // Get current user from auth header
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    
    // Verify current user is super_admin
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if current user is super_admin
    const { data: currentUserRoles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "super_admin")
      .maybeSingle();

    if (!currentUserRoles) {
      return new Response(
        JSON.stringify({ error: "Only super admins can grant super admin access" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const payload: GrantSuperAdminRequest = await req.json();
    
    if (!payload.user_email) {
      return new Response(
        JSON.stringify({ error: "user_email is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Find user by email
    const { data: targetUser, error: userError } = await supabase.auth.admin.listUsers();
    
    if (userError) {
      throw new Error("Failed to fetch users: " + userError.message);
    }

    const foundUser = targetUser.users.find(u => u.email === payload.user_email);
    
    if (!foundUser) {
      return new Response(
        JSON.stringify({ error: `User with email ${payload.user_email} not found` }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user already has super_admin role
    const { data: existingRole } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", foundUser.id)
      .eq("role", "super_admin")
      .maybeSingle();

    if (existingRole) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "User already has super_admin role",
          user_id: foundUser.id,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Grant super_admin role
    const { error: insertError } = await supabase
      .from("user_roles")
      .insert({
        user_id: foundUser.id,
        role: "super_admin",
      });

    if (insertError) {
      throw new Error("Failed to grant super_admin role: " + insertError.message);
    }

    console.log(`✅ Granted super_admin to user: ${payload.user_email} (${foundUser.id})`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Super admin access granted to ${payload.user_email}`,
        user_id: foundUser.id,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error: any) {
    console.error("Error in grant-super-admin:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});