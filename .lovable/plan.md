## הבעיה

`MaskyooCallsCard` מחזיר 0 למרות ששיחות קיימות ב-`call_logs`.

הסיבה: השאילתה משתמשת ב-`.ilike("to_number", "%778050632")` (9 ספרות), אבל `to_number` נשמר עם מקפים (`077-8050632`) — ולכן אין רצף של 9 ספרות רצופות לחיפוש.

ב-DB ראיתי 1 שיחה ל-077-8050632 ו-3 שיחות ל-077-8042037 ב-30 הימים האחרונים — שאמורות להופיע.

## התיקון

עריכת `src/components/dynamic-tables/MaskyooCallsCard.tsx`, פונקציית `live` בתוך `NumberRow`:

1. להסיר את ה-`.ilike("to_number", ...)`.
2. לשלוף את כל הרשומות של `provider='maskyoo'` עבור ה-tenant ב-30 הימים האחרונים (כפי ש-`MaskyooNumbersManager` כבר עושה בהצלחה).
3. לסנן בצד הלקוח: `right(digits-only(to_number), 9) === cfg.last9`.

זה אותו דפוס שכבר עובד ב-`MaskyooNumbersManager` (שורות 60–77) — דבר שמסביר למה הספירה במסך הניהול נכונה אבל בכרטיס הדוח אפסית.

### אופטימיזציה (אופציונלית, מומלצת)

כדי לא לשלוף את אותו set פעמיים לכל מספר באותו דוח: להעלות את ה-fetch ל-`MaskyooCallsCard` (שאילתה אחת לכל ה-tenant + תקופה), ואז לפצל ל-stats לכל `last9` ולהעביר ל-`NumberRow` כ-prop. זה מקטין את מספר ה-round-trips מ-N (כמספר המספרים) ל-1.

## בלי שינויים

- `MaskyooSiblingCard` — נשאר.
- `MaskyooNumbersManager` — נשאר (כבר עובד נכון).
- מצב `prefetchedStats` (Public Share) — לא מושפע.
- אין צורך במיגרציה ל-DB.
