/** Re-export for Deno edge functions. Implementation in .mjs (Node-testable). */
export {
  AUTHORIZED_DEV_REQUESTERS,
  DEV_ESCALATION_REFUSAL_HE,
  normalizePhoneSuffix,
  isAuthorizedDevRequester,
  isDevEscalationTool,
  isDevEscalationSkill,
  buildDevEscalationPromptRule,
} from './dev-escalation-auth.mjs';
