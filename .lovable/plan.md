# Manus WhatsApp Gateway Integration

הוספת ספק WhatsApp חדש (`manus_wa`) לצד Green API, עם אותן יכולות: חיבור, שליחת טקסט/תמונה/קובץ, וקבלת הודעות נכנסות + ACKs דרך webhook.

## פרטי ה-API
- Base: `https://whatsappgw-pzpyrrww.manus.space`
- Auth: `X-Api-Key: wgk_...` (per-instance)
- Endpoints: `GET /api/v1/instances/{id}/status`, `POST .../send/text|image|file`
- Webhook: gateway שולח אירועי `message` ו-`message_ack` עם header `X-WA-Gateway-Secret` לאימות

## שלבים

### 1. סכמה
- מיגרציה: הוספת ערך `'manus_wa'` ל-enum `chat_provider`.
- שמירת ההגדרות בטבלה הקיימת `tenant_integrations` עם `integration_type = 'manus_wa'` ו-`settings = { instance_id, api_key, base_url, webhook_secret, phone_number, status }`. אין צורך בטבלה חדשה.

### 2. Edge Functions חדשות (תחת `supabase/functions/`)
- `manus-wa-status` — קורא `/status` עם ה-API key, מחזיר את הסטטוס + מספר טלפון, מעדכן את `tenant_integrations.settings`.
- `send-manus-wa-message` — מקבל `{ instanceId, to, body }` (או `tenantIntegrationId`), שולף את ה-API key מ-DB, קורא ל-`/send/text`, ושומר רשומה ב-`chat_messages` עם `provider='manus_wa'` (מקביל ל-`send-green-api-message`).
- `send-manus-wa-file` — מקביל ל-`send-green-api-file`, תומך ב-`image` או `file` לפי `mimeType`.
- `manus-wa-webhook` — endpoint ציבורי (`verify_jwt=false`) שמאמת `X-WA-Gateway-Secret` מול `settings.webhook_secret`, מטפל ב-`event:'message'` (יצירת/עדכון contact + insert ל-`chat_messages` + ביצוע auto-sync לליד אם רלוונטי) וב-`event:'message_ack'` (עדכון `status` בהודעה הקיימת לפי `messageId`: 2=delivered, 3=read).

### 3. דף הגדרות חדש: `src/pages/ManusWhatsAppSettings.tsx`
מבוסס על `GreenAPISettings.tsx`:
- טופס: Instance ID, API Key, Webhook Secret (מתקבל מ-Lovable או נוצר אוטומטית), Display Name.
- כפתור "בדוק סטטוס" שמפעיל `manus-wa-status`, ומציג CONNECTED/מספר טלפון.
- מציג את ה-Webhook URL שצריך להזין בדשבורד של Manus: `https://<project>.functions.supabase.co/manus-wa-webhook?tid=<tenant_integration_id>`.
- ניהול חיבורים מרובים (instances) באותו tenant — כמו ב-Green API.

### 4. עמוד אינטגרציות (`src/pages/Integrations.tsx`)
- הוספת כרטיס "Manus WhatsApp Gateway" שמנווט ל-`/t/:slug/integrations/manus-wa`.
- רישום ה-route ב-`App.tsx`.

### 5. שילוב בצ׳אט ובאוטומציות
- `ChatView.tsx` / `ChatProviderIndicator.tsx`: הוספת תמיכה ב-`provider: 'manus_wa'` (label + לוגיקת שליחה שקוראת ל-`send-manus-wa-message` במקום `send-green-api-message` כאשר ההודעה משויכת ל-instance של Manus).
- `StepConfigPanel.tsx` באוטומציות: הוספת `manus_wa` כספק שליחה אפשרי בצעדי WhatsApp (זהה לאופן שבו Green API נבחר מפורשות לפי connection לפי [memory](mem://features/automations/green-api-integration-priority)).
- `ConvertContactDialog`, `SendReportDialog` וכו׳: הוספת `manus_wa` כאופציה כאשר רלוונטי.

### 6. תפריט וניווט
- `AppSidebar.tsx` / `useUserPermissions.ts`: הוספת ערך תפריט "Manus WhatsApp" תחת אינטגרציות.

## הערות
- בידוד טננטים: כל פעולה נשלפת לפי `tenant_integration_id` ומאומתת מול ה-tenant של המשתמש (RLS קיים על `tenant_integrations`).
- ה-webhook מאומת ע״י סוד שמור ב-DB, לא דרך JWT (זה endpoint ציבורי מעצם הגדרתו).
- אם תרצה, אפשר לדחוס שלב 5 (שילוב מלא בצ׳אט/אוטומציות) למשימה נפרדת ולהשאיר עכשיו רק חיבור + שליחה ידנית + קבלה. תגיד.
