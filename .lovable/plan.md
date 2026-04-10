

# תיקון: כרמן לא מצליחה ליצור משימת סוכן

## הבעיה
שתי שגיאות בלוגים:

1. **`Cannot set properties of null (setting 'id')`** — בשורה 397, כשאין סוכן בשם "carmen" ב-`ai_agents`, המשתנה `agentData` הוא `null`. הקוד מנסה לעשות `agentData.id = fallbackAgent.id` על אובייקט null.

2. **`invalid input value for enum task_status: "completed"`** — כרמן מנסה לעדכן סטטוס משימה לערך שלא קיים ב-enum.

## התיקון

### קובץ: `supabase/functions/ai-support-chat/index.ts`

**שורות 385-398** — תיקון הלוגיקה של fallback agent:
```typescript
// לפני (באגי):
if (!agentData?.id) {
  const { data: fallbackAgent } = ...
  if (!fallbackAgent?.id) {
    return { success: false, error: '...' };
  }
  agentData.id = fallbackAgent.id;  // 💥 agentData is null!
}

// אחרי (מתוקן):
let agentId = agentData?.id;
if (!agentId) {
  const { data: fallbackAgent } = ...
  if (!fallbackAgent?.id) {
    return { success: false, error: '...' };
  }
  agentId = fallbackAgent.id;
}
// שימוש ב-agentId במקום agentData.id
```

**שגיאת enum** — בודק אילו ערכים חוקיים ב-`task_status` ומעדכן את ה-system prompt או הכלי כך שכרמן תשתמש בערכים הנכונים בלבד.

## תוצאה
כרמן תוכל ליצור משימות סוכן ולעדכן סטטוסים ללא שגיאות.

