/**
 * Resolves the agency a client task belongs to.
 *
 * Task forms keep a cached list of clients for the picker, but that list is
 * filtered (by status, tenant and campaigner assignment) and therefore cannot
 * be trusted to contain the client a task is being created for — the form is
 * often opened straight from a client card, with the client already fixed.
 * Looking the client up only in that list makes a perfectly well-configured
 * client look like it has no agency, which blocks the task.
 */

export interface TaskClientRow {
  id: string;
  name: string | null;
  agency_id: string | null;
}

export interface ResolveClientTaskAgencyArgs {
  clientId?: string | null;
  /** Authoritative lookup of a single client by id, bypassing any list filter. */
  fetchClient: (clientId: string) => Promise<TaskClientRow | null>;
  /** Client rows already loaded by the form; used only if the lookup comes back empty. */
  cachedClients?: readonly TaskClientRow[] | null;
  /** agency_id passed down by the card the form was opened from. */
  fallbackAgencyId?: string | null;
}

export interface ResolvedClientTaskAgency {
  client: TaskClientRow | null;
  agencyId: string;
  clientName: string;
}

export const MISSING_CLIENT_ERROR = "יש לבחור לקוח למשימת לקוח";
export const CLIENT_WITHOUT_AGENCY_ERROR = "הלקוח שנבחר לא משויך לסוכנות";
export const CLIENT_UNREADABLE_ERROR = "לא ניתן לטעון את פרטי הלקוח. רענן את הדף ונסה שוב.";

export async function resolveClientTaskAgency({
  clientId,
  fetchClient,
  cachedClients,
  fallbackAgencyId,
}: ResolveClientTaskAgencyArgs): Promise<ResolvedClientTaskAgency> {
  if (!clientId) {
    throw new Error(MISSING_CLIENT_ERROR);
  }

  let client: TaskClientRow | null = null;
  try {
    client = await fetchClient(clientId);
  } catch {
    // A failed read must not block the task while other sources are available;
    // the fallbacks below still end in an explicit error if none of them holds.
    client = null;
  }

  if (!client) {
    client = cachedClients?.find((candidate) => candidate.id === clientId) ?? null;
  }

  const agencyId = client?.agency_id || fallbackAgencyId || null;
  if (!agencyId) {
    throw new Error(client ? CLIENT_WITHOUT_AGENCY_ERROR : CLIENT_UNREADABLE_ERROR);
  }

  return { client, agencyId, clientName: client?.name || "לקוח" };
}
