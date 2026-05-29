
# Manus WhatsApp Gateway Integration

מטרה: לאפשר לכרמן ליצור instances של WhatsApp דרך Manus Gateway, לקבל QR לחיבור, לבדוק סטטוס ולשלוח הודעות — בלי לגעת בקוד קיים.

## שינויים

### 1. קובץ חדש: `supabase/functions/manage-manus-wa/index.ts`
Edge Function חדשה המשמשת כ-proxy מאובטח בין כרמן ל-Gateway.
תומכת ב-5 פעולות:
- `create_instance` — יצירת instance חדש
- `get_qr_link` — קבלת קישור QR לחיבור
- `get_status` — בדיקת סטטוס חיבור
- `connect` — חיבור instance
- `send_message` — שליחת הודעה דרך ה-Gateway

### 2. עריכה: `supabase/functions/run-ai-agent/index.ts` (הוספה בלבד)
- שורה ~138: הוספת 4 tool definitions ל-`ALL_TOOLS`
- שורה ~1291: הוספת 4 `case` חדשים ב-switch של `executeTool` לפני `default:`

כלים חדשים לכרמן:
- `create_whatsapp_instance`
- `get_whatsapp_qr_link`
- `get_whatsapp_status`
- `send_whatsapp_via_gateway`

### 3. עריכה: `supabase/functions/agent-heartbeat/index.ts` (הוספה בלבד)
14 שורות לפני ה-return הסופי — שליחת ping ל-`run-ai-agent` בכל ריצת heartbeat כדי למנוע cold start.

## Secret נדרש לאחר הדחיפה
```
GATEWAY_SESSION_TOKEN = <session token מה-Gateway>
```
נדרש כדי ש-`create_instance` ו-`get_qr_link` יעבדו. אבקש אותו דרך טופס מאובטח אחרי המעבר ל-build.

## הערות
- כל השינויים הם הוספות בלבד, אין שינוי בקוד קיים.
- לא נוגעים ב-`src/integrations/supabase/client.ts` ולא ב-`types.ts`.
- אחרי build אבדוק deploy של 3 ה-functions ואוודא שאין שגיאות.
