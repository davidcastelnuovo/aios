

# תוכנית: תיקון מודול סושיאל — RTL, הסרת טאבים, ותיקון תצוגה

## סיכום שינויים

1. **הסרת לשונית "לוח שנה"** — מיותרת, תימחק לחלוטין
2. **מיזוג וורדפרס תחת ערוצים** — WordPressSettings תוצג מתחת ל-ChannelManager באותו טאב
3. **הסרת לשונית "וורדפרס"** הנפרדת
4. **תיקון תצוגת טאב ערוצים** — הבעיה: `flex-1` על TabsContent לא עובד עם Radix. נשתמש בגובה מחושב עם overflow כמו בטאב פוסטים
5. **תיקון תצוגת טאב גאנט** — אותה בעיה, נוסיף `forceMount` ועטיפת div עם גובה מחושב
6. **יישור RTL** — הטאבים עצמם (TabsList) צריכים `dir="rtl"` כדי שיסתדרו מימין לשמאל

## קבצים לעריכה

### `src/pages/SocialDashboard.tsx`
- הסרת import של `Calendar`, `VisualPostCalendar`, `Globe`
- הסרת TabsTrigger ו-TabsContent של "calendar" ו-"wordpress"
- טאב "channels" יכלול גם את `ChannelManager` וגם את `WordPressSettings` (עם כותרת מפרידה)
- תיקון טאב gantt וטאב channels להשתמש ב-`forceMount` + `activeTab === "..."` + div עם גובה מחושב + overflow
- הוספת `dir="rtl"` ל-TabsList אם חסר

### `src/components/social-media/ChannelManager.tsx`
- ייתכן שלא צריך שינוי — WordPressSettings פשוט תוצג מתחתיו

## תוצאה
- 3 טאבים: גאנט תוכן, פוסטים, ערוצים (כולל וורדפרס)
- כל הטאבים מוצגים ונגללים כראוי
- יישור RTL תקין

