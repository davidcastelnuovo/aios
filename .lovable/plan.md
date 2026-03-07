

# תיקון תצוגת רשימת אימיילים — הגבלת טקסט והצגת תאריך ושעה

## הבעיה
הטקסט הפנימי (snippet) של כל אימייל תופס את כל הרוחב ודוחף את התאריך והשעה מחוץ למסך.

## הפתרון
בקובץ `src/pages/Gmail.tsx`, שורות 642-694:

1. **הגבלת רוחב ה-snippet** — הוספת `max-w-[50%]` או שימוש ב-`overflow-hidden` על ה-div של Subject + snippet כדי שלא ידחוף את השאר
2. **הגדלת עמודת התאריך** — שינוי מ-`w-[60px]` ל-`w-[100px]` כדי להציג גם תאריך וגם שעה
3. **הצגת תאריך + שעה** — עדכון `formatTime` או הוספת תצוגה משולבת (תאריך קצר + שעה)

### שינויים ספציפיים:

**שורות 642-662** — הוספת `overflow-hidden` על ה-container של subject+snippet:
```tsx
<div className="flex-1 min-w-0 flex items-center gap-2 text-sm truncate overflow-hidden">
```

**שורות 691-694** — הרחבת עמודת הזמן והצגת תאריך:
```tsx
<div className="w-[110px] flex-shrink-0 text-xs text-muted-foreground text-left ps-2">
  {format(new Date(msg.date), 'dd/MM HH:mm')}
</div>
```

