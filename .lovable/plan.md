

# תוכנית: רענון ויזואלי של משימות + זיכרון AI מתמשך

## שני שינויים עיקריים

### 1. רענון אוטומטי של לוח המשימות אחרי פעולת הסוכן

**בעיה:** כשהסוכן יוצר/מעדכן משימה, לוח המשימות לא מתעדכן — המשתמש צריך לרענן ידנית.

**פתרון:** אחרי שהסוכן מסיים פעולה על משימה (create_task / update_task), לשלוח SSE event מסוג `invalidate_tasks`. בצד הלקוח, כש-`AISupport.tsx` מקבל את האירוע, להפעיל `queryClient.invalidateQueries({ queryKey: ["tasks"] })`.

**קבצים:**
- `supabase/functions/ai-support-chat/index.ts` — להוסיף שליחת `{ type: 'invalidate', entity: 'tasks' }` אחרי כל tool call שמשנה משימה
- `src/pages/AISupport.tsx` — לטפל ב-event type `invalidate` ולהפעיל invalidation על query key "tasks"

### 2. זיכרון AI מתמשך עם קטגוריות

**בעיה:** הסוכן לא זוכר העדפות והקשרים בין שיחות — כל שיחה מתחילה מאפס.

**פתרון:** יצירת טבלה `ai_memory` שמאחסנת פריטי זיכרון מחולקים לקטגוריות. הסוכן יכתוב ויקרא מהזיכרון אוטומטית.

**טבלה חדשה — `ai_memory`:**
```
id (uuid, PK)
user_id (uuid, FK auth.users)
tenant_id (uuid, FK tenants)
category (text) — e.g. "preferences", "projects", "clients", "workflows", "personal"
key (text) — מזהה ייחודי לפריט הזיכרון
content (text) — תוכן הזיכרון
created_at (timestamptz)
updated_at (timestamptz)
UNIQUE(user_id, tenant_id, category, key)
```

**RLS:** משתמש רואה רק את הזיכרון שלו.

**כלים חדשים לסוכן:**
- `save_memory` — שמירת פריט זיכרון (category, key, content)
- `recall_memory` — שליפת זיכרון לפי קטגוריה (או הכל)
- `delete_memory` — מחיקת פריט ספציפי

**שינוי ב-System Prompt:** הנחיה לסוכן לשמור אוטומטית מידע חשוב שהמשתמש מספר (העדפות, שמות פרויקטים, הנחיות חוזרות), ולקרוא את הזיכרון בתחילת כל שיחה חדשה.

**טעינה אוטומטית:** בתחילת כל שיחה, לשלוף את כל פריטי הזיכרון של המשתמש ולהוסיף אותם ל-system prompt כהקשר.

**קבצים:**
- Migration — יצירת טבלה `ai_memory` עם RLS
- `supabase/functions/ai-support-chat/index.ts` — הוספת 3 כלים חדשים, טעינת זיכרון ל-system prompt, שינוי הנחיות הסוכן

### סיכום קבצים לשינוי
1. **Migration SQL** — טבלת `ai_memory`
2. `supabase/functions/ai-support-chat/index.ts` — invalidate events + memory tools + memory loading
3. `src/pages/AISupport.tsx` — טיפול ב-invalidate events

