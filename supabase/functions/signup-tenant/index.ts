import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SignupTenantRequest {
  email: string;
  password: string;
  fullName: string;
  phone: string;
  organizationName: string;
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

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    
    const payload: SignupTenantRequest = await req.json();
    
    // Normalize input (emails are case-insensitive)
    payload.email = (payload.email || "").trim().toLowerCase();
    payload.fullName = (payload.fullName || "").trim();
    payload.phone = (payload.phone || "").trim();
    payload.organizationName = (payload.organizationName || "").trim();
    
    // Validate input
    if (!payload.email || !payload.password || !payload.fullName || !payload.organizationName) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (payload.password.length < 6) {
      return new Response(
        JSON.stringify({ success: false, error: "Password must be at least 6 characters" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("📝 Creating new tenant and owner:", {
      email: payload.email,
      organizationName: payload.organizationName,
    });

    // Step 1: Create or reuse the user account
    let userId: string;
    let newUserCreated = false;

    // First check if user is already authenticated
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const authHeader = req.headers.get("authorization") ?? "";
    let authenticatedUser = null;
    
    if (authHeader && authHeader !== "" && authHeader !== "Bearer ") {
      console.log("🔍 Checking for authenticated user...");
      const authClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
      const { data: authData, error: authCheckError } = await authClient.auth.getUser();
      
      if (!authCheckError && authData?.user) {
        authenticatedUser = authData.user;
        console.log("✅ Found authenticated user:", authenticatedUser.id, authenticatedUser.email);
      }
    }

    // If user is authenticated with the same email (case-insensitive), use their account
    if (authenticatedUser && (authenticatedUser.email || "").toLowerCase() === (payload.email || "").toLowerCase()) {
      userId = authenticatedUser.id;
      console.log("↩️ Using existing authenticated user:", userId);
    } else {
      // Try to create a new user
      const { data: userData, error: userError }: any = await supabase.auth.admin.createUser({
        email: payload.email,
        password: payload.password,
        email_confirm: true, // Auto-confirm email for smoother onboarding
        user_metadata: {
          full_name: payload.fullName,
          phone: payload.phone,
        },
      });

      if (userError || !userData?.user) {
        const isEmailExists = (userError as any)?.status === 422 || (userError as any)?.code === 'email_exists';
        if (isEmailExists) {
          console.error("❌ Email exists but user not authenticated (or email mismatch)");
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: "האימייל כבר רשום במערכת. אנא התחבר תחילה דרך דף ההתחברות (/auth) ואז חזור לדף זה כדי ליצור ארגון חדש." 
            }),
            { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        } else {
          console.error("Error creating user:", userError);
          return new Response(
            JSON.stringify({ success: false, error: (userError as any)?.message || "Failed to create user" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      } else {
        userId = userData.user.id;
        newUserCreated = true;
        console.log("✅ User created:", userId);
      }
    }

    // Step 2: Update profile with full details
    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        full_name: payload.fullName,
        email: payload.email,
        status: "active",
      })
      .eq("id", userId);

    if (profileError) {
      console.error("Error updating profile:", profileError);
      // Continue anyway - profile will be updated later
    } else {
      console.log("✅ Profile updated");
    }

    // Step 3: Create the tenant/organization
    const { data: newTenant, error: tenantError } = await supabase
      .from("tenants")
      .insert({
        name: payload.organizationName,
        contact_name: payload.fullName,
        contact_email: payload.email,
        status: "active",
        notes: `Created via self-signup on ${new Date().toISOString()}`,
      })
      .select()
      .single();

    if (tenantError || !newTenant) {
      console.error("Error creating tenant:", tenantError);
      // Cleanup: delete the user we just created (not existing users)
      if (newUserCreated) {
        await supabase.auth.admin.deleteUser(userId);
      }
      return new Response(
        JSON.stringify({ success: false, error: "Failed to create organization" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("✅ Tenant created:", newTenant.id);

    // Step 4: Add user to tenant_users with owner role
    const { error: tenantUserError } = await supabase
      .from("tenant_users")
      .insert({
        tenant_id: newTenant.id,
        user_id: userId,
        role: "owner",
      });

    if (tenantUserError) {
      console.error("Error adding user to tenant_users:", tenantUserError);
      // This is critical - cleanup everything
      await supabase.from("tenants").delete().eq("id", newTenant.id);
      if (newUserCreated) {
        await supabase.auth.admin.deleteUser(userId);
      }
      return new Response(
        JSON.stringify({ success: false, error: "Failed to assign user to organization" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("✅ User added to tenant_users");

    // Step 5: Grant owner role
    const { error: roleError } = await supabase
      .from("user_roles")
      .insert({
        user_id: userId,
        role: "owner",
      });

    if (roleError) {
      console.error("Error granting owner role:", roleError);
      // Continue anyway - role can be added later
    } else {
      console.log("✅ Owner role granted");
    }

    // Step 6: Grant all module permissions
    const allModules = [
      "dashboard",
      "clients",
      "leads",
      "tasks",
      "agencies",
      "campaigners",
      "sales_people",
      "suppliers",
      "client_onboarding",
      "finance",
      "finance_view",
      "users",
      "tenants",
      "reports",
      "sales_dashboard",
      "lead_integrations",
      "time_tracking",
      "automations",
    ];

    const permissions = allModules.map((module) => ({
      user_id: userId,
      module,
      can_access: true,
    }));

    const { error: permissionsError } = await supabase
      .from("user_permissions")
      .insert(permissions);

    if (permissionsError) {
      console.error("Error granting permissions:", permissionsError);
      // Continue anyway - permissions can be added later
    } else {
      console.log("✅ Permissions granted");
    }

    // Step 7: Set active tenant for user
    const { error: activeTenantError } = await supabase
      .from("user_active_tenant")
      .insert({
        user_id: userId,
        tenant_id: newTenant.id,
      });

    if (activeTenantError) {
      console.error("Error setting active tenant:", activeTenantError);
      // Continue anyway
    } else {
      console.log("✅ Active tenant set");
    }

    console.log("🎉 Tenant and owner created successfully!");

    return new Response(
      JSON.stringify({
        success: true,
        user_id: userId,
        tenant_id: newTenant.id,
        message: "Organization and account created successfully",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error: any) {
    console.error("Error in signup-tenant:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
