# הוספת מצב "משולב" (לידים + איקומרס) לדשבורד אביאלי

## הבעיה
הדשבורד של אביאלי (טבלת Google Ads, slug: `אביאלי-mo2oc7bk`) מוגדר כיום כ‑`campaign_type: "leads"`, ולכן מציג רק עמודת המרות + עלות להמרה ומסתיר את ערך ההמרות / ROAS. הלקוח מריץ קמפיין PMAX שכולל גם לידים וגם רכישות, וצריך לראות את שניהם יחד. שאר דשבורדי Google Ads חייבים להישאר ללא שינוי.

## הפתרון – מצב חדש: `combined`
מוסיפים ערך שלישי לאפשרות `campaign_type` בטבלת Google Ads: `leads | ecommerce | combined`.  
הסנכרון כבר מביא בפועל גם `conversions` וגם `conversions_value` (ראה `sync-google-ads-data`), אז זה שינוי תצוגה בלבד — אין שינוי בלוגיקת סנכרון או בסכמה.

ההפעלה תהיה נקודתית רק על הטבלה של אביאלי דרך עדכון `integration_settings.campaign_type = 'combined'` שלה — כל שאר טבלאות Google Ads ימשיכו עם `leads` / `ecommerce` כרגיל.

## שינויי UI

### 1. `src/pages/DynamicTableView.tsx` — טבלת הסיכום של Google Ads (סביבות 2675–2835)
- להוסיף `const isCombined = table?.integration_settings?.campaign_type === 'combined'`.
- במצב Combined להציג את כל העמודות: חשיפות, קליקים, **המרות (לידים)**, עלות, **עלות להמרה**, **ערך המרות**, **ROAS** — גם בשורות וגם ב‑`tfoot`.
- במצבים `leads` / `ecommerce` הקיימים — להשאיר בדיוק כמו היום.

### 2. `src/pages/DynamicTableView.tsx` — `ManualROICard` (שורה 2839)
- לאפשר את הצגת כרטיס ה‑ROI הידני גם כש‑`campaign_type === 'combined'` (כיום מוסתר רק על `ecommerce`).

### 3. `src/components/dynamic-tables/GoogleAdsTableDialog.tsx`
- להוסיף אופציה שלישית ל‑`RadioGroup` של `campaignType`: "משולב (לידים + איקומרס)".
- להרחיב את הטיפוס ל‑`"leads" | "ecommerce" | "combined"`.

### 4. `src/pages/SharedTable.tsx` (מסך השיתוף הציבורי)
- להוסיף מצב `'combined'` ל‑`tableMode` כאשר `tableCampaignType === 'combined'`.
- ב‑`summary`: לאסוף גם `leads` וגם `purchases/revenue/roas` (לא לאפס אף אחד מהם).
- בקוביות ובטבלת הקמפיינים — להציג את כל העמודות (כמו ב‑DynamicTableView).

### 5. `supabase/functions/public-table/index.ts`
- אם יש לוגיקה שמסננת לפי `campaign_type` בעת בניית התשובה — לאפשר `combined` להחזיר את כל השדות (`conversions`, `conversions_value`, `purchases`, `purchase_value`). אם אין סינון מסוג זה (סביר), אין שינוי. אבדוק זאת באימפלמנטציה.

## הפעלה ספציפית לאביאלי
מיגרציה קצרצרה (UPDATE נקודתי) על שורה אחת בלבד:

```sql
UPDATE crm_tables
SET integration_settings = jsonb_set(integration_settings, '{campaign_type}', '"combined"')
WHERE id = '2210de70-b853-49bf-b579-8178f798b357';
```

זה ה‑`id` של "אביאלי" בלבד — לא נוגע באף טבלת Google Ads אחרת.

## לא מושפע
- כל טבלאות Google Ads האחרות (`leads` או `ecommerce`) — נשארות זהות לחלוטין.
- ה‑Edge Functions של הסנכרון (`sync-google-ads-data`, `cron-sync-google-ads`) — ללא שינוי. כבר מושכים גם conversions וגם conversions_value.
- דשבורדי Facebook / Analytics / SEO — ללא שינוי.

## QA
1. לפתוח את `/t/marketingcaptain/table/אביאלי-mo2oc7bk` ולוודא שמופיעות גם עמודת **המרות / עלות להמרה** וגם **ערך המרות / ROAS** בטבלת הקמפיינים ובסיכום.
2. כרטיס "סיכום ROI ידני" צריך להופיע (כמו במצב leads).
3. לפתוח טבלת Google Ads אחרת (leads רגילה ו‑ecommerce רגילה) ולוודא שלא השתנה דבר.
4. לפתוח את קישור השיתוף של דשבורד אביאלי ולוודא שאותן עמודות מופיעות שם.
