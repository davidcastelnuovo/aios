import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const { email, fullName, role, agencyIds } = await req.json();

    // Invite user - this will send them an email to set their password
    const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      email,
      {
        data: {
          full_name: fullName,
        },
        redirectTo: `${req.headers.get("origin")}/auth?type=recovery`,
      }
    );

    if (inviteError) throw inviteError;

    const userId = inviteData.user.id;

    // Create profile
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .insert({
        id: userId,
        email: email,
        full_name: fullName,
      });

    if (profileError) throw profileError;

    // Set user role
    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .insert({
        user_id: userId,
        role: role,
      });

    if (roleError) throw roleError;

    // If agency_manager, set managed agencies
    if (role === "agency_manager" && agencyIds && agencyIds.length > 0) {
      const { error: agenciesError } = await supabaseAdmin
        .from("user_managed_agencies")
        .insert(agencyIds.map((agencyId: string) => ({ user_id: userId, agency_id: agencyId })));

      if (agenciesError) throw agenciesError;
    }

    return new Response(
      JSON.stringify({ success: true, userId }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
