

## תוכנית: יצירת טבלאות Facebook דינמיות לכל לקוחות DMM עם מזהה מטא

### הבעיה
ב-DMM יש כ-40 לקוחות עם `meta_ads_account_id` מוגדר, אבל אין אף טבלה דינמית (`crm_tables`) מסוג `facebook_insights` שמשויכת אליהם.

### הפתרון
יצירת סקריפט חד-פעמי (Edge Function invocation או ישירות בDB) שיעבור על כל לקוחות DMM עם `meta_ads_account_id`, וייצור לכל אחד טבלת `crm_tables` עם:
- `integration_type: 'facebook_insights'`
- `integration_settings` עם ה-`ad_account_id` של הלקוח
- שיוך ל-`agency_id` ו-`client_id` הנכונים
- שם אוטומטי: `"Facebook - [שם לקוח]"`

### שלבים

1. **יצירת סקריפט Edge Function חד-פעמי** (`bulk-create-facebook-tables`)
   - שולף את כל הלקוחות ב-DMM tenant שיש להם `meta_ads_account_id` ואין להם עדיין טבלת `facebook_insights`
   - יוצר `crm_tables` record לכל אחד דרך ה-Edge Function `crm-tables` (או ישירות INSERT)
   - מפעיל סנכרון ראשוני (`sync-facebook-insights`) לכל טבלה שנוצרה

2. **הפעלת הסקריפט** — קריאה חד-פעמית שתיצור את כל הטבלאות

### פרטים טכניים
- **Tenant ID**: `6ad8f321-25db-4a04-8e44-e57a7c8961b2`
- **סוכנויות**: DMM-MC (`38cf0e62...`) ו-DMM-LTD (`25b9754c...`)
- **כ-40 לקוחות** צריכים טבלה חדשה
- כל טבלה תכיל `slug` ייחודי מבוסס שם + timestamp
- ה-`category` יהיה `'Facebook Insights'`
- ה-`date_range` ברירת מחדל: `'last_30_days'`

