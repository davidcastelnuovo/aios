# Carmen Authoring — כרמן בונה אוטומציות (באישור)

כרמן יכולה לתכנן אוטומציה ולשלוח אותה לאישור; היא נוצרת **כבויה** רק לאחר אישור.

## זרימה
1. המשתמש: "כרמן, תבני לי אוטומציה ש…".
2. כרמן קוראת לכלי **`propose_automation`** עם spec: `name`, `trigger_type`, `trigger_config`, ו-`steps[]` (כל שלב: `type` agent/action/condition/delay/merge, ולשלב agent — `skin` + `instruction`).
3. הכלי מכניס שורת **pending** ל-`agent_approval_queue` (`tool_name='create_automation'`, ה-spec ב-`tool_input`). כרמן מציגה את התכנון ומבקשת אישור. **שום דבר לא נוצר עדיין.**
4. המשתמש מאשר (טאב Approvals / כפתור אישור בוואטסאפ).
5. הביצוע מגיע ל-**`carmen-approval-execute`** (handler `create_automation`) שבונה `automations` + `automation_flow_steps` כשרשרת לינארית **כבויה** (`active=false`), עם הסקינז מוצמדים לצמתי agent.
6. המשתמש בודק בעורך הויזואלי, מכוון, ומפעיל.

## שני נתיבי אישור (שניהם מנותבים נכון)
- **UI** (`ApprovalsTab` → `resume-agent-run`): special-case ל-`create_automation` → `carmen-approval-execute`.
- **כרמן עצמה** (`run-ai-agent` → `execute_pending_approval` → `carmen-approval-execute`).

## בטיחות
- האוטומציה תמיד נוצרת **כבויה** — לא רצה עד שהמשתמש מפעיל.
- אישור חובה לפני יצירה (gate ב-`agent_approval_queue`).
- עד 20 שלבים; טריגר ו-spec מאומתים; כשל מסומן `failed` עם סיבה.
- נבנה על דפוס Campaign Pulse (שרשרת לינארית) — fan-in אמיתי = שדרוג מנוע נפרד.

## הוספת צעד WhatsApp לאוטומציה קיימת
1. `get_automation_details` — מחזיר `configuration` מלא (מסונן) + `propose_format` לכל צעד.
2. `propose_automation_add_step` — מוסיף צעד בודד (למשל `send_greenapi_message`) בסוף או אחרי `after_step_id`; לא מוחק צעדים קיימים.
3. אישור → `carmen-approval-execute` (`add_automation_step`).
4. סקין: `carmen_automation_add_whatsapp_step`.

## פערים לשלב הבא
- עריכת אוטומציה קיימת (החלפת כל ה-flow) — `propose_automation_edit` (מסוכן; העדפה ל-`add_step`).
- הפעלה/כיבוי באישור (כרגע ידני בעורך).
- תצוגה מקדימה ויזואלית של ההצעה בתוך ה-approval לפני אישור.

*קוד: `run-ai-agent` (כלי `propose_automation`), `carmen-approval-execute` (handler), `resume-agent-run` (ניתוב).*
