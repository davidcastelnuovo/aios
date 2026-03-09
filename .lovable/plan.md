

# תוכנית: הוספת משתנה {{group_invite_link}} למיפוי שדות באוטומציות

## מה צריך לעשות

כשאוטומציה מופעלת מהודעה בקבוצת WhatsApp, להוסיף אפשרות למשוך את קישור ההזמנה לקבוצה ולהציג אותו כמשתנה בתבנית ההודעה.

## שלבים

### 1. הוספת עמודה `invite_link` לטבלת `whatsapp_groups`
מיגרציה שמוסיפה:
```sql
ALTER TABLE public.whatsapp_groups ADD COLUMN IF NOT EXISTS invite_link TEXT;
```

### 2. שליפת קישור קבוצה מ-Green API ב-webhook
בקובץ `supabase/functions/green-api-webhook/index.ts`, כשיוצרים/מעדכנים קבוצה, לקרוא ל-Green API endpoint:
```
GET /waInstance{id}/getGroupInviteLink/{token}
Body: { "groupId": "120363XXXXX@g.us" }
```
ולשמור את הקישור בעמודה `invite_link`.

### 3. העברת `group_invite_link` לאוטומציה
בקובץ `supabase/functions/green-api-webhook/index.ts`, בחלק שמעביר נתונים ל-trigger-automation, להוסיף את `group_invite_link` מה-DB.

### 4. הוספת המשתנה ל-trigger-automation
בקובץ `supabase/functions/trigger-automation/index.ts` (~שורה 1819), להוסיף:
```typescript
group_invite_link: data.group_invite_link || '',
```

### 5. הוספת המשתנה ל-UI
בקובץ `src/components/forms/MessageTemplateBuilder.tsx` (שורה 29), להוסיף לרשימת `AVAILABLE_VARIABLES`:
```typescript
{ key: "group_invite_link", label: "קישור לקבוצה", example: "https://chat.whatsapp.com/ABC123" },
{ key: "group_name", label: "שם קבוצה", example: "קבוצת מכירות" },
{ key: "sender_name", label: "שם שולח", example: "יוסי כהן" },
{ key: "sender_phone", label: "טלפון שולח", example: "050-1234567" },
```

## סיכום קבצים לשינוי
1. מיגרציית DB - עמודה חדשה
2. `green-api-webhook/index.ts` - שליפת invite link מ-API + שמירה + העברה לאוטומציה
3. `trigger-automation/index.ts` - משתנה חדש
4. `MessageTemplateBuilder.tsx` - הצגת המשתנה ב-UI

