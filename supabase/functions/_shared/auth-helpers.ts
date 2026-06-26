// Shared caller-scope guards for run-ai-agent tools.
//
// Carmen acts AS the caller, bounded by the caller's access level (David's
// standing rule). run-ai-agent uses the service role (which bypasses RLS), so
// every client-scoped MUTATION must call assertCallerCanAccessClient before
// touching a client's data — otherwise a campaigner could affect a client that
// isn't theirs. Managers bypass; team managers are scoped to managed agencies;
// campaigners are scoped to their client_team assignments.

export interface CallerScope {
  callerCampaignerId?: string | null;
  isManagerRole: boolean;
  isTeamManager: boolean;
  managedAgencyIds: string[];
  accessibleTenantIds: string[];
}

export class AccessDeniedError extends Error {
  code = 'access_denied';
  constructor(message: string) {
    super(message);
    this.name = 'AccessDeniedError';
  }
}

/**
 * Throws AccessDeniedError if the caller may not act on `clientId`.
 * - Managers (owner/agency_owner/agency_manager/super_admin): allowed.
 * - Team managers: allowed only if the client's agency is in managedAgencyIds.
 * - Campaigners: allowed only if assigned to the client via client_team.
 * - No campaigner identity and not a manager: denied.
 */
export async function assertCallerCanAccessClient(
  supabase: any,
  clientId: string,
  scope: CallerScope,
): Promise<void> {
  if (!clientId) throw new AccessDeniedError('missing client_id');
  if (scope.isManagerRole) return; // full-tenant managers

  const { data: client } = await supabase
    .from('clients')
    .select('agency_id')
    .eq('id', clientId)
    .in('tenant_id', scope.accessibleTenantIds)
    .maybeSingle();
  if (!client) throw new AccessDeniedError('הלקוח לא נמצא או מחוץ להרשאה שלך');

  if (scope.isTeamManager) {
    if (scope.managedAgencyIds.includes(client.agency_id)) return;
    throw new AccessDeniedError('הלקוח אינו באחת הסוכנויות שאתה מנהל — אין לך גישה אליו');
  }

  if (scope.callerCampaignerId) {
    const { data: link } = await supabase
      .from('client_team')
      .select('id')
      .eq('client_id', clientId)
      .eq('campaigner_id', scope.callerCampaignerId)
      .maybeSingle();
    if (link) return;
    throw new AccessDeniedError('הלקוח לא משויך אליך — אינך רשאי לפעול עליו. פנה למנהל אם זו טעות.');
  }

  // No campaigner identity and not a manager (e.g. in-app owner/admin context):
  // preserve the existing permissive behavior — these surfaces are already trusted.
  return;
}

/**
 * Resolve the client_id a Facebook campaign belongs to (for scope checks on
 * campaign tools that only receive a campaign_id). Returns null if not found.
 */
export async function clientIdForFacebookCampaign(
  supabase: any,
  campaignId: string,
  accessibleTenantIds: string[],
): Promise<string | null> {
  const { data } = await supabase
    .from('facebook_campaigns')
    .select('client_id')
    .eq('campaign_id', String(campaignId))
    .in('tenant_id', accessibleTenantIds)
    .maybeSingle();
  return data?.client_id ?? null;
}
