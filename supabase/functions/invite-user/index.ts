import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface InviteUserRequest {
  email: string;
  role?: string;
  agencyIds?: string[];
  modulePermissions?: string[];
  redirectUrl?: string;
  resend?: boolean;
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

    // Verify requesting user by decoding the JWT from the Authorization header
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    const token = authHeader.replace("Bearer ", "");
    const payloadBase64 = token.split(".")[1];
    if (!payloadBase64) {
      throw new Error("Unauthorized");
    }
    const payloadJson = atob(payloadBase64);
    const payload = JSON.parse(payloadJson);
    const requesterId: string | undefined = payload?.sub;

    if (!requesterId) {
      throw new Error("Unauthorized");
    }

    // Check if the user is an owner or agency_owner
    const { data: roles, error: rolesError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", requesterId)
      .in("role", ["owner", "agency_owner"]);

    if (rolesError || !roles || roles.length === 0) {
      throw new Error("Only owners and agency owners can invite users");
    }

    const { email, role, agencyIds, modulePermissions, redirectUrl, resend }: InviteUserRequest = await req.json();

    if (!email) {
      throw new Error("Email is required");
    }

    // If resend is true, we don't need role validation
    if (!resend) {
      if (!role) {
        throw new Error("Role is required for new invites");
      }

      // Validate role
      const validRoles = ["owner", "agency_owner", "team_manager", "campaigner"];
      if (!validRoles.includes(role)) {
        throw new Error("Invalid role");
      }
    }

    console.log(`${resend ? 'Resending' : 'Inviting'} user: ${email}${role ? ` with role: ${role}` : ''}`);

    // For resend, send a password reset email using backend mailer (no Resend)
    if (resend) {
      // Prefer redirectUrl from body, otherwise build from Origin header
      const originHeader = req.headers.get('origin') || req.headers.get('referer');
      const computedOrigin = originHeader ? new URL(originHeader).origin : undefined;
      const setupUrl = redirectUrl || (computedOrigin ? `${computedOrigin}/setup` : undefined);
      
      const { error: resetError } = await supabaseAdmin.auth.resetPasswordForEmail(email, {
        redirectTo: setupUrl,
      });

      if (resetError) {
        console.error('Error sending password reset:', resetError, 'redirectTo:', setupUrl);
        throw resetError;
      }

      console.log('Password reset email sent successfully for resend to:', setupUrl);

      return new Response(
        JSON.stringify({ success: true, message: 'Invitation resent successfully' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // For new invites, use inviteUserByEmail
    const inviteOptions: { redirectTo?: string; data?: Record<string, any> } = {};
    
    if (role) {
      inviteOptions.data = { role };
    }
    
    if (redirectUrl) {
      inviteOptions.redirectTo = redirectUrl;
    }

    const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      email,
      inviteOptions
    );

    if (inviteError) {
      console.error("Error inviting user:", inviteError);
      throw inviteError;
    }

    console.log("User invited successfully:", inviteData);

    // Assign the role to the user (only if not resending and role is provided)
    if (inviteData.user && role && !resend) {
      // First delete any existing roles (especially the default "campaigner" from handle_new_user trigger)
      await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", inviteData.user.id);

      // Then insert the correct role
      const { error: roleError } = await supabaseAdmin
        .from("user_roles")
        .insert({
          user_id: inviteData.user.id,
          role: role,
        });

      if (roleError) {
        console.error("Error assigning role:", roleError);
        // Don't throw - the user was created, just log the error
      }

      // Link campaigner to agencies ONLY if campaigner_id already exists and not resending
      if (agencyIds && agencyIds.length > 0 && !resend) {
        // First get user profile to check if campaigner exists
        const { data: profile } = await supabaseAdmin
          .from("profiles")
          .select("campaigner_id")
          .eq("id", inviteData.user.id)
          .maybeSingle();

        const campaignerId = profile?.campaigner_id;

        // Only link to agencies if user is already linked to a campaigner
        if (campaignerId) {
          const agencyLinks = agencyIds.map((agencyId) => ({
            campaigner_id: campaignerId,
            agency_id: agencyId,
          }));

          const { error: agencyError } = await supabaseAdmin
            .from("campaigner_agencies")
            .insert(agencyLinks);

          if (agencyError) {
            console.error("Error linking campaigner to agencies:", agencyError);
            // Don't throw - the user was created, just log the error
          }
        } else {
          console.log("User has no campaigner_id, skipping agency links");
        }
      }

      // Set module permissions (only if not resending)
      if (modulePermissions && modulePermissions.length > 0 && !resend) {
        const permissions = modulePermissions.map((module) => ({
          user_id: inviteData.user.id,
          module: module,
          can_access: true,
        }));

        const { error: permissionsError } = await supabaseAdmin
          .from("user_permissions")
          .insert(permissions);

        if (permissionsError) {
          console.error("Error setting module permissions:", permissionsError);
          // Don't throw - the user was created, just log the error
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "User invited successfully",
        user: inviteData.user,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in invite-user function:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: error.message === "Unauthorized" || error.message === "Only owners and agency owners can invite users" ? 403 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
