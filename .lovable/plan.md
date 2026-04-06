

## תיקון גלילה פנימית בתצוגת צ'אט של לקוחות

### הבעיה
למרות ש-`overflow-hidden` מוגדר ברמות שונות, העמוד כולו עדיין גולל במקום שרק רשימת הלקוחות והפאנל הימני יגללו בנפרד. הסיבה: ה-`ScrollArea` של Radix צריך גובה מוגבל מפורש כדי לעבוד — `flex-1` לבד לא מספיק בכל המקרים, וחסר `min-h-0` בנקודות קריטיות.

### שינויים נדרשים

**1. `src/components/clients/ClientsChatView.tsx`**
- הקונטיינר הראשי (שורה 363): להוסיף `min-h-0` כדי שה-flex children יוכלו להתכווץ
- הסיידבר של רשימת הלקוחות (שורה 365): להוסיף `min-h-0` 
- ה-`ScrollArea` של רשימת הלקוחות (שורה 454): להוסיף `min-h-0` 
- פאנל הפרטים (שורה 532): לוודא שיש `min-h-0`
- תוכן הפרטים (אחרי ה-toolbar): לעטוף ב-`ScrollArea` עם `flex-1 min-h-0` אם עדיין לא עטוף

**2. `src/pages/Clients.tsx`**
- הקונטיינר הראשי (שורה 519): לוודא שיש `min-h-0` על `flex flex-col h-full`
- לוודא שאין `overflow-y-auto` שמתחרה עם `overflow-hidden`

**3. `src/components/layout/AppLayout.tsx`**
- ה-`main` (שורה 226): כבר מוגדר נכון עם `flex-1 min-h-0 overflow-hidden`, אבל ב-mobile יש `overflow-y-auto` שיכול לגרום לגלילת עמוד — צריך להסיר את `overflow-y-auto` ולהשאיר רק `overflow-hidden`

### עיקרון
הבעיה הקלאסית: ב-flexbox, ילד עם `flex-1` לא יתכווץ מתחת לגודל התוכן שלו אלא אם יש לו `min-h-0`. צריך להבטיח שכל שרשרת ה-flex מההורה ועד ל-ScrollArea מכילה `min-h-0`.

