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
  allow_super_admin_access?: boolean;
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
    
    // Auth context for conditional validation
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const authHeader = req.headers.get("authorization") ?? "";
    let authenticatedUser: any = null;

    if (authHeader && authHeader !== "" && authHeader !== "Bearer ") {
      console.log("🔍 Checking for authenticated user...");
      const authClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
      const { data: authData, error: authCheckError } = await authClient.auth.getUser();
      if (!authCheckError && authData?.user) {
        authenticatedUser = authData.user;
        console.log("✅ Found authenticated user via getUser:", authenticatedUser.id, authenticatedUser.email);
      } else {
        console.warn("⚠️ getUser did not return a user. Falling back to JWT decode.", authCheckError?.message);
        // Fallback: decode JWT directly to extract user id/email
        const match = authHeader.match(/^Bearer\s+(.+)/i);
        const token = match?.[1];
        const decodeJwt = (t: string) => {
          try {
            const payload = t.split(".")[1];
            const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
            const json = atob(base64.padEnd(base64.length + (4 - (base64.length % 4)) % 4, "="));
            return JSON.parse(json);
          } catch (_) {
            return null;
          }
        };
        const decoded = token ? decodeJwt(token) : null;
        if (decoded?.sub) {
          authenticatedUser = { id: decoded.sub, email: decoded.email ?? null };
          console.log("✅ Extracted authenticated user from JWT:", authenticatedUser.id, authenticatedUser.email);
        } else {
          console.warn("❌ Could not extract user from Authorization header");
        }
      }
    }
    
    // Validate input (password required only if not authenticated)
    if (!payload.email || !payload.fullName || !payload.organizationName || (!authenticatedUser && !payload.password)) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!authenticatedUser && payload.password && payload.password.length < 6) {
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
    // auth context already checked above

    // If a user is already authenticated, always use their account (ignore form email/password)
    if (authenticatedUser) {
      userId = authenticatedUser.id;
      console.log("↩️ Using existing authenticated user:", userId);
    } else {
      // Try to reuse existing account by verifying provided credentials
      const authClient = createClient(supabaseUrl, anonKey);
      const { data: signInData, error: signInError } = await authClient.auth.signInWithPassword({
        email: payload.email,
        password: payload.password,
      });
      if (!signInError && signInData?.user) {
        userId = signInData.user.id;
        console.log("↩️ Reusing existing account via credentials:", userId);
      } else {
        // Otherwise, create a new user for the provided email
        const { data: userData, error: userError }: any = await supabase.auth.admin.createUser({
          email: payload.email,
          password: payload.password,
          email_confirm: true,
          user_metadata: {
            full_name: payload.fullName,
            phone: payload.phone,
          },
        });

        if (userError || !userData?.user) {
          const isEmailExists = (userError as any)?.status === 422 || (userError as any)?.code === 'email_exists';
          if (isEmailExists) {
            console.error("❌ Email exists and provided credentials didn't match (and no session)");
            return new Response(
              JSON.stringify({ 
                success: false, 
                error: "האימייל כבר קיים. היכנס/י לחשבון או הזן/הזיני סיסמה תקינה ואז נסה/י שוב." 
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
    }

    // Step 2: Update profile with full details
    const effectiveEmail = (authenticatedUser?.email || payload.email || "").toLowerCase();
    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        full_name: payload.fullName,
        email: effectiveEmail,
        status: "active",
      })
      .eq("id", userId);

    if (profileError) {
      console.error("Error updating profile:", profileError);
      // Continue anyway - profile will be updated later
    } else {
      console.log("✅ Profile updated");
    }

    // Step 3: Create the tenant/organization with slug
    // Generate slug from organization name
    const generateSlug = (name: string): string => {
      let slug = name
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
        .replace(/\s+/g, '-') // Replace spaces with hyphens
        .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
        .replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens
        .trim();
      
      // If slug is empty or just dashes, generate a random one
      if (!slug || slug === '-' || slug.length < 2) {
        slug = `org-${Date.now().toString(36)}`;
      }
      
      return slug;
    };
    
    const baseSlug = generateSlug(payload.organizationName);
    let slug = baseSlug;
    let counter = 1;
    
    // Ensure slug is unique
    while (true) {
      const { data: existing } = await supabase
        .from("tenants")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();
      
      if (!existing) break;
      slug = `${baseSlug}-${counter}`;
      counter++;
    }
    
    const { data: newTenant, error: tenantError } = await supabase
      .from("tenants")
      .insert({
        name: payload.organizationName,
        slug: slug,
        contact_name: payload.fullName,
        contact_email: payload.email,
        status: "active",
        notes: `Created via self-signup on ${new Date().toISOString()}`,
        allow_super_admin_access: payload.allow_super_admin_access !== false, // Default to true
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
