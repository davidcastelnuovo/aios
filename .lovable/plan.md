## הבעיה

לכרמן יש שתי דליפות סקופ:

1. **אין הגבלת קמפיינר** — כש`callerCampaignerId` מזוהה (קמפיינר ששלח הודעה בקבוצה), הכלי `list_clients` עדיין מחזיר את כל הלקוחות בטננט אלא אם המודל בוחר להעביר `campaigner_id`. אין שום אכיפה בצד-שרת ואין הוראה בפרומפט.
2. **בלבול ארגון/סוכנות** — `list_clients` ו-`search_entities` לא מקבלים `agency_id` כפילטר. כשמשתמש שואל "לקוחות בסוכנות מרקטינג קפטן", המודל מחזיר לקוחות מכל הטננט.

בנוסף, ה-system prompt של כרמן הוא **hard-coded** ב-`run-ai-agent/index.ts` (השדה `ai_agents.system_prompt` ריק). המשתמש מבקש שההנחיות יישמרו גם ב**מרכז הידע** וגם ב**זיכרון** של כרמן, לא רק בקוד.

## הפתרון

### 1. אכיפה בצד-שרת ב-`supabase/functions/run-ai-agent/index.ts`

**`list_clients`** — אם `callerCampaignerId` קיים והקורא הוא קמפיינר (לא admin/owner):
- ברירת מחדל: לסנן ל-clients המשוייכים אליו דרך `client_team` (קיים כבר הלוגיקה — רק להפעיל אוטומטית כש-`campaigner_id`/`campaigner_name` לא סופקו).
- ברירת מחדל: `status in ('active','onboarding')` אלא אם המשתמש ביקש מפורשות סטטוס אחר.
- להוסיף פרמטר `agency_id` ולהעביר ל-query.

**`get_client_info`** — לחסום אם הלקוח לא מופיע ב-`client_team` של הקורא (כש-callerCampaignerId קיים והוא לא admin).

**`search_entities`** — כשהקורא הוא קמפיינר ו-`entity_type='client'`: לסנן דרך client_team. להוסיף `agency_id` אופציונלי.

**זיהוי תפקיד הקורא** — לקרוא `user_roles` של ה-user המקושר לקמפיינר; אם `admin`/`owner`/`super_admin` — לא לחסום.

### 2. עדכון ה-System Prompt של כרמן

להוסיף 2 כללי-זה