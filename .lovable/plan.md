

# חיבור Unified.to כשכבת אינטגרציה נוספת

## סקירה
Unified.to הוא Unified API שמאפשר גישה ל-420+ אינטגרציות דרך API אחד סטנדרטי. נחבר אותו כשכבה נוספת — האינטגרציות הקיימות (Facebook, Google Ads, Green API וכו׳) ימשיכו לעבוד כמו היום, ו-Unified.to ישמש רק לאינטגרציות חדשות.

## ארכיטקטורה

```text
┌─────────────────────────────────────────┐
│           tenant_integrations           │
│  (טבלה קיימת - ללא שינוי מבני)          │
│                                         │
│  integration_type = 'facebook'    ──► Edge Functions ישירות (כמו היום)
│  integration_type = 'google_ads'  ──► Edge Functions ישירות (כמו היום)
│  integration_type = 'unified_crm' ──► Edge Function חדשה ──► Unified.to API
│  integration_type = 'unified_ats' ──► Edge Function חדשה ──► Unified.to API
│  ...                                    │
└─────────────────────────────────────────┘
```

## שלבי מימוש

### 1. שמירת API Token של Unified.to
- הוספת Secret `UNIFIED_API_KEY` דרך כלי ה-secrets
- ה-token ישמש ב-Edge Functions לקריאות ל-Unified.to API

### 2. Edge Function: `unified-api-proxy`
פונקציה אחת שמשמשת כ-proxy לכל קריאות Unified.to:
- מקבלת: `connection_id` (של Unified.to), `method`, `path`, `body`
- מעבירה את הקריאה ל-`https://api.unified.to/{path}` עם ה-API token
- מחזירה את התוצאה ללקוח
- כוללת validation ואימות משתמש

### 3. Edge Function: `unified-connections`
ניהול connections של Unified.to:
- **create**: יוצרת connection חדש דרך Unified.to Embed URL ושומרת ב-`tenant_integrations` עם `integration_type = 'unified_{category}'`
- **list**: מחזירה את כל ה-connections הפעילים של ה-tenant
- **delete**: מוחקת connection

### 4. דף הגדרות: `UnifiedSettings.tsx`
דף חדש שמאפשר:
- צפייה בקטגוריות זמינות (CRM, ATS, Ticketing, Commerce וכו׳)
- חיבור אינטגרציה חדשה דרך Unified.to Embed (iframe/popup)
- ניהול connections קיימים (ניתוק, רענון)

### 5. עדכון דף Integrations.tsx
הוספת כרטיס "Unified.to" לרשימת האינטגרציות הקיימת, עם קישור לדף ההגדרות החדש.

### 6. הרחבת AddIntegrationDialog
הוספת אפשרות לבחור אינטגרציות Unified.to בדיאלוג הוספת אינטגרציה לטבלאות דינמיות (CRM tables).

## שימוש ב-Unified.to

**חיבור אינטגרציה (Embed URL):**
Unified.to מספק URL מוכן שפותח חלון חיבור ללקוח הסופי. ה-URL נבנה כך:
```
https://embed.unified.to/integration?
  workspace_id=...&
  categories=crm,ats,ticketing&
  success_redirect=...&
  failure_redirect=...
```

**קריאת נתונים:**
```
GET https://api.unified.to/crm/{connection_id}/contact
GET https://api.unified.to/crm/{connection_id}/deal
GET https://api.unified.to/ats/{connection_id}/candidate
```

**שמירת connection_id:**
ב-`tenant_integrations.settings` נשמור את ה-`unified_connection_id` שמאפשר קריאות ל-API.

## קבצים

| קובץ | פעולה |
|---|---|
| `supabase/functions/unified-api-proxy/index.ts` | חדש — proxy לקריאות API |
| `supabase/functions/unified-connections/index.ts` | חדש — ניהול connections |
| `src/pages/UnifiedSettings.tsx` | חדש — דף הגדרות |
| `src/pages/Integrations.tsx` | עריכה — הוספת כרטיס |
| `src/components/dynamic-tables/AddIntegrationDialog.tsx` | עריכה — תמיכה ב-Unified |

## מה לא משתנה
- כל האינטגרציות הקיימות (Facebook, Google Ads, Green API וכו׳) — ממשיכות לעבוד בדיוק כמו היום
- טבלת `tenant_integrations` — ללא שינוי מבני, רק שורות חדשות עם `integration_type` חדש
- ה-Edge Functions הקיימות — ללא נגיעה

