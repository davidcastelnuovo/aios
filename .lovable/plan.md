

# תיקון: מוד AIOS מציג רק דשבורד בכל הנתיבים

## הבעיה
כשעוברים למוד AIOS, רק הסיידבר מוסתר — אבל התוכן של העמוד הנוכחי (למשל לידים) נשאר כמו שהוא. הסיבה: `DashboardRouter` עובד רק ב-route של `/dashboard`, אבל כל שאר ה-routes (leads, tasks, clients וכו') עדיין מרנדרים את הדף הרגיל שלהם.

## הפתרון
ב-`AppLayout.tsx`, כשהמוד הוא `aios` — להחליף את `{children}` ב-`<AIOSDashboard />` בכל route. כך לא משנה באיזה עמוד המשתמש נמצא, ברגע שהוא עובר למוד AIOS הוא רואה את ממשק הצ'אט + קנבס הנתונים.

## שינוי נדרש

### `src/components/layout/AppLayout.tsx`
- בשורה 271-272, החלפת `{children}` בתנאי:
  - אם `mode === "aios"` → רנדר `<AIOSDashboard />`
  - אחרת → רנדר `{children}` כרגיל
- הוספת import ל-`AIOSDashboard` (lazy loaded)

זהו שינוי של 3-4 שורות בלבד.

