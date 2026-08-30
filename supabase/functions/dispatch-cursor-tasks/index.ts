// Cron / manual worker: claim open human tasks assigned to Cursor and dispatch to cursor-mcp.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import { claimAndDispatchCursorTask } from "../_shared/cursor-task-queue.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let body: { tenant_id?: string } = {};
  try { body = await req.json(); } catch { /* cron may send empty body */ }

  const tenantId = String(
    body.tenant_id ||
      Deno.env.get("CURSOR_DEFAULT_TENANT_ID") ||
      "2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019",
  ).trim();

  try {
    const result = await claimAndDispatchCursorTask(supabase, tenantId);
    return new Response(JSON.stringify({ ok: true, tenant_id: tenantId, dispatched: result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[dispatch-cursor-tasks]", e?.message ?? e);
    return new Response(JSON.stringify({ ok: false, error: String(e?.message ?? e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
