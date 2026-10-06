import { supabase } from "@/integrations/supabase/client";
import { mergePrivatePhoneAllowlist as mergePrivatePhoneAllowlistCore } from "./carmenPrivatePhoneAllowlist.mjs";

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

  const configs = (steps || [])
    .map((s: { configuration?: CarmenAutomationConfig }) => s.configuration)
    .filter((c): c is CarmenAutomationConfig => !!c)
    .filter((c) => !c.agent_id || c.agent_id === agentId);

  if (!configs.length) return null;

  // Prefer the private-phone trigger when Carmen has both a private and a group
  // trigger — otherwise an unordered `.find()` can pick the group-only step and
  // the Agent Hub allowlist looks empty even though private replies work.
  const withPhones = configs.filter((c) => (c.carmen_allowed_phones || []).length > 0);
  const preferred = withPhones[0] || configs[0];
  const mergedPhones = [...new Set(
    configs.flatMap((c) => (c.carmen_allowed_phones || []).map((p) => String(p).replace(/\D/g, "")).filter(Boolean)),
  )];

  return {
    ...preferred,
    carmen_allowed_phones: mergedPhones.length ? mergedPhones : preferred.carmen_allowed_phones,
  };
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
) {
  const phones = (cfg.carmen_allowed_phones || []).map((p: string) => ({
    phone: normalizePhone(p),
    surfaces: ["whatsapp_private"],
    source: "automation" as const,
  }));
  const groupIds = resolveAutomationGroupIds(cfg, manusGroups);
  return {
    phones,
    groupIds,
    openMemberGroups: cfg.carmen_open_member_groups === true,
    requireDirectAddress: true,
  };
}

export type PrivatePhoneRow = {
  phone: string;
  label?: string;
  status?: string;
  source?: "policy" | "identity" | "automation";
  dev_escalation_tier?: "full" | "bugfix" | null;
  surfaces?: string[];
};

type IdentityRow = {
  phone: string;
  display_name?: string | null;
  status?: string;
  surfaces?: string[] | null;
  dev_escalation_tier?: string | null;
};

/** Merge all sources that grant private WhatsApp access for display in Agent Hub. */
export function mergePrivatePhoneAllowlist(params: {
  policyPhones?: PrivatePhoneRow[];
  identities?: IdentityRow[];
  automationPhones?: string[];
}): PrivatePhoneRow[] {
  return mergePrivatePhoneAllowlistCore(params) as PrivatePhoneRow[];
}
