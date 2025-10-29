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

    console.log("Signup request for token:", token);

    // Verify invitation token
    const { data: invitation, error: tokenError } = await supabase
      .from("invitation_tokens")
      .select("*")
      .eq("token", token)
      .eq("used", false)
      .single();

    if (tokenError || !invitation) {
      console.error("Invalid token:", tokenError);
      throw new Error("קישור ההזמנה אינו תקף או שכבר נוצל");
    }

    // Check if token expired
    if (new Date(invitation.expires_at) < new Date()) {
      throw new Error("קישור ההזמנה פג תוקף");
    }

    // Check if email matches (if specified in invitation)
    if (invitation.email && invitation.email !== email) {
      throw new Error("כתובת האימייל אינה תואמת להזמנה");
    }

    console.log("Creating user:", email);

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
      console.error("Error creating user:", authError);
      throw new Error(`שגיאה ביצירת משתמש: ${authError.message}`);
    }

    const userId = authData.user.id;
    console.log("User created:", userId);

    // Get invitation metadata
    const metadata = invitation.metadata || {};
    const inviteFullName = metadata.fullName || full_name;
    const inviteRole = metadata.role || "campaigner";
    const inviteAgencyIds = metadata.agencyIds || [];
    const inviteModulePermissions = metadata.modulePermissions || [];
    const inviteCampaignerId = metadata.campaignerId;
    const inviteSalesPersonId = metadata.salesPersonId;

    console.log("Processing invitation metadata:", metadata);

    // Update profile with full name and IDs
    const profileUpdate: any = { full_name: inviteFullName };
    if (inviteCampaignerId) profileUpdate.campaigner_id = inviteCampaignerId;
    if (inviteSalesPersonId) profileUpdate.sales_person_id = inviteSalesPersonId;

    const { error: profileError } = await supabase
      .from("profiles")
      .update(profileUpdate)
      .eq("id", userId);

    if (profileError) {
      console.error("Error updating profile:", profileError);
    } else {
      console.log("Profile updated successfully");
    }

    // Delete default campaigner role from trigger
    await supabase
      .from("user_roles")
      .delete()
      .eq("user_id", userId);

    // Assign correct role from invitation
    const { error: roleError } = await supabase
      .from("user_roles")
      .insert({
        user_id: userId,
        role: inviteRole,
      });

    if (roleError) {
      console.error("Error assigning role:", roleError);
    } else {
      console.log("Role assigned:", inviteRole);
    }

    // Set module permissions from invitation
    // Clear any existing permissions to avoid unintended defaults
    await supabase
      .from("user_permissions")
      .delete()
      .eq("user_id", userId);

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

    const { error: permError } = await supabase
      .from("user_permissions")
      .insert(permissionsToInsert);

    if (permError) {
      console.error("Error setting permissions:", permError);
    } else {
      console.log("Permissions set:", permissionsToInsert);
    }

    // Link campaigner to agencies if provided
    if (inviteCampaignerId && inviteAgencyIds.length > 0) {
      const agencyLinks = inviteAgencyIds.map((agencyId: string) => ({
        campaigner_id: inviteCampaignerId,
        agency_id: agencyId,
      }));

      const { error: agencyError } = await supabase
        .from("campaigner_agencies")
        .insert(agencyLinks);

      if (agencyError) {
        console.error("Error linking campaigner to agencies:", agencyError);
      } else {
        console.log("Campaigner linked to agencies successfully");
      }
    }

    // Add user to tenant
    const { error: tenantError } = await supabase
      .from("tenant_users")
      .insert({
        user_id: userId,
        tenant_id: invitation.tenant_id,
        role: "member",
      });

    if (tenantError) {
      console.error("Error adding user to tenant:", tenantError);
      throw new Error("שגיאה בהוספת משתמש לארגון");
    }

    // Mark invitation as used
    await supabase
      .from("invitation_tokens")
      .update({
        used: true,
        used_at: new Date().toISOString(),
        used_by: userId,
      })
      .eq("id", invitation.id);

    console.log("Signup completed successfully");

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
