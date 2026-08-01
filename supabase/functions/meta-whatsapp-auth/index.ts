import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import {
  DEFAULT_META_GRAPH_VERSION,
  isCoexistenceFinishEvent,
  type MetaWhatsAppSessionInfo,
} from "../_shared/meta-whatsapp.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

const graphJson = async (
  path: string,
  token: string,
  init?: RequestInit,
  graphVersion = DEFAULT_META_GRAPH_VERSION,
) => {
  const response = await fetch(`https://graph.facebook.com/${graphVersion}/${path}`, {
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
    throw new Error(data?.error?.message || `Meta Graph API error (${response.status})`);
  }
  return data;
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (request.method !== "POST") return reply({ error: "method_not_allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const appId = Deno.env.get("FACEBOOK_APP_ID") ?? Deno.env.get("META_APP_ID") ?? "";
    const appSecret = Deno.env.get("META_APP_SECRET") ?? Deno.env.get("FACEBOOK_APP_SECRET") ?? "";
    const configurationId = Deno.env.get("META_WHATSAPP_CONFIG_ID") ?? "";
    const graphVersion = Deno.env.get("META_GRAPH_API_VERSION") ?? DEFAULT_META_GRAPH_VERSION;
    const authHeader = request.headers.get("Authorization") ?? "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "");

    if (!supabaseUrl || !serviceKey || !jwt) return reply({ error: "unauthorized" }, 401);
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authData, error: authError } = await admin.auth.getUser(jwt);
    if (authError || !authData.user) return reply({ error: "unauthorized" }, 401);

    const body = await request.json().catch(() => ({}));
    const action = typeof body.action === "string" ? body.action : "config";
    const tenantId = typeof body.tenant_id === "string" ? body.tenant_id : "";
    if (!tenantId) return reply({ error: "tenant_id_required" }, 400);

    const [{ data: membership }, { data: superAdmin }] = await Promise.all([
      admin
        .from("tenant_users")
        .select("user_id")
        .eq("tenant_id", tenantId)
        .eq("user_id", authData.user.id)
        .maybeSingle(),
      admin.rpc("is_super_admin", { _user_id: authData.user.id }),
    ]);
    if (!membership && superAdmin !== true) return reply({ error: "forbidden" }, 403);

    if (action === "config") {
      if (!appId || !configurationId) {
        return reply({ error: "meta_whatsapp_not_configured" }, 503);
      }
      return reply({
        app_id: appId,
        configuration_id: configurationId,
        graph_version: graphVersion,
      });
    }

    if (action === "disconnect") {
      const integrationId = typeof body.integration_id === "string" ? body.integration_id : "";
      if (!integrationId) return reply({ error: "integration_id_required" }, 400);
      const { data: integration } = await admin
        .from("tenant_integrations")
        .select("id,user_id")
        .eq("id", integrationId)
        .eq("tenant_id", tenantId)
        .eq("integration_type", "meta_whatsapp")
        .maybeSingle();
      if (!integration || (integration.user_id !== authData.user.id && superAdmin !== true)) {
        return reply({ error: "forbidden" }, 403);
      }
      const { error } = await admin.from("tenant_integrations").delete().eq("id", integrationId);
      if (error) throw error;
      return reply({ success: true });
    }

    if (action !== "complete") return reply({ error: "unsupported_action" }, 400);
    if (!appId || !appSecret || !configurationId) {
      return reply({ error: "meta_whatsapp_not_configured" }, 503);
    }

    const rawCode = typeof body.code === "string" ? body.code.trim() : "";
    const suppliedToken = typeof body.access_token === "string" ? body.access_token.trim() : "";
    const sessionInfo = (body.session_info ?? {}) as MetaWhatsAppSessionInfo;
    const sessionEvent = typeof body.session_event === "string" ? body.session_event : "";
    const requestedCoexistence = isCoexistenceFinishEvent(sessionEvent);
    const pin = typeof body.pin === "string" ? body.pin.replace(/\D/g, "") : "";

    // The JS SDK cross-domain bridge sometimes hands back a "cb=" arbiter id.
    // That is never a usable authorization code.
    const code = rawCode.startsWith("cb=") ? "" : rawCode;
    if (!code && !suppliedToken) return reply({ error: "exchange_code_required" }, 400);

    // Embedded Signup through the JS SDK returns either an authorization code or,
    // for some configurations, a short-lived user token. Support both.
    let businessToken = "";
    if (code) {
      const tokenUrl = new URL(`https://graph.facebook.com/${graphVersion}/oauth/access_token`);
      tokenUrl.searchParams.set("client_id", appId);
      tokenUrl.searchParams.set("client_secret", appSecret);
      tokenUrl.searchParams.set("code", code);
      const tokenResponse = await fetch(tokenUrl);
      const tokenPayload = await tokenResponse.json();
      if (tokenResponse.ok && tokenPayload?.access_token) {
        businessToken = String(tokenPayload.access_token);
      } else if (!suppliedToken) {
        const metaMessage = tokenPayload?.error?.message ?? "";
        const hint = tokenPayload?.error?.error_subcode === 36008
          ? " ודאו שה-Configuration הוא זרימת WhatsApp Embedded Signup, ושהדומיין רשום ב-Allowed Domains for the JavaScript SDK וב-Valid OAuth Redirect URIs."
          : "";
        return reply({
          error: `${metaMessage || "Failed to exchange Meta authorization code"}${hint}`,
          meta_error: tokenPayload?.error ?? null,
        }, 400);
      }
    }

    if (!businessToken && suppliedToken) {
      const longLivedUrl = new URL(`https://graph.facebook.com/${graphVersion}/oauth/access_token`);
      longLivedUrl.searchParams.set("grant_type", "fb_exchange_token");
      longLivedUrl.searchParams.set("client_id", appId);
      longLivedUrl.searchParams.set("client_secret", appSecret);
      longLivedUrl.searchParams.set("fb_exchange_token", suppliedToken);
      const longLivedResponse = await fetch(longLivedUrl);
      const longLivedPayload = await longLivedResponse.json();
      businessToken = longLivedResponse.ok && longLivedPayload?.access_token
        ? String(longLivedPayload.access_token)
        : suppliedToken;
    }

    if (!businessToken) {
      return reply({ error: "Failed to obtain a Meta access token" }, 400);
    }

    let wabaIds = [
      ...(Array.isArray(sessionInfo.waba_ids) ? sessionInfo.waba_ids : []),
      ...(sessionInfo.waba_id ? [sessionInfo.waba_id] : []),
    ].filter((value, index, values) => value && values.indexOf(value) === index);

    // Embedded Signup only emits session info for full WhatsApp flows. When it is
    // absent, ask Meta which WABAs the customer actually granted to this app.
    let grantedScopes: string[] = [];
    if (!wabaIds.length) {
      const debug = await graphJson(
        `debug_token?input_token=${encodeURIComponent(businessToken)}`,
        `${appId}|${appSecret}`,
        undefined,
        graphVersion,
      );
      grantedScopes = debug?.data?.scopes ?? [];
      const granular = debug?.data?.granular_scopes ?? [];
      wabaIds = granular
        .filter((entry: any) =>
          ["whatsapp_business_management", "whatsapp_business_messaging"].includes(entry?.scope),
        )
        .flatMap((entry: any) => entry?.target_ids ?? [])
        .filter((value: string, index: number, values: string[]) => value && values.indexOf(value) === index);
    }

    // Last resort: read the WABAs shared with this app through the customer's businesses.
    if (!wabaIds.length) {
      try {
        const businesses = await graphJson("me/businesses?limit=50", businessToken, undefined, graphVersion);
        for (const business of businesses?.data ?? []) {
          for (const edge of ["client_whatsapp_business_accounts", "owned_whatsapp_business_accounts"]) {
            try {
              const accounts = await graphJson(
                `${business.id}/${edge}?limit=50`,
                businessToken,
                undefined,
                graphVersion,
              );
              for (const account of accounts?.data ?? []) {
                if (account?.id && !wabaIds.includes(account.id)) wabaIds.push(account.id);
              }
            } catch { /* edge not accessible for this business */ }
          }
        }
      } catch { /* business discovery unavailable */ }
    }

    if (!wabaIds.length) {
      const scopeNote = grantedScopes.length
        ? ` ההרשאות שהתקבלו: ${grantedScopes.join(", ")}.`
        : "";
      return reply({
        error:
          "Meta לא החזירה חשבון WhatsApp Business. ודאו שה-Configuration הוא זרימת WhatsApp Embedded Signup הכוללת whatsapp_business_management ו-whatsapp_business_messaging, ושבחרתם חשבון WhatsApp בתהליך." +
          scopeNote,
        code: "waba_not_granted",
        granted_scopes: grantedScopes,
      }, 400);
    }

    const connected: Array<Record<string, unknown>> = [];
    const warnings: string[] = [];

    for (const wabaId of wabaIds) {
      await graphJson(`${wabaId}/subscribed_apps`, businessToken, { method: "POST" }, graphVersion);

      const phonePayload = await graphJson(
        `${wabaId}/phone_numbers?fields=id,display_phone_number,verified_name,quality_rating,platform_type,is_on_biz_app`,
        businessToken,
        undefined,
        graphVersion,
      );
      const phones = (phonePayload.data ?? []).filter(
        (phone: any) => !sessionInfo.phone_number_id || phone.id === sessionInfo.phone_number_id,
      );
      if (!phones.length) throw new Error("No WhatsApp business phone number was returned by Meta");

      for (const phone of phones) {
        if (requestedCoexistence && phone.is_on_biz_app !== true) {
          throw new Error("Meta did not confirm WhatsApp Business App coexistence for this number");
        }
        // Meta's is_on_biz_app is authoritative: a number still used in the
        // WhatsApp Business app must not be re-registered for Cloud API.
        const coexistence = phone.is_on_biz_app === true;
        if (!coexistence) {
          if (!/^\d{6}$/.test(pin)) {
            return reply({
              error: `המספר ${phone.display_phone_number ?? phone.id} דורש רישום ל-Cloud API. בחרו "מספר חדש" והזינו PIN בן 6 ספרות.`,
              code: "pin_required_for_registration",
            }, 400);
          }
          await graphJson(
            `${phone.id}/register`,
            businessToken,
            {
              method: "POST",
              body: JSON.stringify({ messaging_product: "whatsapp", pin }),
            },
            graphVersion,
          );
        }

        let contactsSyncRequestId: string | null = null;
        let historySyncRequestId: string | null = null;
        if (coexistence) {
          for (const syncType of ["smb_app_state_sync", "history"]) {
            try {
              const sync = await graphJson(
                `${phone.id}/smb_app_data`,
                businessToken,
                {
                  method: "POST",
                  body: JSON.stringify({ messaging_product: "whatsapp", sync_type: syncType }),
                },
                graphVersion,
              );
              if (syncType === "history") historySyncRequestId = sync.request_id ?? null;
              else contactsSyncRequestId = sync.request_id ?? null;
            } catch (error) {
              warnings.push(
                `${phone.display_phone_number || phone.id}: ${syncType} sync failed: ${
                  error instanceof Error ? error.message : "unknown error"
                }`,
              );
            }
          }
        }

        const settings = {
          waba_id: wabaId,
          business_id: sessionInfo.business_id ?? null,
          phone_number_id: String(phone.id),
          display_phone_number: phone.display_phone_number ?? null,
          verified_name: phone.verified_name ?? null,
          quality_rating: phone.quality_rating ?? null,
          platform_type: phone.platform_type ?? "CLOUD_API",
          coexistence_enabled: coexistence,
          webhook_subscribed_at: new Date().toISOString(),
          contacts_sync_request_id: contactsSyncRequestId,
          history_sync_request_id: historySyncRequestId,
          graph_version: graphVersion,
        };

        const { data: existing } = await admin
          .from("tenant_integrations")
          .select("id,tenant_id")
          .eq("integration_type", "meta_whatsapp")
          .filter("settings->>phone_number_id", "eq", String(phone.id))
          .maybeSingle();
        if (existing && existing.tenant_id !== tenantId) {
          throw new Error("This WhatsApp number is already connected to another AIOS organization");
        }
        const payload = {
          tenant_id: tenantId,
          user_id: authData.user.id,
          integration_type: "meta_whatsapp",
          api_key: null,
          api_token_last_4: businessToken.slice(-4),
          instance_id: String(phone.id),
          display_name: phone.verified_name || phone.display_phone_number || "Meta WhatsApp",
          connection_visibility: "org",
          is_active: true,
          settings,
        };
        const query = existing
          ? admin.from("tenant_integrations").update(payload).eq("id", existing.id)
          : admin.from("tenant_integrations").insert(payload);
        const { data: saved, error: saveError } = await query.select("id").single();
        if (saveError) throw saveError;
        const { error: tokenError } = await admin.from("meta_whatsapp_tokens").upsert({
          integration_id: saved.id,
          access_token: businessToken,
          updated_at: new Date().toISOString(),
        });
        if (tokenError) {
          if (!existing) await admin.from("tenant_integrations").delete().eq("id", saved.id);
          throw tokenError;
        }

        connected.push({
          integration_id: saved.id,
          phone_number_id: phone.id,
          display_phone_number: phone.display_phone_number,
          verified_name: phone.verified_name,
          coexistence,
        });
      }
    }

    return reply({ success: true, connections: connected, warnings });
  } catch (error) {
    console.error("meta-whatsapp-auth error", error);
    return reply({ error: error instanceof Error ? error.message : "unknown_error" }, 500);
  }
});
