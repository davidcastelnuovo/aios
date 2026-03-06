import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Get the user from the auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid user" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { token } = await req.json();
    if (!token) {
      return new Response(JSON.stringify({ error: "Token is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get the invite
    const { data: invite, error: inviteError } = await adminClient
      .from("team_channel_invites")
      .select("*, team_channels(name, tenant_id)")
      .eq("token", token)
      .eq("is_active", true)
      .single();

    if (inviteError || !invite) {
      return new Response(JSON.stringify({ error: "Invalid or expired invite link" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tenantId = invite.tenant_id;
    const channelId = invite.channel_id;

    // 1. Ensure user has a profile with a name
    const derivedName = user.user_metadata?.full_name || user.email?.split("@")[0] || "";
    const { data: existingProfile } = await adminClient
      .from("profiles")
      .select("id, full_name")
      .eq("id", user.id)
      .single();

    if (!existingProfile) {
      await adminClient.from("profiles").insert({
        id: user.id,
        email: user.email,
        full_name: derivedName,
        status: "active",
      });
    } else if (!existingProfile.full_name && derivedName) {
      // Update empty full_name for existing profiles
      await adminClient.from("profiles").update({ full_name: derivedName }).eq("id", user.id);
    }

    // 2. Add user to tenant if not already a member
    const { data: existingTenantUser } = await adminClient
      .from("tenant_users")
      .select("id")
      .eq("user_id", user.id)
      .eq("tenant_id", tenantId)
      .single();

    if (!existingTenantUser) {
      await adminClient.from("tenant_users").insert({
        user_id: user.id,
        tenant_id: tenantId,
      });

      // Add viewer role
      await adminClient.from("user_roles").insert({
        user_id: user.id,
        role: "viewer",
        tenant_id: tenantId,
      });
    }

    // 3. Set active tenant
    await adminClient.from("user_active_tenant").upsert({
      user_id: user.id,
      tenant_id: tenantId,
    }, { onConflict: "user_id" });

    // 4. Add user as channel member if not already
    const { data: existingMember } = await adminClient
      .from("team_channel_members")
      .select("id")
      .eq("channel_id", channelId)
      .eq("user_id", user.id)
      .single();

    if (!existingMember) {
      await adminClient.from("team_channel_members").insert({
        channel_id: channelId,
        user_id: user.id,
        tenant_id: tenantId,
        role: "member",
      });
    }

    // Get tenant slug for redirect
    const { data: tenant } = await adminClient
      .from("tenants")
      .select("slug")
      .eq("id", tenantId)
      .single();

    return new Response(
      JSON.stringify({
        success: true,
        tenantSlug: tenant?.slug,
        channelName: (invite as any).team_channels?.name,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("process-chat-invite error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
