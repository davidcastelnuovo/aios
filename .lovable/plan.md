

# תיקון תצוגת תאריך ושעה ברשימת אימיילים

## הבעיה
עמודת התאריך/שעה (שורה 694) נדחקת מחוץ למסך כי:
1. ה-snippet תופס את כל ה-`flex-1` ולא מוגבל ברוחב
2. כפתורי ה-hover actions (שורות 667-691) יושבים בין ה-snippet לעמודת הזמן

## הפתרון
בקובץ `src/pages/Gmail.tsx`:

1. **העבר את עמודת הזמן לפני ה-snippet** בסדר ה-DOM (אחרי השולח, לפני הנושא) — כך היא תמיד תהיה גלויה
2. **עדכן את ה-header** בהתאם — העבר את עמודת "שעה" לאותו מיקום
3. **עדכן formatTime** — תמיד להציג `dd/MM HH:mm` (בלי תנאי isToday)

### שינויים ספציפיים:

**שורות 322-332** — פישוט formatTime:
```tsx
const formatTime = (dateStr: string) => {
  const d = new Date(dateStr);
  const day = d.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' });
  const time = d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
  return `${day} ${time}`;
};
```

**שורות 595-606** — סידור עמודות ב-header: הזז "שעה" לפני "נושא"

**שורות 636-696** — בכל שורת אימייל: הזז את div של התאריך (שורות 693-696) ל**אחרי** ה-sender ו**לפני** ה-subject+snippet. כך ה-actions וה-snippet לא ידחקו אותו.

