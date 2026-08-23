/**
 * Author line of the update feeds (client card, lead card, task dialog).
 *
 * The feeds read the author from `profiles`, but `profiles.full_name` is empty
 * for most campaigner accounts — nothing fills it in when a campaigner gets a
 * login — so the feed fell back to the raw login email instead of the name the
 * rest of the app shows. `profiles.campaigner_id` points at the campaigner
 * record that does hold the name, so use it before falling back to the email.
 */

export interface UpdateAuthorCampaigner {
  full_name?: string | null;
}

export interface UpdateAuthorProfile {
  full_name?: string | null;
  email?: string | null;
  campaigners?: UpdateAuthorCampaigner | UpdateAuthorCampaigner[] | null;
}

/** PostgREST embed returning everything `resolveUpdateAuthorName` needs. */
export const UPDATE_AUTHOR_SELECT =
  "profiles:user_id (full_name, email, campaigners:campaigner_id (full_name))";

export const UNKNOWN_UPDATE_AUTHOR = "משתמש";

function nonEmpty(value?: string | null): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function resolveUpdateAuthorName(profile?: UpdateAuthorProfile | null): string {
  const campaigner = Array.isArray(profile?.campaigners)
    ? profile?.campaigners[0]
    : profile?.campaigners;

  return (
    nonEmpty(profile?.full_name) ??
    nonEmpty(campaigner?.full_name) ??
    nonEmpty(profile?.email) ??
    UNKNOWN_UPDATE_AUTHOR
  );
}
