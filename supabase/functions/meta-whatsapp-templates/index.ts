import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import { DEFAULT_META_GRAPH_VERSION } from "../_shared/meta-whatsapp.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

const graphRequest = async (
  url: URL,
  token: string,
  init?: RequestInit,
) => {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const text = await response.text();
  let data: any = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (!response.ok || data?.error) {
    const error = data?.error ?? {};
    return {
      ok: false as const,
      status: response.status || 502,
      error: error.error_user_msg || error.message || "Meta template request failed",
      metaError: error,
    };
  }
  return { ok: true as const, data };
};

const placeholderIndexes = (text: string) =>
  [...text.matchAll(/\{\{(\d+)\}\}/g)].map((match) => Number(match[1]));

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (request.method !== "POST") return reply({ error: "method_not_allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const authHeader = request.headers.get("Authorization") ?? "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "");
    if (!supabaseUrl || !serviceKey || !jwt) return reply({ error: "unauthorized" }, 401);

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authData, error: authError } = await admin.auth.getUser(jwt);
    if (authError || !authData.user) return reply({ error: "unauthorized" }, 401);

    const body = await request.json().catch(() => ({}));
    const action = typeof body.action === "string" ? body.action : "list";
    const tenantId = typeof body.tenant_id === "string" ? body.tenant_id : "";
    const integrationId = typeof body.integration_id === "string" ? body.integration_id : "";
    if (!tenantId || !integrationId) {
      return reply({ error: "tenant_id_and_integration_id_required" }, 400);
    }

    const [{ data: membership }, { data: superAdmin }, { data: integration }] = await Promise.all([
      admin
        .from("tenant_users")
        .select("user_id")
        .eq("tenant_id", tenantId)
        .eq("user_id", authData.user.id)
        .maybeSingle(),
      admin.rpc("is_super_admin", { _user_id: authData.user.id }),
      admin
        .from("tenant_integrations")
        .select("id,tenant_id,user_id,connection_visibility,settings,is_active")
        .eq("id", integrationId)
        .eq("integration_type", "meta_whatsapp")
        .maybeSingle(),
    ]);
    if ((!membership && superAdmin !== true) || !integration?.is_active) {
      return reply({ error: "forbidden" }, 403);
    }

    const isSharedAcrossTenants = integration.tenant_id !== tenantId;
    const canManage =
      superAdmin === true || integration.user_id === authData.user.id;
    let canUse = canManage || (!isSharedAcrossTenants && integration.connection_visibility === "org");
    if (isSharedAcrossTenants) {
      const { data: tenantCanUse, error: accessError } = await admin.rpc("tenant_can_use_integration", {
        p_tenant_id: tenantId,
        p_integration_id: integrationId,
      });
      if (accessError) throw accessError;
      canUse = tenantCanUse === true;
    }
    if (!canUse) {
      const { data: permission } = await admin
        .from("integration_user_permissions")
        .select("integration_id")
        .eq("integration_id", integrationId)
        .eq("user_id", authData.user.id)
        .maybeSingle();
      canUse = Boolean(permission);
    }
    if (!canUse) return reply({ error: "integration_access_denied" }, 403);
    if (action !== "list" && !canManage) return reply({ error: "manage_access_required" }, 403);

    const settings = (integration.settings ?? {}) as Record<string, any>;
    const wabaId = String(settings.waba_id ?? "");
    const graphVersion = String(
      settings.graph_version ?? Deno.env.get("META_GRAPH_API_VERSION") ?? DEFAULT_META_GRAPH_VERSION,
    );
    if (!wabaId) return reply({ error: "waba_id_missing" }, 400);

    const { data: tokenRow, error: tokenError } = await admin
      .from("meta_whatsapp_tokens")
      .select("access_token")
      .eq("integration_id", integrationId)
      .maybeSingle();
    if (tokenError) throw tokenError;
    if (!tokenRow?.access_token) return reply({ error: "meta_whatsapp_token_missing" }, 400);

    const baseUrl = `https://graph.facebook.com/${graphVersion}/${wabaId}/message_templates`;

    if (action === "list") {
      const templates: any[] = [];
      let after = "";
      let pageCount = 0;
      do {
        const url = new URL(baseUrl);
        url.searchParams.set(
          "fields",
          "id,name,status,category,language,parameter_format,components,rejected_reason,quality_score",
        );
        url.searchParams.set("limit", "100");
        if (after) url.searchParams.set("after", after);
        const result = await graphRequest(url, tokenRow.access_token);
        if (!result.ok) return reply({ error: result.error, meta_error: result.metaError }, result.status);
        templates.push(...(result.data.data ?? []));
        after = String(result.data.paging?.cursors?.after ?? "");
        pageCount++;
        if (!result.data.paging?.next) after = "";
      } while (after && pageCount < 20);
      return reply({
        templates,
        truncated: Boolean(after),
        can_manage: canManage,
      });
    }

    if (action === "create") {
      const template = body.template ?? {};
      const name = String(template.name ?? "");
      const category = String(template.category ?? "UTILITY").toUpperCase();
      const language = String(template.language ?? "he");
      const bodyText = String(template.body_text ?? "").trim();
      const footerText = String(template.footer_text ?? "").trim();
      const examples: string[] = Array.isArray(template.examples)
        ? template.examples.map((value: unknown) => String(value).trim())
        : [];

      if (!/^[a-z0-9_]{1,512}$/.test(name)) {
        return reply({ error: "template_name_must_be_lowercase_snake_case" }, 400);
      }
      if (!["UTILITY", "MARKETING"].includes(category)) {
        return reply({ error: "unsupported_template_category" }, 400);
      }
      if (!/^[a-z]{2,3}(?:_[A-Z]{2})?$/.test(language)) {
        return reply({ error: "invalid_language_code" }, 400);
      }
      if (!bodyText || bodyText.length > 1024) {
        return reply({ error: "template_body_must_be_1_to_1024_characters" }, 400);
      }
      if (footerText.length > 60) return reply({ error: "footer_too_long" }, 400);
      if (footerText.includes("{{") || footerText.includes("}}")) {
        return reply({ error: "footer_variables_are_not_supported" }, 400);
      }
      const braceTokens = [...bodyText.matchAll(/\{\{([^{}]+)\}\}/g)];
      const bodyWithoutValidTokens = bodyText.replace(/\{\{[^{}]+\}\}/g, "");
      if (
        braceTokens.some((match) => !/^\d+$/.test(match[1])) ||
        bodyWithoutValidTokens.includes("{{") ||
        bodyWithoutValidTokens.includes("}}")
      ) {
        return reply({ error: "only_positional_variables_like_double_brace_1_are_supported" }, 400);
      }

      const indexes = placeholderIndexes(bodyText);
      const uniqueIndexes = [...new Set(indexes)].sort((a, b) => a - b);
      if (uniqueIndexes.some((value, index) => value !== index + 1)) {
        return reply({ error: "template_variables_must_be_sequential_from_1" }, 400);
      }
      if (examples.length !== uniqueIndexes.length || examples.some((value) => !value)) {
        return reply({ error: "one_non_empty_example_required_per_variable" }, 400);
      }

      const bodyComponent: Record<string, unknown> = { type: "BODY", text: bodyText };
      if (examples.length) bodyComponent.example = { body_text: [examples] };
      const components: Array<Record<string, unknown>> = [bodyComponent];
      if (footerText) components.push({ type: "FOOTER", text: footerText });

      // Optional QUICK_REPLY buttons (e.g. lead opt-in warm template).
      const quickReplies: Array<{ text: string; payload?: string }> = Array.isArray(template.quick_replies)
        ? template.quick_replies
          .map((row: any) => ({
            text: String(row?.text ?? "").trim(),
            payload: row?.payload ? String(row.payload).trim() : undefined,
          }))
          .filter((row: { text: string }) => row.text.length > 0)
        : [];
      if (quickReplies.length > 3) {
        return reply({ error: "max_3_quick_reply_buttons" }, 400);
      }
      if (quickReplies.some((row) => row.text.length > 25)) {
        return reply({ error: "quick_reply_text_max_25_chars" }, 400);
      }
      if (quickReplies.length) {
        components.push({
          type: "BUTTONS",
          buttons: quickReplies.map((row) => ({
            type: "QUICK_REPLY",
            text: row.text,
            ...(row.payload ? { payload: row.payload } : {}),
          })),
        });
      }

      const result = await graphRequest(
        new URL(baseUrl),
        tokenRow.access_token,
        {
          method: "POST",
          body: JSON.stringify({
            name,
            category,
            language,
            parameter_format: "positional",
            components,
          }),
        },
      );
      if (!result.ok) return reply({ error: result.error, meta_error: result.metaError }, result.status);
      return reply({ success: true, template: result.data });
    }

    if (action === "delete") {
      const templateName = String(body.template_name ?? "");
      const templateId = String(body.template_id ?? "");
      if (!/^[a-z0-9_]{1,512}$/.test(templateName)) {
        return reply({ error: "valid_template_name_required" }, 400);
      }
      const url = new URL(baseUrl);
      url.searchParams.set("name", templateName);
      if (templateId) url.searchParams.set("hsm_id", templateId);
      const result = await graphRequest(url, tokenRow.access_token, { method: "DELETE" });
      if (!result.ok) return reply({ error: result.error, meta_error: result.metaError }, result.status);
      return reply({ success: true });
    }

    return reply({ error: "unsupported_action" }, 400);
  } catch (error) {
    console.error("meta-whatsapp-templates error", error);
    return reply({ error: error instanceof Error ? error.message : "unknown_error" }, 500);
  }
});
