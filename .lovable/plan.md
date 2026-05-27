## מה בונים

החלפת הבחירה היחידה ("יעד שליחה" עם RadioGroup) ברשימת **יעדים מרובים** בצעד WhatsApp/Green API באוטומציה. כל שורה היא יעד אחד עם סוג משלה, וניתן להוסיף/למחוק שורות. ההודעה תישלח לכל היעדים ברשימה.

## סוגי יעד נתמכים (לכל שורה)

1. **טלפון – שדה דינמי** (`phone_field`) – בוחר שדה מה-payload (קיים)
2. **טלפון – ידני** (`phone_manual`) – הזנת מספר קבוע (קיים)
3. **קבוצה – שדה דינמי** (`group_field`) – שדה group_id/group_chat_id (קיים)
4. **קבוצה – מזהה ידני** (`group_manual`) – הדבקת chatId קבוע של קבוצה (קיים)
5. **איש קשר מה-CRM** (`contact_lookup`) – חדש: חיפוש Combobox בלקוחות/לידים, בעת ריצה נשלף הטלפון העדכני
6. **קבוצה מרשימת WhatsApp** (`group_lookup`) – חדש: בחירה מתוך `whatsapp_groups` של הטננט

## UI – `src/components/automations/StepConfigPanel.tsx`

מחליפים את הבלוק "יעד שליחה" + שדות המותנים (שורות 1128–1259) ברכיב חדש `RecipientsListEditor`:

- שדה חדש בקונפיגורציה: `recipients: Recipient[]` (במקום phone_mode/phone_field/manual_phone/group_id_field/manual_group_id הבודדים).
- כל שורה: Select לסוג יעד + שדה ערך מותאם לסוג + כפתור מחיקה (🗑).
- כפתור **"+ הוסף יעד"** למטה.
- תאימות לאחור: אם נטען צעד ישן בלי `recipients`, נמיר אוטומטית את הערכים הישנים לשורה אחת ברשימה.
- בחירת איש קשר/קבוצה: Combobox עם חיפוש (כמו `WhatsAppGroupSelect` הקיים) שמושך מ-`clients`/`leads`/`whatsapp_groups` עם סינון tenant.

```ts
type Recipient =
  | { type: 'phone_field'; field: string }
  | { type: 'phone_manual'; phone: string }
  | { type: 'group_field'; field: string }
  | { type: 'group_manual'; group_id: string }
  | { type: 'contact_lookup'; entity: 'lead'|'client'; id: string }
  | { type: 'group_lookup'; group_id: string };
```

## Backend – `supabase/functions/trigger-automation/index.ts`

ב-`executeGreenApiMessage` (שורה 2552):

1. אם `config.recipients?.length`: נעבור עליה ונבנה מערך `chatIds` ע"י resolver אחד לכל סוג (להוציא לפונקציה `resolveRecipient(r, data, supabase, tenantId)` שמחזירה chatId).
2. אם אין `recipients` – שומרים את הלוגיקה הקיימת (legacy) כפי שהיא (תאימות לאחור).
3. לולאה שמריצה את אותו `sendMessage` הקיים לכל chatId, עם try/catch לכל יעד כדי שכשל אחד לא יעצור את היתר. רושמים תוצאות ב-execution log: `{ recipient, status, error? }`.
4. הצלחה כוללת = לפחות אחד נשלח (אחרת throw עם סיכום).

## תאימות לאחור

- בקריאה: אם אין `recipients`, נבנה ב-frontend בזמן הטעינה רשימה בת איבר אחד מ-phone_mode הישן (לא נכתוב חזרה אוטומטית כדי לא לדרוס בלי שמירה).
- בכתיבה: ברגע שהמשתמש שומר עם הרכיב החדש, נשמור `recipients` ונמחק את השדות הבודדים מהקונפיג.
- backend ממשיך לתמוך בשני המבנים.

## מחוץ לסקופ

- אין שינוי בטריגרים, ב-Loop Protection, ב-Carmen, או ב-StepConfigPanel של צעדים אחרים (טלגרם/Email).
- לא נוגעים ב-RLS / סכמת DB (אין שדה חדש במסד – הכל בתוך `automations.configuration` JSON).
