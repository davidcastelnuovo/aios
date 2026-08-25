export interface LeadJsonIntakeField {
  key: string;
  label: string;
  exampleValue: string;
  required?: boolean;
}

/**
 * Fields the lead-intake webhook actually persists.
 * JSON builder + integration docs should stay in sync with this list.
 */
export function getLeadJsonIntakeFields(tenantSlug: string): LeadJsonIntakeField[] {
  return [
    {
      key: "tenant_slug",
      label: "🔑 מזהה ארגון (חובה)",
      exampleValue: tenantSlug || "your-tenant-slug",
      required: true,
    },
    { key: "company_name", label: "שם החברה", exampleValue: "שם החברה", required: true },
    { key: "contact_name", label: "שם איש קשר", exampleValue: "שם איש הקשר" },
    { key: "email", label: "אימייל", exampleValue: "email@example.com" },
    { key: "phone", label: "מספר טלפון", exampleValue: "050-1234567" },
    { key: "source", label: "מקור הליד", exampleValue: "website" },
    { key: "campaign_name", label: "קמפיין", exampleValue: "שיווק" },
    { key: "notes", label: "הערות", exampleValue: "הערות נוספות" },
    { key: "monthly_budget", label: "תקציב חודשי", exampleValue: "5000" },
    { key: "three_month_budget", label: "תקציב ל-3 חודשים", exampleValue: "15000" },
    { key: "products", label: "מוצרים מעניינים", exampleValue: "קמפיין פייסבוק, גוגל" },
    { key: "industry", label: "תעשייה", exampleValue: "טכנולוגיה" },
    {
      key: "agency_id",
      label: "ID של סוכנות (אם לא תספק - ישתמש בסוכנות ברירת מחדל)",
      exampleValue: "uuid-של-סוכנות",
    },
    { key: "manychat_subscriber_id", label: "ManyChat Subscriber ID", exampleValue: "123456789" },
    { key: "tag_name", label: "שם תגית (יצירה אוטומטית)", exampleValue: "ליד מהאתר" },
  ];
}

export const LEAD_JSON_INTAKE_ALWAYS_SHOWN = new Set([
  "tenant_slug",
  "tag_name",
]);
