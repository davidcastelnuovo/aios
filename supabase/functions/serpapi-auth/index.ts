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
      // Get integration status - check for dataforseo first, fallback to serpapi for backwards compatibility
      let integration = null;
      
      const { data: dataforSeoIntegration } = await supabase
        .from("tenant_integrations")
        .select("id, is_active, config, created_at, updated_at")
        .eq("tenant_id", tenantId)
        .eq("integration_type", "dataforseo")
        .single();
      
      if (dataforSeoIntegration) {
        integration = dataforSeoIntegration;
      } else {
        // Fallback to old serpapi integration
        const { data: serpIntegration } = await supabase
          .from("tenant_integrations")
          .select("id, is_active, config, created_at, updated_at")
          .eq("tenant_id", tenantId)
          .eq("integration_type", "serpapi")
          .single();
        integration = serpIntegration;
      }

      return new Response(JSON.stringify({
        connected: !!integration?.is_active,
        has_credentials: !!(integration?.config?.email && integration?.config?.password) || !!integration?.config?.api_key,
        created_at: integration?.created_at,
        updated_at: integration?.updated_at,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "connect") {
      const body = await req.json();
      const { email, password } = body;

      if (!email || !password) {
        return new Response(JSON.stringify({ error: "Email and password are required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Create Base64 token for DataForSEO
      const base64Token = btoa(`${email}:${password}`);

      // Test the credentials by getting user data
      const testResponse = await fetch("https://api.dataforseo.com/v3/appendix/user_data", {
        method: "GET",
        headers: {
          "Authorization": `Basic ${base64Token}`,
          "Content-Type": "application/json",
        },
      });

      if (!testResponse.ok) {
        const errorData = await testResponse.json();
        return new Response(JSON.stringify({ 
          error: errorData.status_message || "Invalid credentials" 
        }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const testData = await testResponse.json();
      
      // Check if response is successful
      if (testData.status_code !== 20000) {
        return new Response(JSON.stringify({ 
          error: testData.status_message || "API Error" 
        }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const userData = testData.tasks?.[0]?.result?.[0];

      // Save or update integration
      const { data: existing } = await supabase
        .from("tenant_integrations")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("integration_type", "dataforseo")
        .single();

      const configData = { 
        email,
        password,
        balance: userData?.money?.balance,
        currency: userData?.money?.currency,
        login: userData?.login,
        timezone: userData?.timezone,
      };

      if (existing) {
        await supabase
          .from("tenant_integrations")
          .update({
            config: configData,
            is_active: true,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);
      } else {
        await supabase.from("tenant_integrations").insert({
          tenant_id: tenantId,
          user_id: user.id,
          integration_type: "dataforseo",
          config: configData,
          is_active: true,
        });
      }

      // Deactivate old serpapi integration if exists
      await supabase
        .from("tenant_integrations")
        .update({ is_active: false })
        .eq("tenant_id", tenantId)
        .eq("integration_type", "serpapi");

      return new Response(JSON.stringify({
        success: true,
        login: userData?.login,
        balance: userData?.money?.balance,
        currency: userData?.money?.currency,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "disconnect") {
      // Disconnect both old and new integrations
      await supabase
        .from("tenant_integrations")
        .update({ is_active: false })
        .eq("tenant_id", tenantId)
        .eq("integration_type", "dataforseo");

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
      // Get current account info - check dataforseo first
      let integration = null;
      
      const { data: dataforSeoIntegration } = await supabase
        .from("tenant_integrations")
        .select("id, config")
        .eq("tenant_id", tenantId)
        .eq("integration_type", "dataforseo")
        .eq("is_active", true)
        .single();
      
      if (dataforSeoIntegration?.config?.email && dataforSeoIntegration?.config?.password) {
        integration = dataforSeoIntegration;
        
        // Get fresh data from DataForSEO
        const base64Token = btoa(`${integration.config.email}:${integration.config.password}`);
        
        const accountResponse = await fetch("https://api.dataforseo.com/v3/appendix/user_data", {
          method: "GET",
          headers: {
            "Authorization": `Basic ${base64Token}`,
            "Content-Type": "application/json",
          },
        });

        if (!accountResponse.ok) {
          return new Response(JSON.stringify({ error: "Failed to get account info" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const accountData = await accountResponse.json();
        const userData = accountData.tasks?.[0]?.result?.[0];

        // Update stored info
        await supabase
          .from("tenant_integrations")
          .update({
            config: {
              ...integration.config,
              balance: userData?.money?.balance,
              currency: userData?.money?.currency,
              login: userData?.login,
            },
          })
          .eq("id", integration.id);

        return new Response(JSON.stringify({
          provider: "dataforseo",
          login: userData?.login,
          balance: userData?.money?.balance,
          currency: userData?.money?.currency || "USD",
          limits: userData?.limits,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Fallback to old serpapi
      const { data: serpIntegration } = await supabase
        .from("tenant_integrations")
        .select("config")
        .eq("tenant_id", tenantId)
        .eq("integration_type", "serpapi")
        .eq("is_active", true)
        .single();

      if (serpIntegration?.config?.api_key) {
        const accountUrl = `https://serpapi.com/account.json?api_key=${serpIntegration.config.api_key}`;
        const accountResponse = await fetch(accountUrl);

        if (!accountResponse.ok) {
          return new Response(JSON.stringify({ error: "Failed to get account info" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const accountInfo = await accountResponse.json();

        return new Response(JSON.stringify({
          provider: "serpapi",
          account_email: accountInfo.account_email,
          plan: accountInfo.plan,
          searches_per_month: accountInfo.searches_per_month,
          this_month_searches: accountInfo.this_month_usage,
          remaining_searches: accountInfo.searches_per_month - accountInfo.this_month_usage,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ error: "No integration configured" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("DataForSEO auth error:", error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
