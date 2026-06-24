# מולטיטאסק של כרמן — תכנון מבוסס בסט-פרקטיס

> מבוסס מחקר: Anthropic multi-agent research system, OpenAI/Anthropic parallel tool calling, LangGraph Send/max_concurrency, CrewAI hierarchical, Temporal/WorkOS durable-queue + idempotency, ו-MAST failure taxonomy.

## עקרון
כרמן = **lead agent** יחיד שמפזר עבודה ל-**workers** (subagents) כשהמשימה מתפצלת לחלקים בלתי-תלויים. ריבוי-סוכנים מנצח רק כשהעבודה באמת מקבילה והערך גבוה (Anthropic: ~90% שיפור אך ~15× עלות טוקנים) — אחרת single-agent.

## שלוש דרכי המולטיטאסק של כרמן
1. **Parallel tool-calls** — קריאות כלי בלתי-תלויות בתור אחד (קריאות בלבד). כתיבות/side-effects מסריאליזציה.
2. **`delegate_to_subagent`** — תת-משימה ברקע יחידה, fire-and-forget, polling דרך `get_subagent_result`, push ל-WhatsApp בסיום.
3. **`delegate_parallel`** (חדש) — פיזור עד 8 תת-משימות עצמאיות בבת אחת עם `batch_id`, איסוף עם `get_batch_results`.

## חוזה ה-delegation (מחמיר — נגד חפיפה/zפולושן)
כל תת-משימה מקבלת **brief עצמאי**: מטרה אחת + היקף + פורמט פלט + "אל תחפפי עם תת-משימות אחרות". ה-worker חוקר בהקשר נקי משלו ומחזיר **סיכום מתומצת** (לא dump של כלים); כרמן מסנתזת מהסיכומים. זה גם מנגנון דחיסה — שומר על חלון ההקשר של כרמן.

## אמינות (מה שנבנה)
| בסט-פרקטיס | יישום |
|---|---|
| תקרת מקביליות | `MAX_INFLIGHT_SUBAGENTS=5` — מעל התקרה תת-משימה נשארת `pending` וה-dispatcher cron מריץ אותה (backstop) |
| מניעת recursion (fork-bomb) | surface='task' מסתיר `delegate_to_subagent`/`delegate_parallel` → worker לא מפזר workers (עומק מוגבל ל-1) |
| Idempotency (at-least-once) | עמודת `idempotency_key` + partial unique index `(tenant_id, key)`; spawn מחזיר משימה קיימת במקום כפילות, כולל טיפול ב-race |
| בידוד כשל חלקי | `get_batch_results` מחזיר settled per-task (status+output) + total/completed/failed/running; כשל אחד לא מסתיר אחרים |
| תור עמיד / status אמין | reuse `agent_tasks`; status הוא מקור-האמת; push (WhatsApp) הוא best-effort |
| גבול N | `delegate_parallel` חסום ל-8 תת-משימות לקריאה |

## אנטי-דפוסים שנמנעו (MAST)
- multi-agent overkill → כלי נפרד למשימה יחידה (`delegate_to_subagent`) מול מרובה (`delegate_parallel`); הנחיה לא להשתמש במרובה למשימה אחת.
- context pollution → workers מחזירים סיכום, לא raw.
- state race → idempotency + unique index.
- runaway recursion → recursion guard.

## פערים פתוחים (לשלב הבא)
- **Checkpoint/resume אמיתי** ברמת הצעד (Temporal-style) — היום `run-agent-task` שומר result אך לא replay דטרמיניסטי של קריאות LLM.
- **תקרת מקביליות גם ב-dispatcher** — היום ה-dispatcher מריץ עד 25/tick בלי בדיקת running-count; התקרה נאכפת על fire מיידי בלבד.
- **סינתזה + verification pass** אוטומטית אחרי batch (היום כרמן מסנתזת ידנית מ-get_batch_results).
- **לוח מולטיטאסק** ב-UI — reuse `AgentTasksPage` עם סינון לפי batch_id.

*נכתב כתיעוד תכנון. הקוד: `_shared/subagent.ts`, `run-ai-agent` (כלים `delegate_parallel`/`get_batch_results`), מיגרציה `20260624000006`.*
