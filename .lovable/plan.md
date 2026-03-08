

# הוספת מיפוי שדות לפעולת "צור משימה" בעורך הפלו

## הבעיה
כשבוחרים פעולת "צור משימה" בעורך הפלו, אין שום ממשק להגדרת שדות המשימה. הבקאנד כבר תומך בכל השדות (`task_title_template`, `task_notes_template`, `task_priority`, `task_due_days`, `default_campaigner_id`, `default_agency_id`) אבל אין UI.

## הפתרון
הוספת קומפוננטת `CreateTaskActionConfig` בתוך `StepConfigPanel.tsx` שתוצג כש-`action_type === "create_task"`.

### שדות שיוצגו:

1. **כותרת משימה** (`task_title_template`) - Input עם אפשרות הכנסת משתנים מהטריגר (כמו `{{contact_name}}`, `{{company_name}}`)
2. **הערות** (`task_notes_template`) - Textarea עם משתנים
3. **עדיפות** (`task_priority`) - Select (1-10)
4. **ימים לדד-ליין** (`task_due_days`) - Input מספרי
5. **סוכנות ברירת מחדל** (`default_agency_id`) - Select מרשימת סוכנויות הארגון
6. **קמפיינר ברירת מחדל** (`default_campaigner_id`) - Select מרשימת קמפיינרים
7. **שיוך ליד/לקוח** - הסבר שהמערכת משייכת אוטומטית מנתוני הטריגר

כל שדות הטקסט יכללו כפתורי הכנסת משתנים (בדיוק כמו שקיים כבר ב-Green API message template).

### שינויים:

| קובץ | שינוי |
|-------|-------|
| `src/components/automations/StepConfigPanel.tsx` | הוספת קומפוננטת `CreateTaskActionConfig` + רנדור שלה כש-`action_type === "create_task"` (שורה ~417, לפני סגירת ה-div) |

הקומפוננטה תשתמש ב-queries קיימים לטעינת סוכנויות וקמפיינרים, ותציג את `availableFields` ככפתורי משתנים להכנסה לשדות הטקסט.

