import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface InviteUserRequest {
  email: string;
  fullName?: string;
  role?: string;
  agencyIds?: string[];
  modulePermissions?: string[];
  resend?: boolean;
  campaignerId?: string;
  salesPersonId?: string;
  tenantId?: string; // For inviting users to a specific tenant
  baseUrl?: string; // Base URL for invitation link
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

    const { email, fullName, role, agencyIds, modulePermissions, resend, campaignerId, salesPersonId, tenantId, baseUrl }: InviteUserRequest = await req.json();

    if (!email) {
      throw new Error("Email is required");
    }

    let tenantIdFinal = tenantId;
    if (!tenantIdFinal) {
      const { data: requesterTenant } = await supabaseAdmin
        .from("tenant_users")
        .select("tenant_id")
        .eq("user_id", requesterId)
        .maybeSingle();
      tenantIdFinal = requesterTenant?.tenant_id as string | undefined;
      if (!tenantIdFinal) {
        throw new Error("Tenant ID is required");
      }
    }

    // If resend is true, we don't need role validation
    if (!resend) {
      if (!role) {
        throw new Error("Role is required for new invites");
      }

      // Validate role
      const validRoles = ["owner", "agency_owner", "team_manager", "campaigner", "sales_person"];
      if (!validRoles.includes(role)) {
        throw new Error("Invalid role");
      }
    }

    console.log(`${resend ? 'Resending' : 'Inviting'} user: ${email}${role ? ` with role: ${role}` : ''}`);
    console.log('Module permissions received:', modulePermissions);
    console.log('Tenant ID:', tenantIdFinal);

    // Check if user already exists
    const { data: existingUser } = await supabaseAdmin.auth.admin.listUsers();
    const userExists = existingUser?.users?.some(u => u.email === email);

    if (userExists) {
      console.log("User already exists");
      // For resend, send invitation link again
      if (resend) {
        // Generate new invitation token
        const token_value = crypto.randomUUID();
        
        const invitationMetadata = {
          email,
          fullName,
          role,
          agencyIds: agencyIds || [],
          modulePermissions: modulePermissions || [],
          campaignerId,
          salesPersonId,
        };

        const { error: tokenError } = await supabaseAdmin
          .from("invitation_tokens")
          .insert({
            token: token_value,
            tenant_id: tenantIdFinal,
            created_by: requesterId,
            email: email,
            metadata: invitationMetadata,
          });

        if (tokenError) {
          console.error("Error creating invitation token:", tokenError);
          throw tokenError;
        }

        // Build invitation link (force origin only)
        const baseUrlInput1 = baseUrl || "https://after-lead.lovable.app";
        let safeBaseUrl1: string;
        try {
          const u = new URL(baseUrlInput1);
          safeBaseUrl1 = u.origin;
        } catch {
          const parts = baseUrlInput1.split("/").slice(0, 3);
          safeBaseUrl1 = parts.join("/");
        }
        const invitationLink = `${safeBaseUrl1.replace(/\/+$/, "")}/auth?token=${token_value}`;

        // Send invitation email via Supabase Auth
        try {
          const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
            redirectTo: invitationLink,
          });

          if (inviteError) {
            console.error("Error sending invitation email:", inviteError);
          } else {
            console.log("Invitation email resent successfully via Supabase Auth to:", email);
          }
        } catch (e) {
          console.error("Invitation email exception:", e);
        }

        // Always return success with the link so you can copy manually if needed
        return new Response(
          JSON.stringify({ success: true, message: 'Invitation resent successfully', invitationLink }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({
          success: false,
          error: "EMAIL_EXISTS",
          message: "המשתמש כבר רשום במערכת",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Create invitation token for new user
    const token_value = crypto.randomUUID();
    
    // Store invitation metadata
    const invitationMetadata = {
      email,
      fullName,
      role,
      agencyIds: agencyIds || [],
      modulePermissions: modulePermissions || [],
      campaignerId,
      salesPersonId,
    };
    
    const { data: invitation, error: tokenError } = await supabaseAdmin
      .from("invitation_tokens")
      .insert({
        token: token_value,
        tenant_id: tenantIdFinal,
        created_by: requesterId,
        email: email,
        metadata: invitationMetadata,
      })
      .select()
      .single();

    if (tokenError) {
      console.error("Error creating invitation token:", tokenError);
      throw tokenError;
    }

    console.log("Invitation token created:", invitation);

    // Build invitation link (force origin only)
    const baseUrlInput2 = baseUrl || "https://after-lead.lovable.app";
    let safeBaseUrl2: string;
    try {
      const u = new URL(baseUrlInput2);
      safeBaseUrl2 = u.origin;
    } catch {
      const parts = baseUrlInput2.split("/").slice(0, 3);
      safeBaseUrl2 = parts.join("/");
    }
    const invitationLink = `${safeBaseUrl2.replace(/\/+$/, "")}/auth?token=${token_value}`;

    // Send invitation email via Supabase Auth
    try {
      const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
        redirectTo: invitationLink,
      });

      if (inviteError) {
        console.error("Error sending invitation email:", inviteError);
      } else {
        console.log("Invitation email sent successfully via Supabase Auth to:", email);
      }
    } catch (e) {
      console.error("Invitation email exception:", e);
    }

    // Store invitation details for later user creation
    const inviteData = {
      email,
      fullName,
      role,
      agencyIds,
      modulePermissions,
      campaignerId,
      salesPersonId,
      tenantId,
      token: token_value,
    };


    // Return success with direct invitation link
    const baseUrlInput3 = baseUrl || "https://after-lead.lovable.app";
    let safeBaseUrl3: string;
    try {
      const u = new URL(baseUrlInput3);
      safeBaseUrl3 = u.origin;
    } catch {
      const parts = baseUrlInput3.split("/").slice(0, 3);
      safeBaseUrl3 = parts.join("/");
    }
    const directInvitationLink = `${safeBaseUrl3.replace(/\/+$/, "")}/auth?token=${token_value}`;

    return new Response(
      JSON.stringify({
        success: true,
        message: "User invited successfully",
        invitationLink: directInvitationLink,
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

// Helper function to get role name in Hebrew
function getRoleNameInHebrew(role: string): string {
  const roleNames: Record<string, string> = {
    owner: "בעלים",
    agency_owner: "בעלים סוכנות",
    team_manager: "מנהל צוות",
    campaigner: "קמפיינר",
    sales_person: "איש מכירות",
  };
  return roleNames[role] || role;
}
