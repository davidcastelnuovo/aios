// resume-agent-run — apply approval decision, log the outcome on the action trace,
// and re-invoke run-ai-agent-v2 to continue the ReAct loop from the next step.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { approval_id, decision, reviewer_id } = await req.json();
    if (!approval_id || !decision || !["approved", "rejected"].includes(decision)) {
      return new Response(JSON.stringify({ error: "missing/invalid params" }), {
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

    if (approval.status !== "pending") {
      return new Response(JSON.stringify({ ok: false, error: "approval already decided", status: approval.status }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let executionResult: any = null;

    if (decision === "approved" && approval.tool_name === "create_automation") {
      // Carmen authoring: route to carmen-approval-execute, which materializes the
      // (disabled) flow automation from the approved spec. Kept as an explicit
      // special-case so no other tool's behavior changes.
      try {
        const { data, error } = await supabase.functions.invoke("carmen-approval-execute", {
          body: { approval_id, approved_by: reviewer_id ?? null },
        });
        executionResult = error ? { ok: false, error: String(error?.message ?? error) } : (data ?? { ok: true });
      } catch (e: any) {
        executionResult = { ok: false, error: String(e?.message ?? e) };
      }
    } else if (decision === "approved" && approval.tool_name) {
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
            body: {
              ...(approval.tool_input ?? {}),
              _approval_id: approval_id,
              _run_id: approval.run_id,
              _tenant_id: approval.tenant_id,
              _agent_id: approval.agent_id,
            },
          });
          if (error) throw error;
          executionResult = data ?? { ok: true };
        } catch (e: any) {
          executionResult = { ok: false, error: String(e?.message ?? e) };
        }
      } else {
        executionResult = { ok: true, note: "no handler — manual or internal tool" };
      }
    } else if (decision === "rejected") {
      executionResult = { ok: false, rejected: true, reason: "Rejected by reviewer" };
    }

    // Persist the approval decision
    await supabase
      .from("agent_approval_queue")
      .update({
        status: decision === "approved" ? "executed" : "rejected",
        approved_by: reviewer_id ?? null,
        approved_at: new Date().toISOString(),
        executed_at: decision === "approved" ? new Date().toISOString() : null,
        execution_result: executionResult,
      })
      .eq("id", approval_id);

    // If the approval belongs to a run, attach the observation to the pending step
    // so the run can be reconstructed cleanly when v2 resumes.
    if (approval.run_id) {
      const { data: pendingLog } = await supabase
        .from("agent_action_log")
        .select("id, step_index")
        .eq("run_id", approval.run_id)
        .eq("step_kind", "approval_pending")
        .order("step_index", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (pendingLog) {
        // Promote the pending step to a regular tool step with the execution result
        await supabase
          .from("agent_action_log")
          .update({
            step_kind: "tool",
            observation: executionResult,
            status: executionResult?.ok === false ? "error" : "success",
            action_type: "tool",
          })
          .eq("id", pendingLog.id);
      }

      // Continue the ReAct loop
      const { data: continueResult, error: contErr } = await supabase.functions.invoke(
        "run-ai-agent-v2",
        { body: { run_id: approval.run_id, tenant_id: approval.tenant_id } },
      );
      if (contErr) {
        await supabase.from("agent_runs")
          .update({ status: "failed", error_message: `resume failed: ${contErr.message}` })
          .eq("id", approval.run_id);
      }
      return new Response(JSON.stringify({ ok: true, executionResult, continued: continueResult }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Log standalone (legacy approval without run)
    await supabase.from("agent_action_log").insert({
      tenant_id: approval.tenant_id,
      agent_id: approval.agent_id,
      action_type: `approval_${decision}`,
      action_details: { tool_name: approval.tool_name, result: executionResult },
      status: executionResult?.ok === false ? "error" : "success",
    });

    return new Response(JSON.stringify({ ok: true, executionResult }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[resume-agent-run] error:", e?.message);
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
