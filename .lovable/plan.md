נכון — Carmen לא צריכה להיות “WhatsApp bot” בנפרד ו“צ׳אט פנימי” בנפרד. הבעיה המרכזית היא שיש היום כמה שכבות שמנסות לעשות אותו דבר: WhatsApp עובר דרך `_shared/carmen.ts`, הצ׳אט הפנימי/AIOS קורא ל-`run-ai-agent`, יש Prompt V1/V2 כפול, ויש כמה מערכות זיכרון במקביל. לכן היא יכולה להתנהג טוב יום אחד ולהתקלקל יום אחר: לא כל הערוצים מקבלים את אותו prompt, אותו memory retrieval, אותו routing לכלים, ואותה לוגיקת למידה.

## אבחנה קצרה

1. **אין “מוח Carmen” יחיד**
   - יש core agent ב-`run-ai-agent`, אבל WhatsApp עוטף אותו עם חוקים, session history, echo guards ו-notify metadata.
   - AIOS/הצ׳אט הפנימי משתמשים באותו endpoint חלקית, אבל לא בהכרח באותו session context, אותו WhatsApp context, או אותה שכבת למידה.

2. **הזיכרון מפוצל**
   - `ai_memory` שומר הוראות מפורשות.
   - `agent_memory` משמש recall כללי/Hermes-style.
   - `carmen_memory_episodes` ו-`carmen_memory_pointers` לומדים מסשני WhatsApp.
   - `ai_skills` שומר פרוצדורות.
   אבל אין עדיין loader אחד שמבטיח שכל ערוץ מקבל את אותה חבילת זיכרון רלוונטית.

3. **הלמידה תלויה מדי בסגירת סשן**
   - אם המשתמש לא סוגר סשן, או שהסשן פג/מתחלף, לא תמיד מופעלת למידה פסיבית.
   - הוראות מפורשות כן אמורות להישמר מיידית, אבל בגלל פיצול prompt/tools היא לא תמיד עושה את זה עקבית.

4. **הבחנה בין ערוצים קיימת אבל לא מספיק נקייה**
   - יש `surface: 'whatsapp' | 'aios' | 'task'`, אבל הכללים מפוזרים בתוך prompt וקוד.
   - צריך להפוך את זה לחוזה ברור: אותו מוח, אותו זיכרון, אותן יכולות — רק סגנון ו-delivery משתנים לפי הערוץ.

## התוכנית

### 1. לבנות “Carmen Core Context” אחד
ניצור/נסדר שכבה משותפת שמחזירה לכל ריצה של Carmen אותו context:

```text
Carmen request
→ identify surface: whatsapp / internal_chat / aios / background_task
→ load same identity + tenant + caller + permissions
→ load same memories + skills + recent history
→ choose same tools with surface-specific guards
→ execute
→ save learning + action trace
→ reply through the correct channel
```

הערוץ ישפיע רק על:
- אורך וסגנון תשובה.
- האם מותר לדבר על “חלון/התקדמות”.
- איך שולחים follow-up בסיום משימת רקע.
- איזה היסטוריית שיחה מקומית מצורפת.

### 2. לאחד Memory Loader לכל הערוצים
נבנה helper משותף שנטען בתחילת כל ריצה, גם WhatsApp וגם צ׳אט פנימי:

- הוראות קבועות מ-`ai_memory` category `instructions`.
- זיכרון רלוונטי מ-`agent_memory` לפי FTS.
- פרקי זיכרון של Carmen מ-`carmen_memory_episodes`.
- pointers חיים מ-`carmen_memory_pointers` כשיש נושא/לקוח/שיחה רלוונטיים.
- סקילים מ-`ai_skills` לפי חיפוש טקסטואלי/FTS.

המטרה: אם לימדת את Carmen משהו ב-WhatsApp, היא תדע אותו גם בצ׳אט הפנימי — ולהפך.

### 3. להקשיח “שמירה לזיכרון” כהתנהגות מערכתית, לא רק prompt
במקום לסמוך רק על זה שהמודל יחליט לקרוא `save_memory`:

- נוסיף pre-check בקוד להודעות עם ביטויים כמו “תזכרי”, “מעכשיו”, “תמיד”, “אל תעשי”, “שמרי”.
- אם מזוהה instruction מפורש — נשמור אותו מיידית לשכבת הזיכרון לפני/במקביל לקריאת המודל.
- עדיין נשאיר למודל את האפשרות לשמור זיכרון עם key מדויק יותר, אבל לא נסתמך רק עליו.

### 4. להפריד בין “יכולות” לבין “משלוח תשובה”
כל הכלים העסקיים יהיו זמינים לפי הרשאות ותפקיד, לא לפי ערוץ.

אבל delivery יהיה תלוי surface:
- WhatsApp: הודעה קצרה, בלי markdown, בלי “סגור חלון”, ועם follow-up רק אם באמת נוצרה משימת רקע.
- צ׳אט פנימי/AIOS: אפשר תשובה מפורטת יותר, טבלאות, tool activity, והתקדמות.
- background task: אין האצלה נוספת, רק ביצוע וסיכום סופי.

### 5. לתקן עקביות delegation/background
- `delegate_to_subagent` יהיה זמין רק כשבאמת ביקשת עבודה ברקע או כשהמשימה גדולה מדי.
- בכל ערוץ יישמר source metadata:
  - אם התחיל מ-WhatsApp → התוצאה חוזרת ל-WhatsApp.
  - אם התחיל מצ׳אט פנימי/AIOS → התוצאה נשמרת ומוצגת שם.
- אסור ל-Carmen לטעון “עובדת ברקע” בלי `sub_task_id` אמיתי.

### 6. לחבר tracing בסגנון open-source agents
נשתמש בדפוס ReAct/LangGraph/OpenAI Agents בלי להמציא מחדש:

```text
plan → tool call → observation → next step → final answer → memory update
```

בפועל:
- לרשום כל ריצה ל-`agent_runs` או לפחות ל-`agent_action_log` בצורה עקבית.
- לשמור tool calls, תוצאות, final answer, surface, user/channel.
- כך אפשר לבדוק בדיעבד אם היא באמת ביצעה או רק ענתה.

### 7. לתקן למידה פסיבית משיחות קודמות
- לא להסתמך רק על טריגר “סשן נסגר”.
- להפעיל למידה גם בסשנים שפגו/הסתיימו אוטומטית או אחרי מספר הודעות משמעותי.
- תובנות חשובות יישמרו כזיכרון; פרוצדורות חוזרות יישמרו כ-skill.

### 8. לנקות כפילות Prompt V1/V2
- להפוך את `carmen-prompt-v2` למקור האמת.
- להסיר/לצמצם חוקים כפולים שמוזרקים גם ידנית בתוך `run-ai-agent`.
- להבטיח שכל surface משתמש באותה מערכת כללים, עם section קטן שמותאם לערוץ.

## בדיקות קבלה

1. **למידה חוצה ערוצים**
   - ב-WhatsApp: “כרמן, מעכשיו אל תעני לי עם הצעות נוספות”.
   - בצ׳אט פנימי: Carmen חייבת לפעול לפי זה.

2. **למידה הפוכה**
   - בצ׳אט פנימי מלמדים פרוצדורה.
   - ב-WhatsApp מבקשים פעולה דומה — Carmen משתמשת בפרוצדורה.

3. **WhatsApp רגיל**
   - “כרמן בדיקת דופק” → תשובה עם נתונים אמיתיים, לא “עובדת ברקע”.

4. **WhatsApp רקע מפורש**
   - “תרוצי ברקע ותעדכני אותי” → נוצר `sub_task_id`, ובסיום נשלחת הודעת WhatsApp.

5. **צ׳אט פנימי/AIOS**
   - אותה בקשה מקבלת אותו reasoning וכלים, אבל יכולה להציג יותר פירוט/טבלה/התקדמות.

6. **בדיקת עקביות**
   - לכל תשובה שטוענת “בוצע” יש tool call או action log שמוכיח את זה.

## מה לא נעשה

- לא נבנה Carmen חדשה מאפס.
- לא נפריד מוח ל-WhatsApp ומוח לצ׳אט.
- לא נסתמך רק על prompt כדי “לקוות” שהיא תלמד.
- לא נשבור הרשאות/tenant scoping קיימים.