import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface UpdateUserAgenciesRequest {
  userId: string;
  agencyIds: string[];
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
    const payload = JSON.parse(atob(payloadBase64));
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
      throw new Error("Only owners and agency owners can update user agencies");
    }

    const { userId, agencyIds }: UpdateUserAgenciesRequest = await req.json();

    if (!userId) {
      throw new Error("User ID is required");
    }

    console.log(`Updating agencies for user ${userId}:`, agencyIds);

    // Get user profile to check if they have a campaigner
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("campaigner_id")
      .eq("id", userId)
      .single();

    if (profileError) {
      console.error("Error fetching profile:", profileError);
      throw profileError;
    }

    const campaignerId = profile.campaigner_id;

    // Only update agencies if user has a campaigner_id
    if (!campaignerId) {
      console.log("User has no campaigner_id, cannot update agencies");
      return new Response(
        JSON.stringify({ 
          error: "User is not linked to a campaigner. Please link user to a campaigner first." 
        }),
        { 
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    // Delete all existing agency links for this campaigner
    const { error: deleteError } = await supabaseAdmin
      .from("campaigner_agencies")
      .delete()
      .eq("campaigner_id", campaignerId);

    if (deleteError) {
      console.error("Error deleting agency links:", deleteError);
      throw deleteError;
    }

    // Insert new agency links if any
    if (agencyIds && agencyIds.length > 0) {
      const links = agencyIds.map(agencyId => ({
        campaigner_id: campaignerId,
        agency_id: agencyId,
      }));

      const { error: insertError } = await supabaseAdmin
        .from("campaigner_agencies")
        .insert(links);

      if (insertError) {
        console.error("Error inserting agency links:", insertError);
        throw insertError;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Agencies updated successfully",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in update-user-agencies function:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: error.message === "Unauthorized" || error.message === "Only owners and agency owners can update user agencies" ? 403 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
