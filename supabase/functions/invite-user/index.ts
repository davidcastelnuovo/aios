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
  tenantId?: string;
  baseUrl?: string;
  /** When true, provision tenant access without sending another email (multi-org invite). */
  skipEmail?: boolean;
  /** When false, do not overwrite profiles.campaigner_id / sales_person_id (secondary org). */
  updateProfileTeamLinks?: boolean;
}

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const DEFAULT_FROM_EMAIL = Deno.env.get("RESEND_FROM_EMAIL") ?? "noreply@aios.co.il";
const DEFAULT_FROM_NAME = Deno.env.get("RESEND_FROM_NAME") ?? "AIOS";

function safeOrigin(baseUrl?: string): string {
  const baseUrlInput = baseUrl || "https://aios.co.il";
  try {
    return new URL(baseUrlInput).origin;
  } catch {
    return baseUrlInput.split("/").slice(0, 3).join("/");
  }
}

async function findUserIdByEmail(
  supabaseAdmin: ReturnType<typeof createClient>,
  email: string,
): Promise<string | null> {
  const normalized = email.trim().toLowerCase();
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .ilike("email", normalized)
    .maybeSingle();
  if (profile?.id) return profile.id;

  // Fallback: paginated auth lookup (avoid single listUsers() over entire user base)
  let page = 1;
  const perPage = 200;
  while (page <= 10) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
    if (error) {
      console.error("listUsers error:", error);
      break;
    }
    const match = data?.users?.find((u) => u.email?.toLowerCase() === normalized);
    if (match?.id) return match.id;
    if (!data?.users?.length || data.users.length < perPage) break;
    page++;
  }
  return null;
}

async function sendInvitationEmailViaResend(
  to: string,
  actionLink: string,
  orgName: string,
  fullName?: string,
): Promise<void> {
  if (!RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is not configured");
  }

  const greeting = fullName ? `שלום ${fullName},` : "שלום,";
  const html = `
    <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
      <h1 style="color: #111; font-size: 22px;">הוזמנת להצטרף ל${orgName}</h1>
      <p style="font-size: 16px; color: #444; line-height: 1.6;">${greeting}</p>
      <p style="font-size: 16px; color: #444; line-height: 1.6;">
        הוזמנת להצטרף למערכת AIOS בארגון <strong>${orgName}</strong>.
        לחץ על הכפתור להתחברות ויצירת חשבון:
      </p>
      <p style="margin: 28px 0;">
        <a href="${actionLink}"
           style="background-color: #2563eb; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
          הצטרף ל-AIOS
        </a>
      </p>
      <p style="font-size: 13px; color: #888;">
        אם הכפתור לא עובד, העתק את הקישור לדפדפן:<br/>
        <a href="${actionLink}" style="color: #2563eb;">${actionLink}</a>
      </p>
    </div>
  `;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `${DEFAULT_FROM_NAME} <${DEFAULT_FROM_EMAIL}>`,
      to: [to],
      subject: `הזמנה להצטרף ל${orgName} — AIOS`,
      html,
    }),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error("Resend error:", json);
    throw new Error("Failed to send invitation email via Resend");
  }
}

async function generateAuthLink(
  supabaseAdmin: ReturnType<typeof createClient>,
  email: string,
  redirectTo: string,
  isNewUser: boolean,
  invitationId?: string,
): Promise<string> {
  const linkType = isNewUser ? "invite" : "magiclink";
  const { data, error } = await supabaseAdmin.auth.admin.generateLink({
    type: linkType,
    email,
    options: {
      redirectTo,
      data: invitationId ? { invitation_id: invitationId } : undefined,
    },
  });

  if (error) {
    console.error("generateLink error:", error);
    throw new Error(error.message || "Failed to generate invitation link");
  }

  const actionLink = data?.properties?.action_link;
  if (!actionLink) {
    throw new Error("No action link returned from auth");
  }
  return actionLink;
}

async function autoCreateCampaigner(
  supabaseAdmin: ReturnType<typeof createClient>,
  tenantId: string,
  email: string,
  fullName?: string,
  agencyIds?: string[],
): Promise<string | undefined> {
  const displayName = fullName?.trim() || email.split("@")[0] || "קמפיינר";
  const { data: newCampaigner, error } = await supabaseAdmin
    .from("campaigners")
    .insert({
      full_name: displayName,
      email: email,
      active: true,
      tenant_id: tenantId,
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating campaigner:", error);
    return undefined;
  }

  if (agencyIds && agencyIds.length > 0) {
    const rows = agencyIds.map((agencyId) => ({
      campaigner_id: newCampaigner.id,
      agency_id: agencyId,
    }));
    await supabaseAdmin.from("campaigner_agencies").insert(rows);
  }

  return newCampaigner.id;
}

async function autoCreateSalesPerson(
  supabaseAdmin: ReturnType<typeof createClient>,
  tenantId: string,
  email: string,
  fullName?: string,
  agencyIds?: string[],
): Promise<string | undefined> {
  const displayName = fullName?.trim() || email.split("@")[0] || "איש מכירות";
  const { data: newSalesPerson, error } = await supabaseAdmin
    .from("sales_people")
    .insert({
      full_name: displayName,
      email: email,
      active: true,
      tenant_id: tenantId,
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating sales_people record:", error);
    return undefined;
  }

  if (agencyIds && agencyIds.length > 0) {
    const rows = agencyIds.map((agencyId) => ({
      sales_person_id: newSalesPerson.id,
      agency_id: agencyId,
    }));
    await supabaseAdmin.from("sales_person_agencies").insert(rows);
  }

  return newSalesPerson.id;
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

    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user: requesterUser }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !requesterUser) {
      throw new Error("Unauthorized");
    }
    const requesterId = requesterUser.id;

    const { data: roles, error: rolesError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", requesterId)
      .in("role", ["owner", "agency_owner"]);

    if (rolesError || !roles || roles.length === 0) {
      throw new Error("Only owners and agency owners can invite users");
    }

    const {
      email: rawEmail,
      fullName,
      role,
      agencyIds,
      modulePermissions,
      resend,
      campaignerId,
      salesPersonId,
      tenantId,
      baseUrl,
      skipEmail,
      updateProfileTeamLinks = true,
    }: InviteUserRequest = await req.json();

    const email = rawEmail?.trim().toLowerCase();
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

    const { data: tenantRow } = await supabaseAdmin
      .from("tenants")
      .select("name")
      .eq("id", tenantIdFinal)
      .maybeSingle();
    const orgName = tenantRow?.name || "AIOS";

    const authRedirect = `${safeOrigin(baseUrl).replace(/\/+$/, "")}/auth`;

    if (!resend) {
      if (!role) {
        throw new Error("Role is required for new invites");
      }
      const validRoles = ["owner", "agency_owner", "team_manager", "campaigner", "sales_person", "super_admin", "seo"];
      if (!validRoles.includes(role)) {
        throw new Error("Invalid role");
      }
    }

    // Resend invitation email only (user already in tenant)
    if (resend) {
      const existingUserId = await findUserIdByEmail(supabaseAdmin, email);
      if (!existingUserId) {
        throw new Error("User not found");
      }

      const { data: tenantUser } = await supabaseAdmin
        .from("tenant_users")
        .select("id")
        .eq("user_id", existingUserId)
        .eq("tenant_id", tenantIdFinal)
        .maybeSingle();

      if (!tenantUser) {
        throw new Error("User is not in this organization");
      }

      const actionLink = await generateAuthLink(
        supabaseAdmin,
        email,
        authRedirect,
        false,
      );
      await sendInvitationEmailViaResend(email, actionLink, orgName, fullName);

      return new Response(
        JSON.stringify({
          success: true,
          message: "Invitation resent successfully",
          invitationLink: authRedirect,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Auto-create team member records when role requires them
    let effectiveCampaignerId = campaignerId;
    if (role === "campaigner" && !campaignerId) {
      effectiveCampaignerId = await autoCreateCampaigner(
        supabaseAdmin,
        tenantIdFinal,
        email,
        fullName,
        agencyIds,
      );
    }

    let effectiveSalesPersonId = salesPersonId;
    if (role === "sales_person" && !salesPersonId) {
      effectiveSalesPersonId = await autoCreateSalesPerson(
        supabaseAdmin,
        tenantIdFinal,
        email,
        fullName,
        agencyIds,
      );
    }

    const existingUserId = await findUserIdByEmail(supabaseAdmin, email);

    if (existingUserId) {
      const userId = existingUserId;

      await supabaseAdmin
        .from("profiles")
        .upsert(
          { id: userId, email, full_name: fullName || null, status: "pending" },
          { onConflict: "id" },
        );

      if (fullName) {
        await supabaseAdmin.from("profiles").update({ full_name: fullName }).eq("id", userId);
      }

      if (updateProfileTeamLinks && effectiveCampaignerId) {
        await supabaseAdmin
          .from("profiles")
          .update({ campaigner_id: effectiveCampaignerId })
          .eq("id", userId);
      }

      if (updateProfileTeamLinks && effectiveSalesPersonId) {
        await supabaseAdmin
          .from("profiles")
          .update({ sales_person_id: effectiveSalesPersonId })
          .eq("id", userId);
      }

      if (role) {
        await supabaseAdmin
          .from("user_roles")
          .delete()
          .eq("user_id", userId)
          .eq("tenant_id", tenantIdFinal);

        await supabaseAdmin
          .from("user_roles")
          .insert({ user_id: userId, role, tenant_id: tenantIdFinal });
      }

      if (modulePermissions && modulePermissions.length > 0) {
        await supabaseAdmin.from("user_permissions").delete().eq("user_id", userId);
        const permissionsToInsert = modulePermissions.map((module) => ({
          user_id: userId,
          module,
          can_access: true,
        }));
        await supabaseAdmin.from("user_permissions").insert(permissionsToInsert);
      }

      if (effectiveCampaignerId && agencyIds && agencyIds.length > 0) {
        await supabaseAdmin
          .from("campaigner_agencies")
          .delete()
          .eq("campaigner_id", effectiveCampaignerId);
        const rows = agencyIds.map((agencyId) => ({
          campaigner_id: effectiveCampaignerId,
          agency_id: agencyId,
        }));
        await supabaseAdmin.from("campaigner_agencies").insert(rows);
      }

      if (effectiveSalesPersonId && agencyIds && agencyIds.length > 0) {
        await supabaseAdmin
          .from("sales_person_agencies")
          .delete()
          .eq("sales_person_id", effectiveSalesPersonId);
        const rows = agencyIds.map((agencyId) => ({
          sales_person_id: effectiveSalesPersonId,
          agency_id: agencyId,
        }));
        await supabaseAdmin.from("sales_person_agencies").insert(rows);
      }

      const { data: tenantUser } = await supabaseAdmin
        .from("tenant_users")
        .select("id")
        .eq("user_id", userId)
        .eq("tenant_id", tenantIdFinal)
        .maybeSingle();

      let wasAddedToTenant = false;
      if (!tenantUser) {
        await supabaseAdmin.from("tenant_users").insert({
          user_id: userId,
          tenant_id: tenantIdFinal,
          role: role || "member",
        });
        wasAddedToTenant = true;
      }

      if (wasAddedToTenant) {
        let emailSent = false;
        if (!skipEmail) {
          const actionLink = await generateAuthLink(
            supabaseAdmin,
            email,
            authRedirect,
            false,
          );
          await sendInvitationEmailViaResend(email, actionLink, orgName, fullName);
          emailSent = true;
        }

        return new Response(
          JSON.stringify({
            success: true,
            message: "המשתמש הקיים נוסף לארגון בהצלחה",
            addedToExistingUser: true,
            emailSent,
            invitationLink: authRedirect,
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      return new Response(
        JSON.stringify({
          success: false,
          error: "EMAIL_EXISTS_IN_TENANT",
          message: "המשתמש כבר קיים בארגון זה",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const invitationMetadata = {
      email,
      fullName,
      role,
      agencyIds: agencyIds || [],
      modulePermissions: modulePermissions || [],
      campaignerId: effectiveCampaignerId,
      salesPersonId: effectiveSalesPersonId,
    };

    const { data: invitation, error: tokenError } = await supabaseAdmin
      .from("invitation_tokens")
      .insert({
        token: crypto.randomUUID(),
        tenant_id: tenantIdFinal,
        created_by: requesterId,
        email,
        metadata: invitationMetadata,
      })
      .select()
      .single();

    if (tokenError) {
      console.error("Error creating invitation token:", tokenError);
      throw tokenError;
    }

    // Create auth user via generateLink (no Supabase email) — send via Resend only
    const inviteLinkData = await supabaseAdmin.auth.admin.generateLink({
      type: "invite",
      email,
      options: {
        redirectTo: authRedirect,
        data: { invitation_id: invitation.id },
      },
    });

    if (inviteLinkData.error) {
      console.error("generateLink invite error:", inviteLinkData.error);
      throw new Error(inviteLinkData.error.message || "Failed to create invited user");
    }

    const newUserId = inviteLinkData.data?.user?.id ?? await findUserIdByEmail(supabaseAdmin, email);
    const actionLink = inviteLinkData.data?.properties?.action_link;

    if (!actionLink) {
      throw new Error("No invitation link generated");
    }

    if (newUserId) {
      await supabaseAdmin
        .from("profiles")
        .upsert(
          { id: newUserId, email, full_name: fullName || null, status: "pending" },
          { onConflict: "id" },
        );

      if (role) {
        await supabaseAdmin
          .from("user_roles")
          .upsert(
            { user_id: newUserId, role, tenant_id: tenantIdFinal },
            { onConflict: "user_id,role,tenant_id" },
          );
      }

      const { data: existingTU } = await supabaseAdmin
        .from("tenant_users")
        .select("id")
        .eq("user_id", newUserId)
        .eq("tenant_id", tenantIdFinal)
        .maybeSingle();

      if (!existingTU) {
        await supabaseAdmin.from("tenant_users").insert({
          user_id: newUserId,
          tenant_id: tenantIdFinal,
          role: role || "member",
        });
      }

      if (modulePermissions && modulePermissions.length > 0) {
        const permissionsToInsert = modulePermissions.map((module) => ({
          user_id: newUserId,
          module,
          can_access: true,
        }));
        const { error: permError } = await supabaseAdmin
          .from("user_permissions")
          .insert(permissionsToInsert);
        if (permError) console.error("Error inserting permissions:", permError);
      }

      if (effectiveCampaignerId) {
        await supabaseAdmin
          .from("profiles")
          .update({ campaigner_id: effectiveCampaignerId })
          .eq("id", newUserId);
      }

      if (effectiveSalesPersonId) {
        await supabaseAdmin
          .from("profiles")
          .update({ sales_person_id: effectiveSalesPersonId })
          .eq("id", newUserId);
      }

      if (effectiveCampaignerId && agencyIds && agencyIds.length > 0) {
        const rows = agencyIds.map((agencyId) => ({
          campaigner_id: effectiveCampaignerId,
          agency_id: agencyId,
        }));
        await supabaseAdmin
          .from("campaigner_agencies")
          .upsert(rows, { onConflict: "campaigner_id,agency_id" });
      }

      if (effectiveSalesPersonId && agencyIds && agencyIds.length > 0) {
        const rows = agencyIds.map((agencyId) => ({
          sales_person_id: effectiveSalesPersonId,
          agency_id: agencyId,
        }));
        await supabaseAdmin
          .from("sales_person_agencies")
          .upsert(rows, { onConflict: "sales_person_id,agency_id" });
      }
    }

    if (!skipEmail) {
      await sendInvitationEmailViaResend(email, actionLink, orgName, fullName);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "User invited successfully",
        emailSent: !skipEmail,
        invitationLink: authRedirect,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error: any) {
    console.error("Error in invite-user function:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status:
          error.message === "Unauthorized" ||
          error.message === "Only owners and agency owners can invite users"
            ? 403
            : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
