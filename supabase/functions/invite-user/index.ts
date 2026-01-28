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
      const validRoles = ["owner", "agency_owner", "team_manager", "campaigner", "sales_person", "super_admin", "seo"];
      if (!validRoles.includes(role)) {
        throw new Error("Invalid role");
      }
    }

    console.log(`${resend ? 'Resending' : 'Inviting'} user: ${email}${role ? ` with role: ${role}` : ''}`);
    console.log('Module permissions received:', modulePermissions);
    console.log('Tenant ID:', tenantIdFinal);

    // Auto-create sales_people record if role is sales_person and no salesPersonId provided
    let effectiveSalesPersonId = salesPersonId;
    if (role === 'sales_person' && !salesPersonId && fullName) {
      console.log("Auto-creating sales_people record for:", fullName);
      const { data: newSalesPerson, error: spError } = await supabaseAdmin
        .from("sales_people")
        .insert({
          full_name: fullName,
          email: email,
          active: true,
          tenant_id: tenantIdFinal,
        })
        .select()
        .single();
      
      if (spError) {
        console.error("Error creating sales_people record:", spError);
      } else if (newSalesPerson) {
        effectiveSalesPersonId = newSalesPerson.id;
        console.log("Created sales_people record with ID:", effectiveSalesPersonId);
        
        // Link to agencies if provided
        if (agencyIds && agencyIds.length > 0) {
          const spAgenciesToInsert = agencyIds.map((agencyId) => ({
            sales_person_id: newSalesPerson.id,
            agency_id: agencyId,
          }));
          await supabaseAdmin
            .from("sales_person_agencies")
            .insert(spAgenciesToInsert);
        }
      }
    }

    // Check if user already exists
    const { data: existingUser } = await supabaseAdmin.auth.admin.listUsers();
    const userExists = existingUser?.users?.some(u => u.email === email);

    if (userExists) {
      console.log("User already exists - updating their details");
      
      // Get existing user ID
      const existingUserData = existingUser?.users?.find(u => u.email === email);
      const userId = existingUserData?.id;
      
      if (!userId) {
        throw new Error("Could not find user ID");
      }

      // Ensure profile exists with pending status
      await supabaseAdmin
        .from("profiles")
        .upsert({ id: userId, email, full_name: fullName || null, status: 'pending' }, { onConflict: "id" });

      // Update user profile if fullName provided
      if (fullName) {
        await supabaseAdmin
          .from("profiles")
          .update({ full_name: fullName })
          .eq("id", userId);
      }

      // Update campaigner_id if provided
      if (campaignerId) {
        await supabaseAdmin
          .from("profiles")
          .update({ campaigner_id: campaignerId })
          .eq("id", userId);
      }

      // Update sales_person_id if provided (use effectiveSalesPersonId which may be auto-created)
      if (effectiveSalesPersonId) {
        await supabaseAdmin
          .from("profiles")
          .update({ sales_person_id: effectiveSalesPersonId })
          .eq("id", userId);
      }

      // Update role if provided
      if (role) {
        // Delete existing roles
        await supabaseAdmin
          .from("user_roles")
          .delete()
          .eq("user_id", userId);

        // Insert new role
        await supabaseAdmin
          .from("user_roles")
          .insert({ user_id: userId, role });
      }

      // Update module permissions if provided
      if (modulePermissions && modulePermissions.length > 0) {
        // Delete existing permissions
        await supabaseAdmin
          .from("user_permissions")
          .delete()
          .eq("user_id", userId);

        // Insert new permissions
        const permissionsToInsert = modulePermissions.map((module) => ({
          user_id: userId,
          module: module,
          can_access: true,
        }));

        await supabaseAdmin
          .from("user_permissions")
          .insert(permissionsToInsert);
      }

      // Update campaigner agencies if provided
      if (campaignerId && agencyIds && agencyIds.length > 0) {
        // Delete existing campaigner agencies
        await supabaseAdmin
          .from("campaigner_agencies")
          .delete()
          .eq("campaigner_id", campaignerId);

        // Insert new campaigner agencies
        const campaignerAgenciesToInsert = agencyIds.map((agencyId) => ({
          campaigner_id: campaignerId,
          agency_id: agencyId,
        }));

        await supabaseAdmin
          .from("campaigner_agencies")
          .insert(campaignerAgenciesToInsert);
      }

      // Update sales person agencies if provided (use effectiveSalesPersonId)
      if (effectiveSalesPersonId && agencyIds && agencyIds.length > 0) {
        // Delete existing sales person agencies
        await supabaseAdmin
          .from("sales_person_agencies")
          .delete()
          .eq("sales_person_id", effectiveSalesPersonId);

        // Insert new sales person agencies
        const salesPersonAgenciesToInsert = agencyIds.map((agencyId) => ({
          sales_person_id: effectiveSalesPersonId,
          agency_id: agencyId,
        }));

        await supabaseAdmin
          .from("sales_person_agencies")
          .insert(salesPersonAgenciesToInsert);
      }

      // Check if user is in the tenant
      const { data: tenantUser } = await supabaseAdmin
        .from("tenant_users")
        .select("*")
        .eq("user_id", userId)
        .eq("tenant_id", tenantIdFinal)
        .maybeSingle();

      // Add user to tenant if not already there
      let wasAddedToTenant = false;
      if (!tenantUser) {
        await supabaseAdmin
          .from("tenant_users")
          .insert({
            user_id: userId,
            tenant_id: tenantIdFinal,
            role: role || "member",
          });
        wasAddedToTenant = true;
        console.log(`User ${email} was added to tenant ${tenantIdFinal}`);
      }

      // If user was added to a new tenant, return success
      if (wasAddedToTenant) {
        return new Response(
          JSON.stringify({
            success: true,
            message: "המשתמש הקיים נוסף לארגון בהצלחה",
            addedToExistingUser: true,
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // User already exists in this tenant - return error
      return new Response(
        JSON.stringify({
          success: false,
          error: "EMAIL_EXISTS_IN_TENANT",
          message: "המשתמש כבר קיים בארגון זה",
        }),
        {
          status: 200,
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

    // Build simple invitation link to auth page
    const baseUrlInput2 = baseUrl || "https://after-lead.lovable.app";
    let safeBaseUrl2: string;
    try {
      const u = new URL(baseUrlInput2);
      safeBaseUrl2 = u.origin;
    } catch {
      const parts = baseUrlInput2.split("/").slice(0, 3);
      safeBaseUrl2 = parts.join("/");
    }
    const invitationLink = `${safeBaseUrl2.replace(/\/+$/, "")}/auth`;

    // Send invitation email via Lovable Auth (standard)
    try {
      const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
        redirectTo: invitationLink,
        data: {
          invitation_id: invitation.id,
        }
      });

      if (inviteError) {
        console.error("Error sending invitation email:", inviteError);
        throw new Error(inviteError.message || "Failed to send invitation email");
      } else {
        console.log("Invitation email sent successfully via Supabase Auth to:", email);
        const newUserId = inviteData?.user?.id;
        if (newUserId) {
          // Create profile with pending status so the user appears in the org list immediately
          await supabaseAdmin
            .from("profiles")
            .upsert({ id: newUserId, email, full_name: fullName || null, status: 'pending' }, { onConflict: "id" });

          if (role) {
            await supabaseAdmin
              .from("user_roles")
              .upsert({ user_id: newUserId, role, tenant_id: tenantIdFinal }, { onConflict: 'user_id,role,tenant_id' });
          }

          // Link invited user to tenant immediately so owners can see them
          const { data: existingTU } = await supabaseAdmin
            .from("tenant_users")
            .select("id")
            .eq("user_id", newUserId)
            .eq("tenant_id", tenantIdFinal)
            .maybeSingle();
          if (!existingTU) {
            await supabaseAdmin
              .from("tenant_users")
              .insert({ user_id: newUserId, tenant_id: tenantIdFinal, role: role || 'member' });
          }

          // *** CRITICAL FIX: Insert module permissions immediately for new users ***
          if (modulePermissions && modulePermissions.length > 0) {
            console.log("Inserting permissions for new user:", modulePermissions);
            const permissionsToInsert = modulePermissions.map((module) => ({
              user_id: newUserId,
              module: module,
              can_access: true,
            }));

            const { error: permError } = await supabaseAdmin
              .from("user_permissions")
              .insert(permissionsToInsert);
            
            if (permError) {
              console.error("Error inserting permissions:", permError);
            } else {
              console.log("Successfully inserted permissions for new user");
            }
          }

          // Optionally attach campaigner/sales person ids provided
          if (campaignerId) {
            await supabaseAdmin
              .from("profiles")
              .update({ campaigner_id: campaignerId })
              .eq("id", newUserId);
          }
          // Use effectiveSalesPersonId which may be auto-created
          if (effectiveSalesPersonId) {
            await supabaseAdmin
              .from("profiles")
              .update({ sales_person_id: effectiveSalesPersonId })
              .eq("id", newUserId);
          }

          // Link campaigner to agencies if provided
          if (campaignerId && agencyIds && agencyIds.length > 0) {
            const campaignerAgenciesToInsert = agencyIds.map((agencyId) => ({
              campaigner_id: campaignerId,
              agency_id: agencyId,
            }));

            await supabaseAdmin
              .from("campaigner_agencies")
              .upsert(campaignerAgenciesToInsert, { onConflict: 'campaigner_id,agency_id' });
          }

          // Link sales person to agencies if provided (use effectiveSalesPersonId)
          if (effectiveSalesPersonId && agencyIds && agencyIds.length > 0) {
            const salesPersonAgenciesToInsert = agencyIds.map((agencyId) => ({
              sales_person_id: effectiveSalesPersonId,
              agency_id: agencyId,
            }));

            await supabaseAdmin
              .from("sales_person_agencies")
              .upsert(salesPersonAgenciesToInsert, { onConflict: 'sales_person_id,agency_id' });
          }
        }
      }
    } catch (e) {
      console.error("Invitation email exception:", e);
    }

    // Return success with invitation link
    const directInvitationLink = `${safeBaseUrl2.replace(/\/+$/, "")}/auth`;

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
