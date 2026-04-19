

## בעיה
ב-`ClientUpdatesTab.tsx` הדרופדאון "מצב לקוח" משתמש ב-state מקומי `commStatus` שמאותחל קשיח ל-`"happy"`, ולא מסתנכרן עם המצב האמיתי של הלקוח (`client.mood_status`). תוצאה:

1. הדרופדאון תמיד מציג "מבסוט" בפתיחה — גם אם הלקוח באמת "מתנדנד".
2. אם המשתמש בוחר "מבסוט" (הערך שכבר מוצג), ה-`onValueChange` של Radix לא נורה → אין שמירה.
3. הסטטוס הראשי בכותרת (`selectedClient.mood_status` ב-`ClientsChatView`) קורא ישירות מה-DB, ולכן הוא לא תואם לתצוגה המקומית.

## פתרון

### 1. סנכרון `commStatus` עם המצב האמיתי
- להעביר את `client.mood_status` כ-prop נוסף ל-`ClientUpdatesTab` מ-`ClientsChatView` ו-`EditClientDialog`.
- לאתחל את `commStatus` ממנו, ולעדכן עם `useEffect` כשהוא משתנה (כדי שגם רענון מהכותרת יסתנכרן פנימה).

### 2. הבטחת שמירה מיידית
- במקום `Select` רגיל שמסתמך על `onValueChange` (שלא נורה כשבוחרים את אותו ערך), להוסיף שמירה גם אם הערך זהה (לא יזיק) — או פשוט: לאחר שה-state האמיתי יסתנכרן, הבעיה הזו תיעלם.

### 3. סדר פעולות במוטציה
- לעדכן קודם את `clients.mood_status` ואז להוסיף ל-`communication_logs` — כך שגם אם רישום ה-log נכשל, הסטטוס נשמר.

### 4. אינוולידציה של ה-cache הנכון
- לוודא ש-`queryClient.invalidateQueries({ queryKey: ["clients"] })` מרענן את הרשימה ב-`ClientsChatView`. לבדוק את ה-queryKey המדויק של רשימת הלקוחות (ייתכן שזה `["clients", tenantId]`) ולהוסיף refetch מתאים.

## קבצים לעריכה
- `src/components/clients/ClientUpdatesTab.tsx` — הוספת prop `currentMoodStatus`, אתחול state ממנו, useEffect לסנכרון, היפוך סדר במוטציה.
- `src/components/clients/ClientsChatView.tsx` — העברת `selectedClient.mood_status` כ-prop.
- `src/components/forms/EditClientDialog.tsx` — העברת `client.mood_status` כ-prop.

