

## סיכום הבעיה

ה-webhook של Ahrefs (`ahrefs-webhook/index.ts`) מכניס כל דוח שנשלח כשורה חדשה **בלי בדיקת כפילויות**. כלומר אם אותו דוח נשלח פעמיים (או יותר) לאותו דומיין ותאריך - נוצרות שורות כפולות. מתוך 79 דוחות בבסיס הנתונים, 45 הם כפילויות מיותרות.

בנוסף, כשמשייכים דוח ללקוח - זה מעדכן רק שורה אחת, והכפילויות נשארות ללא שיוך.

---

## תוכנית

### שלב 1: ניקוי כפילויות קיימות (מיגרציה)

מיגרציית SQL שתמחק את כל הכפילויות. הלוגיקה:
- לכל שילוב של `domain + report_date + report_type` - נשמור רק שורה אחת
- עדיפות: שורה עם `client_id` (משויכת) לפני שורה ללא שיוך, ובתוך זה הכי חדשה

### שלב 2: מניעת כפילויות עתידיות (webhook)

עדכון `ahrefs-webhook/index.ts` - לפני INSERT, בדיקה אם כבר קיים דוח עם אותו `domain + report_date + report_type`. אם כן:
- עדכון (UPSERT) של הדוח הקיים במקום יצירת חדש
- שמירה על `client_id` הקיים אם כבר שויך

### שלב 3: שיוך אוטומטי לפי דומיין

עדכון ה-webhook כך שכאשר מגיע דוח חדש לדומיין שכבר שויך ללקוח בעבר:
1. מוצא את ה-`client_id` מדוח קודם לאותו דומיין
2. משייך אותו אוטומטית לדוח החדש
3. יוצר דוח SEO בטבלת `crm_tables` אם עדיין לא קיים

### שלב 4: UNIQUE constraint בבסיס הנתונים

הוספת אינדקס ייחודי על `(domain, report_date, report_type)` כדי למנוע כפילויות ברמת הDB.

---

## פרטים טכניים

**מיגרציה - מחיקת כפילויות:**
```sql
DELETE FROM ahrefs_reports 
WHERE id NOT IN (
  SELECT DISTINCT ON (domain, report_date, report_type) id
  FROM ahrefs_reports
  ORDER BY domain, report_date, report_type, client_id NULLS LAST, received_at DESC
);

CREATE UNIQUE INDEX idx_ahrefs_reports_unique_domain_date_type 
ON ahrefs_reports (domain, report_date, report_type);
```

**Webhook - UPSERT logic:**
- שימוש ב-`ON CONFLICT` על האינדקס החדש
- בעת conflict: עדכון `report_data`, `metadata`, `received_at`, ושמירה על `client_id` קיים

**שיוך אוטומטי:**
- בwebhook, חיפוש `client_id` מדוח קודם לאותו דומיין
- אם נמצא, שיוך אוטומטי + יצירת דוח SEO אם חסר

**קבצים שישתנו:**
- `supabase/functions/ahrefs-webhook/index.ts` - הוספת UPSERT ושיוך אוטומטי
- מיגרציה חדשה - ניקוי + UNIQUE constraint

