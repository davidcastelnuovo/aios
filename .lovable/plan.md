## מטרה
לאפשר לטריגר "שיחת כרמן ב-WhatsApp" לעבוד גם דרך חיבור Manus WA (לא רק Green API), ולתת בחירה מפורשת איזה חיבור יהיה זה שכרמן תקשיב ותגיב דרכו — בדיוק כמו בצעד "שלח WhatsApp (Green API)" שכבר תומך ב-Manus.

## מצב היום
- ה־UI של `CarmenSessionConfig` שולף רק חיבורי `green_api`, ומציג בורר רק כשיש יותר מחיבור אחד.
- הסלקטור שומר `carmen_connection_user_id` (מזהה משתמש) — לא ID של חיבור ספציפי, ולכן לא יכול להבחין בין שתי אינטגרציות של אותו משתמש.
- `green-api-webhook` הוא היחיד שיודע לטפל בכרמן (זיהוי מילת הפעלה, פתיחת session, קריאה ל-`run-ai-agent` ושליחת תשובה).
- `manus-wa-webhook` כרגע רק כותב הודעות נכנסות לטבלת `chat_messages` ולא מפעיל כרמן כלל.

## שינויים מתוכננים

### 1. UI — `src/components/automations/StepConfigPanel.tsx` (CarmenSessionConfig)
- לשלוף גם `green_api` וגם `manus_wa` מ-`tenant_integrations` (אותה שאילתה כמו ב-`GreenAPIActionConfig`).
- להוסיף שדה חדש בקונפיג: **"חיבור WhatsApp לכרמן"** עם בורר שמציג כל החיבורים (Green API + Manus WA) עם תווית ספק, וברירת מחדל "כל החיבורים".
- שמירה תחת `carmen_integration_id` (מזהה רשומת `tenant_integrations`).
- הצגה תמיד, גם אם יש חיבור יחיד (כדי שאפשר יהיה להגביל במפורש ל-Manus).
- שמירה על תאימות לאחור: אם קיים `carmen_connection_user_id` ישן — להמשיך לכבד אותו, ולהציע אזהרה קלה לעדכון.

### 2. שרת — `supabase/functions/green-api-webhook/index.ts`
- במקום (או בנוסף ל-) השוואת `carmen_connection_user_id`, להשוות `carmen_integration_id` עם ה-`integration.id` שזיהה את הוובהוק.
- אם `carmen_integration_id` מוגדר ושייך לאינטגרציה מסוג `manus_wa` — לדלג (לתת ל-manus-wa-webhook לטפל).

### 3. שרת — `supabase/functions/manus-wa-webhook/index.ts`
- להוסיף תמיכת כרמן סימטרית ל-green-api-webhook:
  - אחרי שמירת ההודעה הנכנסת, להריץ את אותה לוגיקה: `findCarmenSessionAutomation`, בדיקת `scope`, מילת הפעלה/סיום, פתיחה/סגירה של `carmen_whatsapp_sessions`, ריצת `runCarmenAI` ושליחה חזרה דרך `send-manus-wa-message`.
  - לכבד `carmen_integration_id` — להריץ רק אם תואם ל-`integ.id`.
- כדי לא לשכפל קוד, להוציא helpers משותפים (`findCarmenAgent`, `findCarmenSessionAutomation`, `runCarmenAI`, ניהול session) לקובץ `_shared/carmen.ts` ולייבא משני הוובהוקים.

### 4. תאימות לאחור
- אם באוטומציה קיימת רק שדה `carmen_connection_user_id` (ללא `carmen_integration_id`) — להמשיך לסנן לפי `connection_user_id` בלבד (התנהגות נוכחית).

## קבצים שיתעדכנו
- `src/components/automations/StepConfigPanel.tsx`
- `supabase/functions/green-api-webhook/index.ts`
- `supabase/functions/manus-wa-webhook/index.ts`
- חדש: `supabase/functions/_shared/carmen.ts`

## שאלה לפני בנייה
האם להפעיל כרמן **באופן בלעדי** דרך החיבור שנבחר (כלומר, אם נבחר Manus — Green API לא יפעיל אותה אפילו אם תגיע אליו הודעה עם מילת ההפעלה), או להשאיר "כל החיבורים" כברירת מחדל גמישה? ההמלצה: בלעדי כשנבחר חיבור, "כל החיבורים" כשלא נבחר.