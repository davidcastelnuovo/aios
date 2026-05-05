## סקירה
שתי הוספות במודול הנהלת חשבונות (`/t/:slug/accounting-integrations`):
1. **פילטר סוגי תנועות** (אושר קודם) – הכנסות ריטיינר / חד פעמי / הוצאות לקוחות / הוצאות ספקים.
2. **לשונית "קליטת חשבוניות"** – העלאה ידנית של צילום/PDF, סוכן AI שמזהה ושולף שדות, ושיוך לספק/לקוח/סוכנות.

---

## חלק 1: פילטר סוגי תנועות
(כפי שאושר) ב-`src/pages/AccountingIntegrations.tsx`:
- State `typeFilter` (מערך של 4 ערכים: `retainer`, `one_time`, `client_expense`, `supplier_expense`), ברירת מחדל – הכל פעיל.
- Popover + Checkboxes בשורת הפילטרים.
- חישוב הסיכומים (Cards + שורת סה״כ) ועמודות הטבלה מתעדכן לפי הפילטר.
- כרטיס "הוצאות ספקים" יוסתר כשהסוג שלו כבוי.

---

## חלק 2: קליטת חשבוניות עם AI

### תשתית (Backend)
1. **Storage Bucket** חדש: `invoices` (פרטי). RLS: רק חברי ה-tenant יכולים upload/select לקבצים תחת prefix `<tenant_id>/...`.
2. **טבלת DB** חדשה `invoice_uploads`:
   - `id`, `tenant_id`, `uploaded_by`, `file_path`, `file_url` (signed), `mime_type`, `created_at`.
   - שדות מזוהים על ידי AI: `vendor_name`, `invoice_number`, `invoice_date`, `total_amount`, `currency`, `vat_amount`, `description`, `raw_extraction` (jsonb).
   - שיוך: `supplier_id`, `client_id`, `agency_id` (כולם nullable, FK).
   - `status`: `pending` / `processed` / `linked` / `failed`.
   - `finance_id` nullable – אם הומר לרשומת הוצאה ב-`finance`.
   - RLS: tenant-scoped (כמו שאר הטבלאות).
3. **Edge Function** חדשה `extract-invoice-data`:
   - מקבלת `file_path` (תוך bucket `invoices`).
   - מורידה את הקובץ, שולחת ל-Lovable AI (`google/gemini-2.5-pro` – תומך ב-vision/PDF) עם הוראה לשלוף JSON מובנה (vendor, date, total, vat, currency, line_items, suggested_category) באמצעות tool calling.
   - מחזירה את ה-JSON ומעדכנת את `invoice_uploads` (status=`processed`).
   - תומכת ב-image (jpg/png/webp) וב-PDF (קידוד base64 בהודעה ל-AI).

### Frontend
4. **טאבים** ב-`AccountingIntegrations.tsx`:
   - טאב "סקירה" – התוכן הקיים.
   - טאב חדש "קליטת חשבוניות".
5. **קומפוננטה חדשה** `src/components/accounting/InvoiceIntakeTab.tsx`:
   - אזור Drag & Drop + כפתור העלאה (קבלה מרובת קבצים, image/* + pdf).
   - בעת בחירה: upload ל-storage → רישום ב-`invoice_uploads` (status=`pending`) → קריאה ל-`extract-invoice-data`.
   - **רשימת חשבוניות שנקלטו**: קלף לכל חשבונית עם:
     - תמונה ממוזערת / אייקון PDF + לחיצה לפתיחה (signed URL).
     - השדות שזוהו (ניתנים לעריכה inline): vendor, תאריך, סכום, מע"מ, תיאור.
     - 3 Selects לשיוך: ספק (מתוך `suppliers`), לקוח (מתוך `clients`), סוכנות (מתוך `agencies`).
       - אם vendor הוזהה – הצעה אוטומטית למיפוי ספק לפי חיפוש fuzzy בשם.
     - כפתור **"שמור כהוצאה"** – יוצר רשומה ב-`finance` (type=`expense`, amount, date, supplier_id, client_id, agency_id, notes=תיאור החשבונית, category) ומסמן `invoice_uploads.status=linked` עם `finance_id`.
     - כפתור **"מחק"**.
   - פילטרים: סטטוס (כולם / pending / processed / linked).

### חיבור לסיכומים הקיימים
ההוצאות שנשמרות ב-`finance` כבר מוצגות בלוגיקה הקיימת (`accounting-finance-expenses`), אז חשבוניות שנקלטו ושוייכו ייכנסו אוטומטית לסיכום החודשי.

---

## פרטים טכניים
- **AI**: Lovable AI Gateway, מודל `google/gemini-2.5-pro` (תמיכה ב-vision); structured output דרך tool calling. שימוש ב-`LOVABLE_API_KEY` הקיים – אין צורך בסוד חדש.
- **Storage**: bucket פרטי, גישה דרך signed URLs לתצוגה ב-UI.
- **שגיאות AI**: 429/402 יוחזרו ל-UI עם toast מתאים. אם AI נכשל – `status=failed` והמשתמש עדיין יכול למלא ידנית.
- אין שינוי בסכמה הקיימת של `finance` – נכתב אליה רק `INSERT`.
