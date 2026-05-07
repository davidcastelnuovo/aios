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

    if (req.method === "POST") {
      const ct = req.headers.get("content-type") || "";
      try {
        if (ct.includes("application/json")) Object.assign(params, await req.json());
        else if (ct.includes("form")) {
          const fd = await req.formData();
          fd.forEach((v, k) => { if (typeof v === "string") params[k] = v; });
        } else {
          const text = await req.text();
          if (text.startsWith("{")) Object.assign(params, JSON.parse(text));
        }
      } catch {}
    }

    const tenant_id = params.tenant_id;
    const secret = params.secret;
    if (!tenant_id) {
      return new Response(JSON.stringify({ error: "tenant_id required" }), { status: 400, headers: corsHeaders });
    }

    const { data: settings } = await supabase
      .from("maskyoo_settings").select("*").eq("tenant_id", tenant_id).maybeSingle();
    if (!settings) {
      return new Response(JSON.stringify({ error: "Tenant not configured" }), { status: 404, headers: corsHeaders });
    }
    if (settings.webhook_secret && settings.webhook_secret !== secret) {
      return new Response(JSON.stringify({ error: "Invalid secret" }), { status: 403, headers: corsHeaders });
    }

    const uniqueid = params.cdr_uniqueid || params.call_uuid || params.uniqueid;
    if (!uniqueid) {
      return new Response(JSON.stringify({ ok: true, ignored: true }), { status: 200, headers: corsHeaders });
    }

    const callerPhone = normalizePhone(params.cdr_ani || params.from);
    const calleePhone = normalizePhone(params.cdr_ddi || params.to);
    const targetPhone = calleePhone || callerPhone;

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

    const rawStatus = (params.call_status || params.status || "").toString().toUpperCase();
    const status = rawStatus.includes("ANSWERED") ? "completed"
      : rawStatus.includes("NO ANSWER") ? "no-answer"
      : rawStatus.includes("BUSY") ? "busy"
      : rawStatus.includes("RINGING") ? "ringing"
      : rawStatus.includes("FAILED") ? "failed" : "completed";

    const { data: existing } = await supabase
      .from("call_logs").select("id")
      .eq("tenant_id", tenant_id).eq("provider", "maskyoo")
      .eq("provider_call_id", uniqueid).maybeSingle();

    const payload: any = {
      tenant_id, provider: "maskyoo", provider_call_id: uniqueid,
      from_number: params.cdr_ani || null,
      to_number: params.cdr_ddi || null,
      duration: params.call_duration ? parseInt(params.call_duration) : null,
      status,
      notes: `Maskyoo webhook [${rawStatus}]`,
      lead_id, client_id,
    };

    if (existing) await supabase.from("call_logs").update(payload).eq("id", existing.id);
    else await supabase.from("call_logs").insert(payload);

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
