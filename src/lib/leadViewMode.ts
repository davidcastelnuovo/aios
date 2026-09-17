export const LEAD_VIEW_MODES = ["kanban", "table", "chat"] as const;
export type LeadViewMode = (typeof LEAD_VIEW_MODES)[number];

export const LEAD_VIEW_MODE_STORAGE_KEY = "leads-view-mode";
export const LEAD_DEFAULT_VIEW_STORAGE_KEY = "leads-default-view";

export const LEAD_VIEW_MODE_LABELS: Record<LeadViewMode, string> = {
  kanban: "פייפליין",
  table: "טבלה",
  chat: "צ'אט",
};

export function parseLeadViewMode(value: string | null | undefined): LeadViewMode | null {
  return value === "kanban" || value === "table" || value === "chat" ? value : null;
}

function getStorage(): Pick<Storage, "getItem" | "setItem"> | null {
  try {
    const storage = (globalThis as { localStorage?: Storage }).localStorage;
    return storage ?? null;
  } catch {
    return null;
  }
}

export function readStoredLeadViewMode(): LeadViewMode {
  const storage = getStorage();
  if (!storage) return "kanban";
  return (
    parseLeadViewMode(storage.getItem(LEAD_DEFAULT_VIEW_STORAGE_KEY)) ??
    parseLeadViewMode(storage.getItem(LEAD_VIEW_MODE_STORAGE_KEY)) ??
    "kanban"
  );
}

export function writeStoredLeadViewMode(mode: LeadViewMode, asDefault = false) {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(LEAD_VIEW_MODE_STORAGE_KEY, mode);
    if (asDefault) {
      storage.setItem(LEAD_DEFAULT_VIEW_STORAGE_KEY, mode);
    }
  } catch {
    // ignore quota / private-mode failures
  }
}

export function readStoredLeadDefaultView(): LeadViewMode | null {
  const storage = getStorage();
  if (!storage) return null;
  return parseLeadViewMode(storage.getItem(LEAD_DEFAULT_VIEW_STORAGE_KEY));
}
