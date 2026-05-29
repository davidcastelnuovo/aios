## מטרה
להפוך את `AgentHub` להציג את **ממלכת הזיכרון של כרמן** כספריית תיקיות מלאה (כפי שבנינו אתמול), ולהעשיר את טאב הפרופיל כך שיציג את כל המאפיינים שהוגדרו ולא רק שורת תיאור.

## המצב היום
- **טאב זיכרון לכרמן** — מציג כרגע רק רשימה שטוחה של `carmen_memory_pointers` (תצוגה בלבד, ללא ניווט בתיקיות).
- **טאב פרופיל** — קומפקטי מדי: `personality` / `soul` עם `rows=2`, אין הפרדה ויזואלית בין זהות/אישיות/סגנון, אין הצגת `allowed_tools` או summary של מה הסוכן הוא.
- מה שיש בפועל בזיכרון של כרמן (לפי DB):
  - `clients/` — 371 פריטים + תת-תיקייה `updates/` (25)
  - `conversations/2025-11..2026-05/` — סיכומי שיחות לפי חודש (181)
  - `team/` — `assigned_clients/` (256), `tasks/` (32), ושורש (36)
  - `system_map/` — 156 פריטים
  - + טבלת `carmen_memory_episodes` — אפיזודי שיחה ארוכים עם topic/tags

## מה ייבנה

### 1. `MemoryTab` חדש — ספריית תיקיות
תצוגה דו־טורית כמו `KnowledgeTab`:

**עץ תיקיות (טור שמאלי):**
```text
🧠 ממלכת הזיכרון
├── 👥 clients (371)
│    └── 📝 updates (25)
├── 💬 conversations (181)
│    ├── 📅 2026-05 (76)
│    ├── 📅 2026-04 (43)
│    ├── 📅 2026-03 (51)
│    ├── 📅 2025-12 (6)
│    └── 📅 2025-11 (5)
├── 👨‍💼 team (324)
│    ├── 🎯 assigned_clients (256)
│    └── ✅ tasks (32)
├── 🗺️ system_map (156)
└── 📚 episodes (סיכומי שיחות מ-carmen_memory_episodes)
```
- נבנה דינמית מ-`group by category, subcategory` בטעינה.
- מספרים מוצגים כ-Badge ליד כל תיקייה.
- שורש "ממלכת הזיכרון" מציג סיכום כללי (X פריטים, Y קטגוריות, Z אפיזודים).

**פאנל ימני:**
- כותרת התיקייה + סרגל חיפוש מקומי + מיון (לפי `importance` או `ref_date`).
- כל פריט: `title`, `summary`, `path`, `importance`, `ref_date` כ-Card קומפקטי.
- לחיצה על פריט פותחת Dialog עם הפרטים המלאים (כולל `entity_type/entity_id`, `metadata`, `valid_until`).
- פעולת מחיקה ידנית רק על פריטים שאינם משויכים לישות חיה (clients/team) — אחרת כפתור מושבת עם tooltip.

**עבור סוכנים שאינם כרמן:** אותה תצוגה אבל מעל `agent_memory` (כשייווצרו פריטים) — קטגוריות מובנות: conversation / instruction / fact / task / preference, ותתי־קטגוריות מ-`subcategory` או `path` אם קיים.

### 2. `ProfileTab` מורחב
מבנה חדש בכרטיסים נפרדים:

- **🪪 זהות** — `name`, `talent` (תפקיד/מומחיות), `active` toggle, צבע/אווטאר.
- **💭 אישיות ונשמה** — `personality` (textarea rows=5), `soul` / מטרת קיום (rows=4), `writing_style`, `response_length`, `language`.
- **⚙️ הנחיות מערכת** — `system_prompt` (rows=10 + מונה תווים), הסבר שזה דורס את הבנייה האוטומטית, אזור preview של ה-system prompt שבאמת ייבנה אם השדה ריק.
- **🛠️ סיכום יכולות** (read-only) — מספר כלים שמופעלים (`allowed_tools.length`), מספר מטרות פעילות, מספר תיקיות ידע, מספר פריטי זיכרון, המוח הנוכחי (model). קישורי "ערוך" שמנווטים לטאבים המתאימים.
- **🔧 הגדרות ריצה** — `max_tool_rounds`, בורר מוח (BrainSelector מוטמע גם כאן לנוחות).

כפתור "שמור" sticky בתחתית, או שמירה אוטומטית on-blur לכל שדה.

## טכני
- `useCarmenMemoryPointers` יקבל פרמטרים `category?` ו-`subcategory?` ופונקציית עזר `useCarmenMemoryTree()` שמחזירה את מבנה התיקיות (count by category/subcategory).
- `useCarmenMemoryEpisodes` חדש לטעינת `carmen_memory_episodes` (תיקיית "episodes").
- אין מיגרציות. אין שינויים ב-edge functions.
- אין שינוי בלוגיקת `run-ai-agent` או ב-`carmen-memory-worker`.

## מה לא נכלל בשלב הזה
- עריכת פריטי זיכרון של כרמן (קיים רק delete לפריטים שאינם חיים).
- קלקולטור עלויות — נשאר לפאזה הבאה.

## שאלה אחת
האם רוצה שכל פריט בעץ יציג גם **5 הפריטים האחרונים בפריוויו** מתחת לשם התיקייה (לתחושת חיים), או רק ספירה ופתיחה בלחיצה?