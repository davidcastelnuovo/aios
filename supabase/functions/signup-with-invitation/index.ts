import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SignupRequest {
  token: string;
  full_name: string;
  email: string;
  password: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { token, full_name, email, password }: SignupRequest = await req.json();

    // Validate input
    if (!token || !full_name || !email || !password) {
      throw new Error("כל השדות הם חובה");
    }

    if (password.length < 6) {
      throw new Error("הסיסמה חייבת להכיל לפחות 6 תווים");
    }

    console.log("📝 Signup request received");
    console.log("  Token:", token);
    console.log("  Email:", email);
    console.log("  Full name:", full_name);

    // Verify invitation token
    console.log("🔍 Step 1: Verifying invitation token...");
    const { data: invitation, error: tokenError } = await supabase
      .from("invitation_tokens")
      .select("*")
      .eq("token", token)
      .eq("used", false)
      .single();

    if (tokenError || !invitation) {
      console.error("❌ Invalid token error:", tokenError);
      throw new Error("קישור ההזמנה אינו תקף או שכבר נוצל");
    }

    // Check if token expired
    if (new Date(invitation.expires_at) < new Date()) {
      console.error("❌ Token expired:", invitation.expires_at);
      throw new Error("קישור ההזמנה פג תוקף");
    }

    // Check if email matches (if specified in invitation)
    if (invitation.email && invitation.email !== email) {
      console.error("❌ Email mismatch. Expected:", invitation.email, "Got:", email);
      throw new Error("כתובת האימייל אינה תואמת להזמנה");
    }

    console.log("✅ Token verified successfully");
    console.log("👤 Step 2: Creating user...");

    // Create user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name,
      },
    });

    if (authError) {
      console.error("❌ Error creating user:", authError);
      throw new Error(`שגיאה ביצירת משתמש: ${authError.message}`);
    }

    if (!authData?.user?.id) {
      console.error("❌ No user ID returned after creation");
      throw new Error("שגיאה ביצירת משתמש - לא התקבל מזהה משתמש");
    }

    const userId = authData.user.id;
    console.log("✅ User created successfully:", userId);

    // Get invitation metadata
    console.log("📦 Step 3: Processing invitation metadata...");
    const metadata = invitation.metadata || {};
    const inviteFullName = metadata.fullName || full_name;
    const inviteRole = metadata.role || "campaigner";
    const inviteAgencyIds = metadata.agencyIds || [];
    const inviteModulePermissions = metadata.modulePermissions || [];
    const inviteCampaignerId = metadata.campaignerId;
    const inviteSalesPersonId = metadata.salesPersonId;

    console.log("  Full Name:", inviteFullName);
    console.log("  Role:", inviteRole);
    console.log("  Agency IDs:", inviteAgencyIds);
    console.log("  Module Permissions:", inviteModulePermissions);
    console.log("  Campaigner ID:", inviteCampaignerId);
    console.log("  Sales Person ID:", inviteSalesPersonId);

    // Update profile with full name and IDs
    console.log("👤 Step 4: Updating user profile...");
    const profileUpdate: any = { full_name: inviteFullName };
    if (inviteCampaignerId) profileUpdate.campaigner_id = inviteCampaignerId;
    if (inviteSalesPersonId) profileUpdate.sales_person_id = inviteSalesPersonId;

    const { error: profileError } = await supabase
      .from("profiles")
      .update(profileUpdate)
      .eq("id", userId);

    if (profileError) {
      console.error("❌ Error updating profile:", profileError);
      // Don't throw - profile will have default values from trigger
    } else {
      console.log("✅ Profile updated successfully");
    }

    // Delete default campaigner role from trigger and assign correct role
    console.log("🎭 Step 5: Setting user role...");
    
    // First, delete any existing roles
    const { error: deleteRoleError } = await supabase
      .from("user_roles")
      .delete()
      .eq("user_id", userId);

    if (deleteRoleError) {
      console.error("⚠️ Warning: Could not delete default role:", deleteRoleError);
      // Continue anyway - we'll insert the correct role
    }

    // Assign correct role from invitation
    const { error: roleError } = await supabase
      .from("user_roles")
      .insert({
        user_id: userId,
        role: inviteRole,
      });

    if (roleError) {
      console.error("❌ Error assigning role:", roleError);
      throw new Error(`שגיאה בהקצאת תפקיד: ${roleError.message}`);
    }
    
    console.log("✅ Role assigned successfully:", inviteRole);

    // Set module permissions from invitation
    console.log("🔐 Step 6: Setting user permissions...");
    
    // Clear any existing permissions to avoid unintended defaults
    const { error: deletePermError } = await supabase
      .from("user_permissions")
      .delete()
      .eq("user_id", userId);

    if (deletePermError) {
      console.error("⚠️ Warning: Could not delete default permissions:", deletePermError);
      // Continue anyway
    }

    const permissionsToInsert = inviteModulePermissions.length > 0
      ? inviteModulePermissions.map((module: string) => ({
          user_id: userId,
          module: module,
          can_access: true,
        }))
      : [{
          user_id: userId,
          module: "my_profile",
          can_access: true,
        }];

    console.log("  Inserting permissions:", permissionsToInsert);

    const { error: permError } = await supabase
      .from("user_permissions")
      .insert(permissionsToInsert);

    if (permError) {
      console.error("❌ Error setting permissions:", permError);
      throw new Error(`שגיאה בהגדרת הרשאות: ${permError.message}`);
    }
    
    console.log("✅ Permissions set successfully");

    // Link campaigner to agencies if provided
    if (inviteCampaignerId && inviteAgencyIds.length > 0) {
      console.log("🏢 Step 7: Linking campaigner to agencies...");
      console.log("  Campaigner ID:", inviteCampaignerId);
      console.log("  Agency IDs:", inviteAgencyIds);
      
      const agencyLinks = inviteAgencyIds.map((agencyId: string) => ({
        campaigner_id: inviteCampaignerId,
        agency_id: agencyId,
      }));

      const { error: agencyError } = await supabase
        .from("campaigner_agencies")
        .insert(agencyLinks);

      if (agencyError) {
        console.error("❌ Error linking campaigner to agencies:", agencyError);
        // Don't throw - this is not critical
      } else {
        console.log("✅ Campaigner linked to agencies successfully");
      }
    } else {
      console.log("⏭️ Step 7: Skipping agency linking (no campaigner ID or agencies)");
    }

    // Add user to tenant
    console.log("🏠 Step 8: Adding user to tenant...");
    console.log("  Tenant ID:", invitation.tenant_id);
    
    const { error: tenantError } = await supabase
      .from("tenant_users")
      .insert({
        user_id: userId,
        tenant_id: invitation.tenant_id,
        role: "member",
      });

    if (tenantError) {
      console.error("❌ Error adding user to tenant:", tenantError);
      throw new Error("שגיאה בהוספת משתמש לארגון");
    }
    
    console.log("✅ User added to tenant successfully");

    // Mark invitation as used
    console.log("🎫 Step 9: Marking invitation as used...");
    
    const { error: updateTokenError } = await supabase
      .from("invitation_tokens")
      .update({
        used: true,
        used_at: new Date().toISOString(),
        used_by: userId,
      })
      .eq("id", invitation.id);

    if (updateTokenError) {
      console.error("⚠️ Warning: Could not mark invitation as used:", updateTokenError);
      // Don't throw - user is already created
    } else {
      console.log("✅ Invitation marked as used");
    }

    console.log("🎉 Signup completed successfully!");

    return new Response(
      JSON.stringify({
        success: true,
        message: "ההרשמה הושלמה בהצלחה",
        user_id: userId,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error in signup-with-invitation:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "שגיאה לא ידועה" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
