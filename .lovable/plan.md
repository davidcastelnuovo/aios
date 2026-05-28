# תוכנית תיקונים סופית ל-Carmen

## החלטות
- **Green API קבוצות:** Carmen תעבוד גם בקבוצות לפי הערוץ שנבחר באוטומציה (Manus או Green API), בדיוק לפי האוטומציה הספציפית.
- **כשל AI:** ניסיון חוזר אוטומטי פעם אחת; אם גם הוא נכשל — שתיקה מוחלטת (רק לוג, בלי הודעה למשתמש).
- **שחזור היסטוריה:** רק מסשנים שנסגרו ב-30 דקות האחרונות; ישנים מזה — מתעלמים.

## שינויים

### 1. `supabase/functions/green-api-webhook/index.ts`
- להזיז את הקריאה ל-`handleCarmenMessage` כך שתרוץ גם כש-`isGroup === true`, ולהעביר `isGroup` כפרמטר. הגארד הקיים `group_requires_explicit_scope` יחסום אוטומטית אוטומציות שלא הוגדרו לקבוצה ספציפית.

### 2. `supabase/functions/_shared/carmen.ts`
- **כשל AI עם retry:** ב-`runCarmenAI` — אם הקריאה ל-`run-ai-agent` נכשלת או חוזרת ריקה, לנסות שוב פעם אחת אחרי 1 שנייה. אם גם הניסיון השני נכשל — `throw`, ולא להחזיר מחרוזת "מצטערת...".
- **טיפול בכשל ב-`handleCarmenMessage`:** עוטפים את `runCarmenAI` ב-try/catch — אם נזרק, רושמים `console.error`, מעדכנים `last_message_at` בסשן ומחזירים `{ handled: true, outcome: 'error' }` בלי `sendMessage`.
- **Echo-loop:** להוסיף ב-`carmen.ts:351-357` תנאי `a.length >= 15 && b.length >= 15` לפני ההשוואה, כדי לא להפיל הודעות קצרות לגיטימיות.
- **סינון instruction-reports מהיסטוריית assistant:** ב-`cleanHistory` ב-`runCarmenAI` להוסיף סינון גם להודעות assistant שעוברות `looksLikeInstructionReport`.

### 3. `supabase/functions/trigger-automation/index.ts`
- **בדיקת `output` ריק (שורה 1163):** להבחין בין כשל אמיתי (`stepResponse.success === false` → throw) לבין פלט ריק לגיטימי (skip שקט של שלב השליחה בלי שגיאה).
- **שחזור היסטוריה מסשנים ישנים (שורות 1063-1099):** להוסיף תנאי `ended_at > now() - 30 min` בשליפת הסשן הקודם. סשנים ישנים מזה — מתעלמים ומתחילים נקי.

### 4. `supabase/functions/manus-wa-webhook/index.ts`
- **URL קשיח (שורה 310):** להחליף ב-`settings.gateway_url || 'https://whatsappgw-pzpyrrww.manus.space'`.

## אחרי השינויים
- Deploy ל-3 הפונקציות: `green-api-webhook`, `manus-wa-webhook`, `trigger-automation` (ו-`_shared` נכלל אוטומטית).
- בדיקה בלוגים שאין יותר `Error: כרמן לא החזירה תשובה` על מקרים לגיטימיים, ושקבוצות Green API עם אוטומציה ספציפית מקבלות תגובה.