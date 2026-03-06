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

    const body = await req.json();
    const { token, action, email, password, fullName } = body;

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

    let userId: string;
    let userEmail: string;

    // ======== SIGNUP via edge function (auto-confirmed) ========
    if (action === "signup") {
      if (!email || !password) {
        return new Response(JSON.stringify({ error: "Email and password required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check if user already exists
      const { data: existingUsers } = await adminClient.auth.admin.listUsers();
      const existingUser = existingUsers?.users?.find(u => u.email === email);

      if (existingUser) {
        // User exists - add them to the tenant instead of rejecting
        userId = existingUser.id;
        userEmail = email;

        // Ensure profile exists
        await adminClient.from("profiles").upsert({
          id: userId,
          email: userEmail,
          full_name: fullName || existingUser.user_metadata?.full_name || email.split("@")[0],
          status: "active",
        }, { onConflict: "id" });
      } else {
        // Create user with admin API (auto-confirmed)
        const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { full_name: fullName || email.split("@")[0] },
        });

        if (createError || !newUser.user) {
          return new Response(JSON.stringify({ error: createError?.message || "Failed to create user" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        userId = newUser.user.id;
        userEmail = email;

        // Create profile
        await adminClient.from("profiles").upsert({
          id: userId,
          email: userEmail,
          full_name: fullName || email.split("@")[0],
          status: "active",
        }, { onConflict: "id" });
      }

    } else {
      // ======== EXISTING USER (authenticated) ========
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

      userId = user.id;
      userEmail = user.email || "";

      // Ensure profile exists
      const derivedName = user.user_metadata?.full_name || userEmail.split("@")[0] || "";
      const { data: existingProfile } = await adminClient
        .from("profiles")
        .select("id, full_name")
        .eq("id", userId)
        .single();

      if (!existingProfile) {
        await adminClient.from("profiles").insert({
          id: userId,
          email: userEmail,
          full_name: derivedName,
          status: "active",
        });
      } else if (!existingProfile.full_name && derivedName) {
        await adminClient.from("profiles").update({ full_name: derivedName }).eq("id", userId);
      }
    }

    // 1. Add user to tenant if not already a member
    const { data: existingTenantUser } = await adminClient
      .from("tenant_users")
      .select("id")
      .eq("user_id", userId)
      .eq("tenant_id", tenantId)
      .single();

    if (!existingTenantUser) {
      await adminClient.from("tenant_users").insert({
        user_id: userId,
        tenant_id: tenantId,
      });

      // Add viewer role
      await adminClient.from("user_roles").insert({
        user_id: userId,
        role: "viewer",
        tenant_id: tenantId,
      });
    }

    // 2. Set active tenant
    await adminClient.from("user_active_tenant").upsert({
      user_id: userId,
      tenant_id: tenantId,
    }, { onConflict: "user_id" });

    // 3. Add user as channel member if not already
    const { data: existingMember } = await adminClient
      .from("team_channel_members")
      .select("id")
      .eq("channel_id", channelId)
      .eq("user_id", userId)
      .single();

    if (!existingMember) {
      await adminClient.from("team_channel_members").insert({
        channel_id: channelId,
        user_id: userId,
        tenant_id: tenantId,
        role: "member",
      });
    }

    // 4. Grant team_chat permission (chat-only access) if no permissions exist
    const { data: existingPermissions } = await adminClient
      .from("user_permissions")
      .select("id")
      .eq("user_id", userId)
      .limit(1);

    if (!existingPermissions || existingPermissions.length === 0) {
      // Only grant team_chat - user will only see the chat module
      await adminClient.from("user_permissions").insert({
        user_id: userId,
        module: "team_chat",
        can_access: true,
      });
    }

    // 5. Increment uses count
    await adminClient.from("team_channel_invites").update({
      current_uses: (invite.current_uses || 0) + 1,
    }).eq("id", invite.id);

    // Check if max uses reached
    if (invite.max_uses && (invite.current_uses || 0) + 1 >= invite.max_uses) {
      await adminClient.from("team_channel_invites").update({
        is_active: false,
      }).eq("id", invite.id);
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
        // For signup flow - return credentials so frontend can sign in
        ...(action === "signup" ? { autoLogin: true } : {}),
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
