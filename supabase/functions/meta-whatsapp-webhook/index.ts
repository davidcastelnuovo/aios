import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import {
  collectWebhookMessages,
  digitsOnly,
  messageText,
  normalizedPhoneCandidates,
} from "../_shared/meta-whatsapp.ts";

const jsonHeaders = { "Content-Type": "application/json" };

async function validSignature(rawBody: string, signature: string, appSecret: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(appSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign("HMAC", key, encoder.encode(rawBody));
  const expected =
    "sha256=" +
    Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  if (signature.length !== expected.length) return false;
  let difference = 0;
  for (let index = 0; index < expected.length; index++) {
    difference |= signature.charCodeAt(index) ^ expected.charCodeAt(index);
  }
  return difference === 0;
}

const timestampIso = (value: unknown) => {
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds <= 0) return new Date().toISOString();
  return new Date(seconds * 1000).toISOString();
};

Deno.serve(async (request) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const appSecret = Deno.env.get("META_APP_SECRET") ?? Deno.env.get("FACEBOOK_APP_SECRET") ?? "";
  const verifyToken = Deno.env.get("META_WHATSAPP_WEBHOOK_VERIFY_TOKEN") ?? "";

  if (request.method === "GET") {
    const url = new URL(request.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    if (verifyToken && mode === "subscribe" && token === verifyToken && challenge) {
      return new Response(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
    }
    return new Response("Forbidden", { status: 403 });
  }
  if (request.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
  if (!supabaseUrl || !serviceKey || !appSecret || !verifyToken) {
    console.error("Meta WhatsApp webhook secrets are not configured");
    return new Response("Webhook not configured", { status: 503 });
  }

  const rawBody = await request.text();
  const signature = request.headers.get("x-hub-signature-256") ?? "";
  if (!(await validSignature(rawBody, signature, appSecret))) {
    return new Response("Invalid signature", { status: 403 });
  }

  try {
    const payload = JSON.parse(rawBody);
    if (payload.object !== "whatsapp_business_account") {
      return new Response(JSON.stringify({ received: true, ignored: true }), { headers: jsonHeaders });
    }
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    let processed = 0;

    for (const entry of payload.entry ?? []) {
      for (const change of entry.changes ?? []) {
        const value = change.value ?? {};
        const field = String(change.field ?? "");

        if (field === "account_update") {
          const disconnected = ["PARTNER_REMOVED", "ACCOUNT_OFFBOARDED"].includes(String(value.event ?? ""));
          const { data: wabaIntegrations, error: wabaError } = await admin
            .from("tenant_integrations")
            .select("id,settings")
            .eq("integration_type", "meta_whatsapp")
            .filter("settings->>waba_id", "eq", String(entry.id));
          if (wabaError) throw wabaError;
          const eventPhone = digitsOnly(value.phone_number);
          const affectedIntegrations = eventPhone
            ? (wabaIntegrations ?? []).filter(
                (row) => digitsOnly((row.settings as Record<string, any> | null)?.display_phone_number) === eventPhone,
              )
            : (wabaIntegrations ?? []);
          for (const row of affectedIntegrations) {
            const rowSettings = (row.settings ?? {}) as Record<string, any>;
            const { error: updateError } = await admin
              .from("tenant_integrations")
              .update({
                ...(disconnected ? { is_active: false } : {}),
                settings: {
                  ...rowSettings,
                  account_update_event: value.event ?? null,
                  account_update_at: new Date().toISOString(),
                  ...(disconnected
                    ? {
                        disconnected_at: new Date().toISOString(),
                        disconnection_info: value.disconnection_info ?? null,
                      }
                    : {}),
                },
              })
              .eq("id", row.id);
            if (updateError) throw updateError;
          }
          continue;
        }

        const phoneNumberId = String(value.metadata?.phone_number_id ?? "");
        if (!phoneNumberId) continue;

        const { data: integration, error: integrationError } = await admin
          .from("tenant_integrations")
          .select("*")
          .eq("integration_type", "meta_whatsapp")
          .eq("is_active", true)
          .filter("settings->>phone_number_id", "eq", phoneNumberId)
          .maybeSingle();
        if (integrationError) throw integrationError;
        if (!integration) {
          console.warn("No active Meta WhatsApp integration for phone_number_id", phoneNumberId);
          continue;
        }
        const settings = (integration.settings ?? {}) as Record<string, any>;

        if (field === "smb_app_state_sync") {
          const { error: syncUpdateError } = await admin
            .from("tenant_integrations")
            .update({
              settings: {
                ...settings,
                contacts_sync_last_event_at: new Date().toISOString(),
                contacts_sync_last_count: Array.isArray(value.state_sync) ? value.state_sync.length : 0,
              },
            })
            .eq("id", integration.id);
          if (syncUpdateError) throw syncUpdateError;
          continue;
        }

        const contactNames = new Map<string, string>();
        for (const contact of value.contacts ?? []) {
          if (contact.wa_id) contactNames.set(String(contact.wa_id), String(contact.profile?.name ?? ""));
        }

        for (const item of collectWebhookMessages(value, field)) {
          const messageId = String(item.message.id);
          const { data: duplicate } = await admin
            .from("chat_messages")
            .select("id")
            .eq("tenant_id", integration.tenant_id)
            .eq("raw_provider_data->>idMessage", messageId)
            .limit(1)
            .maybeSingle();
          if (duplicate) continue;

          const candidates = normalizedPhoneCandidates(item.peerPhone);
          const suffix = candidates.find((candidate) => candidate.length === 9) ?? candidates[0] ?? "";
          let clientId: string | null = null;
          let leadId: string | null = null;
          if (suffix) {
            const { data: client, error: clientError } = await admin
              .from("clients")
              .select("id")
              .eq("tenant_id", integration.tenant_id)
              .ilike("phone", `%${suffix}%`)
              .limit(1)
              .maybeSingle();
            if (clientError) throw clientError;
            clientId = client?.id ?? null;
            if (!clientId) {
              const { data: lead, error: leadError } = await admin
                .from("leads")
                .select("id")
                .eq("tenant_id", integration.tenant_id)
                .ilike("phone", `%${suffix}%`)
                .limit(1)
                .maybeSingle();
              if (leadError) throw leadError;
              leadId = lead?.id ?? null;
            }
          }

          const blockQuery = admin
            .from("blocked_contacts")
            .select("id")
            .eq("tenant_id", integration.tenant_id)
            .eq("connection_user_id", integration.user_id);
          if (clientId) blockQuery.eq("client_id", clientId);
          else if (leadId) blockQuery.eq("lead_id", leadId);
          else blockQuery.eq("sender_phone", item.peerPhone);
          const { data: blocked, error: blockedError } = await blockQuery.limit(1).maybeSingle();
          if (blockedError) throw blockedError;
          if (blocked) continue;

          const rawProviderData = {
            ...item.message,
            idMessage: messageId,
            webhook_field: field,
            webhook_source: item.source,
            phone_number_id: phoneNumberId,
            waba_id: entry.id,
          };
          const { error: insertError } = await admin.from("chat_messages").insert({
            client_id: clientId,
            lead_id: leadId,
            tenant_id: integration.tenant_id,
            connection_user_id: integration.user_id,
            integration_id: integration.id,
            message_text: messageText(item.message),
            direction: item.direction,
            channel: "whatsapp",
            provider: "meta_whatsapp",
            sender_phone: item.peerPhone,
            sender_name: contactNames.get(item.peerPhone) || null,
            is_blocked: false,
            created_at: timestampIso(item.message.timestamp),
            raw_provider_data: rawProviderData,
          });
          if (insertError) {
            console.error("Failed to store Meta WhatsApp message", insertError);
            throw insertError;
          }
          processed++;
        }

        if (field === "history") {
          const history = Array.isArray(value.history) ? value.history : [];
          const lastChunk = history.at(-1);
          const { error: historyUpdateError } = await admin
            .from("tenant_integrations")
            .update({
              settings: {
                ...settings,
                history_sync_last_event_at: new Date().toISOString(),
                history_sync_progress: lastChunk?.metadata?.progress ?? settings.history_sync_progress ?? null,
                history_sync_error: lastChunk?.errors?.[0]?.message ?? null,
              },
            })
            .eq("id", integration.id);
          if (historyUpdateError) throw historyUpdateError;
        }
      }
    }

    return new Response(JSON.stringify({ received: true, processed }), { headers: jsonHeaders });
  } catch (error) {
    console.error("meta-whatsapp-webhook error", error);
    return new Response(JSON.stringify({ received: true, error: "processing_failed" }), {
      status: 500,
      headers: jsonHeaders,
    });
  }
});
