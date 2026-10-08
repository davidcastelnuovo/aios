// Policy for calling Carmen's tools directly (carmen-tools-mcp → run-ai-agent direct_tool),
// without Carmen's LLM. Used by Claude Direct / Cursor Direct and other coding agents.
import { isDevEscalationTool } from "./dev-escalation-auth.mjs";

/** Never exposed directly: agent spawning (loops / token burn) and self-approval. */
export const DIRECT_BLOCKED_TOOLS = Object.freeze([
  "search_agent_tools",
  "delegate_to_subagent",
  "delegate_parallel",
  "get_subagent_result",
  "get_batch_results",
  "delegate_to_manus",
  "send_message_to_manus",
  "assign_task_to_cursor",
  "execute_pending_approval",
  "reject_pending_approval",
]);

/**
 * Executed immediately inside Carmen, but sensitive (external sends, deletions, access,
 * money, agent behavior). Directly they are queued for David's approval instead.
 * Tools that already queue themselves (Meta/Google mutations, accounting, broadcasts,
 * automations, campaign schedules) are not listed: their own gate applies.
 */
export const DIRECT_APPROVAL_TOOLS = Object.freeze([
  "send_message",
  "send_whatsapp_to_staff",
  "send_message_to_campaigner",
  "send_whatsapp_via_gateway",
  "publish_social_post",
  "reply_to_social_comment",
  "hide_social_comment",
  "delete_lead",
  "delete_task",
  "delete_automation",
  "toggle_automation",
  "delete_memory",
  "send_calendar_invite",
  "update_calendar_invite",
  "cancel_calendar_invite",
  "join_meeting_for_client",
  "create_whatsapp_instance",
  "toggle_integration",
  "create_agent",
  "update_agent",
  "create_skill",
  "update_skill",
  "create_campaigner",
  "create_sales_person",
  "create_agency",
  "connect_google_ads_account",
  "connect_client_meta_ad_account",
  "create_meta_lead_form",
  "set_automation_meta_lead_form",
  "set_campaign_table_active",
  "create_finance_entry",
]);

const BLOCKED = new Set(DIRECT_BLOCKED_TOOLS);
const APPROVAL = new Set(DIRECT_APPROVAL_TOOLS);

/** @returns {'blocked'|'approval'|'direct'} */
export function classifyDirectTool(name) {
  const n = String(name || "");
  if (!n || BLOCKED.has(n) || isDevEscalationTool(n)) return "blocked";
  if (APPROVAL.has(n)) return "approval";
  return "direct";
}

/** Tools from Carmen's catalogue that a direct caller may see. */
export function directToolPool(allTools, { allowedTools = [], disabledTools = [], isManager = false } = {}) {
  return allTools.filter((t) =>
    (allowedTools.length === 0 || allowedTools.includes(t.name)) &&
    !disabledTools.includes(t.name) &&
    (isManager || t.name !== "query_system_graph") &&
    classifyDirectTool(t.name) !== "blocked"
  );
}
