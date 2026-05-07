import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function normalizePhone(p: string | null | undefined): string | null {
  if (!p) return null;
  let c = p.replace(/\D/g, "");
  if (c.startsWith("972")) c = "0" + c.slice(3);
  return c;
}

// Public webhook to receive real-time call events from Maskyoo.
// Configure URL in Maskyoo as: https://<project>.supabase.co/functions/v1/maskyoo-webhook?tenant_id=<UUID>&secret=<SECRET>
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const url = new URL(req.url);

    // Collect params from query and body
    const params: Record<string, any> = {};
    url.searchParams.forEach((v, k) => { params[k] = v; });

    const logRequest = (stage: string) => {
      const safeParams = { ...params };
      if (safeParams.secret) safeParams.secret = "[redacted]";
      console.info("maskyoo-webhook trace", JSON.stringify({ stage, method: req.method, path: url.pathname, params: safeParams }));
    };

    // Maskyoo bug: their template appends ?event=hangup after our URL that already
    // ends with ?tenant_id=..., producing tenant_id=UUID?event=hangup. Split it back.
    if (typeof params.tenant_id === "string" && params.tenant_id.includes("?")) {
      const [realTenant, extra] = params.tenant_id.split("?", 2);
      params.tenant_id = realTenant;
      if (extra) {
        for (const pair of extra.split("&")) {
          const [k, v] = pair.split("=");
          if (k && !(k in params)) params[k] = decodeURIComponent(v || "");
        }
      }
    }

    if (req.method === "POST") {
      const ct = req.headers.get("content-type") || "";
      try {
        if (ct.includes("application/json")) Object.assign(params, await req.json());
        else if (ct.includes("form")) {
          const fd = await req.formData();
          fd.forEach((v, k) => { if (typeof v === "string") params[k] = v; });
        } else {
          const text = await req.text();
          if (text.trim().startsWith("{")) Object.assign(params, JSON.parse(text));
          else if (text.includes("=")) {
            const bodyParams = new URLSearchParams(text);
            bodyParams.forEach((v, k) => { params[k] = v; });
          }
        }
      } catch {}
    }

    logRequest("received");

    const tenant_id = params.tenant_id;
    const secret = params.secret;
    if (!tenant_id) {
      return new Response(JSON.stringify({ error: "tenant_id required" }), { status: 400, headers: corsHeaders });
    }

    const { data: settings } = await supabase
      .from("maskyoo_settings").select("*").eq("tenant_id", tenant_id).maybeSingle();
    if (!settings) {
      return new Response(JSON.stringify({ error: "Tenant not configured", tenant_id }), { status: 404, headers: corsHeaders });
    }
    if (settings.webhook_secret && settings.webhook_secret !== secret) {
      return new Response(JSON.stringify({ error: "Invalid secret" }), { status: 403, headers: corsHeaders });
    }

    const uniqueid = params.cdr_uniqueid || params.call_uuid || params.uniqueid || params.uuid;
    if (!uniqueid) {
      return new Response(JSON.stringify({ ok: true, ignored: true }), { status: 200, headers: corsHeaders });
    }

    // Maskyoo template: cli=caller, destination/maskyoo=called number
    const callerPhone = normalizePhone(params.cdr_ani || params.from || params.cli_unformatted || params.cli);
    const calleePhone = normalizePhone(params.cdr_ddi || params.to || params.destination_unformatted || params.destination || params.maskyoo);
    const targetPhone = callerPhone || calleePhone;

    let lead_id: string | null = null, client_id: string | null = null;
    if (targetPhone) {
      const last9 = targetPhone.slice(-9);
      const { data: lead } = await supabase.from("leads").select("id")
        .eq("tenant_id", tenant_id).ilike("phone", `%${last9}`).maybeSingle();
      if (lead) lead_id = lead.id;
      if (!lead_id) {
        const { data: client } = await supabase.from("clients").select("id")
          .eq("tenant_id", tenant_id).ilike("phone", `%${last9}`).maybeSingle();
        if (client) client_id = client.id;
      }
    }

    // Auto-register / lookup the Maskyoo called number (DID).
    // Allows the user to map numbers to clients/categories and to ignore some.
    if (calleePhone) {
      const calleeLast9 = calleePhone.slice(-9);
      const { data: knownNumber } = await supabase
        .from("maskyoo_numbers")
        .select("id, client_id, is_ignored, label")
        .eq("tenant_id", tenant_id)
        .eq("phone_last9", calleeLast9)
        .maybeSingle();

      if (knownNumber?.is_ignored) {
        console.info("maskyoo-webhook: ignored number", { calleeLast9 });
        return new Response(JSON.stringify({ ok: true, ignored: true, reason: "number_ignored" }), { status: 200, headers: corsHeaders });
      }

      if (knownNumber?.client_id && !client_id) {
        client_id = knownNumber.client_id;
      }

      // Try to capture the human-friendly name configured for this DID inside Maskyoo.
      const maskyooName: string | null =
        params.did_name || params.cdr_did_name || params.cdr_ddi_name ||
        params.destination_name || params.ddi_name || params.line_name || null;

      if (!knownNumber) {
        await supabase.from("maskyoo_numbers").insert({
          tenant_id,
          phone_last9: calleeLast9,
          display_number: params.cdr_ddi || params.destination || params.maskyoo || calleePhone,
          label: maskyooName,
          category: "general",
        });
      } else if (maskyooName && !knownNumber.label) {
        // Backfill the Maskyoo display name once we receive it.
        await supabase.from("maskyoo_numbers").update({ label: maskyooName }).eq("id", knownNumber.id);
      }
    }

    const { data: tenantUser } = await supabase
      .from("tenant_users")
      .select("user_id")
      .eq("tenant_id", tenant_id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!tenantUser?.user_id) {
      console.error("maskyoo-webhook save blocked: no tenant user", { tenant_id });
      return new Response(JSON.stringify({ error: "No tenant user found", tenant_id }), { status: 422, headers: corsHeaders });
    }

    const rawStatus = (params.call_status || params.status || "").toString().toUpperCase();
    const status = rawStatus.includes("ANSWER") && !rawStatus.includes("NO") ? "completed"
      : rawStatus.includes("NO ANSWER") || rawStatus === "NOANSWER" ? "no-answer"
      : rawStatus.includes("BUSY") ? "busy"
      : rawStatus.includes("RINGING") ? "ringing"
      : rawStatus.includes("FAILED") ? "failed" : "completed";

    const { data: existing } = await supabase
      .from("call_logs").select("id")
      .eq("tenant_id", tenant_id).eq("provider", "maskyoo")
      .eq("provider_call_id", uniqueid).maybeSingle();

    const recording = params.recording || params.recording_url || null;
    const noteParts = [`Maskyoo [${rawStatus}]`];
    if (params.event) noteParts.push(`event=${params.event}`);
    if (recording) noteParts.push(`recording=${recording}`);

    const payload: any = {
      tenant_id, provider: "maskyoo", provider_call_id: uniqueid,
      caller_user_id: tenantUser.user_id,
      from_number: params.cdr_ani || params.cli || params.cli_unformatted || null,
      to_number: params.cdr_ddi || params.destination || params.maskyoo || null,
      duration: params.call_duration || params.duration ? parseInt(params.call_duration || params.duration) : null,
      status,
      recording_url: recording,
      notes: noteParts.join(" | "),
      lead_id, client_id,
    };

    const { error: saveError } = existing
      ? await supabase.from("call_logs").update(payload).eq("id", existing.id)
      : await supabase.from("call_logs").insert(payload);
    if (saveError) {
      console.error("maskyoo-webhook save error:", saveError);
      return new Response(JSON.stringify({ error: "Failed to save call log", details: saveError.message }), { status: 500, headers: corsHeaders });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("maskyoo-webhook error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
