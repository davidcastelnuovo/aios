import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CreateInvitationRequest {
  email?: string;
}

serve(async (req) => {
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

    // Check if user is owner or super_admin
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    const isAuthorized = roles?.some(r => r.role === "owner" || r.role === "super_admin");
    if (!isAuthorized) {
      throw new Error("Unauthorized - only owners and super admins can create invitation links");
    }

    // Get user's tenant
    const { data: tenantUser } = await supabase
      .from("tenant_users")
      .select("tenant_id")
      .eq("user_id", user.id)
      .single();

    if (!tenantUser) {
      throw new Error("User not associated with any tenant");
    }

    const { email }: CreateInvitationRequest = await req.json();

    // Generate unique token
    const token_value = crypto.randomUUID();

    // Create invitation token
    const { data: invitation, error: insertError } = await supabase
      .from("invitation_tokens")
      .insert({
        token: token_value,
        tenant_id: tenantUser.tenant_id,
        created_by: user.id,
        email: email || null,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error creating invitation:", insertError);
      throw insertError;
    }

    // Create invitation link
    const baseUrl = req.headers.get("origin") || supabaseUrl;
    const invitationLink = `${baseUrl}/signup?token=${token_value}`;

    return new Response(
      JSON.stringify({
        success: true,
        invitation_link: invitationLink,
        expires_at: invitation.expires_at,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error in create-invitation-link:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "שגיאה לא ידועה" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
