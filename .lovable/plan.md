## הבעיה
ב-tenant הזה יש 3 אוטומציות פעילות של כרמן. ה-Legacy ("שיחת כרמן ב-WhatsApp", `trigger_type=whatsapp_message_received`, ללא pinning וללא scope) **נתפס תמיד ראשון** ב-`findCarmenSessionAutomation`. תוצאה:
- ההודעה הגיעה ב-Green API → כרמן ענתה דרך Green API (במקום Manus כפי שמוגדר ב"כרמן / ישיר").
- בקבוצות פנימיות — Legacy חוסם עם `group_requires_explicit_scope`, ו"כרמן / קבוצות פנימיות" אף פעם לא נבדק.

בנוסף, גם כשפלואו נתפס — התשובה נשלחת דרך ה-`sendMessage` של ה-webhook הנכנס, ולא דרך ה-action step (`send_manus_message` / `send_green_api_message`) שמוגדר באוטומציה.

## תיקון

### 1. `supabase/functions/_shared/carmen.ts` — `findCarmenSessionAutomation`
- **למחוק לחלוטין את Method 1 (Legacy)**. הפונקציה תחפש רק `automation_flow_steps` עם `step_type='trigger'` ו-`action_type='carmen_whatsapp_session'`.
- כשמסננים לפי `integrationId`: רק steps עם `carmen_integration_id` שווה ל-integrationId, או ללא pinning. (אם יש כמה — להעדיף את ה-pinned-match על פני unpinned.)

### 2. `_shared/carmen.ts` — `handleCarmenMessage` — ניתוב יציאה לפי action step
לאחר ש-`runCarmenAI` מחזירה טקסט, להוסיף שלב חדש שמחפש את ה-action step של אותה אוטומציה ושולח דרכו:

```ts
const { data: actionStep } = await supabase
  .from('automation_flow_steps')
  .select('action_type, configuration')
  .eq('automation_id', carmenAutomation.id)
  .eq('step_type', 'action')
  .in('action_type', ['send_manus_message', 'send_green_api_message'])
  .order('created_at', { ascending: true })
  .limit(1)
  .maybeSingle();
```

- אם `action_type === 'send_manus_message'`: לקרוא ל-`send-manus-wa-message` עם `integrationId = actionStep.configuration.green_api_integration_id` (שם השדה כך בקונפיג הקיים — מצביע על integration_id של Manus כשהאקשן הוא send_manus_message), `phoneNumber`/`chatId` לפי `recipients` (תמיכה ב-`type:phone_manual`, `type:group_field`, ו-fallback ל-`chatId` הנוכחי לקבוצות).
- אם `action_type === 'send_green_api_message'`: לקרוא ל-`send-green-api-message` עם `tenantId` + `phoneNumber`/`groupId` בהתאם.
- אם **לא נמצא action step**: fallback ל-`sendMessage` שה-webhook הזריק (התנהגות קיימת, כדי לא לשבור אוטומציות בלי action).
- במקרה כישלון בשליחה דרך ה-action step — לוג + fallback ל-`sendMessage` של ה-webhook.

### 3. שדרוג webhooks — `green-api-webhook` ו-`manus-wa-webhook`
- אין צורך לשנות את ה-`sendMessage` callback (נשאר כ-fallback). השינוי המהותי בשכבת ה-shared.
- לאחר מחיקת ה-Legacy: ב-green-api-webhook, אם `findCarmenSessionAutomation` מחזירה null (כי כל הפלואו pinned ל-Manus), כרמן פשוט לא תרוץ דרך Green API. זה התנהגות נכונה.

### 4. בלי שינויי DB
לא נוגעים באוטומציות הקיימות. המשתמש יוכל לבטל ידנית את ה-Legacy ("שיחת כרמן ב-WhatsApp") אם ירצה — אבל הקוד יתעלם ממנה בכל מקרה.

### 5. Deploy
`green-api-webhook`, `manus-wa-webhook` (כדי שיטענו את ה-`_shared/carmen.ts` המעודכן).

## אימות אחרי הפריסה
- שליחה ב-WhatsApp ישיר ל-Manus עם המילה "כרמן": תשובה דרך Manus (לא Green API).
- שליחה בקבוצה פנימית מורשית (מתוך `carmen_allowed_group_ids` של "כרמן / קבוצות פנימיות") עם "כרמן": תשובה תופיע בקבוצה דרך Manus.
- שליחה ב-Green API ישיר: אין תגובה של כרמן (כי שתי האוטומציות pinned ל-Manus) — זו ההתנהגות הנכונה כעת.
