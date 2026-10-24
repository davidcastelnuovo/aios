/**
 * Who may use Carmen's voice (realtime, transcribe, speak) on the org's
 * OpenAI key. Users with a personal key always use their own key.
 */
import { isNonProductionAppEnv } from "../app-env.ts";

/** Owners who may use the org key on Production. */
export const CARMEN_OWNER_ALLOWLIST = ["david.castelnuovo@gmail.com"];

/**
 * True for an allowlisted owner, and for every signed-in user outside
 * Production (APP_ENV set to a non-production value), so the team can test
 * Carmen's voice on Staging and previews. Unset APP_ENV counts as Production.
 */
export function orgVoiceKeyAllowed(
  email: string | null | undefined,
  appEnv: string | undefined,
): boolean {
  if (email && CARMEN_OWNER_ALLOWLIST.includes(email.toLowerCase()))
    return true;
  return !!email && isNonProductionAppEnv(appEnv);
}
