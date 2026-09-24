export type LeadTableColumnField = {
  key: string;
  label: string;
  type: string;
  /** Always shown in the CRM table; cannot be hidden. */
  required: boolean;
};

export const LEAD_TABLE_COLUMN_FIELDS: LeadTableColumnField[] = [
  { key: "contact_name", label: "שם", type: "text", required: true },
  { key: "created_at", label: "תאריך", type: "date", required: false },
  { key: "sales_person", label: "משתמש", type: "text", required: false },
  { key: "phone", label: "טלפון", type: "phone", required: false },
  { key: "company_name", label: "שם חברה", type: "text", required: false },
  { key: "campaign_name", label: "שם קמפיין", type: "text", required: false },
  { key: "source", label: "מקור הליד", type: "select", required: false },
  { key: "status", label: "שלב במשפך", type: "select", required: false },
  { key: "response_status", label: "סטטוס", type: "select", required: false },
  { key: "tags", label: "תגיות", type: "text", required: false },
  { key: "follow_up_date", label: "תאריך לחזרה", type: "date", required: false },
  { key: "actions", label: "פעולות", type: "text", required: true },
];

export const LEAD_TABLE_TOGGLEABLE_COLUMNS = LEAD_TABLE_COLUMN_FIELDS.filter(
  (field) => !field.required,
);

export function isLeadTableColumnVisible(
  fieldKey: string,
  isFieldVisible: (key: string, defaultVisible?: boolean) => boolean,
): boolean {
  const field = LEAD_TABLE_COLUMN_FIELDS.find((item) => item.key === fieldKey);
  if (field?.required) return true;
  return isFieldVisible(fieldKey, true);
}

/** Browser-local CRM table widths. Column ids match the lead table, not field keys. */
export const LEAD_TABLE_COLUMN_WIDTHS_STORAGE_KEY = "leads-table-column-widths";
export const LEAD_TABLE_COLUMN_WIDTHS_EVENT = "leads-table-column-widths";
export const LEAD_TABLE_COLUMN_MIN_WIDTH = 80;
export const LEAD_TABLE_COLUMN_MAX_WIDTH = 800;

const LEAD_TABLE_WIDTH_COLUMN_IDS = new Set([
  "name",
  "created_at",
  "sales_person",
  "phone",
  "company",
  "campaign_name",
  "source",
  "status",
  "response_status",
  "tags",
  "follow_up_date",
  "actions",
]);

export function parseLeadTableColumnWidths(raw: string | null | undefined): Record<string, number> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const widths: Record<string, number> = {};
    for (const [id, value] of Object.entries(parsed)) {
      if (!LEAD_TABLE_WIDTH_COLUMN_IDS.has(id)) continue;
      const width = typeof value === "number" ? value : Number(value);
      if (!Number.isFinite(width)) continue;
      widths[id] = Math.round(
        Math.min(LEAD_TABLE_COLUMN_MAX_WIDTH, Math.max(LEAD_TABLE_COLUMN_MIN_WIDTH, width)),
      );
    }
    return widths;
  } catch {
    return {};
  }
}

export function readLeadTableColumnWidths(
  storage?: Pick<Storage, "getItem"> | null,
): Record<string, number> {
  try {
    return parseLeadTableColumnWidths(storage?.getItem(LEAD_TABLE_COLUMN_WIDTHS_STORAGE_KEY) ?? null);
  } catch {
    return {};
  }
}

export function writeLeadTableColumnWidths(
  widths: Record<string, number>,
  storage?: Pick<Storage, "setItem"> | null,
): Record<string, number> {
  const clean = parseLeadTableColumnWidths(JSON.stringify(widths));
  try {
    storage?.setItem(LEAD_TABLE_COLUMN_WIDTHS_STORAGE_KEY, JSON.stringify(clean));
  } catch {
    // Private mode or a full quota should not block resizing.
  }
  return clean;
}

export function applyLeadTableColumnWidths<T extends { id: string; width: number }>(
  columns: T[],
  saved: Record<string, number>,
): T[] {
  return columns.map((column) => {
    const width = saved[column.id];
    return width ? { ...column, width } : column;
  });
}
