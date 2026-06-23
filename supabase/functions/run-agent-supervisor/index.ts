// run-agent-supervisor — routes a goal to one or more sub-agents and aggregates results.
// Body: { supervisor_agent_id, goal, context?, tenant_id, user_id? }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import { resolveModelId } from "../_shared/models.ts";
import { chatCompletion } from "../_shared/ai-gateway.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function jsonResponse(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function route(supervisor: any, children: any[], goal: string, context: any) {
  // Ask LLM to pick which child agent(s) should handle the goal.
  const childDescriptions = children
    .map((c, i) =>
      `${i + 1}. ${c.child.name} (id: ${c.child_agent_id}) — ${c.child.talent ?? c.child.system_prompt?.slice(0, 120) ?? ""}${c.routing_hint ? `\n   רמז ניתוב: ${c.routing_hint}` : ""}`,
    )
    .join("\n");

  const prompt = `אתה ה-Supervisor "${supervisor.name}". יש לך את הסוכנים-בנים הבאים:\n${childDescriptions}\n\nמטרה: ${goal}\n${context && Object.keys(context).length ? `קונטקסט: ${JSON.stringify(context)}\n` : ""}\nבחר את הסוכן המתאים ביותר (או יותר מאחד אם חיוני) והחזר JSON בפורמט: {"delegations":[{"agent_id":"<uuid>","sub_goal":"<טקסט>"}]}. אל תוסיף הסבר.`;

  const data = await chatCompletion({
    model: resolveModelId(supervisor.engine ?? "gemini-2.5-flash"),
    messages: [
      { role: "system", content: "אתה Supervisor שמנתב משימות לסוכנים מומחים. החזר JSON בלבד." },
      { role: "user", content: prompt },
    ],
    response_format: { type: "json_object" },
  });
  const content = data.choices?.[0]?.message?.content ?? "{}";
  let parsed: any;
  try { parsed = JSON.parse(content); } catch { parsed = { delegations: [] }; }
  return Array.isArray(parsed.delegations) ? parsed.delegations : [];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    const { supervisor_agent_id, goal, context, tenant_id, user_id } = body;
    if (!supervisor_agent_id || !goal || !tenant_id) {
      return jsonResponse({ error: "missing supervisor_agent_id/goal/tenant_id" }, 400);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: supervisor } = await supabase
      .from("ai_agents").select("*").eq("id", supervisor_agent_id).single();
    if (!supervisor) throw new Error("supervisor agent not found");

    const { data: children } = await supabase
      .from("agent_supervisors")
      .select("*, child:ai_agents!agent_supervisors_child_agent_id_fkey(id, name, talent, system_prompt)")
      .eq("supervisor_agent_id", supervisor_agent_id)
      .eq("enabled", true)
      .order("priority", { ascending: false });

    if (!children?.length) {
      return jsonResponse({ error: "no enabled child agents configured for this supervisor" }, 400);
    }

    // Create parent run
    const { data: parentRun, error: parentErr } = await supabase
      .from("agent_runs")
      .insert({
        tenant_id, agent_id: supervisor_agent_id, user_id: user_id ?? null,
        goal, context: context ?? {}, status: "running", max_steps: 1,
        trigger_source: "supervisor",
      }).select().single();
    if (parentErr) throw parentErr;

    const delegations = await route(supervisor, children, goal, context);

    if (!delegations.length) {
      await supabase.from("agent_runs").update({
        status: "failed",
        error_message: "router returned no delegations",
        completed_at: new Date().toISOString(),
      }).eq("id", parentRun.id);
      return jsonResponse({ ok: false, error: "no delegation chosen" }, 200);
    }

    // Invoke children in parallel
    const childResults = await Promise.all(delegations.map(async (d: any) => {
      const validChild = children.find((c: any) => c.child_agent_id === d.agent_id);
      if (!validChild) return { agent_id: d.agent_id, error: "child not authorized" };
      try {
        const { data, error } = await supabase.functions.invoke("run-ai-agent-v2", {
          body: {
            agent_id: d.agent_id,
            goal: d.sub_goal ?? goal,
            context: context ?? {},
            tenant_id,
            user_id: user_id ?? null,
            parent_run_id: parentRun.id,
            trigger_source: "supervisor_delegated",
          },
        });
        if (error) throw error;
        return { agent_id: d.agent_id, ...data };
      } catch (e: any) {
        return { agent_id: d.agent_id, error: String(e?.message ?? e) };
      }
    }));

    await supabase.from("agent_runs").update({
      status: "completed",
      final_answer: JSON.stringify(childResults).slice(0, 4000),
      completed_at: new Date().toISOString(),
    }).eq("id", parentRun.id);

    return jsonResponse({ ok: true, parent_run_id: parentRun.id, delegations: childResults });
  } catch (e: any) {
    console.error("[run-agent-supervisor]", e?.message);
    return jsonResponse({ error: String(e?.message ?? e) }, 500);
  }
});
