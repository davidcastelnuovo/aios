# תכנית מימוש: תור סדרתי ("מחכה לתורה בסבלנות")

> עיקרון: **תור סדרתי רק למשימות "מסוכנות".** משימות שמשנות state / יש להן side-effect / בלתי-הפיכות → תור FIFO, אחת בכל רגע. משימות **בטוחות** (קריאה/ניתוח/מחקר בלבד) → רצות **במקביל** (עד תקרה). כך אין אף race condition בין שתי פעולות מסוכנות, אבל לא מאטים סתם עבודה שאפשר לעשות במקביל.

## ההבחנה: מסוכן מול בטוח

| | מסוכן (serial) | בטוח (parallel) |
|---|---|---|
| **מהות** | משנה state / side-effect / בלתי-הפיך / יוצא החוצה | קריאה/ניתוח טהור, אין שינוי |
| **דוגמאות כלים** | `send_message`, `update_*_status`, `create_lead/task/social_post`, `toggle_automation/campaign`, `update_budget`, `fb_*`/`gads_*` (create/pause/resume), `add_*_update` | `list_*`, `get_*`, `search_*`, `analyze_campaign_performance`, `recall_*`, `kb_search`, Ahrefs/web-analytics reads, מחקר |
| **ניתוב** | נתיב סדרתי (queue, אחת בכל רגע) | נתיב מקבילי (עד `MAX_INFLIGHT=5`) |

**האינוריאנט המדויק:** לעולם לא שתי משימות **מסוכנות** רצות בו-זמנית (באותו tenant). משימות **בטוחות** חופשיות לרוץ במקביל — זו עם זו וגם לצד משימה מסוכנת (כי הן לא נוגעות ב-state משותף).

### איך מסווגים
1. **הצהרה פר-תת-משימה** ע"י כרמן ב-`delegate_parallel`: `side_effects: true|false` (כרמן יודעת מה היא מבקשת).
2. **רשת ביטחון בצד-שרת** — ממפים את הסקין/כלים של התת-משימה; אם יש כלי מ-**רשימת הכלים המשנים** → נכפה "מסוכן" גם אם הוצהר בטוח. מונע מכרמן לתייג כתיבה כבטוחה בטעות.
3. **ברירת מחדל שמרנית** — לא הוצהר/לא ידוע → **מסוכן** (serial). מחיר טעות: משימה בטוחה תרוץ סדרתית (רק איטי) מול משימה מסוכנת שתרוץ מקבילית (השחתת נתונים). לכן ברירת המחדל מחמירה.

> מימוש: קבוע `MUTATING_TOOLS = Set<string>` ב-`_shared/subagent.ts`; `isDangerous(subtask)` = הוצהר true, או הסקין/כלים שלו חותכים את הסט, או לא-ידוע.

---

## למה זה בטוח
- **אפס concurrency בין פעולות מסוכנות → אפס race conditions** היכן שזה משנה.
- **משימות בטוחות מקביליות** — מהירות, ואין סיכון (אין side-effect/state משותף).
- **Durable** — כל צעד נשמר ב-DB; קריסה מתאוששת מהתור.
- **מבודד מה-dispatcher** — משימות מסוכנות-בתור מקבלות status `'queued'` שה-dispatcher מתעלם ממנו.
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
- **חדש:** `queue_position int` — מיקום בתור לנתיב הסדרתי (0..N-1).
- **חדש:** `is_dangerous boolean default true` — מסווג נתיב (ברירת מחדל שמרנית).
- **חדש:** ערך status `'queued'` — מסוכן הממתין בתור. ה-dispatcher בוחר רק `'pending'` → מתעלם.

### זרימה (שני נתיבים)
1. **`delegate_parallel`** → `spawnSubagentBatch`:
   - לכל תת-משימה: `isDangerous(subtask)` (הצהרה + רשת ביטחון של כלים).
   - **בטוחות** → status `'pending'` + **הפעלה מיידית** (כולן יחד, עד `MAX_INFLIGHT=5`).
   - **מסוכנות** → status `'queued'` + `queue_position` רץ; **מפעיל רק את המסוכנת הראשונה**.
2. **`run-agent-task` בסיום** → אם `task.batch_id` ו-`task.is_dangerous`: `advanceDangerLane(batchId)`:
   - מוצא את המסוכנת הבאה (`status='queued'`, `queue_position` מינימלי) → מפעיל. **לעולם לא שתיים מסוכנות יחד.**
   - (משימות בטוחות לא משרשרות — הן כבר רצות במקביל.)
3. **כשהכל הושלם** (אין `queued` ואין `running` ב-batch) → מפעילה (אופ') משימת **סינתזה** שקוראת `get_batch_results`, מאחדת, ושולחת ל-WhatsApp.

### בטיחות התור
- ה-dispatcher בוחר `status='pending'` בלבד → לא נוגע ב-`'queued'` → אין הרצה מחוץ-לסדר.
- **Reaper (backstop, פאזה מאוחרת):** cron שמזהה batch עם `'queued'` אבל בלי running/pending מעל X דקות → ממשיך את הבא. מתאושש משרשרת שנקטעה.
- **Idempotency** — מפתח קיים (`idempotency_key`); מונע כפילות בהרצה-חוזרת.
- **Recursion guard** — קיים (surface='task' מסתיר delegate).

### נקודות נגיעה בקוד
| קובץ | שינוי |
|---|---|
| מיגרציה חדשה | `queue_position int`, `is_dangerous boolean default true`; לאפשר `status='queued'` |
| `_shared/subagent.ts` | `MUTATING_TOOLS` Set + `isDangerous()`; `spawnSubagentBatch` בשני נתיבים; `advanceDangerLane()` |
| `run-agent-task/index.ts` | בבלוק הסיום: אם `task.batch_id && task.is_dangerous` → `advanceDangerLane`; בדיקת "batch הושלם" → סינתזה |
| `run-ai-agent` | `delegate_parallel`: הוספת `side_effects` פר-תת-משימה; תיאור "בטוחות במקביל, מסוכנות בתור" |

### פסאודו-קוד
```
spawnSubagentBatch(items, batchId):
  pos = 0
  for it in items:
    danger = isDangerous(it)          // הצהרה || כלים-משנים || לא-ידוע
    row = { batch_id: batchId, is_dangerous: danger, ... }
    if danger:
      row.status = 'queued'; row.queue_position = pos++
    else:
      row.status = 'pending'          // ייורה מיד
    insert row
  // הפעל את כל הבטוחות מיד (עד MAX_INFLIGHT), והמסוכנת הראשונה בלבד
  fire all safe rows (capped)
  fire first dangerous row (queue_position = 0), if any

advanceDangerLane(supabase, batchId):
  next = agent_tasks
    .where(batch_id=batchId, is_dangerous=true, status='queued')
    .orderBy(queue_position asc).limit(1)
  if next:
    update next: status='pending'
    fetch run-agent-task { task_id: next.id }     // המסוכנת הבאה — לבדה
  if batchAllDone(batchId):                        // אין queued ואין running
    maybeFireSynthesis(batchId)

isDangerous(subtask):
  if subtask.side_effects === false: return skinTouchesMutatingTool(subtask)  // רשת ביטחון
  if subtask.side_effects === true:  return true
  return true   // ברירת מחדל שמרנית
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

> **אותה הבחנה חלה כאן** (לעתיד, אם נוסיף מקביליות בפלואו): צמתי **קריאה/ניתוח** (agent שרק מנתח) יכולים לרוץ במקביל; צמתי **action/מוטציה** (`send_*`, `update_budget`, `toggle_*`) חייבים נתיב סדרתי. כיום הפלואו ממילא סדרתי, אז זה רק עיקרון מנחה.

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
- **רק מסוכן → תור:** משימות מסוכנות (כתיבה/side-effect) רצות אחת-בכל-רגע, מחכות לתורן בסבלנות. אף פעם לא שתי מסוכנות יחד = אפס race.
- **בטוח → מקבילי:** קריאה/ניתוח/מחקר רצים במקביל — לא מאטים סתם עבודה שאפשר לעשות בו-זמנית.
- סיווג: הצהרת כרמן + רשת ביטחון של כלים-משנים + ברירת מחדל שמרנית.
- מישור B נותן לסינתזה לראות את כל מי שרץ לפניה — הכל durable ובטוח.

*שלב תכנון. מימוש מתחיל ב-Q1 לפי אישור.*
