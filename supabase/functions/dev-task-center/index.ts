import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import { requireAuth } from "../_shared/security.ts";
import {
  approveDevTask,
  attachDevTaskSession,
  createDevTask,
  dispatchDevTask,
  findDuplicateDevTasks,
  logDevTaskEvent,
  type DevTaskBrief,
} from "../_shared/dev-tasks.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const auth = await requireAuth(req);
    if (!auth.ok) {
      return new Response(JSON.stringify({ error: auth.error }), {
        status: auth.status,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "");
    const tenantId = String(body.tenant_id || "").trim();
    if (!tenantId) {
      return new Response(JSON.stringify({ error: "tenant_id required" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const userId = auth.kind === "user" ? auth.userId : null;

    if (action === "list") {
      let q = supabase.from("dev_tasks").select("*").eq("tenant_id", tenantId).order("updated_at", { ascending: false });
      if (body.status) q = q.eq("status", body.status);
      if (body.priority) q = q.eq("priority", body.priority);
      const limit = Math.min(Number(body.limit) || 50, 100);
      const { data, error } = await q.limit(limit);
      if (error) throw error;
      return json({ tasks: data || [] });
    }

    if (action === "get") {
      const id = String(body.id || "");
      const { data, error } = await supabase
        .from("dev_tasks")
        .select("*")
        .eq("id", id)
        .eq("tenant_id", tenantId)
        .maybeSingle();
      if (error) throw error;
      const { data: events } = await supabase
        .from("dev_task_events")
        .select("*")
        .eq("dev_task_id", id)
        .order("created_at", { ascending: false })
        .limit(30);
      return json({ task: data, events: events || [] });
    }

    if (action === "find_duplicates") {
      const title = String(body.title || "").trim();
      if (!title) return json({ duplicates: [] });
      const duplicates = await findDuplicateDevTasks(supabase, tenantId, title);
      return json({ duplicates });
    }

    if (action === "create") {
      const brief = body.brief as DevTaskBrief;
      if (!brief?.title?.trim()) throw new Error("brief.title required");
      const duplicates = await findDuplicateDevTasks(supabase, tenantId, brief.title);
      const task = await createDevTask(supabase, {
        tenantId,
        brief,
        priority: body.priority,
        assignedAgent: body.assigned_agent,
        requestedByUserId: userId,
        sourceConversationId: body.source_conversation_id,
        sourceMessage: body.source_message,
        dedupOf: body.dedup_of,
        actorUserId: userId,
      });
      return json({ task, possible_duplicates: duplicates.slice(0, 5) });
    }

    if (action === "update") {
      const id = String(body.id || "");
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      for (const key of [
        "title", "problem", "expected_behavior", "current_behavior", "scope",
        "affected_areas", "constraints", "acceptance_criteria", "base_branch",
        "environment", "priority", "status", "assigned_agent", "pr_url", "owner_user_id",
      ]) {
        if (body[key] !== undefined) patch[key] = body[key];
      }
      const { data, error } = await supabase
        .from("dev_tasks")
        .update(patch)
        .eq("id", id)
        .eq("tenant_id", tenantId)
        .select("*")
        .single();
      if (error) throw error;
      await logDevTaskEvent(supabase, {
        devTaskId: id,
        tenantId,
        eventType: "updated",
        actorUserId: userId,
        detail: patch,
      });
      return json({ task: data });
    }

    if (action === "approve") {
      const task = await approveDevTask(supabase, tenantId, String(body.id), userId!);
      return json({ task });
    }

    if (action === "dispatch") {
      const result = await dispatchDevTask(supabase, {
        tenantId,
        taskId: String(body.id),
        actorUserId: userId,
      });
      return json(result);
    }

    if (action === "attach_session") {
      const task = await attachDevTaskSession(supabase, {
        tenantId,
        taskId: String(body.id),
        cursorSessionId: String(body.cursor_session_id),
        cursorSessionUrl: body.cursor_session_url,
        actorUserId: userId,
      });
      return json({ task });
    }

    if (action === "cancel") {
      const id = String(body.id || "");
      const { data, error } = await supabase
        .from("dev_tasks")
        .update({ status: "cancelled", updated_at: new Date().toISOString() })
        .eq("id", id)
        .eq("tenant_id", tenantId)
        .select("*")
        .single();
      if (error) throw error;
      await logDevTaskEvent(supabase, { devTaskId: id, tenantId, eventType: "cancelled", actorUserId: userId });
      return json({ task: data });
    }

    if (action === "mark_done") {
      const id = String(body.id || "");
      const { data, error } = await supabase
        .from("dev_tasks")
        .update({ status: "done", updated_at: new Date().toISOString() })
        .eq("id", id)
        .eq("tenant_id", tenantId)
        .select("*")
        .single();
      if (error) throw error;
      await logDevTaskEvent(supabase, { devTaskId: id, tenantId, eventType: "done", actorUserId: userId });
      return json({ task: data });
    }

    return new Response(JSON.stringify({ error: `unknown action: ${action}` }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    console.error("[dev-task-center]", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});

function json(payload: unknown) {
  return new Response(JSON.stringify(payload), {
    headers: { ...cors, "Content-Type": "application/json" },
  });
}
