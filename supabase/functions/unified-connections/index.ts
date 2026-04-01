import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const unifiedApiKey = Deno.env.get("UNIFIED_API_KEY");
    if (!unifiedApiKey) {
      return new Response(JSON.stringify({ error: "UNIFIED_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action, tenant_id, category, connection_id, integration_type, success_redirect, failure_redirect } = body;

    if (!tenant_id) {
      return new Response(JSON.stringify({ error: "tenant_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    switch (action) {
      case "list_integrations": {
        if (!category) {
          return new Response(JSON.stringify({ error: "category is required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const resp = await fetch(`https://api.unified.to/unified/integration?categories=${category}`, {
          headers: { "Authorization": `Bearer ${unifiedApiKey}` },
        });

        if (!resp.ok) {
          const errText = await resp.text();
          console.error("Unified.to list_integrations error:", errText);
          return new Response(JSON.stringify({ error: "Failed to fetch integrations", details: errText }), {
            status: 502,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const integrations = await resp.json();

        const mapped = (integrations || []).map((i: any) => ({
          name: i.name || i.type,
          type: i.type,
          icon_url: i.logo_url || i.icon_url || null,
          categories: i.categories || [],
          support: i.support || {},
        }));

        return new Response(JSON.stringify({ integrations: mapped }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "get_embed_url": {
        const workspaceId = Deno.env.get("UNIFIED_WORKSPACE_ID");
        if (!workspaceId) {
          return new Response(JSON.stringify({ error: "UNIFIED_WORKSPACE_ID not configured" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        if (!category) {
          return new Response(JSON.stringify({ error: "category is required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const params = new URLSearchParams({
          workspace_id: workspaceId,
          categories: category,
          ...(integration_type && { integration_type }),
          ...(success_redirect && { success_redirect }),
          ...(failure_redirect && { failure_redirect }),
        });

        const embedUrl = `https://embed.unified.to/integration?${params.toString()}`;

        return new Response(JSON.stringify({ embed_url: embedUrl }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "save_connection": {
        if (!connection_id || !category) {
          return new Response(JSON.stringify({ error: "connection_id and category are required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const connResp = await fetch(`https://api.unified.to/unified/connection/${connection_id}`, {
          headers: { "Authorization": `Bearer ${unifiedApiKey}` },
        });
        const connData = await connResp.json();

        const integrationType = `unified_${category}`;

        const { data, error } = await supabase
          .from("tenant_integrations")
          .insert({
            tenant_id,
            user_id: user.id,
            integration_type: integrationType,
            is_active: true,
            settings: {
              unified_connection_id: connection_id,
              unified_category: category,
              integration_name: connData.integration_type || integration_type || category,
              connected_at: new Date().toISOString(),
            },
          })
          .select()
          .single();

        if (error) throw error;

        return new Response(JSON.stringify({ success: true, integration: data }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "list": {
        const { data, error } = await supabase
          .from("tenant_integrations")
          .select("*")
          .eq("tenant_id", tenant_id)
          .like("integration_type", "unified_%")
          .eq("is_active", true);

        if (error) throw error;

        return new Response(JSON.stringify({ connections: data || [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "delete": {
        if (!connection_id) {
          return new Response(JSON.stringify({ error: "connection_id is required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { error } = await supabase
          .from("tenant_integrations")
          .update({ is_active: false })
          .eq("tenant_id", tenant_id)
          .eq("id", connection_id);

        if (error) throw error;

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
  } catch (error) {
    console.error("unified-connections error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
