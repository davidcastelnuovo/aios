

# תיקון: הפרדה בין "תלונה" ל"דרוש טיפול דחוף"

## הבעיה
כרגע דגל אדום מציג "תלונה" בדשבורד, אבל "תלונה" צריך להיות דגל ידני שנקבע רק מתוך כרטיס לקוח. דגל אדום אוטומטי צריך להציג "דרוש טיפול דחוף".

## התיקון

### קובץ: `src/lib/healthScore.ts`

1. **הוספת FlagKey חדש**: `urgent_treatment` — דגל אדום אוטומטי
2. **עדכון FLAG_LABELS**: `urgent_treatment: 'דרוש טיפול דחוף'`
3. **עדכון FLAG_COLORS**: צבע אדום כמו complaint
4. **הוספה ל-RED_FLAGS**: `urgent_treatment` יחליף את `complaint` ברשימת הדגלים האדומים האוטומטיים
5. **`complaint` יישאר** כדגל ידני בלבד — ללא שינוי בהיגיון החישוב, אבל ייכנס לרשימה רק דרך ManualHealthEditDialog

### לוגיקה:
- `complaint` נשאר ב-FlagKey וב-ManualHealthEditDialog כדגל ידני
- ב-`calculateHealthScore()` — שורה 60-62: כשיש `communicationStatus === 'complaint'`, במקום להוסיף flag `complaint` ← יוסיף `urgent_treatment`
- כך הדשבורד יציג "דרוש טיפול דחוף" כשהציון יורד אוטומטית, ו"תלונה" רק כשזה נקבע ידנית

