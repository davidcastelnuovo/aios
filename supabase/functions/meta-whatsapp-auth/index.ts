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

const unique = (values: string[]) =>
  values.filter((value, index) => value && values.indexOf(value) === index);

type TokenDebug = { type: string; scopes: string[]; wabaIds: string[] };

/** Reads the token metadata Meta exposes, including the assets it was granted. */
const inspectToken = async (
  token: string,
  appToken: string,
  graphVersion: string,
): Promise<TokenDebug> => {
  try {
    const debug = await graphJson(
      `debug_token?input_token=${encodeURIComponent(token)}`,
      appToken,
      undefined,
      graphVersion,
    );
    const granular = debug?.data?.granular_scopes ?? [];
    return {
      type: String(debug?.data?.type ?? ""),
      scopes: debug?.data?.scopes ?? [],
      wabaIds: unique(
        granular
          .filter((entry: any) =>
            ["whatsapp_business_management", "whatsapp_business_messaging"].includes(entry?.scope)
          )
          .flatMap((entry: any) => entry?.target_ids ?? []),
      ),
    };
  } catch {
    return { type: "", scopes: [], wabaIds: [] };
  }
};

const WABA_EDGES = ["owned_whatsapp_business_accounts", "client_whatsapp_business_accounts"];

type DiscoveryStep = { source: string; found?: string[]; error?: string };

/**
 * Finds the WhatsApp accounts a token can act on when Meta did not scope the
 * grant to specific assets. System user tokens in particular come back with
 * unscoped permissions and no `me/businesses` edge, so several routes are
 * tried and each outcome is recorded for the operator.
 */
const discoverWabas = async (
  token: string,
  graphVersion: string,
  explicitBusinessId: string,
) => {
  const found: string[] = [];
  const steps: DiscoveryStep[] = [];

  const readBusiness = async (businessId: string, source: string) => {
    for (const edge of WABA_EDGES) {
      try {
        const accounts = await graphJson(
          `${businessId}/${edge}?limit=50`,
          token,
          undefined,
          graphVersion,
        );
        const ids = (accounts?.data ?? []).map((account: any) => account?.id).filter(Boolean);
        found.push(...ids);
        steps.push({ source: `${source}:${edge}`, found: ids });
      } catch (error) {
        steps.push({
          source: `${source}:${edge}`,
          error: error instanceof Error ? error.message : "unknown error",
        });
      }
    }
  };

  if (explicitBusinessId) await readBusiness(explicitBusinessId, "business_id");

  // A user token exposes the businesses it belongs to; a system user token does not.
  if (!found.length) {
    try {
      const businesses = await graphJson("me/businesses?limit=50", token, undefined, graphVersion);
      const ids = (businesses?.data ?? []).map((business: any) => business?.id).filter(Boolean);
      steps.push({ source: "me/businesses", found: ids });
      for (const businessId of ids) await readBusiness(businessId, `me/businesses/${businessId}`);
    } catch (error) {
      steps.push({
        source: "me/businesses",
        error: error instanceof Error ? error.message : "unknown error",
      });
    }
  }

  // A system user belongs to exactly one business, reachable through its own node.
  if (!found.length) {
    try {
      const me = await graphJson("me?fields=id,name", token, undefined, graphVersion);
      steps.push({ source: "me", found: me?.id ? [String(me.id)] : [] });
      for (const edge of ["assigned_whatsapp_business_accounts", "businesses"]) {
        try {
          const payload = await graphJson(
            `${me.id}/${edge}?limit=50`,
            token,
            undefined,
            graphVersion,
          );
          const ids = (payload?.data ?? []).map((entry: any) => entry?.id).filter(Boolean);
          if (edge === "assigned_whatsapp_business_accounts") found.push(...ids);
          else for (const businessId of ids) await readBusiness(businessId, `me/${businessId}`);
          steps.push({ source: `me/${edge}`, found: ids });
        } catch (error) {
          steps.push({
            source: `me/${edge}`,
            error: error instanceof Error ? error.message : "unknown error",
          });
        }
      }
    } catch (error) {
      steps.push({ source: "me", error: error instanceof Error ? error.message : "unknown error" });
    }
  }

  return { wabaIds: unique(found), steps };
};

const PHONE_FIELDS = "id,display_phone_number,verified_name,quality_rating,platform_type,is_on_biz_app";

const listPhoneNumbers = async (wabaId: string, token: string, graphVersion: string) => {
  const payload = await graphJson(
    `${wabaId}/phone_numbers?fields=${PHONE_FIELDS}`,
    token,
    undefined,
    graphVersion,
  );
  return (payload.data ?? []) as any[];
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
    const appToken = `${appId}|${appSecret}`;
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

    // Reports what Meta knows about the Embedded Signup configuration. A configuration
    // that is not a WhatsApp login variation silently degrades into a plain Facebook
    // login, which is impossible to tell apart from the browser.
    if (action === "diagnose") {
      if (!appId || !appSecret || !configurationId) {
        return reply({ error: "meta_whatsapp_not_configured" }, 503);
      }
      const checks: Array<Record<string, unknown>> = [];
      for (const path of [configurationId, `${configurationId}?fields=id,name`]) {
        try {
          const data = await graphJson(path, appToken, undefined, graphVersion);
          checks.push({ path, ok: true, data });
          break;
        } catch (error) {
          checks.push({ path, ok: false, error: error instanceof Error ? error.message : "unknown" });
        }
      }
      const configOk = checks.some((entry) => entry.ok === true);
      const configData = checks.find((entry) => entry.ok)?.data as { name?: string } | undefined;
      let whatsappProduct: Record<string, unknown> = { ok: false };
      try {
        const subscribed = await graphJson(
          `${appId}/subscriptions`,
          appToken,
          undefined,
          graphVersion,
        );
        const objects = (subscribed?.data ?? []).map((entry: any) => ({
          object: entry?.object,
          fields: (entry?.fields ?? []).map((field: any) => field?.name),
        }));
        whatsappProduct = { ok: true, objects };
      } catch (error) {
        whatsappProduct = { ok: false, error: error instanceof Error ? error.message : "unknown" };
      }
      const hasWhatsappWebhook = Array.isArray((whatsappProduct as any).objects)
        && (whatsappProduct as any).objects.some((entry: any) => entry?.object === "whatsapp_business_account");
      const guidance = !configOk
        ? "Configuration ID לא נגיש ב-Meta Graph API — בדקו META_WHATSAPP_CONFIG_ID ו-META_APP_SECRET."
        : !hasWhatsappWebhook
        ? "Webhook של whatsapp_business_account לא רשום על האפליקציה — הוסיפו ב-WhatsApp → Configuration → Webhooks."
        : "אם בדפדפן מופיע Facebook Login רגיל (לא מסכי WhatsApp/WABA) — ה-Configuration חייב להיות מסוג WhatsApp Embedded Signup, לא Facebook Login for Business רגיל. נדרש Tech Provider / Solution Partner.";
      return reply({
        app_id: appId,
        configuration_id: configurationId,
        configuration_name: configData?.name ?? null,
        graph_version: graphVersion,
        configuration: checks,
        webhook_subscriptions: whatsappProduct,
        config_reachable: configOk,
        whatsapp_webhook_subscribed: hasWhatsappWebhook,
        guidance,
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

    if (!["complete", "list_assets", "connect_manual"].includes(action)) {
      return reply({ error: "unsupported_action" }, 400);
    }
    if (!appId || !appSecret) {
      return reply({ error: "meta_whatsapp_not_configured" }, 503);
    }

    const suppliedToken = typeof body.access_token === "string" ? body.access_token.trim() : "";
    const pin = typeof body.pin === "string" ? body.pin.replace(/\D/g, "") : "";

    // Resolve the token AIOS will act with. Embedded Signup hands back an
    // authorization code; the manual path hands back a system user token.
    let businessToken = "";

    if (action === "complete") {
      const rawCode = typeof body.code === "string" ? body.code.trim() : "";
      // The JS SDK cross-domain bridge sometimes hands back a "cb=" arbiter id.
      // That is never a usable authorization code.
      const code = rawCode.startsWith("cb=") ? "" : rawCode;
      if (!code && !suppliedToken) return reply({ error: "exchange_code_required" }, 400);

      if (code) {
        // Facebook Login for Business codes exchange with no redirect_uri at all.
        // Codes minted by the plain JS SDK dialog need one, and Meta accepts an
        // explicitly empty value for those. Walk every shape before giving up:
        // null omits the parameter, "" sends it empty.
        const suppliedRedirects = [
          ...(Array.isArray(body.redirect_uris)
            ? body.redirect_uris.filter((value: unknown) => typeof value === "string")
            : []),
          ...(typeof body.redirect_uri === "string" ? [body.redirect_uri] : []),
        ].filter(Boolean) as string[];
        const redirectCandidates: Array<string | null> = [null, "", ...unique(suppliedRedirects)];

        let lastError: any = null;
        for (const redirectUri of redirectCandidates) {
          const tokenUrl = new URL(`https://graph.facebook.com/${graphVersion}/oauth/access_token`);
          tokenUrl.searchParams.set("client_id", appId);
          tokenUrl.searchParams.set("client_secret", appSecret);
          tokenUrl.searchParams.set("code", code);
          if (redirectUri !== null) tokenUrl.searchParams.set("redirect_uri", redirectUri);
          const tokenResponse = await fetch(tokenUrl);
          const tokenPayload = await tokenResponse.json().catch(() => ({}));
          if (tokenResponse.ok && tokenPayload?.access_token) {
            businessToken = String(tokenPayload.access_token);
            break;
          }
          lastError = tokenPayload?.error ?? lastError;
          // A code is single use. Once Meta says it was already redeemed there is
          // nothing left to retry, and further attempts only mask the real error.
          if (String(tokenPayload?.error?.message ?? "").includes("has been used")) break;
        }
        if (!businessToken && !suppliedToken) {
          const metaMessage = lastError?.message ?? "";
          const hint = lastError?.error_subcode === 36008
            ? " Meta דחתה את הקוד. בדקו ש-aios.co.il מופיע ב-Allowed Domains for the JavaScript SDK וב-Valid OAuth Redirect URIs, ושה-Configuration הוא זרימת WhatsApp Embedded Signup. לחלופין חברו את המספר במסלול הידני עם Access Token."
            : "";
          return reply({
            error: `${metaMessage || "Failed to exchange Meta authorization code"}${hint}`,
            code: "code_exchange_failed",
            meta_error: lastError ?? null,
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
        const longLivedPayload = await longLivedResponse.json().catch(() => ({}));
        businessToken = longLivedResponse.ok && longLivedPayload?.access_token
          ? String(longLivedPayload.access_token)
          : suppliedToken;
      }
    } else {
      if (!suppliedToken) return reply({ error: "access_token_required" }, 400);
      businessToken = suppliedToken;
    }

    if (!businessToken) {
      return reply({ error: "Failed to obtain a Meta access token" }, 400);
    }

    const sessionInfo = (body.session_info ?? {}) as MetaWhatsAppSessionInfo;
    const sessionEvent = typeof body.session_event === "string" ? body.session_event : "";
    const requestedCoexistence = action === "complete" && isCoexistenceFinishEvent(sessionEvent);

    const debug = await inspectToken(businessToken, appToken, graphVersion);

    // A short-lived user token from the manual path is worth extending; system user
    // tokens are already long-lived and must never be exchanged.
    if (action === "connect_manual" && debug.type === "USER") {
      const longLivedUrl = new URL(`https://graph.facebook.com/${graphVersion}/oauth/access_token`);
      longLivedUrl.searchParams.set("grant_type", "fb_exchange_token");
      longLivedUrl.searchParams.set("client_id", appId);
      longLivedUrl.searchParams.set("client_secret", appSecret);
      longLivedUrl.searchParams.set("fb_exchange_token", businessToken);
      const longLivedResponse = await fetch(longLivedUrl);
      const longLivedPayload = await longLivedResponse.json().catch(() => ({}));
      if (longLivedResponse.ok && longLivedPayload?.access_token) {
        businessToken = String(longLivedPayload.access_token);
      }
    }

    const requestedWabaId = typeof body.waba_id === "string" ? body.waba_id.trim() : "";
    const requestedBusinessId = typeof body.business_id === "string" ? body.business_id.trim() : "";
    let wabaIds = unique([
      ...(requestedWabaId ? [requestedWabaId] : []),
      ...(Array.isArray(sessionInfo.waba_ids) ? sessionInfo.waba_ids : []),
      ...(sessionInfo.waba_id ? [sessionInfo.waba_id] : []),
    ]);
    if (!wabaIds.length) wabaIds = debug.wabaIds;

    let discoverySteps: DiscoveryStep[] = [];
    if (!wabaIds.length) {
      const discovered = await discoverWabas(businessToken, graphVersion, requestedBusinessId);
      wabaIds = discovered.wabaIds;
      discoverySteps = discovered.steps;
    }

    if (!wabaIds.length) {
      const hasWhatsAppScopes = debug.scopes.some((scope) => scope.startsWith("whatsapp_business"));
      // Meta grants system users unscoped permissions, so the right scopes with
      // no discoverable account means the account was never assigned to the user.
      const guidance = hasWhatsAppScopes
        ? "האסימון כולל את הרשאות ה-WhatsApp, אך Meta לא חשפה דרכו אף חשבון. הקצו את חשבון ה-WhatsApp ל-System User (Add assets → WhatsApp accounts → Full control), או הזינו כאן את ה-WhatsApp Business Account ID ידנית."
        : "ודאו שהאסימון כולל whatsapp_business_management ו-whatsapp_business_messaging ושהוקצה לו חשבון WhatsApp.";
      const scopeNote = debug.scopes.length ? ` ההרשאות שהתקבלו: ${debug.scopes.join(", ")}.` : "";
      return reply({
        error: `Meta לא החזירה חשבון WhatsApp Business. ${guidance}${scopeNote}`,
        code: "waba_not_granted",
        granted_scopes: debug.scopes,
        token_type: debug.type,
        discovery: discoverySteps,
      }, 400);
    }

    // Lets the UI show the operator exactly which numbers Meta will connect.
    if (action === "list_assets") {
      const accounts: Array<Record<string, unknown>> = [];
      for (const wabaId of wabaIds) {
        try {
          // Meta delivers webhooks to every app subscribed to a WABA, so an
          // existing provider on the same account means duplicate inbound
          // messages and possibly duplicate automated replies. Show it first.
          const [details, phones, subscribed] = await Promise.all([
            graphJson(`${wabaId}?fields=id,name,currency,timezone_id`, businessToken, undefined, graphVersion)
              .catch(() => ({ id: wabaId })),
            listPhoneNumbers(wabaId, businessToken, graphVersion),
            graphJson(`${wabaId}/subscribed_apps`, businessToken, undefined, graphVersion)
              .catch(() => null),
          ]);
          accounts.push({
            waba_id: wabaId,
            name: (details as any)?.name ?? null,
            subscribed_apps: subscribed
              ? ((subscribed as any).data ?? []).map((entry: any) => ({
                id: String(entry?.whatsapp_business_api_data?.id ?? entry?.id ?? ""),
                name: entry?.whatsapp_business_api_data?.name ?? entry?.name ?? null,
              }))
              : null,
            phone_numbers: phones.map((phone) => ({
              id: phone.id,
              display_phone_number: phone.display_phone_number ?? null,
              verified_name: phone.verified_name ?? null,
              quality_rating: phone.quality_rating ?? null,
              platform_type: phone.platform_type ?? null,
              is_on_biz_app: phone.is_on_biz_app === true,
            })),
          });
        } catch (error) {
          accounts.push({
            waba_id: wabaId,
            error: error instanceof Error ? error.message : "unknown error",
            phone_numbers: [],
          });
        }
      }
      return reply({
        success: true,
        token_type: debug.type,
        granted_scopes: debug.scopes,
        app_id: appId,
        accounts,
      });
    }

    const requestedPhoneIds = new Set(
      [
        ...(Array.isArray(body.phone_number_ids)
          ? body.phone_number_ids.filter((value: unknown) => typeof value === "string")
          : []),
        ...(typeof body.phone_number_id === "string" ? [body.phone_number_id] : []),
        ...(action === "complete" && sessionInfo.phone_number_id ? [sessionInfo.phone_number_id] : []),
      ].filter(Boolean) as string[],
    );

    const connected: Array<Record<string, unknown>> = [];
    const warnings: string[] = [];

    for (const wabaId of wabaIds) {
      await graphJson(`${wabaId}/subscribed_apps`, businessToken, { method: "POST" }, graphVersion);

      const allPhones = await listPhoneNumbers(wabaId, businessToken, graphVersion);
      const phones = requestedPhoneIds.size
        ? allPhones.filter((phone: any) => requestedPhoneIds.has(String(phone.id)))
        : allPhones;
      if (!phones.length) throw new Error("No WhatsApp business phone number was returned by Meta");

      for (const phone of phones) {
        if (requestedCoexistence && phone.is_on_biz_app !== true) {
          throw new Error("Meta did not confirm WhatsApp Business App coexistence for this number");
        }
        // Meta's is_on_biz_app is authoritative: a number still used in the
        // WhatsApp Business app must not be re-registered for Cloud API.
        const coexistence = phone.is_on_biz_app === true;
        // A number already on Cloud API (e.g. hosted through another provider
        // such as ManyChat) is registered once, WABA-wide. Re-running /register
        // would reset its two-step PIN and can break the other provider, so any
        // app with WABA access simply sends without re-registering.
        const alreadyOnCloud = String(phone.platform_type ?? "").toUpperCase() === "CLOUD_API";
        if (!coexistence && !alreadyOnCloud) {
          if (!/^\d{6}$/.test(pin)) {
            return reply({
              error: `המספר ${phone.display_phone_number ?? phone.id} דורש רישום ל-Cloud API. הזינו PIN בן 6 ספרות.`,
              code: "pin_required_for_registration",
            }, 400);
          }
          try {
            await graphJson(
              `${phone.id}/register`,
              businessToken,
              {
                method: "POST",
                body: JSON.stringify({ messaging_product: "whatsapp", pin }),
              },
              graphVersion,
            );
          } catch (error) {
            // Treat an already-registered number as success rather than failing
            // the whole connection.
            const message = error instanceof Error ? error.message : "";
            if (!/already|registered/i.test(message)) throw error;
            warnings.push(`${phone.display_phone_number || phone.id}: ${message}`);
          }
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
          already_registered: !coexistence && alreadyOnCloud,
          onboarding_method: action === "connect_manual" ? "manual_token" : "embedded_signup",
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
