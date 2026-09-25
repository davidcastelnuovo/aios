/** Load recommendation + playbook and execute or verify. */

import {
  executeClientOpsPlaybook,
  loadPlaybookForSignal,
  runClientOperationVerification,
} from "./client-ops-playbooks.ts";

export async function runPlaybookForRecommendation(
  supabase: { from: (t: string) => any },
  args: {
    tenantId: string;
    recommendationId: string;
    actorUserId?: string | null;
    dryRun?: boolean;
  },
): Promise<Record<string, unknown>> {
  const { data: rec, error } = await supabase
    .from("client_operation_recommendations")
    .select("*, clients(name)")
    .eq("id", args.recommendationId)
    .eq("tenant_id", args.tenantId)
    .maybeSingle();
  if (error) throw error;
  if (!rec) return { ok: false, error: "not_found" };
  if (rec.linked_task_id && !args.dryRun) {
    return { ok: true, already_executed: true, task_id: rec.linked_task_id };
  }

  const signalKind = rec.signal_kind;
  if (!signalKind) return { ok: false, error: "missing_signal_kind" };

  const playbook = await loadPlaybookForSignal(supabase, args.tenantId, signalKind);
  if (!playbook) return { ok: false, error: "playbook_not_found", signal_kind: signalKind };

  const clientName = rec.clients?.name || "לקוח";
  return executeClientOpsPlaybook(supabase, {
    tenantId: args.tenantId,
    clientId: rec.client_id,
    clientName,
    recommendationId: rec.id,
    signalKind,
    problemSummary: rec.problem_summary || rec.title,
    evidence: (rec.evidence as Record<string, unknown>) || {},
    verificationPlan: playbook.verification_plan || [],
    assigneePolicy: playbook.assignee_policy,
    taskTemplate: playbook.task_template || {},
    actorUserId: args.actorUserId,
    dryRun: args.dryRun,
  });
}

export async function verifyRecommendation(
  supabase: { from: (t: string) => any },
  args: { tenantId: string; recommendationId: string },
): Promise<Record<string, unknown>> {
  const { data: rec, error } = await supabase
    .from("client_operation_recommendations")
    .select("*")
    .eq("id", args.recommendationId)
    .eq("tenant_id", args.tenantId)
    .maybeSingle();
  if (error) throw error;
  if (!rec) return { ok: false, error: "not_found" };

  const plan = (rec.verification_plan as Array<Record<string, unknown>>) || [];
  if (!plan.length) {
    const playbook = rec.signal_kind
      ? await loadPlaybookForSignal(supabase, args.tenantId, rec.signal_kind)
      : null;
    if (playbook?.verification_plan?.length) {
      plan.push(...playbook.verification_plan);
    }
  }

  const result = await runClientOperationVerification(supabase, {
    tenantId: args.tenantId,
    clientId: rec.client_id,
    signalKind: rec.signal_kind || "",
    evidence: (rec.evidence as Record<string, unknown>) || {},
    verificationPlan: plan,
  });

  await supabase
    .from("client_operation_recommendations")
    .update({
      last_verification_at: new Date().toISOString(),
      last_verification_result: result,
      status: result.passed ? "resolved" : rec.status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", rec.id);

  return { ok: true, ...result, carmen_guidance: (await loadPlaybookForSignal(
    supabase,
    args.tenantId,
    rec.signal_kind || "",
  ))?.carmen_guidance };
}
