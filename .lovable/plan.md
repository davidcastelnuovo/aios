

# תוכנית השלמת שדרוג מודול סוכנים - Paperclip

## מה חסר

הDB מוכן (goals, heartbeat_logs, assigned_agent, update_type) אבל רוב הלוגיקה והממשק לא מומשו. הנה מה שנבנה:

---

## 1. כלים חדשים לכרמן ב-`run-ai-agent`

הוספת 5 כלים חדשים ל-ALL_TOOLS + executeTool:

- **`create_goal`** — יצירת יעד חדש (title, parent_goal_id, description, due_date)
- **`list_goals`** — רשימת יעדים עם אחוז התקדמות
- **`take_task`** — כרמן "לוקחת" משימה (מעדכנת assigned_agent + status ל-agent_working)
- **`complete_task_step`** — כרמן מדווחת התקדמות + מוסיפה task_update מסוג agent_action
- **`prioritize_tasks`** — מנתחת משימות פתוחות, מחזירה סדר עדיפויות מומלץ לפי דדליינים, יעדים, ועומס

## 2. Edge Function `agent-heartbeat`

פונקציה חדשה שרצה לפי תזמון ומבצעת:
- סריקת משימות פתוחות/באיחור לכל tenant
- זיהוי משימות חסומות (assigned_agent קיים אבל אין עדכונים 24 שעות+)
- שליחת תזכורות WhatsApp לקמפיינרים (דרך send-chat-message)
- רישום ל-heartbeat_logs (tasks_reviewed, actions_taken, summary)

## 3. הגדרות Heartbeat בדף הסוכנים

הוספת טאב "הגדרות" ב-AgentTasksPage עם:
- תדירות Heartbeat (כל 4/8/12/24 שעות)
- שעות פעילות (מ-שעה עד-שעה)
- פעולות מותרות (תזכורות WhatsApp, עדכון סטטוס, סיכום יומי)
- לוג Heartbeats אחרונים מ-heartbeat_logs

## 4. שדרוג ממשק דף הסוכנים

- **Badge "כרמן עובדת"** על כרטיסי משימות שיש בהן assigned_agent
- **כפתור "קח משימה"** — מאפשר לסוכן AI לקחת בעלות על משימה
- **תצוגת Heartbeat אחרון** בכרטיס הסוכן (מתי הרצה אחרונה, כמה משימות נסקרו)
- **"המשימה הבאה"** — בנר בראש הדף שמציע את המשימה הדחופה ביותר

## 5. שדרוג Thread View

הthread כבר עובד ב-TaskDetailDialog אבל נוסיף:
- אייקון ייעודי לפעולות agent_action (רובוט)
- תצוגת tool call log (איזה כלי כרמן הפעילה)
- Badge על כרטיס משימה בדף הסוכנים עם מספר עדכונים חדשים

---

## פירוט טכני

### קבצים שישתנו

| קובץ | שינוי |
|---|---|
| `supabase/functions/run-ai-agent/index.ts` | הוספת 5 כלים חדשים (goals, take_task, prioritize) |
| `supabase/functions/agent-heartbeat/index.ts` | **חדש** — לולאת סקירה אוטונומית |
| `src/pages/AgentTasksPage.tsx` | טאב הגדרות Heartbeat, badge "כרמן עובדת", בנר "המשימה הבאה" |
| `src/components/tasks/TaskDetailDialog.tsx` | שדרוג thread view עם agent_action icons |

### מיגרציה נדרשת
טבלת הגדרות heartbeat per-tenant:
```text
CREATE TABLE tenant_heartbeat_settings (
  tenant_id UUID PRIMARY KEY REFERENCES tenants(id),
  enabled BOOLEAN DEFAULT false,
  interval_hours INT DEFAULT 8,
  active_hours_start INT DEFAULT 7,
  active_hours_end INT DEFAULT 22,
  allowed_actions JSONB DEFAULT '["reminders","status_update","daily_summary"]',
  updated_at TIMESTAMPTZ DEFAULT now()
)
```

### סדר ביצוע
1. מיגרציית tenant_heartbeat_settings
2. כלים חדשים ב-run-ai-agent
3. Edge Function agent-heartbeat
4. שדרוג AgentTasksPage (הגדרות + badges + בנר)
5. שדרוג TaskDetailDialog thread

