

# תוכנית: הפעלת סוכן AI בפועל + תצוגת אאוטפוט

## מצב נוכחי
- ה-Edge Function `trigger-automation` מקבל את הפקודה אבל **לא מעבד צעדי agent** - אין קוד שמזהה step_type = "agent"
- אין קריאה למנוע AI (Gemini/GPT)
- הלוגים נשמרים ב-`automation_logs` אבל ללא תוכן AI
- אין תצוגת אאוטפוט בממשק

## מה צריך לבנות

### 1. Edge Function: `run-ai-agent`
פונקציה חדשה שמקבלת:
- `agent_id` - שליפת הסוכן מ-`ai_agents` (שם, מנוע, אופי, נשמה, טלנט)
- `command_text` - הפקודה מהמשתמש
- `automation_id` - לשמירת הלוג

הפונקציה:
1. שולפת את הגדרות הסוכן מה-DB
2. בונה system prompt מהאופי + נשמה + טלנט
3. קוראת ל-AI Gateway של Lovable עם המנוע שנבחר
4. שומרת את התוצאה ב-`automation_logs` (בשדה `response`)
5. מחזירה את האאוטפוט

### 2. עדכון `trigger-automation`
- הוספת `action_type === 'agent'` שקורא ל-`run-ai-agent`
- העברת `command_text` מה-payload לסוכן

### 3. עדכון `ManualTriggerDialog`
- אחרי ההפעלה, **להציג את התשובה של הסוכן** ישירות בדיאלוג
- במקום לסגור את הדיאלוג, להציג את האאוטפוט בתיבת תוצאה
- אפשרות לכתוב פקודה נוספת (כמו צ'אט)

### 4. תצוגת לוגים באוטומציה
- הוספת טאב/כפתור "לוגים" ב-FlowEditor שמציג את `automation_logs` עם האאוטפוט של הסוכן

## פירוט טכני

### Edge Function `run-ai-agent`
```text
1. שליפת agent מ-ai_agents לפי agent_id
2. בניית system prompt:
   "אתה {name}. האופי שלך: {personality}. הנשמה שלך: {soul}. הטלנט שלך: {talent}."
3. קריאה ל-AI Gateway:
   POST https://jnzguisakdtcollxmgzd.supabase.co/functions/v1/ai-support-chat
   (או קריאה ישירה ל-gateway)
4. שמירת תוצאה ב-automation_logs
5. החזרת response עם output הסוכן
```

### ManualTriggerDialog - שיפור ל-Chat-style
```text
┌─────────────────────────────────┐
│ הפעלה ידנית - שם האוטומציה     │
├─────────────────────────────────┤
│                                 │
│  [אזור תוצאות - scrollable]    │
│  👤 שלח הודעת מעקב לכל הלידים  │
│  🤖 ביצעתי סריקה ומצאתי 12     │
│     לידים חדשים מהיום...        │
│                                 │
│  👤 פקודה נוספת...              │
│  🤖 תשובת הסוכן...             │
│                                 │
├─────────────────────────────────┤
│ [textarea] [כפתור שלח]         │
└─────────────────────────────────┘
```

## קבצים שישתנו
1. **חדש**: `supabase/functions/run-ai-agent/index.ts`
2. **עדכון**: `supabase/functions/trigger-automation/index.ts` - הוספת handler ל-agent
3. **עדכון**: `src/components/automations/ManualTriggerDialog.tsx` - תצוגת צ'אט עם אאוטפוט
4. **עדכון**: `src/components/automations/FlowEditor.tsx` - כפתור לוגים

