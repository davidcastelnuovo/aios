

# תוכנית: הוספת סוג צעד "סוכן AI" לפלוו האוטומציות

## סקירה
הוספת אפשרות חדשה "סוכן" בתפריט הוספת צעד (ליד פעולה, תנאי, השהייה). בחירת סוכן תפתח דיאלוג לבחירת סוכן קיים או יצירת חדש. יצירת סוכן חדש תכלול: שם, מנוע AI, אופי, נשמה וטלנט.

## שינויי DB (מיגרציה)

יצירת טבלת `ai_agents` עם tenant isolation:

```sql
CREATE TABLE public.ai_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  engine TEXT NOT NULL DEFAULT 'google/gemini-2.5-flash',
  personality TEXT, -- אופי
  soul TEXT,        -- נשמה
  talent TEXT,      -- טלנט
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.ai_agents ENABLE ROW LEVEL SECURITY;
-- RLS policies for tenant isolation
```

## שינויי קוד

### 1. AddStepMenu.tsx
- הוספת אפשרות רביעית "סוכן" עם אייקון `Bot` ובצבע כתום
- עדכון ה-`onAdd` callback לתמוך ב-`"agent"` כ-step_type

### 2. FlowNode.tsx
- הוספת `"agent"` ל-`FlowNodeData.step_type` type
- הוספת קונפיגורציה ויזואלית ב-`STEP_TYPE_CONFIG` (אייקון Bot, צבע כתום)

### 3. FlowEditor.tsx
- עדכון `addStep` לתמוך ב-`"agent"`

### 4. StepConfigPanel.tsx
- כש-step_type === "agent", מציגים:
  1. **בחירת סוכן קיים** - Select עם רשימת סוכנים מ-`ai_agents` (מסוננים לפי tenant)
  2. **כפתור "צור סוכן חדש"** - פותח דיאלוג `CreateAgentDialog`
- **CreateAgentDialog** - דיאלוג עם שדות:
  - **שם הסוכן** (text, חובה)
  - **מנוע AI** (select): google/gemini-2.5-flash, google/gemini-2.5-pro, openai/gpt-5, openai/gpt-5-mini וכו׳
  - **אופי** (textarea): תיאור האופי של הסוכן
  - **נשמה** (textarea): מה מניע את הסוכן, הערכים שלו
  - **טלנט** (textarea): מה הסוכן טוב בו, היכולות המיוחדות
- לאחר יצירה/בחירה, ה-agent_id נשמר ב-`configuration.agent_id`

### 5. automation_flow_steps
- עדכון הטבלה לתמוך ב-step_type = 'agent' (אם יש enum - הוספה)

## ללא שינויי Edge Functions
בשלב זה רק UI + DB. הפעלת הסוכן בפועל תהיה בשלב הבא.

