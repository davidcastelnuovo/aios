# איחוד מלא של מוח כרמן — סוכן אחד, גישה מכל מקום

הבנתי: ניקוי מלא + שלב 3 עכשיו. אחרי הביצוע יהיה מוח אחד (`run-ai-agent`) שמשרת את הטלפון (WhatsApp) ואת המחשב (AIOS) — אותו פרומפט V2, אותם כלים, אותו זיכרון, אותם MCP+subagents.

## מה קיים היום (אומת)

| חזית | קוראת ל- | מה יש שם |
|---|---|---|
| WhatsApp (Green API + Manus) | `run-ai-agent` (דרך `_shared/carmen.ts`) | פרומפט V2, ~140 כלים, MCP, subagents, זיכרון, סקופ |
| AIOS (Dialog/CommandBar/Context) | `ai-support-chat` (3257 שורות) | פרומפט נפרד, ~50 כלים משלה, tool loop משלה, SSE |

## תוכנית הביצוע (סדר עבודה)

### שלב A — Streaming SSE ל-`run-ai-agent`
- תוספת בודדת בסוף ה-handler: אם `body.stream === true` → להחזיר `text/event-stream` במקום JSON.
- אירועים: `text_delta` (תוכן הודעת ה-assistant), `tool_call` ({name,args}), `tool_result` ({name,result}), `done` ({output, tools_used, execution_time_ms}).
- במצב לא-stream — אפס שינוי בהתנהגות (WhatsApp ממשיכה כרגיל).

### שלב B — שלב 3: קטלוג כלים משותף `_shared/carmen-tools.ts`
- מוציאים את `ALL_TOOLS` ואת `executeTool` מ-`run-ai-agent/index.ts` למודול משותף.
- חתימה: `getCarmenTools()` → `{ defs, execute(name, args, ctx) }` כש-`ctx` כולל `supabase, tenantId, userId, callerCampaignerId, agentId, callerRole, callerManagedAgencyIds, surface`.
- `run-ai-agent` מייבאת ומשתמשת בקטלוג היחיד (לוגיקה זהה — רק מקום אחר).
- לא נוגעים ב-MCP/subagent loaders שכבר ב-`_shared/`.

### שלב C — ניקוי `ai-support-chat`
שתי חלופות. אני ממליץ על **(1)** שזה ניקוי מלא כפי שביקשת:

**(1) ניקוי מלא — מחיקה והפניה ישירה (מועדף):**
- AIOS (`AIOSContext.tsx`, `AIOSDialog.tsx`) קוראים ישירות ל-`run-ai-agent` עם `stream: true`, `surface: 'aios'`, `agent_id` של כרמן, `conversation_history`, `command_text`.
- מתאימים את ה-SSE parser ב-AIOS לפורמט החדש (`text_delta` במקום ה-events הנוכחיים).
- מוחקים את `supabase/functions/ai-support-chat/` כולה.

**(2) Proxy דק (חלופה, פחות "ניקוי"):**
- `ai-support-chat` הופכת ל-~80 שורות שמתרגמות body ומעבירות SSE מ-`run-ai-agent`. AIOS לא משתנה.

הולך עם (1).

### שלב D — Surface flag בפרומפט
- ל-`run-ai-agent` תוספת פרמטר `surface: 'whatsapp' | 'aios'` (ברירת מחדל `whatsapp` לתאימות).
- ב-`buildCarmenV2SystemPrompt`: `isWhatsApp` נקבע מ-`surface`. כללי WA הקצרים נדלקים רק כשהטלפון מדבר; ב-AIOS כרמן יכולה לתת תשובות יותר מפורטות.
- כל השאר זהה (זיכרון, סקילז, סקופ קמפיינר, MCP, subagents) — בשני ה-surfaces.

### שלב E — איחוד שם הסוכן
- בדיקה: יש סוכן יחיד עם `name ILIKE '%carmen%' OR '%כרמן%'` בכל tenant. אם יש כפילויות — מאחדים לסוכן הראשי (חיפוש דרך ה-DB, לא מחיקה אוטומטית — אדווח לפני).
- שני ה-surfaces מעבירים את אותו `agent_id` (הסוכן של ה-tenant הנוכחי) → אותם `allowed_tools`, `active_skills`, `metadata.prompt_version=v2`.

### שלב F — אימות עצמי (תבדוק את עצמך)
1. `deno check` על `run-ai-agent` ו-`_shared/carmen-tools.ts` — חייב לעבור ללא שגיאות חדשות.
2. `deploy_edge_functions(['run-ai-agent'])`.
3. `curl_edge_functions` ל-`run-ai-agent` עם stream=false ובדיקה שהכלים עובדים (`list_clients`).
4. `curl_edge_functions` עם stream=true ואימות שיש `text_delta` + `done`.
5. בדיקת AIOS UI חי דרך Playwright: לפתוח את ה-Dialog, לשלוח "תני לי 3 לקוחות", לוודא שהתשובה זורמת ושמופיעות tool calls ב-DataCanvas.
6. בדיקת WhatsApp loop בלוגים של `green-api-webhook` — לוודא ש-`handleCarmenMessage` ממשיך לעבוד וש-`run-ai-agent` מחזיר תשובה תקינה (קריאה ידנית עם payload דמה אם אפשר).
7. בדיקת `agent_tasks` (subagent מ-Phase 4) דרך AIOS — לוודא שכלי `delegate_to_subagent` נגיש גם משם.

## סיכון ידוע
- AIOS היום משתמשת ב-`ai-support-chat` להעלאות קולית (`transcribe-voice`) ולכלים ייחודיים (Manus task creation, וכו'). אצטרך לוודא שכל כלי שהיה ב-`ai-support-chat` בלבד עובר לקטלוג המאוחד או נשמר כקריאה נפרדת. **בדיקה ראשונה בשלב B** — diff בין רשימות הכלים.

## מה משתנה בקבצים
- חדש: `supabase/functions/_shared/carmen-tools.ts`.
- שינוי: `supabase/functions/run-ai-agent/index.ts` (streaming + import מהקטלוג + surface).
- שינוי: `supabase/functions/_shared/carmen-prompt-v2.ts` (surface flag).
- שינוי: `src/contexts/AIOSContext.tsx`, `src/components/AIOSDialog.tsx` (URL חדש + parser SSE).
- מחיקה: `supabase/functions/ai-support-chat/` (אחרי הוכחה ש-AIOS עובדת על המוח החדש).

## נקודה אחת לאישור
האם בשלב C אני הולך על **(1) מחיקה מלאה** (מומלץ — זה מה שביקשת)? אם תאשר, אני מתחיל מיד אחרי שאעבור ל-build mode.
