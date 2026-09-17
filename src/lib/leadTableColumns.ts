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
