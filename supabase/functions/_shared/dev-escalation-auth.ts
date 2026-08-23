/** Re-export for Deno edge functions. Implementation in .mjs (Node-testable). */
export {
  AUTHORIZED_DEV_REQUESTERS,
  FULL_DEV_REQUESTERS,
  BUGFIX_DEV_REQUESTERS,
  DEV_ESCALATION_REFUSAL_HE,
  DEV_ESCALATION_BUGFIX_ONLY_REFUSAL_HE,
  normalizePhoneSuffix,
  getDevEscalationTier,
  isAuthorizedDevRequester,
  isDevEscalationTool,
  isDevEscalationToolAllowed,
  isDevEscalationSkill,
  isBugfixEscalationSkill,
  buildDevEscalationPromptRule,
} from './dev-escalation-auth.mjs';
