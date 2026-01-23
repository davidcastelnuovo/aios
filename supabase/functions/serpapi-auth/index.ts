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
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify user
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await anonClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get user's tenant - check active tenant first, then fallback to tenant_users
    let tenantId: string | null = null;
    
    // First try user_active_tenant
    const { data: activeTenant } = await supabase
      .from("user_active_tenant")
      .select("tenant_id")
      .eq("user_id", user.id)
      .single();
    
    if (activeTenant?.tenant_id) {
      tenantId = activeTenant.tenant_id;
    } else {
      // Fallback to tenant_users
      const { data: tenantUser } = await supabase
        .from("tenant_users")
        .select("tenant_id")
        .eq("user_id", user.id)
        .limit(1)
        .single();
      
      if (tenantUser?.tenant_id) {
        tenantId = tenantUser.tenant_id;
      }
    }

    if (!tenantId) {
      return new Response(JSON.stringify({ error: "No tenant found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    if (action === "status") {
      // Get integration status
      const { data: integration } = await supabase
        .from("tenant_integrations")
        .select("id, is_active, config, created_at, updated_at")
        .eq("tenant_id", tenantId)
        .eq("integration_type", "serpapi")
        .single();

      return new Response(JSON.stringify({
        connected: !!integration?.is_active,
        has_key: !!integration?.config?.api_key,
        created_at: integration?.created_at,
        updated_at: integration?.updated_at,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "connect") {
      const body = await req.json();
      const { api_key } = body;

      if (!api_key) {
        return new Response(JSON.stringify({ error: "API key is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Test the API key
      const testUrl = `https://serpapi.com/search.json?engine=google&q=test&api_key=${api_key}&num=1`;
      const testResponse = await fetch(testUrl);

      if (!testResponse.ok) {
        const errorData = await testResponse.json();
        return new Response(JSON.stringify({ 
          error: errorData.error || "Invalid API key" 
        }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get account info
      const accountUrl = `https://serpapi.com/account.json?api_key=${api_key}`;
      const accountResponse = await fetch(accountUrl);
      let accountInfo = null;
      
      if (accountResponse.ok) {
        accountInfo = await accountResponse.json();
      }

      // Save or update integration
      const { data: existing } = await supabase
        .from("tenant_integrations")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("integration_type", "serpapi")
        .single();

      if (existing) {
        await supabase
          .from("tenant_integrations")
          .update({
            config: { 
              api_key,
              account_email: accountInfo?.account_email,
              plan: accountInfo?.plan,
              searches_per_month: accountInfo?.searches_per_month,
              this_month_searches: accountInfo?.this_month_usage,
            },
            is_active: true,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);
      } else {
        await supabase.from("tenant_integrations").insert({
          tenant_id: tenantId,
          user_id: user.id,
          integration_type: "serpapi",
          config: {
            api_key,
            account_email: accountInfo?.account_email,
            plan: accountInfo?.plan,
            searches_per_month: accountInfo?.searches_per_month,
            this_month_searches: accountInfo?.this_month_usage,
          },
          is_active: true,
        });
      }

      return new Response(JSON.stringify({
        success: true,
        account_email: accountInfo?.account_email,
        plan: accountInfo?.plan,
        searches_per_month: accountInfo?.searches_per_month,
        this_month_searches: accountInfo?.this_month_usage,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "disconnect") {
      await supabase
        .from("tenant_integrations")
        .update({ is_active: false })
        .eq("tenant_id", tenantId)
        .eq("integration_type", "serpapi");

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "account") {
      // Get current account info
      const { data: integration } = await supabase
        .from("tenant_integrations")
        .select("config")
        .eq("tenant_id", tenantId)
        .eq("integration_type", "serpapi")
        .eq("is_active", true)
        .single();

      if (!integration?.config?.api_key) {
        return new Response(JSON.stringify({ error: "SerpAPI not configured" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const accountUrl = `https://serpapi.com/account.json?api_key=${integration.config.api_key}`;
      const accountResponse = await fetch(accountUrl);

      if (!accountResponse.ok) {
        return new Response(JSON.stringify({ error: "Failed to get account info" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const accountInfo = await accountResponse.json();

      // Update stored info
      await supabase
        .from("tenant_integrations")
        .update({
          config: {
            ...integration.config,
            account_email: accountInfo.account_email,
            plan: accountInfo.plan,
            searches_per_month: accountInfo.searches_per_month,
            this_month_searches: accountInfo.this_month_usage,
          },
        })
        .eq("tenant_id", tenantId)
        .eq("integration_type", "serpapi");

      return new Response(JSON.stringify({
        account_email: accountInfo.account_email,
        plan: accountInfo.plan,
        searches_per_month: accountInfo.searches_per_month,
        this_month_searches: accountInfo.this_month_usage,
        remaining_searches: accountInfo.searches_per_month - accountInfo.this_month_usage,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("SerpAPI auth error:", error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
