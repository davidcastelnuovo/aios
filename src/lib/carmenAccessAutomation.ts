import { supabase } from "@/integrations/supabase/client";

export type CarmenAutomationConfig = Record<string, unknown> & {
  agent_id?: string;
  carmen_allowed_phones?: string[];
  carmen_allowed_group_ids?: string[];
  carmen_allowed_group_id?: string;
  carmen_open_member_groups?: boolean;
  carmen_scope_mode?: string;
};

export type ManusGroupRow = {
  id: string;
  group_name: string;
  group_chat_id: string;
};

function normalizePhone(p: string) {
  return (p || "").replace(/\D/g, "");
}

export async function fetchCarmenAutomationConfig(
  tenantId: string,
  agentId: string,
): Promise<CarmenAutomationConfig | null> {
  const { data: steps, error } = await supabase
    .from("automation_flow_steps")
    .select("configuration")
    .eq("tenant_id", tenantId)
    .eq("step_type", "trigger")
    .eq("action_type", "carmen_whatsapp_session");
  if (error) throw error;
  const cfg = (steps || [])
    .map((s: { configuration?: CarmenAutomationConfig }) => s.configuration)
    .find((c) => c?.agent_id === agentId || !c?.agent_id);
  return cfg || ((steps?.[0] as { configuration?: CarmenAutomationConfig })?.configuration ?? null);
}

export function resolveAutomationGroupIds(
  cfg: CarmenAutomationConfig,
  manusGroups: ManusGroupRow[],
): string[] {
  const refs: string[] = cfg.carmen_allowed_group_ids?.length
    ? cfg.carmen_allowed_group_ids
    : (cfg.carmen_allowed_group_id ? [cfg.carmen_allowed_group_id] : []);
  if (!refs.length) return [];
  return (manusGroups || [])
    .filter((g) => refs.includes(g.group_chat_id) || refs.includes(g.id))
    .map((g) => g.id);
}

export function buildPolicyFromAutomation(
  cfg: CarmenAutomationConfig,
  manusGroups: ManusGroupRow[],
  options?: { hasManusIntegration?: boolean },
) {
  const phones = (cfg.carmen_allowed_phones || []).map((p: string) => ({
    phone: normalizePhone(p),
    surfaces: ["whatsapp_private"],
  }));
  const groupIds = resolveAutomationGroupIds(cfg, manusGroups);
  const scopeMode = cfg.carmen_scope_mode || "all";
  const openMemberGroups = cfg.carmen_open_member_groups === true
    || (options?.hasManusIntegration === true
      && scopeMode !== "private_only"
      && scopeMode !== "specific_phone");
  return {
    phones,
    groupIds,
    openMemberGroups,
    requireDirectAddress: true,
  };
}
