

# תיקון בוחר תאריכים בפילטר לידים

## הבעיה
הלוח שנה (Calendar) בתוך ה-Popover של פילטר התאריכים לא מגיב ללחיצות כי חסר `pointer-events-auto` ברכיב Calendar. זה בעיה ידועה כש-Calendar נמצא בתוך Dialog + Popover.

## הפתרון
שני שינויים:

1. **`src/components/ui/calendar.tsx`** — הוספת `pointer-events-auto` ל-className הדיפולטי של DayPicker (שורה 14):
   - `cn("p-3", className)` → `cn("p-3 pointer-events-auto", className)`

2. **`src/components/leads/LeadFiltersDialog.tsx`** — וידוא שה-Calendar ב-date pickers עובד תקין (שורות 646, 669). אם השינוי ב-calendar.tsx מספיק, לא צריך לשנות כאן.

## תוצאה
המשתמש יוכל ללחוץ על תאריכים בלוח השנה ולבחור טווח "מתאריך" - "עד תאריך" בפילטר הלידים.

