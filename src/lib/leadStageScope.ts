export const LEAD_STAGE_SCOPES = ["all", "new"] as const;
export type LeadStageScope = (typeof LEAD_STAGE_SCOPES)[number];

export const LEAD_STAGE_SCOPE_STORAGE_KEY = "leads-default-stage-scope";

export const LEAD_STAGE_SCOPE_LABELS: Record<LeadStageScope, string> = {
  all: "כל הלידים",
  new: "לידים חדשים",
};

export function parseLeadStageScope(value: string | null | undefined): LeadStageScope | null {
  return value === "all" || value === "new" ? value : null;
}

function getStorage(): Pick<Storage, "getItem" | "setItem"> | null {
  try {
    const storage = (globalThis as { localStorage?: Storage }).localStorage;
    return storage ?? null;
  } catch {
    return null;
  }
}

export function readStoredLeadStageScope(): LeadStageScope | null {
  const storage = getStorage();
  if (!storage) return null;
  return parseLeadStageScope(storage.getItem(LEAD_STAGE_SCOPE_STORAGE_KEY));
}

export function writeStoredLeadStageScope(scope: LeadStageScope) {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(LEAD_STAGE_SCOPE_STORAGE_KEY, scope);
  } catch {
    // ignore quota / private-mode failures
  }
}
