## הבעיה

דיאלוג **עריכת הרשאות** של משתמש קיים (`EditUserPermissionsDialog`) כבר בנוי כמו שצריך — מחולק לקטגוריות עם אייקונים, badges, צ'קבוקס "בחר הכל לקטגוריה", וכל המודולים נכונים (`PERMISSION_CATEGORIES`).

אבל בדיאלוג **הזמנת משתמש חדש** (`Users.tsx`, שורות 1014-1048) עדיין יש רשימה ישנה ושטוחה של צ'קבוקסים שמבוססת על `getAllModules()` בלי קטגוריות, בלי אייקונים, ובלי אותה חלוקה.

## הפתרון

לחלץ את ה-UI הפנימי של `EditUserPermissionsDialog` לרכיב משותף ולהשתמש בו בשני המקומות. ככה גם הזמנת משתמש חדש וגם עריכת הרשאות יראו וירגישו בדיוק אותו דבר, וכל שינוי עתידי ל-`PERMISSION_CATEGORIES` יתעדכן אוטומטית בשני הזרמים.

## שינויים

### 1. רכיב חדש: `src/components/forms/PermissionsSelector.tsx`
רכיב controlled שמקבל:
- `value: Record<string, boolean>` — מצב ההרשאות הנוכחי
- `onChange: (next) => void` — handler לעדכון

מרנדר את אותו UI שכבר קיים ב-`EditUserPermissionsDialog`:
- לולאה על `PERMISSION_CATEGORIES`
- לכל קטגוריה: אייקון, badge צבעוני, מונה (X/Y), צ'קבוקס "בחר הכל" (כולל מצב indeterminate)
- לכל מודול: צ'קבוקס + label + description

### 2. עדכון `EditUserPermissionsDialog.tsx`
להשאיר את כל לוגיקת ה-data (טעינה מ-DB, שמירה, owner detection) ולהחליף את גוף ה-render הפנימי בשימוש ב-`<PermissionsSelector value={permissions} onChange={setPermissions} />`. אין שינוי פונקציונלי — רק ארגון מחדש.

### 3. עדכון `src/pages/Users.tsx` (דיאלוג הזמנת משתמש)
- להחליף את ה-`state` הקיים `selectedModules: string[]` ב-`selectedModulesMap: Record<string, boolean>` (כדי להתאים לחתימת הרכיב המשותף).
- להמיר ברירות מחדל לפי תפקיד (קמפיינר → dashboard, clients, tasks, chat, time_tracking; שאר התפקידים כמו שכבר קיים) למפה.
- להחליף את ה-block של שורות 1013-1048 ב-`<PermissionsSelector value={selectedModulesMap} onChange={setSelectedModulesMap} />`.
- להמיר את המפה חזרה למערך `string[]` של מודולים מאופשרים (`Object.entries(...).filter(...).map(...)`) לפני שליחה ל-`inviteUserMutation` (שדה `modulePermissions`), כדי לא לשבור את ה-edge function.
- לעדכן את כפתור "בחר הכל" הקיים (שורה 935) שיעדכן את המפה במקום את המערך.

## תוצאה למשתמש
דיאלוג הזמנת משתמש חדש יציג את אותו UI מודרני ומחולק לקטגוריות שכבר קיים בעריכת משתמש, כולל ההרשאה ל"אינטגרציות לידים" וכל שאר המודולים החסרים שכבר היו ב-`PERMISSION_CATEGORIES`. לא נוצרת כפילות קוד ולא נכתב דיאלוג חדש.
