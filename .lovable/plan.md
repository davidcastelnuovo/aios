

# תיקון כרמן בוואטסאפ — chat_id חסר בסשן

## הבעיה

כרמן מגיבה להודעה הראשונה (עם מילת הטריגר "כרמן") אבל לא לשאר ההודעות בשיחה. הסיבה:

1. **הוובהוק שולח payload לאוטומציה בלי `chat_id`** — שדה `chat_id` (לדוגמה `972507677613@c.us`) לא נכלל ב-payload שנשלח ל-`trigger-automation`.
2. **הסשן נוצר עם `chat_id` ריק** — ה-`trigger-automation` יוצר סשן ב-`carmen_whatsapp_sessions` עם `chat_id: ""`.
3. **הוובהוק לא מוצא את הסשן** — כשההודעה הבאה מגיעה, `findActiveCarmenSession` ב-`green-api-webhook` מחפש לפי `chat_id` אבל הסשן שמור עם ערך ריק, אז לא נמצא, וההודעה לא מועברת לכרמן.

## התיקון (2 שינויים)

### 1. הוספת `chat_id` ל-automation payload (`green-api-webhook`)
בשורות ~1729-1745, להוסיף את `senderData.chatId` לתוך ה-payload שנשלח ל-trigger-automation:
```typescript
data: {
  chat_id: senderData.chatId,  // ← הוספה
  sender_name: ...,
  sender_phone: phoneNumber,
  ...
}
```

### 2. תיקון `findActiveCarmenSession` לחפש גם לפי phone (`green-api-webhook`)
שינוי הפונקציה בשורות 259-274 כך שתחפש גם לפי phone (כמו ש-trigger-automation כבר עושה):
```typescript
async function findActiveCarmenSession(supabase, tenantId, chatId) {
  const phone = chatId.split('@')[0];
  const { data } = await supabase
    .from('carmen_whatsapp_sessions')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('status', 'active')
    .or(`chat_id.eq.${chatId},phone.eq.${phone}`)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data || null;
}
```

### 3. תיקון הסשן הקיים בDB
עדכון הסשן הפעיל הנוכחי (שנוצר עם chat_id ריק) כדי שיעבוד מיד:
```sql
UPDATE carmen_whatsapp_sessions 
SET chat_id = '972507677613@c.us' 
WHERE id = '8f7b67b8-...' AND chat_id = '';
```

### סיכום
שני שינויים קטנים + תיקון נתון בDB. אחרי זה כרמן תזהה את הסשן הפעיל בכל הודעה ותמשיך את השיחה.

