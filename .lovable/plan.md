
## הבעיה

הדוח `periodontics.co.il` נוצר בארגון **DMM** אבל משויך ללקוח בסוכנות **DMM-MC**, שהיא סוכנות בבעלות **MarketingCaptain** (משותפת ל-DMM דרך `agency_tenant_access`). למרות זאת הדוח לא מופיע ב-MarketingCaptain.

שתי תקלות מצטרפות:

1. **`agency_id` של הדוח הוא `NULL`** — בדיאלוג `SeoReportDialog` הקליינט שולח שדות בשמות camelCase (`agencyId`, `clientId`) אבל ה-edge function `crm-tables` (POST) קורא רק שמות snake_case (`agency_id`, `client_id`). לכן `agency_id` נשמר כ-NULL בעת יצירת הדוח.
2. **לוגיקת ה-GET ב-`crm-tables` מסננת חוצה-ארגונים רק לפי `agency_id`** — היא לא מביאה דוחות זרים שמשויכים ללקוח ששייך לסוכנות שלנו (own/shared) כשה-`agency_id` של הטבלה ריק.

## התיקון

### 1. `supabase/functions/crm-tables/index.ts` — POST
לקבל גם camelCase: `const agency_id = body.agency_id ?? body.agencyId; const client_id = body.client_id ?? body.clientId;`. אם `agency_id` ריק אבל יש `client_id` — להשלים אוטומטית `agency_id` מתוך הלקוח.

### 2. `supabase/functions/crm-tables/index.ts` — GET
להוסיף שאילתת איסוף רביעית: דוחות בארגונים זרים שה-`client_id` שלהם שייך לקליינט בסוכנות own/shared (גם כש-`agency_id` ריק).

```text
ownedClientIds  = clients where agency_id IN (owned ∪ shared)  AND tenant_id != ours
foreignByClient = crm_tables where tenant_id != ours AND client_id IN ownedClientIds
allTables       = own ∪ sharedByAgency ∪ ownedForeignByAgency ∪ foreignByClient  (dedupe)
```

### 3. Backfill — מיגרציה חד פעמית
לעדכן `crm_tables.agency_id` בכל הרשומות שבהן הוא NULL לפי `clients.agency_id` של ה-`client_id` המקושר. כך הדוח הקיים יופיע מיידית גם ב-MC, וגם פתרונות אחרים שמסתמכים על `agency_id` יעבדו נכון.

### 4. PATCH
לקבל גם camelCase (לעקביות) — `agencyId`/`clientId`.

## אימות

- לאחר הפריסה לרענן את `/t/marketing-captain/dynamic-tables` ולוודא שהדוח `periodontics.co.il` מופיע תחת הסוכנות DMM-MC.
- ליצור דוח SEO חדש מ-MC ולוודא ש-`agency_id` נשמר ב-DB וזה גם נראה ב-DMM (וגם להפך).
