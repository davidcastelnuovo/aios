# תכנית מימוש: תור סדרתי ("מחכה לתורה בסבלנות")

> עיקרון: **אין concurrency.** מה שנקרא "מקבילי" הופך ל-**תור FIFO** — פעולה אחת רצה בכל רגע, עד הסוף, ואז הבאה בתור. כך מקבלים את הערך (הרבה משימות רצות, סינתזה רואה את כולן) **בלי אף אחד מסיכוני ה-race** שתוארו (state משותף, last-write-wins, side-effects כפולים).

## למה זה בטוח
- **אפס concurrency → אפס race conditions.** כל משימה היא הרצת edge נפרדת וסדרתית.
- **Durable** — כל צעד נשמר ב-DB; קריסה מתאוששת מהתור.
- **מבודד מה-dispatcher** — משימות בתור מקבלות status `'queued'` שה-dispatcher מתעלם ממנו → אין הרצה מחוץ-לסדר.
- **תאימות מלאה** — `batch_id` ריק = ההתנהגות הנוכחית בדיוק.

---

## שני המישורים

### מישור A — תור תת-סוכנים (subagent batch queue)
`delegate_parallel` כיום מפעיל עד 5 במקביל. **משתנה ל-שרשרת סדרתית:** כל תת-המשימות נכנסות לתור, רק אחת רצה בכל רגע, וכשהיא מסיימת היא "מעירה" את הבאה.

### מישור B — fan-in בפלואו (Campaign Pulse)
המנוע כבר רץ סדרתית (topo order) — כלומר **כבר תור**. הבעיה היחידה היא ש-`merge` מקפל פלטים (last-write-wins). תיקון = לתת לצומת הסינתזה לראות את כל הפלטים — **בלי לגעת ב-concurrency**.

---

## מישור A — תכנון מפורט

### מודל נתונים
- `agent_tasks` כבר מכיל `batch_id` (מיגרציה `...000006`).
- **חדש:** `queue_position int` — מיקום בתור (0..N-1).
- **חדש:** ערך status `'queued'` — בתור, טרם הופעל. ה-dispatcher בוחר רק `'pending'` → מתעלם.

### זרימה
1. **`delegate_parallel`** → `spawnSubagentBatch` מכניס N שורות עם `batch_id`, `queue_position`, `status='queued'`. **מפעיל רק position 0** (קורא ל-`run-agent-task`).
2. **`run-agent-task` בסיום** → `advanceBatch(batchId, completedPosition)`:
   - מוצא את המשימה הבאה בתור (`status='queued'` עם `queue_position` המינימלי הגדול מהנוכחי).
   - מפעיל אותה (`run-agent-task`). **שרשרת סדרתית קפדנית — אחת בכל רגע.**
3. **המשימה האחרונה** → מפעילה (אופ') משימת **סינתזה** שקוראת `get_batch_results`, מאחדת לתשובה אחת, ושולחת ל-WhatsApp.

### בטיחות התור
- ה-dispatcher בוחר `status='pending'` בלבד → לא נוגע ב-`'queued'` → אין הרצה מחוץ-לסדר.
- **Reaper (backstop, פאזה מאוחרת):** cron שמזהה batch עם `'queued'` אבל בלי running/pending מעל X דקות → ממשיך את הבא. מתאושש משרשרת שנקטעה.
- **Idempotency** — מפתח קיים (`idempotency_key`); מונע כפילות בהרצה-חוזרת.
- **Recursion guard** — קיים (surface='task' מסתיר delegate).

### נקודות נגיעה בקוד
| קובץ | שינוי |
|---|---|
| מיגרציה חדשה | `queue_position int`; לאפשר `status='queued'` (אם יש CHECK constraint על status) |
| `_shared/subagent.ts` | `spawnSubagentBatch` → insert עם `queued`+position, הפעל רק position 0; פונקציה חדשה `advanceBatch()` |
| `run-agent-task/index.ts` | בבלוק הסיום (אחרי כתיבת result): אם `task.batch_id` → קרא `advanceBatch` |
| `run-ai-agent` | עדכון תיאור `delegate_parallel`: "תור סדרתי — רץ אחת-אחת לפי סדר, לא בו-זמנית" |

### פסאודו-קוד `advanceBatch`
```
advanceBatch(supabase, batchId, completedPosition):
  next = agent_tasks
    .where(batch_id=batchId, status='queued', queue_position > completedPosition)
    .orderBy(queue_position asc).limit(1)
  if (!next):
    // הושלם — הפעל סינתזה אם הוגדרה
    maybeFireSynthesis(batchId)
    return
  // promote + fire
  update next: status='pending'   // הופך זמין
  fetch run-agent-task { task_id: next.id }   // fire-and-forget
```

---

## מישור B — תכנון מפורט (fan-in בלי concurrency)

### הבעיה
כל סוכן שומר פלט תחת מפתח `output`; `merge` עושה `Object.assign` → דורס. הסינתזה רואה ענף אחד.

### תיקון (סדרתי, בטוח — אפס שינוי ב-concurrency)
1. **namespacing פר-צומת:** `nodeOutputs` כבר ממופתח לפי id. לשנות את `merge` כך שיבנה
   `branch_outputs: { <label או id>: <output> }` במקום `Object.assign` שמקפל.
2. **הזרקת הקשר לצומת הסינתזה:** ב-`trigger-automation`, כשבונים את `command_text` לצומת agent, להוסיף בלוק:
   ```
   === פלטי שלבים קודמים ===
   [קמפיינרית]: <output>
   [SEO]: <output>
   ```
   (נאסף מ-`nodeOutputs` של הצמתים שקדמו). כך הסינתזה רואה את **כל** הענפים — בלי merge שמקפל ובלי concurrency.
3. **barrier רב-הורי (אופ', רק לצורות לא-לינאריות):** טבלת `workflow_edges` כדי ש-merge יתלה בכל הענפים. **ל-Campaign Pulse הלינארי לא נדרש** — הסדר כבר מובטח.

### נקודות נגיעה
| קובץ | שינוי |
|---|---|
| `trigger-automation/index.ts` | (א) `merge` בונה `branch_outputs` במקום Object.assign; (ב) צומת agent מקבל בלוק "פלטי שלבים קודמים" ב-command_text |

### גרסת v1 מינימלית (הכי נמוכת-סיכון)
לשמור שרשרת לינארית. רק להוסיף **הזרקת פלטי-קודמים** לצומת הסינתזה. אפס שינוי סכמה, אפס concurrency — רק הקשר עשיר יותר ב-prompt.

---

## פאזות
| פאזה | תוכן | סיכון |
|---|---|---|
| **Q1** | מישור A — תור סדרתי לתת-סוכנים (מיגרציה + `subagent.ts` + שרשור ב-`run-agent-task`) | נמוך — תוספתי, אפס concurrency |
| **Q2** | מישור B — הזרקת פלטי-קודמים לסינתזה (לינארי) | נמוך מאוד — שינוי הקשר בלבד |
| **Q3** (אופ') | `workflow_edges` לצורות fan-out לא-לינאריות + Reaper backstop | בינוני |

## בדיקות
- **Q1:** batch של 3 משימות טריוויאליות → לוודא שרצות **בסדר** (`started_at` עולה), ש-advance מפעיל את הבאה, ושסינתזה רצה אחרי האחרונה.
- **Q2:** פלואו עם 2 צמתי agent + סינתזה → לוודא ש-prompt הסינתזה מכיל את **שני** הפלטים המתויגים.

## למה זה עונה בדיוק על הבקשה
"מקביליות → תור, כל פעולה מחכה לתורה בסבלנות": מישור A הופך את ה-batch לשרשרת סדרתית קפדנית; מישור B נותן לסינתזה לראות את כל מי שרץ לפניה — והכל **סדרתי, durable, ובטוח**, בלי אף race condition.

*שלב תכנון. מימוש מתחיל ב-Q1 לפי אישור.*
