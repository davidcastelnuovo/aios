import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { approval_id, decision } = await req.json();
    if (!approval_id || !decision) {
      return new Response(JSON.stringify({ error: "missing params" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: approval, error: aErr } = await supabase
      .from("agent_approval_queue")
      .select("*")
      .eq("id", approval_id)
      .single();
    if (aErr || !approval) throw aErr ?? new Error("not found");

    let executionResult: any = null;

    if (decision === "approved" && approval.tool_name) {
      // Look up the tool handler
      const { data: tool } = await supabase
        .from("agent_tools")
        .select("*")
        .or(`tenant_id.eq.${approval.tenant_id},tenant_id.is.null`)
        .eq("name", approval.tool_name)
        .maybeSingle();

      if (tool?.handler_kind === "edge" && tool.handler_ref) {
        try {
          const { data, error } = await supabase.functions.invoke(tool.handler_ref, {
            body: { ...(approval.tool_input ?? {}), _approval_id: approval_id, _run_id: approval.run_id },
          });
          if (error) throw error;
          executionResult = { ok: true, data };
        } catch (e: any) {
          executionResult = { ok: false, error: String(e?.message ?? e) };
        }
      } else {
        executionResult = { ok: true, note: "no handler — manual or internal tool" };
      }

      await supabase
        .from("agent_approval_queue")
        .update({
          status: "executed",
          executed_at: new Date().toISOString(),
          execution_result: executionResult,
        })
        .eq("id", approval_id);
    }

    // Log
    await supabase.from("agent_action_log").insert({
      tenant_id: approval.tenant_id,
      agent_id: approval.agent_id,
      action_type: `approval_${decision}`,
      action_details: { tool_name: approval.tool_name, run_id: approval.run_id, result: executionResult },
      status: executionResult?.ok === false ? "error" : "success",
      run_id: approval.run_id,
    });

    return new Response(JSON.stringify({ ok: true, executionResult }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
