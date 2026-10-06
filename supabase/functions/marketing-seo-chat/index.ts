import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAuth } from "../_shared/security.ts";
import { materializeSeoGeoPlan, syncTrackedKeywords } from "../_shared/seo-geo-materialize.ts";
import { buildSkillsBlockBySlug } from "../_shared/skills/registry.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const respond = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  try {
    const auth = await requireAuth(req);
    if (!auth) return respond({ error: "Unauthorized" }, 401);
    const { work_item_id, message } = await req.json();
    if (!work_item_id || !message?.trim()) return respond({ error: "work_item_id and message required" }, 400);

    const { data: item } = await admin.from("marketing_work_items").select("*").eq("id", work_item_id).single();
    if (!item) return respond({ error: "Not found" }, 404);
    if (auth.kind === "user") {
      const { data: membership } = await admin.from("tenant_users").select("user_id").eq("tenant_id", item.tenant_id).eq("user_id", auth.userId).maybeSingle();
      if (!membership) return respond({ error: "Forbidden" }, 403);
    }

    const text = String(message).trim().toLowerCase();
    const actions: string[] = [];

    if (/אשר\s*(ה)?כול|אישור\s*אוטומטי|כרמן\s*תאשר/.test(text)) {
      if (item.client_id) {
        await admin.from("seo_geo_programs").upsert({
          tenant_id: item.tenant_id,
          client_id: item.client_id,
          work_item_id,
          auto_approve: true,
        }, { onConflict: "work_item_id" });
      }
      await admin.from("seo_geo_calendar_entries").update({
        approval_status: "auto_approved",
        approved_at: new Date().toISOString(),
        approved_by_carmen: true,
      }).eq("work_item_id", work_item_id).eq("approval_status", "pending");
      actions.push("auto_approved_pending_entries");
    }

    if (/סנכרן\s*ביטויים|מעקב\s*מיקומים|ahrefs/.test(text)) {
      if (item.client_id) {
        const n = await syncTrackedKeywords(admin, { workItemId: work_item_id, tenantId: item.tenant_id, clientId: item.client_id });
        actions.push(`synced_tracked_keywords:${n}`);
      }
    }

    if (/גאנט|לוח\s*שנה|תוכנית\s*תוכן/.test(text) && (item.payload as Record<string, unknown>)?.seo_plan) {
      const { data: program } = await admin.from("seo_geo_programs").select("auto_approve,horizon_months").eq("work_item_id", work_item_id).maybeSingle();
      const stats = await materializeSeoGeoPlan(admin, {
        workItemId: work_item_id,
        tenantId: item.tenant_id,
        clientId: item.client_id!,
        plan: (item.payload as Record<string, unknown>).seo_plan as Record<string, unknown>,
        autoApprove: !!program?.auto_approve,
        horizonMonths: program?.horizon_months ?? 3,
        replaceExisting: true,
      });
      actions.push(`materialized:${stats.entries}`);
    }

    const { data: integration } = await admin.from("tenant_integrations").select("settings,shared_from_integration_id").eq("tenant_id", item.tenant_id).eq("integration_type", "llm").eq("is_active", true).limit(1).maybeSingle();
    let settings = (integration?.settings ?? {}) as Record<string, string>;
    if (integration?.shared_from_integration_id && !settings.openai_api_key) {
      const { data: source } = await admin.from("tenant_integrations").select("settings").eq("id", integration.shared_from_integration_id).maybeSingle();
      settings = (source?.settings ?? settings) as Record<string, string>;
    }
    const skinBlock = await buildSkillsBlockBySlug(["seo"], item.tenant_id);

    let reply = actions.length ? `בוצע: ${actions.join(", ")}` : "לא זיהיתי פעולה אוטומטית — הנה תשובה:";
    if (settings.openai_api_key) {
      const ai = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${settings.openai_api_key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          temperature: 0.4,
          messages: [
            { role: "system", content: `${skinBlock}\n\nאת כרמן SEO/GEO. עני בעברית, קצר. אם המשתמש מבקש פעולה ידנית — הסבירי מה ללחוץ בממשק.` },
            { role: "user", content: message },
          ],
        }),
      });
      if (ai.ok) {
        const data = await ai.json();
        reply = String(data.choices?.[0]?.message?.content ?? reply);
      }
    }

    return respond({ reply, actions });
  } catch (error) {
    console.error("marketing-seo-chat", error);
    return respond({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
