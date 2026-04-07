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
    const {
      action,
      tenant_id,
      category,
      connection_id,
      integration_type,
      success_redirect,
      failure_redirect,
      state,
      uid,
    } = body;

    if (!tenant_id) {
      return new Response(JSON.stringify({ error: "tenant_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    switch (action) {
      case "list_workspace_integrations": {
        const workspaceId = Deno.env.get("UNIFIED_WORKSPACE_ID");
        if (!workspaceId) {
          return new Response(JSON.stringify({ error: "UNIFIED_WORKSPACE_ID not configured" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const params = new URLSearchParams({
          workspace_id: workspaceId,
          env: "Production",
          active: "true",
        });

        const resp = await fetch(`https://api.unified.to/unified/integration/workspace?${params.toString()}`, {
          headers: {
            "Authorization": `Bearer ${unifiedApiKey}`,
            "Content-Type": "application/json",
          },
        });

        const rawBody = await resp.text();
        let parsedBody: any = [];
        try {
          parsedBody = rawBody ? JSON.parse(rawBody) : [];
        } catch {
          parsedBody = rawBody;
        }

        if (!resp.ok) {
          console.error("Unified.to list_workspace_integrations error:", rawBody);
          return new Response(JSON.stringify({ error: "Failed to fetch workspace integrations" }), {
            status: 502,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const integrations = Array.isArray(parsedBody)
          ? parsedBody
          : Array.isArray(parsedBody?.data) ? parsedBody.data : [];

        const mapped = integrations.map((i: any) => ({
          name: i.name || i.display_name || i.label || i.integration_type || i.type,
          type: i.integration_type || i.type,
          icon_url: i.logo_url || i.image_uri || i.icon_url || null,
          categories: Array.isArray(i.categories) ? i.categories : i.category ? [i.category] : [],
        }));

        return new Response(JSON.stringify({ integrations: mapped }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "list_integrations": {
        if (!category) {
          return new Response(JSON.stringify({ error: "category is required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const workspaceId = Deno.env.get("UNIFIED_WORKSPACE_ID");
        if (!workspaceId) {
          return new Response(JSON.stringify({ error: "UNIFIED_WORKSPACE_ID not configured" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const params = new URLSearchParams({
          workspace_id: workspaceId,
          categories: category,
          env: "Production",
        });

        const resp = await fetch(`https://api.unified.to/unified/integration/workspace?${params.toString()}`, {
          headers: {
            "Authorization": `Bearer ${unifiedApiKey}`,
            "Content-Type": "application/json",
          },
        });

        const rawBody = await resp.text();
        let parsedBody: any = [];
        try {
          parsedBody = rawBody ? JSON.parse(rawBody) : [];
        } catch {
          parsedBody = rawBody;
        }

        if (!resp.ok) {
          const details = typeof parsedBody === "object" && parsedBody !== null
            ? parsedBody.message || parsedBody.error || parsedBody?.attributes?.error || JSON.stringify(parsedBody)
            : rawBody;

          console.error("Unified.to list_integrations error:", details);
          return new Response(JSON.stringify({
            error: resp.status === 401 ? "Unified API credentials are invalid" : "Failed to fetch integrations",
            details,
          }), {
            status: resp.status === 401 ? 500 : 502,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const integrations = Array.isArray(parsedBody)
          ? parsedBody
          : Array.isArray(parsedBody?.data)
            ? parsedBody.data
            : [];

        const mapped = integrations.map((i: any) => ({
          name: i.name || i.display_name || i.label || i.integration_type || i.type,
          type: i.integration_type || i.type,
          icon_url: i.logo_url || i.image_uri || i.icon_url || null,
          categories: Array.isArray(i.categories) ? i.categories : i.category ? [i.category] : [],
          support: i.support || {},
        }));

        console.log(`Unified integrations fetched for ${category}: ${mapped.length}`);

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

        if (!integration_type) {
          return new Response(JSON.stringify({ error: "integration_type is required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const params = new URLSearchParams({
          redirect: "1",
          env: "Production",
          lang: "he",
          ...(success_redirect && { success_redirect }),
          ...(failure_redirect && { failure_redirect }),
          ...(state && { state }),
          ...(uid && { uid }),
        });

        const embedUrl = `https://api.unified.to/unified/integration/auth/${workspaceId}/${integration_type}?${params.toString()}`;

        return new Response(JSON.stringify({ embed_url: embedUrl }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "find_connection": {
        if (!uid) {
          return new Response(JSON.stringify({ error: "uid is required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const params = new URLSearchParams({
          external_xref: uid,
          limit: "100",
        });

        const resp = await fetch(`https://api.unified.to/unified/connection?${params.toString()}`, {
          headers: {
            "Authorization": `Bearer ${unifiedApiKey}`,
            "Content-Type": "application/json",
          },
        });

        const rawBody = await resp.text();
        let parsedBody: any = [];
        try {
          parsedBody = rawBody ? JSON.parse(rawBody) : [];
        } catch {
          parsedBody = rawBody;
        }

        if (!resp.ok) {
          return new Response(JSON.stringify({
            error: resp.status === 401 ? "Unified API credentials are invalid" : "Failed to find connection",
            details: rawBody,
          }), {
            status: resp.status === 401 ? 500 : 502,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const connections = Array.isArray(parsedBody)
          ? parsedBody
          : Array.isArray(parsedBody?.data) ? parsedBody.data : [];

        const matchedConnections = connections
          .filter((conn: any) => !integration_type || conn.integration_type === integration_type || conn.integration?.type === integration_type)
          .sort((a: any, b: any) => {
            const aTime = new Date(a.updated_at || a.created_at || a.created || 0).getTime();
            const bTime = new Date(b.updated_at || b.created_at || b.created || 0).getTime();
            return bTime - aTime;
          });

        const matchedConnection = matchedConnections[0];

        if (!matchedConnection?.id) {
          return new Response(JSON.stringify({ error: "No matching connection found" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({
          connection_id: matchedConnection.id,
          connection: matchedConnection,
        }), {
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
        const connText = await connResp.text();
        let connData: any = null;
        try {
          connData = connText ? JSON.parse(connText) : null;
        } catch {
          connData = connText;
        }

        if (!connResp.ok) {
          const details = typeof connData === "object" && connData !== null
            ? connData.message || connData.error || connData?.attributes?.error || JSON.stringify(connData)
            : connText;

          return new Response(JSON.stringify({
            error: connResp.status === 401 ? "Unified API credentials are invalid" : "Failed to validate connection",
            details,
          }), {
            status: connResp.status === 401 ? 500 : 502,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

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
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
