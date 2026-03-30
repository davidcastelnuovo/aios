

# חיבור כרמן WhatsApp לשיחות AIOS במערכת

## מצב קיים

המערכת כבר כוללת **שני מנגנונים נפרדים** של כרמן:
1. **AIOS Chat (במערכת)** — שומר שיחות בטבלת `ai_conversations`, מציג בממשק עם היסטוריה מלאה (כמו בצילום המסך)
2. **Carmen WhatsApp Sessions** — עובד ישירות ב-`green-api-webhook`, שומר היסטוריה בטבלת `carmen_whatsapp_sessions`, אבל **לא מסנכרן** לשיחות AIOS

כלומר: שיחות WhatsApp עם כרמן לא מופיעות ברשימת השיחות בממשק.

## מה צריך לעשות

לחבר את שני העולמות — כשכרמן עונה בוואטסאפ, השיחה גם תופיע (ותתעדכן) ברשימת השיחות של AIOS בממשק.

## תוכנית

### שינוי 1: סנכרון לטבלת `ai_conversations` מתוך הוובהוק

בפונקציה `green-api-webhook`, בכל פעם שכרמן מגיבה בסשן WhatsApp (הודעה חדשה → תשובה):

1. **בעת פתיחת סשן חדש** — ליצור רשומה חדשה ב-`ai_conversations` עם כותרת כמו "שיחת WhatsApp — [שם השולח]" ולשמור את ה-`conversation_id` בטבלת `carmen_whatsapp_sessions`
2. **בכל הודעה נוספת** — לעדכן את מערך ה-`messages` ב-`ai_conversations` עם ההודעה החדשה והתשובה

### שינוי 2: הוספת עמודה `ai_conversation_id` לטבלת `carmen_whatsapp_sessions`

מיגרציה פשוטה שמוסיפה:
```sql
ALTER TABLE carmen_whatsapp_sessions 
ADD COLUMN ai_conversation_id uuid REFERENCES ai_conversations(id);
```

### שינוי 3: זיהוי המשתמש הנכון

הבעיה: שיחות WhatsApp מגיעות דרך Service Role, אבל `ai_conversations` דורש `user_id`. הפתרון:
- להשתמש ב-`connection_user_id` (הבעלים של חיבור Green API) כ-`user_id` בשיחה
- כך השיחה תופיע לאותו משתמש שמחובר ל-Green API

## סיכום שינויים

| קובץ | שינוי |
|---|---|
| מיגרציה חדשה | הוספת `ai_conversation_id` ל-`carmen_whatsapp_sessions` |
| `green-api-webhook/index.ts` | בפתיחת סשן: יצירת `ai_conversations` רשומה. בכל הודעה: עדכון messages |

**תוצאה**: כל שיחה עם כרמן בווטסאפ תופיע אוטומטית ברשימת השיחות בממשק (כמו בצילום המסך), עם היסטוריה מלאה ותסנכרן בזמן אמת.

