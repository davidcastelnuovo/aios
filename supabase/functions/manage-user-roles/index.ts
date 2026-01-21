import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ManageRolesRequest {
  userId: string;
  role: string;
  tenantId: string;
  action: "add" | "remove";
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

    // Verify requesting user
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    // Check if the user is an owner or super_admin
    const { data: roles, error: rolesError } = await supabaseAdmin
      .from("user_roles")
      .select("role, tenant_id")
      .eq("user_id", user.id);

    if (rolesError) {
      throw new Error("Error checking user roles");
    }

    const isSuperAdmin = roles?.some(r => r.role === "super_admin" && r.tenant_id === null);
    const isOwnerInAnyTenant = roles?.some(r => r.role === "owner");

    if (!isSuperAdmin && !isOwnerInAnyTenant) {
      throw new Error("Only owners or super admins can manage user roles");
    }

    const { userId, role, tenantId, action }: ManageRolesRequest = await req.json();

    if (!userId || !role || !tenantId || !action) {
      throw new Error("User ID, role, tenant ID, and action are required");
    }

    // Validate role
    const validRoles = ["owner", "team_manager", "campaigner", "sales_person", "super_admin", "seo"];
    if (!validRoles.includes(role)) {
      throw new Error("Invalid role");
    }

    console.log(`${action === "add" ? "Adding" : "Removing"} role ${role} for user ${userId} in tenant ${tenantId}`);

    let teamMemberCreated = false;
    let teamMemberType: string | null = null;
    let reusedExisting = false;

    if (action === "add") {
      // Check if role already exists
      const { data: existingRole } = await supabaseAdmin
        .from("user_roles")
        .select("id")
        .eq("user_id", userId)
        .eq("role", role)
        .eq("tenant_id", tenantId)
        .maybeSingle();

      if (existingRole) {
        return new Response(
          JSON.stringify({
            success: true,
            message: "Role already exists",
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Insert new role
      const { error: insertError } = await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: userId, role, tenant_id: tenantId });

      if (insertError) {
        console.error("Error inserting role:", insertError);
        throw insertError;
      }

      // Auto-create team member for sales_person or campaigner roles
      if (role === "sales_person" || role === "campaigner") {
        // Get user profile
        const { data: profile, error: profileError } = await supabaseAdmin
          .from("profiles")
          .select("id, email, full_name, sales_person_id, campaigner_id")
          .eq("id", userId)
          .single();

        if (profileError) {
          console.error("Error fetching profile:", profileError);
        } else if (profile) {
          if (role === "sales_person" && !profile.sales_person_id) {
            // Check if there's an existing sales_person in this tenant with same email
            let salesPersonId: string | null = null;
            
            if (profile.email) {
              const { data: existingSalesPerson } = await supabaseAdmin
                .from("sales_people")
                .select("id")
                .eq("tenant_id", tenantId)
                .eq("email", profile.email)
                .eq("active", true)
                .maybeSingle();

              if (existingSalesPerson) {
                salesPersonId = existingSalesPerson.id;
                reusedExisting = true;
                console.log(`Reusing existing sales_person ${salesPersonId} for user ${userId}`);
              }
            }

            if (!salesPersonId) {
              // Need to create a new sales_person - first get a default agency
              const { data: agencies, error: agenciesError } = await supabaseAdmin
                .from("agencies")
                .select("id, name")
                .eq("tenant_id", tenantId)
                .order("created_at", { ascending: true })
                .limit(1);

              if (agenciesError || !agencies || agencies.length === 0) {
                console.error("No agencies found in tenant for sales_person creation");
                // Don't throw - role was added, just can't auto-create sales_person
                // Return with a warning
                return new Response(
                  JSON.stringify({
                    success: true,
                    message: "Role added, but could not auto-create sales person - no agencies exist in this organization",
                    warning: "NO_AGENCIES",
                    teamMemberCreated: false,
                  }),
                  {
                    status: 200,
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                  }
                );
              }

              const defaultAgencyId = agencies[0].id;
              console.log(`Creating new sales_person with agency ${defaultAgencyId} for user ${userId}`);

              // Create sales_person
              const { data: newSalesPerson, error: createError } = await supabaseAdmin
                .from("sales_people")
                .insert({
                  tenant_id: tenantId,
                  agency_id: defaultAgencyId,
                  full_name: profile.full_name || profile.email || "איש מכירות",
                  email: profile.email,
                  active: true,
                })
                .select("id")
                .single();

              if (createError) {
                console.error("Error creating sales_person:", createError);
              } else {
                salesPersonId = newSalesPerson.id;
                teamMemberCreated = true;
                teamMemberType = "sales_person";
                console.log(`Created sales_person ${salesPersonId} for user ${userId}`);

                // Also add to sales_person_agencies junction table
                await supabaseAdmin
                  .from("sales_person_agencies")
                  .insert({
                    sales_person_id: salesPersonId,
                    agency_id: defaultAgencyId,
                  });
              }
            }

            // Link to profile
            if (salesPersonId) {
              const { error: linkError } = await supabaseAdmin
                .from("profiles")
                .update({ sales_person_id: salesPersonId })
                .eq("id", userId);

              if (linkError) {
                console.error("Error linking sales_person to profile:", linkError);
              } else {
                console.log(`Linked sales_person ${salesPersonId} to profile ${userId}`);
                if (reusedExisting) {
                  teamMemberCreated = true;
                  teamMemberType = "sales_person";
                }
              }
            }
          } else if (role === "campaigner" && !profile.campaigner_id) {
            // Check if there's an existing campaigner in this tenant with same email
            let campaignerId: string | null = null;

            if (profile.email) {
              const { data: existingCampaigner } = await supabaseAdmin
                .from("campaigners")
                .select("id")
                .eq("tenant_id", tenantId)
                .eq("email", profile.email)
                .eq("active", true)
                .maybeSingle();

              if (existingCampaigner) {
                campaignerId = existingCampaigner.id;
                reusedExisting = true;
                console.log(`Reusing existing campaigner ${campaignerId} for user ${userId}`);
              }
            }

            if (!campaignerId) {
              // Create new campaigner
              console.log(`Creating new campaigner for user ${userId}`);

              const { data: newCampaigner, error: createError } = await supabaseAdmin
                .from("campaigners")
                .insert({
                  tenant_id: tenantId,
                  full_name: profile.full_name || profile.email || "קמפיינר",
                  email: profile.email,
                  active: true,
                })
                .select("id")
                .single();

              if (createError) {
                console.error("Error creating campaigner:", createError);
              } else {
                campaignerId = newCampaigner.id;
                teamMemberCreated = true;
                teamMemberType = "campaigner";
                console.log(`Created campaigner ${campaignerId} for user ${userId}`);
              }
            }

            // Link to profile
            if (campaignerId) {
              const { error: linkError } = await supabaseAdmin
                .from("profiles")
                .update({ campaigner_id: campaignerId })
                .eq("id", userId);

              if (linkError) {
                console.error("Error linking campaigner to profile:", linkError);
              } else {
                console.log(`Linked campaigner ${campaignerId} to profile ${userId}`);
                if (reusedExisting) {
                  teamMemberCreated = true;
                  teamMemberType = "campaigner";
                }
              }
            }
          }
        }
      }
    } else if (action === "remove") {
      // Delete the specific role
      const { error: deleteError } = await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", userId)
        .eq("role", role)
        .eq("tenant_id", tenantId);

      if (deleteError) {
        console.error("Error deleting role:", deleteError);
        throw deleteError;
      }

      // Clean up related links based on the removed role
      if (role === "team_manager") {
        // Remove all managed agencies for this user in this tenant
        console.log(`Cleaning up user_managed_agencies for user ${userId}`);
        const { error: cleanupError } = await supabaseAdmin
          .from("user_managed_agencies")
          .delete()
          .eq("user_id", userId);
        
        if (cleanupError) {
          console.error("Error cleaning up managed agencies:", cleanupError);
          // Don't throw - this is cleanup, not critical
        }
      }

      if (role === "campaigner") {
        // Check if user has campaigner role in another tenant
        const { data: otherCampaignerRoles } = await supabaseAdmin
          .from("user_roles")
          .select("id")
          .eq("user_id", userId)
          .eq("role", "campaigner")
          .neq("tenant_id", tenantId);

        if (!otherCampaignerRoles || otherCampaignerRoles.length === 0) {
          // No other campaigner roles, unlink campaigner from profile
          console.log(`Unlinking campaigner_id from profile for user ${userId}`);
          const { error: unlinkError } = await supabaseAdmin
            .from("profiles")
            .update({ campaigner_id: null })
            .eq("id", userId);
          
          if (unlinkError) {
            console.error("Error unlinking campaigner:", unlinkError);
          }
        }
      }

      if (role === "sales_person") {
        // Check if user has sales_person role in another tenant
        const { data: otherSalesRoles } = await supabaseAdmin
          .from("user_roles")
          .select("id")
          .eq("user_id", userId)
          .eq("role", "sales_person")
          .neq("tenant_id", tenantId);

        if (!otherSalesRoles || otherSalesRoles.length === 0) {
          // No other sales_person roles, unlink sales_person from profile
          console.log(`Unlinking sales_person_id from profile for user ${userId}`);
          const { error: unlinkError } = await supabaseAdmin
            .from("profiles")
            .update({ sales_person_id: null })
            .eq("id", userId);
          
          if (unlinkError) {
            console.error("Error unlinking sales_person:", unlinkError);
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Role ${action === "add" ? "added" : "removed"} successfully`,
        teamMemberCreated,
        teamMemberType,
        reusedExisting,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in manage-user-roles function:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: error.message === "Unauthorized" || error.message.includes("Only owners") ? 403 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
