

# תוכנית: הרחבת AIOS לכל מודולי המערכת

## מצב נוכחי
הסוכן תומך ב: משימות, לידים, לקוחות, אוטומציות, Gmail, WhatsApp, זיכרון, display_data

## מודולים חסרים להוספה

### קבוצה 1 — CRM בסיסי
- **סוכנויות** — `list_agencies`, `get_agency_info`, `update_agency`
- **קמפיינרים** — `list_campaigners`, `get_campaigner_info`
- **ספקים** — `list_suppliers`, `create_supplier`, `get_supplier_info`
- **אנשי מכירות** — `list_sales_people`, `get_sales_person_info`
- **מוצרים** — `list_products`, `create_product`, `update_product`

### קבוצה 2 — פיננסי
- **הוצאות/הכנסות** — `list_finance`, `create_finance_entry`, `get_finance_summary` (טבלת `finance` + `income_payments` + `expense_payments`)
- **חשבוניות ספקים** — `list_supplier_invoices`

### קבוצה 3 — תפעולי
- **קליטת לקוחות** — `list_onboarding`, `update_onboarding_status` (טבלת `client_onboarding`)
- **מעקב זמן** — `list_time_entries`, `clock_in`, `clock_out` (טבלת `time_entries`)
- **יומן** — `list_calendar_events` (edge function `get-calendar-events` קיים)
- **עדכוני לקוחות/לידים** — `add_client_update`, `add_lead_update`, `list_updates`

### קבוצה 4 — נתונים ודוחות
- **דשבורדים דינמיים** — `list_dynamic_tables`, `get_table_data` (טבלאות `crm_tables` + `crm_records`)
- **דוחות ביצועים** — `get_performance_report` (אגרגציה של Facebook/Google data)
- **הקלטות** — `list_recordings` (טבלת `zoom_recordings`)

## שינויים טכניים

### קובץ אחד בלבד: `supabase/functions/ai-support-chat/index.ts`
1. **עדכון System Prompt** — הוספת כל המודולים החדשים לרשימת היכולות
2. **הוספת ~20 כלים חדשים** (tool definitions) למערך `tools`
3. **הוספת ~20 cases חדשים** ל-`executeTool` switch
4. **הוספת entity invalidation** עבור כל ישות שמשתנה

### תיקון Build Error (קובץ `notify-team-message/index.ts`)
- שורה 233: `(err as Error).message`
- שורה 331: `(err as Error).message`

## סדר ביצוע
1. תיקון build error ב-`notify-team-message`
2. הוספת כלים של קבוצה 1 (CRM בסיסי) — ~300 שורות
3. הוספת כלים של קבוצה 2 (פיננסי) — ~150 שורות
4. הוספת כלים של קבוצה 3 (תפעולי) — ~200 שורות
5. הוספת כלים של קבוצה 4 (נתונים ודוחות) — ~150 שורות
6. עדכון system prompt עם כל היכולות

## דגשים
- כל כלי מסנן לפי `tenant_id` לאבטחת נתונים
- כל פעולת כתיבה מעדכנת `modifiedEntities` לרענון UI
- שימוש ב-`display_data` אוטומטית אחרי שליפת רשימות

