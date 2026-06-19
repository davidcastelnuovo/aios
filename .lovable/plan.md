## ביקורת איכות — שינויי הרמס (PR #14)

### ציון כולל: 6/10 — רעיון טוב, ביצוע חלקי, באג קריטי שכבר תוקן

### ✅ מה נעשה טוב

1. **ארכיטקטורה מודולרית** — `carmen-prompt-v2.ts` מפצל את הפרומפט לפונקציות נפרדות (`buildIdentity`, `buildReasoningFramework`, `buildAntiHallucination`, ...). הרבה יותר קריא ותחזיק מ-1,300 שורות string concatenation שיש ב-V1.
2. **Opt-in נכון** — דגל `metadata.prompt_version='v2'` ברמת agent בודד, V1 נשאר ברירת מחדל. אפס סיכון ללקוחות קיימים.
3. **תוכן ה-Reasoning Framework** עצמו — שלבי חשיבה (הבנה → תכנון → ביצוע ואימות) עם דוגמה קונקרטית. זה שיפור אמיתי ולא רק קוסמטיקה.
4. **TypeScript types מסודרים** — `AgentConfig`, `CallerContext`, `TenantContext`, `MemoryContext`, `PromptBuildContext`. עובר `deno check` נקי.
5. **UI Selector** — אינטגרציה נקייה ב-`ProfileTab`, נשמר דרך ה-mutation הקיים, בלי DB schema change.

### 🔴 מה נעשה גרוע

1. **באג קריטי: שגיאת תחביר** — `} else {` נפתח ב-1599 ולא נסגר. הקובץ לא היה מתקמפל, ה-edge function לא היה עולה. **תוקן עכשיו**, אבל זה לא אמור לקרות בקוד ש-merged ל-main. סימן ש-Hermes לא הריץ `deno check` לפני push.
2. **Indentation שבור** — בענף ה-V1 שמתחת ל-`else {`, הקוד הקיים הושאר ב-4 רווחים במקום להזיח ל-6. עובד אבל מבלבל ויוצר את הבאג של (1).
3. **כפילות תוכן ב-V2** — V2 builder בונה בעצמו: identity, modes/skills, writing_style, response_length, date, tenant context, memory, lead context. אבל הקוד המאוחד (`run-ai-agent/index.ts` שורות 1626–1916) ממשיך לרוץ ללא תנאי גם ב-V2 ומוסיף שוב: task_mode, task_skills, active_modes, active_skills, writing_style, response_length, date, tenant, memory, lead, WhatsApp rules, knowledge base, caller identity. **שני בלוקים מלאים של אותו תוכן בתוך אותו system prompt**. זה מנפח את הפרומפט פי 2 ויוצר הוראות סותרות פוטנציאלית.
4. **חסר שינוי תוכן אמיתי** — מבטיח "ReAct, structured reasoning, error recovery" אבל בפועל V2 = V1 + 4 פסקאות חדשות (Reasoning Framework, Anti-Hallucination, Task Types, Self-Learning). שאר הסעיפים זהים מילה במילה ל-V1. זה refactor נחמד יותר מ-upgrade.
5. **חסרים tests** — לא נוסף `_test.ts` על אף שיש תשתית ל-`deno test` בפרויקט. לא ניתן לוודא שה-V2 builder מפיק פלט שקול ל-V1 לפני החלפה.
6. **חסר רישום לוג** — אין `console.log('[Carmen] using prompt version: v2')` כדי לדעת בפרודקשן איזה agent רץ באיזו גרסה.

### 📋 מה אני מציעה לעשות (אופציונלי, רק אם רוצים לסיים את העבודה כמו שצריך)

#### A. ניקוי כפילות ב-V2 (מומלץ מאוד)
לעטוף את שורות 1626–1916 ב-`run-ai-agent/index.ts` בתוך `if (!shouldUseV2Prompt(agent)) { ... }` כך שכל ה-injection בלוקים ירוצו רק ב-V1. ב-V2 ה-builder כבר עושה את הכל.

#### B. הוספת בדיקה ידנית
- לפתוח Agent Profile של כרמן → הגדרות ריצה → גרסת Prompt = V2 → לשמור.
- לשלוח לכרמן הודעה אחת ב-WhatsApp ("מה שלום הלקוחות?").
- לבדוק `supabase--edge_function_logs` של `run-ai-agent` ולוודא שאין שגיאות.

#### C. הוספת לוג גרסה
שורה אחת ב-`run-ai-agent`:
```ts
console.log(`[Carmen] agent=${agent.name} prompt_version=${shouldUseV2Prompt(agent) ? 'v2' : 'v1'}`)
```

#### D. אין שינוי DB
העמודה `metadata jsonb` כבר קיימת ב-`ai_agents`. אין מיגרציה.

---

### השורה התחתונה
**הכיוון נכון, הביצוע חצי-אפוי**. הקוד ה-V2 עצמו איכותי, אבל האינטגרציה לפונקציה הקיימת נעשתה בחיפזון: באג תחביר, indent שבור, כפילות תוכן, אפס בדיקות. יחסית לעבודה שהרמס מציג כ-"production ready" — היא לא הייתה.

מאשר שאעבור ל-build ואבצע את A+C? (B אתה צריך לעשות ידנית בדפדפן.)