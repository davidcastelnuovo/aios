

# תוכנית: תיוג אוטומטי של כל האימיילים עם אותו נושא

## הבעיה
כרגע כשמתייגים אימייל, הכלל נשמר ומוחל רק על האימיילים **הנוכחיים בעמוד** (25 הודעות). אימיילים ישנים יותר עם אותו נושא לא מתויגים.

## הפתרון
אחרי תיוג אימייל, לבצע חיפוש ב-Gmail API לפי `subject:"הנושא"` כדי למצוא **את כל** האימיילים עם אותו נושא, ולשייך את כולם לקטגוריה.

## שינויים

### `src/pages/Gmail.tsx` — פונקציית `assignCategory`
בשלב 3 של ה-mutation (שורות 363-376), במקום לסנן רק מתוך `messagesData.messages`:
1. לקרוא ל-edge function `gmail-api` עם `action: 'list'` ו-`query: subject:"..."` + `maxResults: 500`
2. לעבור על כל התוצאות ולשמור `gmail_message_categories` לכל אחת

### לוגיקה
```
// Step 3: Search Gmail for ALL messages with same subject
const searchRes = await supabase.functions.invoke('gmail-api', {
  body: { action: 'list', query: `subject:"${exactSubject}"`, maxResults: 500 }
});
const allMatching = searchRes.data?.messages || [];
// Upsert category for each found message
for (const m of allMatching) {
  await supabase.from('gmail_message_categories').upsert({...});
}
```

שינוי בקובץ אחד בלבד (`src/pages/Gmail.tsx`), בפונקציית `assignCategory`.

