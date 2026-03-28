

## תוספת: בחירת חשבון לקוח Google Ads אוטומטית מתוך Make.com

### מה ישתנה
במקום שהמשתמש יקליד ידנית Customer ID, המערכת תשלוף את רשימת חשבונות הלקוח מתוך החיבור שנבחר ב-Make.com ותציג אותם בדרופדאון לבחירה.

### שלבים

**1. Edge Function `make-api/index.ts` — פעולה חדשה `list_google_ads_accounts`**
- קריאה ל-Make.com RPC API: `POST /rpcs/google-ads/1/listCustomers`
- הפרמטרים: `connection` (ה-ID של החיבור שנבחר)
- מסנן החוצה חשבונות Manager (MCC) ומחזיר רק חשבונות לקוח
- מחזיר מערך של `{ id, name, currency, manager }` לדרופדאון

**2. `GoogleAdsTableDialog.tsx` — דרופדאון חשבונות במקום שדה טקסט**
- אחרי בחירת חיבור (`selectedMakeConnection`), קריאת `list_google_ads_accounts` עם ה-connection ID
- הצגת דרופדאון עם חיפוש (כמו שיש כרגע ב-direct_api) במקום שדה הקלדה ידני
- שמירת ה-Customer ID שנבחר ב-`customerIdInput`
- שמירת fallback — אם ה-RPC נכשל, חזרה לשדה טקסט ידני

### פרטים טכניים

Make.com RPC endpoint:
```text
POST https://{region}.make.com/api/v2/rpcs/google-ads/1/listCustomers
Body: { "data": {}, "scope": { "connectionId": 12345 } }
Headers: { "Authorization": "Token {api_token}" }
```

הדרופדאון יציג:
```text
שם החשבון (XXX-XXX-XXXX) — לא יציג חשבונות MCC
```

