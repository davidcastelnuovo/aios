

# תוכנית: דיאלוג ניהול ספק עם חשבוניות וקריאת AI

## הבעיה
במודול הנהלת חשבונות, כשלוחצים "עריכה" על ספק/קמפיינר, נפתח דיאלוג עריכה כללי (עם ניהול סוכנויות וגישות). צריך דיאלוג חדש ייעודי לניהול חשבוניות ספק.

## מה ייבנה

### 1. טבלת `supplier_invoices` בבסיס הנתונים
- `id`, `tenant_id`, `supplier_id` (FK to suppliers)
- `invoice_name` (שם החשבונית - מוזן ידנית או ע"י AI)
- `invoice_amount` (סכום)
- `invoice_date` (תאריך חשבונית)
- `invoice_month` (חודש לדיווח, פורמט YYYY-MM)
- `file_url` (קישור לקובץ שהועלה ל-Storage)
- `file_name` (שם הקובץ המקורי)
- `ai_extracted` (boolean - האם נקרא ע"י AI)
- `notes`, `created_at`
- RLS: משתמשים רואים רק חשבוניות של ה-tenant שלהם

### 2. Storage bucket `supplier-invoices`
לאחסון קבצי החשבוניות (PDF/תמונות)

### 3. Edge Function `extract-invoice-data`
- מקבל קובץ חשבונית (תמונה/PDF)
- שולח ל-Lovable AI (gemini-2.5-flash - תמיכה ב-multimodal) עם prompt לחלץ שם חשבונית וסכום
- מחזיר `{ invoice_name, invoice_amount }` באמצעות tool calling

### 4. קומפוננטת `SupplierInvoicesDialog`
דיאלוג חדש שמחליף את EditSupplierDialog במודול הנהלת חשבונות:
- **חלק עליון**: פרטי ספק בסיסיים (שם, טלפון, אימייל) - לקריאה בלבד
- **חלק מרכזי**: אזור העלאת חשבונית חדשה
  - בחירת קובץ (PDF/תמונה)
  - כפתור "קרא חשבונית עם AI" → שולח ל-edge function → ממלא אוטומטית שם וסכום
  - שדות ידניים: שם חשבונית, סכום, תאריך, חודש דיווח
  - כפתור "שמור חשבונית"
- **חלק תחתון**: טבלת חשבוניות קיימות של הספק
  - עמודות: שם חשבונית, סכום, תאריך, חודש, קובץ (לינק להורדה), מחיקה
  - סה"כ סכום בתחתית

### 5. עדכון `AccountingIntegrations.tsx`
- `handleEditExpense` לספקים → פותח `SupplierInvoicesDialog` במקום `EditSupplierDialog`
- קמפיינרים → פותח `EditCampaignerDialog` הרגיל (בלי שינוי, כי הוא כבר מציג פרטי עריכה רלוונטיים)

## פרטים טכניים
- AI: Lovable AI Gateway עם `google/gemini-2.5-flash` (multimodal - קורא תמונות)
- Storage: bucket `supplier-invoices` עם RLS
- Edge function: `extract-invoice-data` - מקבל base64 של הקובץ, שולח כ-image ל-Gemini, מחזיר structured output
- הנתונים יהיו זמינים לייצוא לדוחות דרך שאילתת supplier_invoices

