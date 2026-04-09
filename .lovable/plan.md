

# תוכנית: כרמן ללא הגבלת סבבים + כלי batch לעדכון דופק

## הבעיה
כרמן מוגבלת ל-5 סבבי כלים (`MAX_TOOL_ROUNDS = 5`). בבדיקת דופק היא צריכה לקרוא `update_client_health` פעם לכל לקוח — אז אחרי ~4 לקוחות היא נעצרת, ובגלל שאין לה מודעות למגבלה, היא כותבת "עברתי על כולם" גם כשלא.

## הפתרון — שתי גישות משלימות

### 1. כלי batch חדש: `batch_update_client_health`
במקום ש-Carmen תקרא `update_client_health` פעם לכל לקוח (40 קריאות = 40 סבבים), ניצור כלי שמקבל **מערך של לקוחות** ומעדכן את כולם בקריאה אחת.

**פרמטרים:**
```json
{
  "updates": [
    { "client_id": "...", "mood_status": "happy", "note": "ביצועים תקינים" },
    { "client_id": "...", "mood_status": "churn_risk", "note": "התייקרות 30%" }
  ]
}
```

**לוגיקה:** לולאה פנימית שמבצעת עדכון clients + communication_logs + client_updates לכל לקוח ברשימה. מחזירה סיכום: כמה עודכנו, כמה נכשלו.

### 2. העלאת MAX_TOOL_ROUNDS ל-25
גם עם batch, יתכנו תהליכים שדורשים יותר מ-5 סבבים. נעלה ל-25 בשתי הפונקציות:
- `ai-support-chat` — שורה 2331
- `run-ai-agent` — ברירת מחדל בשורה 1427

### 3. הוראת מערכת: דיווח אמיתי בלבד
נוסיף ל-system prompt:
> **כשמבצעים בדיקת דופק או עדכון דשבורד:** השתמשי ב-`batch_update_client_health` כדי לעדכן את כל הלקוחות בקריאה אחת. **אסור** לדווח "עברתי על כל הלקוחות" אם לא ביצעת `update_client_health` או `batch_update_client_health` בפועל לכל אחד מהם. תמיד ציייני כמה לקוחות עודכנו מתוך כמה.

## קבצים לעריכה
- `supabase/functions/ai-support-chat/index.ts` — כלי batch חדש, MAX_TOOL_ROUNDS=25, הוראת system prompt
- `supabase/functions/run-ai-agent/index.ts` — MAX_TOOL_ROUNDS ברירת מחדל 25

## תוצאה צפויה
- בדיקת דופק ל-40 לקוחות: קריאה אחת ל-`analyze_campaign_performance` + קריאה אחת ל-`batch_update_client_health` = **2 סבבים** במקום 41
- כרמן לא תשקר — היא תדווח בדיוק כמה לקוחות עודכנו

