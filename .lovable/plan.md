

## Diagnosis

### Issue 1: סנכרון Google Ads ב-DMM נכשל

מהלוגים של הסנכרון (table `bad108aa` - 24 קאראט):
```
status=403 PERMISSION_DENIED — USER_PERMISSION_DENIED
"login-customer-id: 7600108407" (אותו כמו customer_id!)
```

**שורש הבעיה**: כל הטבלאות של DMM נוצרו מחדש אתמול (16/04 בשעה 00:20) ב-batch אחד, וה-`integration_settings` שלהן **חסרים את `manager_id` (MCC)**. השוואה:

| שדה | MarketingCaptain (עובד) | DMM (לא עובד) |
|---|---|---|
| `manager_id` | ✅ `1625878765` | ❌ חסר |
| `account_name` | ✅ קיים | ❌ חסר |
| `currency` | ✅ קיים | ❌ חסר |
| `data_source` | ✅ `direct_api` | ❌ חסר |
| `campaign_type` | ✅ `leads` | ❌ חסר |

ב-`sync-google-ads-data` שורה 204: `loginCustomerId = settings.manager_id || customerId`. כשאין `manager_id`, הקוד מנסה login עם ה-customer_id עצמו → 403, ואז יש fallback שאמור לגלות MCC אוטומטית — אבל הוא מותנה ב-`searchData.error && !settings.manager_id` ופועל רק כש-`searchData.error` מחזיר אובייקט error ישיר. כאן Google מחזיר את השגיאה בתוך מערך (`[{"error": ...}]`) ולכן הבדיקה `searchData.error` נכשלת ולא מפעילה fallback.

### Issue 2: לקוחות DMM-MC לא נראים במרקטינג קפטן

הסוכנות `DMM-MC` משותפת בין שני הארגונים (`agency_tenant_access` תקין). אבל **כל טבלאות Google Ads ב-DMM נוצרו עם `agency_id=NULL`** (רק `client_id` הוגדר). פונקציית `crm-tables` ב-Edge Function (שורה 78) מסננת shared tables לפי:
```ts
.in('agency_id', sharedAgencyIds)
```
כיוון ש-`agency_id=NULL` — אף טבלה לא מתאימה ולכן משתמש מ-MarketingCaptain לא רואה אותן.

---

## Plan

### Fix 1: גילוי MCC אוטומטי כשהוא חסר

ב-`supabase/functions/sync-google-ads-data/index.ts`:
1. תיקון בדיקת השגיאה — לזהות שגיאה גם כש-Google מחזיר מערך `[{error}]` (לא רק אובייקט).
2. החלפת ה-fallback של גילוי MCC: במקום `customers:listAccessibleCustomers` (שמחזיר רק חשבונות מנהל ראשונים), להשתמש בכל ה-MCCs מההיסטוריה של `google-ads-auth` (מהלוגים רואים שמוכרים `1625878765`, `4568787244`, `8225555809`, `6200958104`) ולנסות אותם דרך `customerClients` query כדי לזהות איזה MCC מנהל את החשבון הספציפי.
3. שמירת ה-`manager_id` שהתגלה ב-`integration_settings` כדי שסנכרונים עתידיים ירוצו ישר בלי 403.

### Fix 2: השלמת `agency_id` בכל טבלאות Google Ads ב-DMM

הוספת migration שמעדכנת `crm_tables` של DMM:
- אם ל-`crm_tables.client_id` משויך לקוח ש-`clients.agency_id` מוגדר → להעתיק את ה-`agency_id` הזה לטבלה.
- ככה טבלאות של לקוחות תחת `DMM-MC` יקבלו `agency_id=38cf0e62...` ויהיו גלויות מ-MarketingCaptain.

### Fix 3: שמירה אוטומטית של agency_id בטבלאות חדשות

ב-`GoogleAdsTableDialog.tsx` (וב-`crm-tables` POST): כשבוחרים `client_id` להוסיף לטבלה, להעתיק אוטומטית את ה-`agency_id` של הלקוח לטבלה. זה ימנע חזרה של הבאג בעתיד.

### Fix 4: One-shot trigger לסנכרון מחדש

לאחר התיקונים, להריץ סנכרון מחדש לכל 30+ טבלאות ה-Google Ads של DMM (כל אחת בנפרד דרך `sync-google-ads-data`) כדי שה-`manager_id` יתגלה וישמר, והנתונים יתמלאו.

---

## Files to change
- `supabase/functions/sync-google-ads-data/index.ts` (Fix 1)
- Migration SQL — `UPDATE crm_tables SET agency_id = c.agency_id FROM clients c WHERE crm_tables.client_id = c.id AND crm_tables.agency_id IS NULL AND crm_tables.tenant_id='6ad8f321...'` (Fix 2)
- `src/components/dynamic-tables/GoogleAdsTableDialog.tsx` (Fix 3 — auto-populate agency_id from client)
- Trigger script לסנכרון של כל הטבלאות (Fix 4)

