/**
 * Meta WhatsApp number warming / lead opt-in campaigns.
 *
 * Actions:
 *  - configure_auto_reply
 *  - ensure_optin_template
 *  - preview_audience
 *  - create_campaign
 *  - confirm_and_launch   (requires exact Hebrew confirm phrase + matching count)
 *  - dispatch_batch
 *  - list_campaigns / get_campaign
 *  - pause_campaign / retry_failed
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import {
  DEFAULT_LEAD_OPTIN_BODY,
  DEFAULT_LEAD_OPTIN_BUTTON_TEXT,
  DEFAULT_LEAD_THANKS_TEXT,
  DEFAULT_META_GRAPH_VERSION,
  digitsOnly,
  LEAD_OPTIN_BUTTON_PAYLOAD,
  LEAD_OPTIN_TEMPLATE_NAME,
} from "../_shared/meta-whatsapp.ts";

function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let digits = digitsOnly(String(raw).split("@")[0]).replace(/^00/, "");
  if (!digits) return null;
  if (digits.startsWith("0") && digits.length >= 9) digits = `972${digits.slice(1)}`;
  if (digits.startsWith("9720")) digits = `972${digits.slice(4)}`;
  return digits;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CONFIRM_PHRASE = "אני מאשר שליחת חימום";

const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

async function authorize(admin: any, jwt: string, tenantId: string, integrationId: string) {
  const { data: authData, error: authError } = await admin.auth.getUser(jwt);
  if (authError || !authData.user) return { error: reply({ error: "unauthorized" }, 401) };

  const [{ data: membership }, { data: superAdmin }, { data: integration }] = await Promise.all([
    admin.from("tenant_users").select("user_id, role").eq("tenant_id", tenantId).eq("user_id", authData.user.id).maybeSingle(),
    admin.rpc("is_super_admin", { _user_id: authData.user.id }),
    admin.from("tenant_integrations")
      .select("id,tenant_id,user_id,connection_visibility,settings,is_active,display_name")
      .eq("id", integrationId)
      .eq("integration_type", "meta_whatsapp")
      .maybeSingle(),
  ]);

  if ((!membership && superAdmin !== true) || !integration?.is_active) {
    return { error: reply({ error: "forbidden" }, 403) };
  }

  const canManage = superAdmin === true || integration.user_id === authData.user.id;
  let canUse = canManage ||
    (integration.tenant_id === tenantId && integration.connection_visibility === "org");
  if (integration.tenant_id !== tenantId) {
    const { data: canShare } = await admin.rpc("tenant_can_use_integration", {
      p_tenant_id: tenantId,
      p_integration_id: integrationId,
    });
    canUse = canShare === true || superAdmin === true;
  }
  if (!canUse) return { error: reply({ error: "integration_access_denied" }, 403) };

  return { user: authData.user, integration, canManage, superAdmin: superAdmin === true };
}

async function buildAudience(
  admin: any,
  tenantId: string,
  integrationId: string,
  source: string,
  manualPhones: string[],
): Promise<Array<{ phone: string; contact_name: string | null; entity_type: string; entity_id: string | null }>> {
  const byPhone = new Map<string, { phone: string; contact_name: string | null; entity_type: string; entity_id: string | null }>();

  if (source === "manual") {
    for (const raw of manualPhones) {
      const phone = normalizePhone(raw);
      if (!phone || phone.length < 10) continue;
      byPhone.set(phone, { phone, contact_name: null, entity_type: "manual", entity_id: null });
    }
  }

  if (source === "prior_meta_chats" || source === "clients_with_phone") {
    if (source === "prior_meta_chats") {
      const { data: msgs } = await admin
        .from("chat_messages")
        .select("sender_phone, sender_name, client_id, lead_id, direction")
        .eq("tenant_id", tenantId)
        .eq("provider", "meta_whatsapp")
        .eq("integration_id", integrationId)
        .order("created_at", { ascending: false })
        .limit(2000);
      for (const row of msgs ?? []) {
        const phone = normalizePhone(row.sender_phone);
        if (!phone || byPhone.has(phone)) continue;
        byPhone.set(phone, {
          phone,
          contact_name: row.sender_name ?? null,
          entity_type: row.client_id ? "client" : row.lead_id ? "lead" : "chat",
          entity_id: row.client_id || row.lead_id || null,
        });
      }
    }

    if (source === "clients_with_phone") {
      const { data: clients } = await admin
        .from("clients")
        .select("id, name, phone, status")
        .eq("tenant_id", tenantId)
        .in("status", ["active", "onboarding"])
        .not("phone", "is", null)
        .limit(2000);
      for (const row of clients ?? []) {
        const phone = normalizePhone(row.phone);
        if (!phone || byPhone.has(phone)) continue;
        byPhone.set(phone, {
          phone,
          contact_name: row.name ?? null,
          entity_type: "client",
          entity_id: row.id,
        });
      }
    }
  }

  // Skip already opted-in on this integration
  const phones = [...byPhone.keys()];
  if (phones.length) {
    const { data: opted } = await admin
      .from("wa_warm_opt_ins")
      .select("phone")
      .eq("tenant_id", tenantId)
      .eq("integration_id", integrationId)
      .in("phone", phones);
    for (const row of opted ?? []) {
      const p = normalizePhone(row.phone);
      if (p) byPhone.delete(p);
    }
  }

  return [...byPhone.values()];
}

async function refreshCampaignStats(admin: any, campaignId: string) {
  const { data: rows } = await admin
    .from("wa_warm_recipients")
    .select("status")
    .eq("campaign_id", campaignId);
  const stats: Record<string, number> = { total: 0 };
  for (const row of rows ?? []) {
    stats.total += 1;
    stats[row.status] = (stats[row.status] || 0) + 1;
  }
  await admin.from("wa_warm_campaigns").update({ stats }).eq("id", campaignId);
  return stats;
}

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

    const body = await request.json().catch(() => ({}));
    const action = String(body.action ?? "");
    const tenantId = String(body.tenant_id ?? "");
    const integrationId = String(body.integration_id ?? "");
    if (!action || !tenantId || !integrationId) {
      return reply({ error: "action_tenant_id_integration_id_required" }, 400);
    }

    const auth = await authorize(admin, jwt, tenantId, integrationId);
    if ("error" in auth && auth.error instanceof Response) return auth.error;
    const { user, integration, canManage } = auth as any;

    // ── configure auto-reply on the lead number ──────────────────────────
    if (action === "configure_auto_reply") {
      if (!canManage) return reply({ error: "manage_access_required" }, 403);
      const enabled = body.enabled !== false;
      const thanksText = String(body.thanks_text ?? DEFAULT_LEAD_THANKS_TEXT).trim() || DEFAULT_LEAD_THANKS_TEXT;
      const settings = {
        ...(integration.settings ?? {}),
        warm_auto_reply_enabled: enabled,
        warm_auto_reply_text: thanksText,
        warm_optin_button_payload: LEAD_OPTIN_BUTTON_PAYLOAD,
        warm_suppress_carmen: body.suppress_carmen !== false,
      };
      const { error } = await admin.from("tenant_integrations")
        .update({ settings })
        .eq("id", integrationId);
      if (error) throw error;
      return reply({ success: true, settings: {
        warm_auto_reply_enabled: settings.warm_auto_reply_enabled,
        warm_auto_reply_text: settings.warm_auto_reply_text,
        warm_suppress_carmen: settings.warm_suppress_carmen,
      }});
    }

    // ── ensure opt-in template exists (submit to Meta for approval) ───────
    if (action === "ensure_optin_template") {
      if (!canManage) return reply({ error: "manage_access_required" }, 403);
      const settings = integration.settings ?? {};
      const wabaId = String(settings.waba_id ?? "");
      const graphVersion = String(settings.graph_version ?? DEFAULT_META_GRAPH_VERSION);
      if (!wabaId) return reply({ error: "waba_id_missing" }, 400);

      const { data: tokenRow } = await admin.from("meta_whatsapp_tokens")
        .select("access_token").eq("integration_id", integrationId).maybeSingle();
      if (!tokenRow?.access_token) return reply({ error: "meta_whatsapp_token_missing" }, 400);

      const templateName = String(body.template_name ?? LEAD_OPTIN_TEMPLATE_NAME);
      const listUrl = new URL(`https://graph.facebook.com/${graphVersion}/${wabaId}/message_templates`);
      listUrl.searchParams.set("name", templateName);
      listUrl.searchParams.set("fields", "id,name,status,language,category,components");
      const listRes = await fetch(listUrl, {
        headers: { Authorization: `Bearer ${tokenRow.access_token}` },
      });
      const listJson = await listRes.json().catch(() => ({}));
      const existing = (listJson?.data ?? []).find((t: any) => t.name === templateName);
      if (existing) {
        return reply({
          success: true,
          created: false,
          template: existing,
          note: existing.status === "APPROVED"
            ? "התבנית כבר מאושרת — אפשר לשלוח חימום."
            : `התבנית קיימת בסטטוס ${existing.status}. יש להמתין לאישור Meta.`,
        });
      }

      const createRes = await fetch(
        `https://graph.facebook.com/${graphVersion}/${wabaId}/message_templates`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${tokenRow.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: templateName,
            category: "UTILITY",
            language: "he",
            parameter_format: "positional",
            components: [
              { type: "BODY", text: DEFAULT_LEAD_OPTIN_BODY },
              {
                type: "BUTTONS",
                buttons: [{
                  type: "QUICK_REPLY",
                  text: DEFAULT_LEAD_OPTIN_BUTTON_TEXT,
                }],
              },
            ],
          }),
        },
      );
      const createJson = await createRes.json().catch(() => ({}));
      if (!createRes.ok || createJson?.error) {
        return reply({
          error: createJson?.error?.error_user_msg || createJson?.error?.message || "template_create_failed",
          meta_error: createJson?.error,
          hint: "אם Meta דוחה UTILITY — צרו ידנית כ-MARKETING ב-Business Manager עם אותו שם וטקסט.",
        }, 502);
      }
      return reply({
        success: true,
        created: true,
        template: createJson,
        note: "התבנית נשלחה לאישור Meta. שליחת חימום אפשרית רק אחרי סטטוס APPROVED.",
      });
    }

    // ── preview audience ─────────────────────────────────────────────────
    if (action === "preview_audience") {
      const source = String(body.audience_source ?? "prior_meta_chats");
      const manual = Array.isArray(body.manual_phones) ? body.manual_phones.map(String) : [];
      const audience = await buildAudience(admin, tenantId, integrationId, source, manual);
      return reply({
        success: true,
        count: audience.length,
        sample: audience.slice(0, 25),
        confirm_phrase_required: CONFIRM_PHRASE,
      });
    }

    // ── create campaign (draft + freeze recipients) ───────────────────────
    if (action === "create_campaign") {
      if (!canManage) return reply({ error: "manage_access_required" }, 403);
      const source = String(body.audience_source ?? "prior_meta_chats");
      const manual = Array.isArray(body.manual_phones) ? body.manual_phones.map(String) : [];
      const audience = await buildAudience(admin, tenantId, integrationId, source, manual);
      if (!audience.length) return reply({ error: "no_recipients_after_dedup" }, 400);

      const { data: campaign, error: campErr } = await admin.from("wa_warm_campaigns").insert({
        tenant_id: tenantId,
        integration_id: integrationId,
        created_by: user.id,
        name: String(body.name ?? "חימום מספר לידים").trim() || "חימום מספר לידים",
        status: "draft",
        optin_template_name: String(body.optin_template_name ?? LEAD_OPTIN_TEMPLATE_NAME),
        optin_template_language: String(body.optin_template_language ?? "he"),
        thanks_text: String(body.thanks_text ?? DEFAULT_LEAD_THANKS_TEXT).trim() || DEFAULT_LEAD_THANKS_TEXT,
        audience_source: source,
        audience_filter: { manual_count: manual.length },
        throttle_min_seconds: Math.max(15, Number(body.throttle_min_seconds ?? 25) || 25),
        throttle_max_seconds: Math.max(20, Number(body.throttle_max_seconds ?? 45) || 45),
        daily_cap: Math.min(200, Math.max(10, Number(body.daily_cap ?? 80) || 80)),
        stats: { total: audience.length, pending: audience.length },
      }).select("*").single();
      if (campErr) throw campErr;

      const rows = audience.map((a) => ({
        campaign_id: campaign.id,
        tenant_id: tenantId,
        phone: a.phone,
        contact_name: a.contact_name,
        entity_type: a.entity_type,
        entity_id: a.entity_id,
        status: "pending",
      }));
      // chunk insert
      for (let i = 0; i < rows.length; i += 200) {
        const { error } = await admin.from("wa_warm_recipients").insert(rows.slice(i, i + 200));
        if (error) throw error;
      }

      return reply({
        success: true,
        campaign,
        recipient_count: audience.length,
        confirm_phrase_required: CONFIRM_PHRASE,
        warning: "שליחה מסיבית תתחיל רק אחרי confirm_and_launch עם המשפט המדויק ומספר הנמענים.",
      });
    }

    // ── confirm + launch ─────────────────────────────────────────────────
    if (action === "confirm_and_launch") {
      if (!canManage) return reply({ error: "manage_access_required" }, 403);
      const campaignId = String(body.campaign_id ?? "");
      const phrase = String(body.confirm_phrase ?? "").trim();
      const confirmCount = Number(body.confirm_count ?? 0);
      if (!campaignId) return reply({ error: "campaign_id_required" }, 400);
      if (phrase !== CONFIRM_PHRASE) {
        return reply({
          error: "confirm_phrase_mismatch",
          required: CONFIRM_PHRASE,
          hint: "הקלידו בדיוק: אני מאשר שליחת חימום",
        }, 400);
      }

      const { data: campaign } = await admin.from("wa_warm_campaigns")
        .select("*").eq("id", campaignId).eq("tenant_id", tenantId).maybeSingle();
      if (!campaign) return reply({ error: "campaign_not_found" }, 404);
      if (!["draft", "paused", "failed"].includes(campaign.status)) {
        return reply({ error: `campaign_not_launchable_status_${campaign.status}` }, 400);
      }

      const { count } = await admin.from("wa_warm_recipients")
        .select("id", { count: "exact", head: true })
        .eq("campaign_id", campaignId)
        .eq("status", "pending");
      if (confirmCount !== count) {
        return reply({
          error: "confirm_count_mismatch",
          pending: count,
          provided: confirmCount,
          hint: `יש לאשר במפורש ${count} נמענים ממתינים`,
        }, 400);
      }

      const { error } = await admin.from("wa_warm_campaigns").update({
        status: "running",
        admin_confirmed_at: new Date().toISOString(),
        admin_confirm_phrase: phrase,
        started_at: campaign.started_at ?? new Date().toISOString(),
        last_error: null,
      }).eq("id", campaignId);
      if (error) throw error;

      return reply({
        success: true,
        campaign_id: campaignId,
        pending: count,
        note: "הקמפיין רץ. קראו ל-dispatch_batch שוב ושוב עד שאין pending (או השתמשו בכפתור ב-UI).",
      });
    }

    // ── dispatch one throttled batch ─────────────────────────────────────
    if (action === "dispatch_batch") {
      if (!canManage) return reply({ error: "manage_access_required" }, 403);
      const campaignId = String(body.campaign_id ?? "");
      const { data: campaign } = await admin.from("wa_warm_campaigns")
        .select("*").eq("id", campaignId).eq("tenant_id", tenantId).maybeSingle();
      if (!campaign) return reply({ error: "campaign_not_found" }, 404);
      if (campaign.status !== "running") {
        return reply({ error: `campaign_not_running_${campaign.status}` }, 400);
      }

      // daily cap
      const dayStart = new Date();
      dayStart.setUTCHours(0, 0, 0, 0);
      const { count: sentToday } = await admin.from("wa_warm_recipients")
        .select("id", { count: "exact", head: true })
        .eq("campaign_id", campaignId)
        .gte("sent_at", dayStart.toISOString())
        .in("status", ["sent", "delivered", "read", "opted_in", "thanked"]);
      const remainingToday = Math.max(0, (campaign.daily_cap || 80) - (sentToday || 0));
      if (remainingToday <= 0) {
        return reply({
          success: true,
          sent: 0,
          paused_daily_cap: true,
          note: "הגעתם לתקרת היום. המשיכו מחר או העלו daily_cap בזהירות.",
        });
      }

      const batchSize = Math.min(Number(body.batch_size ?? 5) || 5, remainingToday, 10);
      const { data: pending } = await admin.from("wa_warm_recipients")
        .select("*")
        .eq("campaign_id", campaignId)
        .eq("status", "pending")
        .order("created_at", { ascending: true })
        .limit(batchSize);
      if (!pending?.length) {
        await admin.from("wa_warm_campaigns").update({
          status: "completed",
          completed_at: new Date().toISOString(),
        }).eq("id", campaignId);
        const stats = await refreshCampaignStats(admin, campaignId);
        return reply({ success: true, sent: 0, completed: true, stats });
      }

      const results: Array<{ phone: string; ok: boolean; error?: string }> = [];
      for (const recipient of pending) {
        const sendRes = await fetch(`${supabaseUrl}/functions/v1/send-meta-whatsapp-message`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({
            tenantId,
            integrationId,
            senderUserId: integration.user_id || user.id,
            phoneNumber: recipient.phone,
            clientId: recipient.entity_type === "client" ? recipient.entity_id : null,
            template: {
              name: campaign.optin_template_name,
              language: campaign.optin_template_language,
            },
          }),
        });
        const sendJson = await sendRes.json().catch(() => ({}));
        if (sendRes.ok && sendJson?.success) {
          await admin.from("wa_warm_recipients").update({
            status: "sent",
            provider_message_id: sendJson.messageId ?? null,
            sent_at: new Date().toISOString(),
            attempts: (recipient.attempts || 0) + 1,
            error: null,
          }).eq("id", recipient.id);
          results.push({ phone: recipient.phone, ok: true });
        } else {
          await admin.from("wa_warm_recipients").update({
            status: "failed",
            error: sendJson?.error || `HTTP ${sendRes.status}`,
            attempts: (recipient.attempts || 0) + 1,
          }).eq("id", recipient.id);
          results.push({ phone: recipient.phone, ok: false, error: sendJson?.error });
        }

        const min = campaign.throttle_min_seconds || 25;
        const max = Math.max(min, campaign.throttle_max_seconds || 45);
        const waitMs = (min + Math.floor(Math.random() * (max - min + 1))) * 1000;
        await new Promise((r) => setTimeout(r, Math.min(waitMs, 8000))); // cap wait in-edge; UI spaces batches
      }

      const stats = await refreshCampaignStats(admin, campaignId);
      const { count: stillPending } = await admin.from("wa_warm_recipients")
        .select("id", { count: "exact", head: true })
        .eq("campaign_id", campaignId)
        .eq("status", "pending");
      if (!stillPending) {
        await admin.from("wa_warm_campaigns").update({
          status: "completed",
          completed_at: new Date().toISOString(),
        }).eq("id", campaignId);
      }

      return reply({
        success: true,
        results,
        stats,
        pending_left: stillPending || 0,
        completed: !stillPending,
      });
    }

    if (action === "pause_campaign") {
      if (!canManage) return reply({ error: "manage_access_required" }, 403);
      const campaignId = String(body.campaign_id ?? "");
      await admin.from("wa_warm_campaigns").update({ status: "paused" })
        .eq("id", campaignId).eq("tenant_id", tenantId).eq("status", "running");
      return reply({ success: true });
    }

    if (action === "retry_failed") {
      if (!canManage) return reply({ error: "manage_access_required" }, 403);
      const campaignId = String(body.campaign_id ?? "");
      // Only retry failed that are not Meta engagement/payment (heuristic via error text)
      const { data: failed } = await admin.from("wa_warm_recipients")
        .select("id, error")
        .eq("campaign_id", campaignId)
        .eq("status", "failed");
      const retryable = (failed ?? []).filter((r: any) => {
        const e = String(r.error ?? "");
        return !/131049|131042|#200|מגבלת מעורבות|תשלום/.test(e);
      });
      if (retryable.length) {
        await admin.from("wa_warm_recipients")
          .update({ status: "pending", error: null })
          .in("id", retryable.map((r: any) => r.id));
      }
      await admin.from("wa_warm_campaigns").update({ status: "running", last_error: null })
        .eq("id", campaignId).eq("tenant_id", tenantId);
      await refreshCampaignStats(admin, campaignId);
      return reply({ success: true, requeued: retryable.length, skipped_non_retryable: (failed?.length || 0) - retryable.length });
    }

    if (action === "list_campaigns") {
      const { data } = await admin.from("wa_warm_campaigns")
        .select("id,name,status,stats,optin_template_name,audience_source,created_at,started_at,completed_at,daily_cap")
        .eq("tenant_id", tenantId)
        .eq("integration_id", integrationId)
        .order("created_at", { ascending: false })
        .limit(30);
      return reply({ success: true, campaigns: data ?? [] });
    }

    if (action === "get_campaign") {
      const campaignId = String(body.campaign_id ?? "");
      const { data: campaign } = await admin.from("wa_warm_campaigns")
        .select("*").eq("id", campaignId).eq("tenant_id", tenantId).maybeSingle();
      if (!campaign) return reply({ error: "campaign_not_found" }, 404);
      const { data: recipients } = await admin.from("wa_warm_recipients")
        .select("id,phone,contact_name,status,error,sent_at,opted_in_at,attempts")
        .eq("campaign_id", campaignId)
        .order("created_at", { ascending: false })
        .limit(200);
      return reply({ success: true, campaign, recipients: recipients ?? [] });
    }

    return reply({ error: "unsupported_action" }, 400);
  } catch (error) {
    console.error("meta-whatsapp-warm error", error);
    return reply({ error: error instanceof Error ? error.message : "unknown_error" }, 500);
  }
});
