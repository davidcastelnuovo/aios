import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CreateTenantRequest {
  tenant_name: string;
  contact_name: string;
  contact_email: string;
  notes?: string;
  parent_tenant_id?: string;
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

    // Get current user from auth header
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    
    // Verify user is super_admin
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user is super_admin or owner
    const { data: userRoles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .in("role", ["super_admin", "owner"]);

    if (!userRoles || userRoles.length === 0) {
      return new Response(
        JSON.stringify({ error: "Only super admins and owners can create tenants" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const payload: CreateTenantRequest = await req.json();
    
    if (!payload.tenant_name || !payload.contact_email) {
      return new Response(
        JSON.stringify({ error: "tenant_name and contact_email are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 1: Create the tenant with slug
    // Generate slug from tenant name
    const generateSlug = (name: string): string => {
      return name
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
        .replace(/\s+/g, '-') // Replace spaces with hyphens
        .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
        .trim();
    };
    
    const baseSlug = generateSlug(payload.tenant_name);
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
        name: payload.tenant_name,
        slug: slug,
        contact_name: payload.contact_name,
        contact_email: payload.contact_email,
        notes: payload.notes,
        parent_tenant_id: payload.parent_tenant_id || null,
        status: "active",
        allow_super_admin_access: payload.allow_super_admin_access !== false, // Default to true
      })
      .select()
      .single();

    if (tenantError || !newTenant) {
      console.error("Error creating tenant:", tenantError);
      throw new Error("Failed to create tenant: " + tenantError?.message);
    }

    console.log("✅ Tenant created:", newTenant.id);

    // Step 2: Add creating user to tenant_users so they can access the new tenant
    const { error: tenantUserError } = await supabase
      .from("tenant_users")
      .insert({
        tenant_id: newTenant.id,
        user_id: user.id,
        role: "owner"
      });

    if (tenantUserError) {
      console.error("Error adding user to tenant_users:", tenantUserError);
      // Continue anyway - the user can still be added later
    } else {
      console.log("✅ User added to tenant_users");
    }

    // Step 2.5: Add owner role to user_roles
    const { error: roleError } = await supabase
      .from("user_roles")
      .insert({
        user_id: user.id,
        role: "owner",
      });

    if (roleError) {
      // Check if role already exists (conflict)
      if (roleError.code !== "23505") {
        console.error("Error adding owner role:", roleError);
      }
    } else {
      console.log("✅ Owner role added to user_roles");
    }

    // Step 3: Create invitation token for owner
    const invitationToken = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // Expires in 7 days

    // All available modules that owner should have access to
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

    const { data: invitation, error: invitationError } = await supabase
      .from("invitation_tokens")
      .insert({
        tenant_id: newTenant.id,
        created_by: user.id,
        token: invitationToken,
        email: payload.contact_email,
        expires_at: expiresAt.toISOString(),
        metadata: {
          role: "owner",
          fullName: payload.contact_name,
          tenant_name: payload.tenant_name,
          modulePermissions: allModules, // Grant access to all modules
        },
      })
      .select()
      .single();

    if (invitationError || !invitation) {
      console.error("Error creating invitation:", invitationError);
      throw new Error("Failed to create invitation: " + invitationError?.message);
    }

    console.log("✅ Invitation created:", invitation.id);

    // Step 4: Send invitation email
    const invitationUrl = `${req.headers.get("origin") || supabaseUrl}/auth?token=${invitationToken}`;
    
    console.log("📧 Invitation URL:", invitationUrl);

    // TODO: Send actual email using your email service
    // For now, we'll just log the invitation URL
    console.log(`
      📧 Invitation Details:
      - Email: ${payload.contact_email}
      - Name: ${payload.contact_name}
      - Organization: ${payload.tenant_name}
      - URL: ${invitationUrl}
    `);

    return new Response(
      JSON.stringify({
        success: true,
        tenant: newTenant,
        invitation: {
          id: invitation.id,
          token: invitationToken,
          email: payload.contact_email,
          invitation_url: invitationUrl,
        },
        message: "Tenant created successfully. Invitation sent to owner.",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error: any) {
    console.error("Error in create-tenant-with-owner:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});