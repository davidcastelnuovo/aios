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
    let userId = "";
    if (!isServiceRole) {
      const authClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
        auth: { persistSession: false },
      });
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
    if (clientId) {
      const { data } = await admin.from("clients").select("tenant_id,phone").eq("id", clientId).single();
      tenantId ||= data?.tenant_id ?? "";
      contactPhone ||= data?.phone ?? "";
    } else if (leadId) {
      const { data } = await admin.from("leads").select("tenant_id,phone").eq("id", leadId).single();
      tenantId ||= data?.tenant_id ?? "";
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
      .eq("tenant_id", tenantId)
      .eq("integration_type", "meta_whatsapp")
      .eq("is_active", true);
    if (integrationId) integrationQuery = integrationQuery.eq("id", integrationId);
    const { data: integrations, error: integrationError } = await integrationQuery.order("created_at").limit(1);
    if (integrationError) throw integrationError;
    const integration = integrations?.[0];
    if (!integration?.api_key) return reply({ error: "meta_whatsapp_not_connected" }, 400);

    if (integration.user_id !== userId && superAdmin !== true) {
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
          Authorization: `Bearer ${integration.api_key}`,
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
