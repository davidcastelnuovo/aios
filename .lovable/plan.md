## תיקון: כרמן ב-WhatsApp עונה "אני עובדת ברקע" אבל לא באמת מאצילה / לא חוזרת עם תוצאה

### מה קורה בפועל
1. **`run-ai-agent/index.ts`** מסיר את הכלי `delegate_to_subagent` בברירת מחדל רק כש־`surface === 'aios'` (שורה ~2507). על `surface === 'whatsapp'` הכלי **כן** זמין → המודל ניגש אליו גם ל"בדיקת דופק" רגילה.
2. גם אם המודל באמת קורא ל־`delegate_to_subagent`, ב-`run-agent-task` (שלב ה-completion, שורה ~211) **אין מסלול שמחזיר את התוצאה ל-WhatsApp**. אין שמירה של `sender_phone` / `group_id` / `chat_id` על ה-task, ואין שליחת הודעת סיום ב-WA → המשתמש לא מקבל עדכון.
3. הניסוח "תוכל לסגור את החלון" / "תוכל לראות את ההתקדמות בזמן אמת" מתאים ל-AIOS (יש דיאלוג עם פרוגרס), לא ל-WA.

### שינויים

**1. חסימת האצלה ב-WhatsApp (כמו ב-AIOS) — `supabase/functions/run-ai-agent/index.ts`**
בשורה ~2507 להחליף את הענף `else if (surface === 'aios')` כך שיתפוס גם `whatsapp`:
```ts
} else if (surface === 'aios' || surface === 'whatsapp') {
  if (!userAskedBackground) filteredTools = filteredTools.filter(t => t.name !== 'delegate_to_subagent')
  if (!userAskedManus) filteredTools = filteredTools.filter(t => t.name !== 'delegate_to_manus')
  if (!userAskedGithubAgent) filteredTools = filteredTools.filter(t => t.name !== 'delegate_to_github_agent')
}
```
משמעות: ב-WA, כל עוד המשתמש לא כתב מפורשות "ברקע / תמשיכי לבד / אל תחכי לי / background" — כרמן חייבת לבצע ישירות ולענות בתשובה אחת. לא ניתן יותר "להתחבא" מאחורי delegation שלא קורה.

**2. חיזוק כללי WhatsApp ב-prompt — `supabase/functions/_shared/carmen-prompt-v2.ts` (`buildWhatsAppRules`)**
להוסיף בלוק:
```
🚫 **אסור לכתוב "תוכל לסגור את החלון" / "תוכל לראות את ההתקדמות בזמן אמת" / "אעדכן בדיאלוג"** — אין חלון ב-WhatsApp.
🚫 **אסור לטעון "אני עובדת על זה ברקע" אלא אם באותה ריצה קראת בפועל ל-delegate_to_subagent וקיבלת sub_task_id.** אם הכלי לא זמין — חובה לבצע ישירות ולענות עם נתונים אמיתיים, גם אם זה דורש 3–6 קריאות כלים.
✅ אם בכל זאת האצלת (המשתמש ביקש מפורשות) — עני: "התחלתי. אשלח לך עדכון בוואטסאפ ברגע שאסיים." (לא "תוכל לסגור את החלון").
```

**3. החזרת תוצאת subagent ל-WhatsApp — `supabase/functions/_shared/subagent.ts` + `run-agent-task/index.ts`**
- ב-`createSubagent` (subagent.ts) להוסיף את שדות ה-WA של ההורה ל־`agent_tasks.metadata`: `wa_sender_phone`, `wa_group_id`, `wa_chat_id`, `parent_surface: 'whatsapp'`. הערכים יועברו מ-`run-ai-agent` ל-`createSubagent` (כבר זמינים שם דרך ה-payload של ה-WA webhook → ניתן להעביר דרך פרמטר חדש `parent_context`).
- ב-`run-agent-task/index.ts` בענף ה-completion (שורה ~211, אחרי `update status='completed'`) לבדוק אם `metadata.parent_surface === 'whatsapp'` → לשלוח הודעת WA עם `final_output` (חתוך ל-1500 תווים) דרך ה-edge function הקיים שכבר שולח הודעות WA של כרמן (מאתרים אותו ע"י grep `send_whatsapp` / `green-api-send` בקוד הקיים). במקרה כשל בשליחה — לוג בלבד, לא להפיל את המשימה.

### בדיקה
- שיחה ב-WA: "תבדקי דופק לכל הלקוחות" → כרמן חייבת להחזיר תוצאה ישירה באותו תור (delegate_to_subagent כבר לא ברשימת הכלים).
- שיחה ב-WA: "תרוצי ברקע ותעדכני אותי בסוף — סריקה של 30 לקוחות" → delegate_to_subagent זמין, ההודעה הראשונה היא "התחלתי, אעדכן בוואטסאפ כשאסיים", וכשהמשימה מסתיימת — הודעת WA אוטומטית עם הסיכום.
- AIOS: התנהגות ללא שינוי.
