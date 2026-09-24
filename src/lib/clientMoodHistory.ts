export type ClientMoodStatus = "happy" | "wavering" | "churn_risk" | "not_progressing";

export interface CommunicationLogRow {
  id: string;
  status: string;
  interaction_type?: string | null;
  note?: string | null;
  created_at?: string | null;
}

export interface ClientMoodChange extends CommunicationLogRow {
  moodStatus: ClientMoodStatus;
  previousMoodStatus: ClientMoodStatus | null;
}

const LEGACY_COMMUNICATION_STATUS_MAP: Record<string, ClientMoodStatus> = {
  normal: "happy",
  sensitive: "wavering",
  complaint: "churn_risk",
};

const MOOD_STATUSES = new Set<ClientMoodStatus>([
  "happy",
  "wavering",
  "churn_risk",
  "not_progressing",
]);

export function normalizeClientMoodStatus(status: string): ClientMoodStatus | null {
  const normalized = LEGACY_COMMUNICATION_STATUS_MAP[status] ?? status;
  return MOOD_STATUSES.has(normalized as ClientMoodStatus)
    ? (normalized as ClientMoodStatus)
    : null;
}

/**
 * Communication logs are also written for ordinary updates. Keep only actual
 * mood transitions, while retaining the first known status as the baseline.
 */
export function getClientMoodChanges(logs: CommunicationLogRow[]): ClientMoodChange[] {
  const chronological = [...logs].sort(
    (a, b) => new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime(),
  );
  const changes: ClientMoodChange[] = [];
  let previousMoodStatus: ClientMoodStatus | null = null;

  for (const log of chronological) {
    const moodStatus = normalizeClientMoodStatus(log.status);
    if (!moodStatus || moodStatus === previousMoodStatus) continue;

    changes.push({ ...log, moodStatus, previousMoodStatus });
    previousMoodStatus = moodStatus;
  }

  return changes.reverse();
}
