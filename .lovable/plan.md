
# התראות אינטגרציה — `integration_disconnected` + `ad_account_blocked`

מטרה: לאפשר אוטומציה עם שני טריגרים (OR) שמשגרת הודעת WhatsApp עם פירוט מלא — איזו אינטגרציה/חשבון, איזה לקוח, וקישור ישיר לחשבון.

## 1. מיגרציה — `integration_alerts_log`
טבלה למניעת ספאם (throttle 6 שעות):
- `tenant_id`, `provider`, `account_id` (nullable), `alert_type` (`disconnected` | `blocked`), `fired_at`
- אינדקס על (tenant_id, provider, account_id, alert_type, fired_at)
- RLS: רק service_role כותב; tenant יכול לקרוא
- GRANTs מלאים

## 2. Shared helper — `supabase/functions/_shared/fireIntegrationAlert.ts`
פונקציה אחת שכל cron/webhook קורא לה:
```
fireIntegrationAlert({
  tenant_id, provider, alert_type: 'disconnected'|'blocked',
  account_id?, account_name?, client_id?, client_name?, reason
})
```
תפקידיה:
- בדיקת throttle מול `integration_alerts_log` (6h)
- העשרת payload: `provider_label` (עברית), `reason_he`, `tenant_name`, `account_link` (deep-link לפי provider), `internal_link` (לכרטיס הלקוח/אינטגרציות), `occurred_at`
- קריאה ל-`trigger-automation` עם הטריגר המתאים
- רישום ב-log

מיפוי `account_link`:
- Meta/FB Ads: `https://business.facebook.com/adsmanager/manage/accounts?act={id}`
- Google Ads: `https://ads.google.com/aw/overview?ocid={id}`
- GA4: `https://analytics.google.com/analytics/web/#/p{id}`
- GSC: `https://search.google.com/search-console?resource_id={encoded}`
- Gmail/Telegram/Green API/ManyChat/Unified.to: קישור פנימי לעמוד האינטגרציה

## 3. שילוב במקורות הקיימים
**`ad_account_blocked`**:
- `cron-sync-facebook-insights`: שינוי שם הטריגר מ-`ad_account_billing_issue` → `ad_account_blocked` + שימוש ב-helper
- `cron-sync-google-ads`: יירוט `CUSTOMER_NOT_ENABLED`/`ACCOUNT_SUSPENDED`/`BILLING` → `ad_account_blocked`
- ב-`trigger-automation`: alias `ad_account_billing_issue` → `ad_account_blocked` לתאימות לאחור

**`integration_disconnected`**:
- כשל refresh-token / 401 / `invalid_grant` בכל הקרונים:
  `cron-sync-google-ads`, `cron-sync-google-analytics`, `cron-sync-google-search-console`, `gmail-sync`
- כשל webhook/auth ב-`green-api-webhook`, `telegram-poll`, `manychat-webhook`
- `unified-to-*` callbacks כשהחיבור נכשל

## 4. UI — `StepConfigPanel`
הוספת פאנל "משתנים זמינים" מתחת לשדה הטקסט של הודעת WhatsApp, מבוסס על סוג הטריגר שנבחר. לחיצה על משתנה מזריקה `{{var_name}}` לעמדת הסמן.

משתנים לשני הטריגרים החדשים:
`{{provider}}`, `{{provider_label}}`, `{{reason}}`, `{{reason_he}}`, `{{account_id}}`, `{{account_name}}`, `{{client_name}}`, `{{client_id}}`, `{{tenant_name}}`, `{{account_link}}`, `{{internal_link}}`, `{{occurred_at}}`

## 5. תבנית ברירת מחדל
כשמשתמש מוסיף step מסוג WhatsApp לאוטומציה עם אחד הטריגרים האלה ושדה ההודעה ריק — להציע:
```
🚨 התראת אינטגרציה
ספק: {{provider_label}}
לקוח: {{client_name}}
חשבון: {{account_name}}
סיבה: {{reason_he}}
קישור: {{account_link}}
```

## קבצים
**חדשים:** מיגרציה ל-`integration_alerts_log`, `supabase/functions/_shared/fireIntegrationAlert.ts`
**עריכה:** `trigger-automation/index.ts`, `cron-sync-facebook-insights/index.ts`, `cron-sync-google-ads/index.ts`, `cron-sync-google-analytics/index.ts`, `cron-sync-google-search-console/index.ts`, `gmail-sync/index.ts`, `green-api-webhook/index.ts`, `telegram-poll/index.ts`, `manychat-webhook/index.ts`, `src/components/automations/StepConfigPanel.tsx`

## פתוח לאישור
1. Throttle של 6 שעות מתאים? (אפשר 1h/24h)
2. להוסיף גם טריגר `integration_reconnected` (החזרה לפעולה)?
