import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from auth header
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    console.log("Processing invitation for user:", user.email);

    // Check if user already has a tenant
    const { data: existingTenant } = await supabase
      .from("tenant_users")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (existingTenant) {
      console.log("User already has a tenant, skipping");
      return new Response(
        JSON.stringify({ success: true, message: "User already has a tenant" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // Find unused invitation for this email
    const { data: invitation } = await supabase
      .from("invitation_tokens")
      .select("*")
      .eq("email", user.email)
      .eq("used", false)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!invitation) {
      console.log("No valid invitation found for", user.email);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "NO_INVITATION",
          message: "לא נמצאה הזמנה תקפה למשתמש זה. אנא צור קשר עם המנהל." 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    console.log("Found invitation:", invitation.id);

    const metadata = invitation.metadata as any;
    const { fullName, role, agencyIds, modulePermissions, campaignerId, salesPersonId } = metadata;

    // Update user profile
    if (fullName) {
      await supabase
        .from("profiles")
        .update({ full_name: fullName })
        .eq("id", user.id);
    }

    if (campaignerId) {
      await supabase
        .from("profiles")
        .update({ campaigner_id: campaignerId })
        .eq("id", user.id);
    }

    if (salesPersonId) {
      await supabase
        .from("profiles")
        .update({ sales_person_id: salesPersonId })
        .eq("id", user.id);
    }

    // Set user role
    if (role) {
      // Delete existing roles
      await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", user.id);

      // Insert new role
      await supabase
        .from("user_roles")
        .insert({ user_id: user.id, role });
    }

    // Set module permissions
    if (modulePermissions && modulePermissions.length > 0) {
      // Delete existing permissions
      await supabase
        .from("user_permissions")
        .delete()
        .eq("user_id", user.id);

      // Insert new permissions
      const permissionsToInsert = modulePermissions.map((module: string) => ({
        user_id: user.id,
        module: module,
        can_access: true,
      }));

      await supabase
        .from("user_permissions")
        .insert(permissionsToInsert);
    }

    // Link campaigner to agencies
    if (campaignerId && agencyIds && agencyIds.length > 0) {
      const campaignerAgenciesToInsert = agencyIds.map((agencyId: string) => ({
        campaigner_id: campaignerId,
        agency_id: agencyId,
      }));

      await supabase
        .from("campaigner_agencies")
        .insert(campaignerAgenciesToInsert);
    }

    // Link sales person to agencies
    if (salesPersonId && agencyIds && agencyIds.length > 0) {
      const salesPersonAgenciesToInsert = agencyIds.map((agencyId: string) => ({
        sales_person_id: salesPersonId,
        agency_id: agencyId,
      }));

      await supabase
        .from("sales_person_agencies")
        .insert(salesPersonAgenciesToInsert);
    }

    // Add user to tenant
    await supabase
      .from("tenant_users")
      .insert({
        user_id: user.id,
        tenant_id: invitation.tenant_id,
        role: role || "member",
      });

    // Mark invitation as used
    await supabase
      .from("invitation_tokens")
      .update({
        used: true,
        used_by: user.id,
        used_at: new Date().toISOString(),
      })
      .eq("id", invitation.id);

    console.log("Successfully processed invitation for", user.email);

    return new Response(
      JSON.stringify({ success: true, message: "ההזמנה עובדה בהצלחה" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error: any) {
    console.error("Error in process-user-invitation:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
