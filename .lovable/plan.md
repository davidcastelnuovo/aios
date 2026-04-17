

## הבעיה
שמות הטבלאות שנוצרו אוטומטית מתחילים בקידומת מבלבלת ("דוח SEO - ", "דוח גוגל אדס - ", "דוח פייסבוק - ") שמופיעה לפני שם הלקוח.

## מקורות הקידומת בקוד
1. **SEO**: `src/components/dynamic-tables/SeoReportDialog.tsx:185` → `דוח SEO - ${clientName}`
2. **SEO (Ahrefs auto-link)**: `src/pages/AhrefsSettings.tsx:101` → `דוח SEO - ${clientName} - ${domain}`
3. **SEO (Ahrefs webhook)**: `supabase/functions/ahrefs-webhook/index.ts:178` → `דוח SEO - ${domain}`
4. **Facebook (AI tools)**: `supabase/functions/run-ai-agent/index.ts:1025` + `supabase/functions/ai-support-chat/index.ts:1821, 1900`
5. **Google Ads (AI tools)**: `ai-support-chat/index.ts:1856, 1900`

> דיאלוגי **FacebookTableDialog / GoogleAdsTableDialog / FacebookEcommerceTableDialog** משתמשים בשם שהמשתמש מקליד ידנית — שם אין קידומת אוטומטית. לכן השמות עם "דוח פייסבוק/גוגל אדס" שראית הגיעו מיצירה אוטומטית של כרמן/הסוכנת.

## תוכנית

### 1. הסרת הקידומת מקוד היצירה (5 מקומות)
- `SeoReportDialog.tsx`: שם הטבלה יהיה `${clientName}` (אם יש דומיין שונה משם הלקוח, נצרף `${clientName} - ${domain}`).
- `AhrefsSettings.tsx`: `${clientName} - ${domain}` (בלי "דוח SEO -").
- `ahrefs-webhook/index.ts`: שם ברירת מחדל יהיה הדומיין בלבד (`${domain}`) במקרה שאין שיוך לקוח.
- `run-ai-agent/index.ts` + `ai-support-chat/index.ts`: כל יצירת טבלה תקבל `name = ${client.name}` בלבד (גם facebook, גם google_ads, גם ב-batch).

### 2. עדכון רטרואקטיבי של טבלאות קיימות (Migration)
הרצת SQL שיעדכן את כל השורות הקיימות ב-`crm_tables`:
```sql
UPDATE crm_tables SET name = REGEXP_REPLACE(name, '^דוח SEO - ', '') WHERE name LIKE 'דוח SEO - %';
UPDATE crm_tables SET name = REGEXP_REPLACE(name, '^דוח פייסבוק - ', '') WHERE name LIKE 'דוח פייסבוק - %';
UPDATE crm_tables SET name = REGEXP_REPLACE(name, '^דוח גוגל אדס - ', '') WHERE name LIKE 'דוח גוגל אדס - %';
```
מעל 50 טבלאות יקבלו שם נקי (רק שם הלקוח, או שם הלקוח + דומיין במקרה של SEO מרובה דומיינים).

### 3. הערות
- ה-`slug` (המשמש ב-URL) **לא ישתנה** — אין שבירת קישורים.
- עמוד דוחות הלקוח (`SeoCombinedSnapshot`, `ClientReportSnapshot`) ממשיך להציג "דוח SEO • דומיין" בכותרת הפנימית של הצילום — זה לא קשור לשם הטבלה ולא נוגעים בו.
- אם תרצה גם להוריד את הטקסט "דוח SEO •" מתוך תוכן הצילום עצמו — נעשה את זה בנפרד; אבל המסך הזה לא הוזכר בבקשה הנוכחית.

## תוצאה
כל הטבלאות (קיימות וחדשות) יופיעו עם שם הלקוח בלבד, ללא קידומת מבלבלת — ב-SEO, ב-Facebook וב-Google Ads.

