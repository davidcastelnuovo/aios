import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import { DEFAULT_META_GRAPH_VERSION, digitsOnly } from "../_shared/meta-whatsapp.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (request.method !== "POST") return reply({ error: "method_not_allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const authHeader = request.headers.get("Authorization") ?? "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "");
    if (!supabaseUrl || !serviceKey || !jwt) return reply({ error: "unauthorized" }, 401);

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const isServiceRole = jwt === serviceKey;
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    let userId = "";
    if (!isServiceRole) {
      const { data, error } = await authClient.auth.getUser(jwt);
      if (error || !data.user) return reply({ error: "unauthorized" }, 401);
      userId = data.user.id;
    }

    const body = await request.json().catch(() => ({}));
    const {
      clientId,
      leadId,
      groupId,
      message,
      phoneNumber,
      tenantId: suppliedTenantId,
      integrationId,
      senderUserId,
      template,
    } = body;
    if (clientId && leadId) return reply({ error: "choose_client_or_lead" }, 400);
    if (groupId) return reply({ error: "Meta WhatsApp Cloud API does not support groups" }, 400);
    if (isServiceRole) {
      if (typeof senderUserId !== "string" || !senderUserId) {
        return reply({ error: "senderUserId_required_for_service_role" }, 400);
      }
      userId = senderUserId;
    }
    if (!message && !template?.name) return reply({ error: "message_or_template_required" }, 400);

    let tenantId = typeof suppliedTenantId === "string" ? suppliedTenantId : "";
    let contactPhone = typeof phoneNumber === "string" ? phoneNumber : "";
    const entityClient = isServiceRole ? admin : authClient;
    if (clientId) {
      const { data } = await entityClient.from("clients").select("tenant_id,phone").eq("id", clientId).single();
      if (!data?.tenant_id) return reply({ error: "client_not_found" }, 404);
      if (tenantId && tenantId !== data.tenant_id) return reply({ error: "tenant_entity_mismatch" }, 403);
      tenantId = data.tenant_id;
      contactPhone ||= data?.phone ?? "";
    } else if (leadId) {
      const { data } = await entityClient.from("leads").select("tenant_id,phone").eq("id", leadId).single();
      if (!data?.tenant_id) return reply({ error: "lead_not_found" }, 404);
      if (tenantId && tenantId !== data.tenant_id) return reply({ error: "tenant_entity_mismatch" }, 403);
      tenantId = data.tenant_id;
      contactPhone ||= data?.phone ?? "";
    }
    const to = digitsOnly(contactPhone).replace(/^00/, "").replace(/^0/, "972");
    if (!tenantId) return reply({ error: "tenant_not_found" }, 404);
    if (!to) return reply({ error: "phone_number_required" }, 400);

    const [{ data: membership }, { data: superAdmin }] = await Promise.all([
      admin.from("tenant_users").select("user_id").eq("tenant_id", tenantId).eq("user_id", userId).maybeSingle(),
      admin.rpc("is_super_admin", { _user_id: userId }),
    ]);
    if (!membership && superAdmin !== true) return reply({ error: "forbidden" }, 403);

    let integrationQuery = admin
      .from("tenant_integrations")
      .select("*")
      .eq("integration_type", "meta_whatsapp")
      .eq("is_active", true);
    if (integrationId) {
      // A shared integration keeps its canonical row and token in the owner tenant.
      // Access is checked below against integration_tenant_access.
      integrationQuery = integrationQuery.eq("id", integrationId);
    } else {
      integrationQuery = integrationQuery.eq("tenant_id", tenantId);
    }
    const { data: integrations, error: integrationError } = await integrationQuery.order("created_at").limit(1);
    if (integrationError) throw integrationError;
    const integration = integrations?.[0];
    if (!integration) return reply({ error: "meta_whatsapp_not_connected" }, 400);

    const isSharedAcrossTenants = integration.tenant_id !== tenantId;
    if (isSharedAcrossTenants) {
      const { data: canUse, error: accessError } = await admin.rpc("tenant_can_use_integration", {
        p_tenant_id: tenantId,
        p_integration_id: integration.id,
      });
      if (accessError) throw accessError;
      if (canUse !== true && superAdmin !== true) {
        return reply({ error: "integration_not_shared_with_tenant" }, 403);
      }
    } else if (integration.user_id !== userId && superAdmin !== true) {
      const visibility = integration.connection_visibility ?? "private";
      let permitted = visibility === "org";
      if (!permitted) {
        const { data: permission } = await admin
          .from("integration_user_permissions")
          .select("integration_id")
          .eq("integration_id", integration.id)
          .eq("user_id", userId)
          .maybeSingle();
        permitted = Boolean(permission);
      }
      if (!permitted) return reply({ error: "integration_access_denied" }, 403);
    }

    const { data: tokenRow, error: tokenError } = await admin
      .from("meta_whatsapp_tokens")
      .select("access_token")
      .eq("integration_id", integration.id)
      .maybeSingle();
    if (tokenError) throw tokenError;
    if (!tokenRow?.access_token) return reply({ error: "meta_whatsapp_token_missing" }, 400);

    const settings = (integration.settings ?? {}) as Record<string, any>;
    const phoneNumberId = String(settings.phone_number_id ?? integration.instance_id ?? "");
    const graphVersion =
      String(settings.graph_version ?? Deno.env.get("META_GRAPH_API_VERSION") ?? DEFAULT_META_GRAPH_VERSION);
    if (!phoneNumberId) return reply({ error: "phone_number_id_missing" }, 400);

    const graphBody = template?.name
      ? {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to,
          type: "template",
          template: {
            name: template.name,
            language: { code: template.language ?? "he" },
            ...(Array.isArray(template.components) ? { components: template.components } : {}),
          },
        }
      : {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to,
          type: "text",
          text: { preview_url: true, body: String(message) },
        };
    const graphResponse = await fetch(
      `https://graph.facebook.com/${graphVersion}/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenRow.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(graphBody),
      },
    );
    const responseText = await graphResponse.text();
    let result: any = {};
    try {
      result = responseText ? JSON.parse(responseText) : {};
    } catch {
      result = { raw: responseText };
    }
    if (!graphResponse.ok || result?.error) {
      const code = result?.error?.code;
      const friendly =
        code === 131047
          ? "חלון השירות של 24 שעות נסגר. יש לשלוח תבנית WhatsApp מאושרת."
          : result?.error?.error_user_msg || result?.error?.message || "Meta WhatsApp send failed";
      return reply({ error: friendly, meta_error: result?.error ?? result }, graphResponse.status || 502);
    }

    const messageId = result?.messages?.[0]?.id ?? null;
    const { error: insertError } = await admin.from("chat_messages").insert({
      client_id: clientId ?? null,
      lead_id: leadId ?? null,
      tenant_id: tenantId,
      connection_user_id: integration.user_id ?? userId,
      integration_id: integration.id,
      message_text: message || `[תבנית: ${template.name}]`,
      direction: "outbound",
      channel: "whatsapp",
      provider: "meta_whatsapp",
      sender_phone: to,
      sent_by_user_id: userId,
      raw_provider_data: {
        ...result,
        idMessage: messageId,
        phone_number_id: phoneNumberId,
        template: template ?? null,
      },
    });
    if (insertError) console.error("Failed to save Meta WhatsApp message", insertError);

    return reply({ success: true, messageId });
  } catch (error) {
    console.error("send-meta-whatsapp-message error", error);
    return reply({ error: error instanceof Error ? error.message : "unknown_error" }, 500);
  }
});
