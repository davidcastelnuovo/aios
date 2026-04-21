

## תיקון רשימת הקמפיינרים והדיאלוג הפנימי לפי הדפוס של לידים/לקוחות

### מקור הבעיה
- `CampaignersChatView` משתמש כיום ב-`flex-row-reverse` ב-wrapper הראשי + `dir="rtl"` על כל אזור בנפרד. זה גורם לכך שכשהשם או רשימת הסוכנויות ארוכים, הכפתור "מתנפח" וה-`flex-1 min-w-0` לא ממש נחתך — מה שדוחף את האווטאר/השם לאמצע.
- בלידים ובלקוחות הדפוס שעובד הוא: **`dir="rtl"` יחיד על ה-wrapper הראשי**, ה-sidebar הוא הילד הראשון (ולכן ב-RTL יושב אוטומטית בימין), ועל הכפתור עצמו מוסיפים `overflow-hidden` + `style={{ maxWidth: '100%', boxSizing: 'border-box' }}` כדי למנוע מהתוכן להגדיל את רוחב השורה.

### מה אעדכן ב-`src/components/campaigners/CampaignersChatView.tsx`

**1. Wrapper ראשי (החזרת רשימה לימין בצורה יציבה)**
- `<div dir="rtl" className="flex h-full min-h-0 max-h-full border rounded-lg overflow-hidden bg-background">` — בלי `flex-row-reverse`, בלי `gap-4`.
- להסיר את ה-`dir="rtl"` הכפול מ-`<aside>` ומה-`<section>`.

**2. עמודת הרשימה (זהה ללידים/לקוחות)**
- `w-[25%] min-w-[240px] max-w-[25%] border-l flex flex-col bg-muted/20 overflow-hidden`.
- חיפוש + סלקט סטטוס נשארים כפי שהם.
- `ScrollArea` → להחליף ל-`<div className="flex-1 overflow-y-auto overflow-x-hidden">` עם `<div className="divide-y w-full">` בפנים (אותו דפוס שעובד נקי בלידים).

**3. שורת איש צוות (קריטי לתיקון)**
- `<button>` עם `style={{ maxWidth: '100%', boxSizing: 'border-box' }}` ו-`className="w-full p-3 hover:bg-muted/50 transition-colors cursor-pointer overflow-hidden"`.
- בפנים: `<div className="flex items-start gap-2">`.
- אווטאר עגול 10×10 עם `shrink-0`.
- בלוק טקסט: `<div className="flex-1 min-w-0 text-right">` שמכיל:
  - שם: `<span className="block font-semibold text-sm truncate text-right">` — `truncate` במקום `whitespace-nowrap`, כך שמות ארוכים נחתכים עם `…` ולא דוחפים את ה-layout.
  - תפקידים: שורה משלה עם `truncate text-xs text-muted-foreground`.
  - סוכנויות: שורה משלה עם `truncate text-xs text-muted-foreground` — וזה החלק הקריטי שגרם לבעיה הנוכחית.
  - לקוחות משויכים: שורה תחתונה.
- מסגרת בחירה: `bg-primary/10 border-r-4 border-r-primary` (זהה ללידים) במקום `bg-muted` הסטנדרטי.

**4. עמודת פרטים (לא נוגעים בלוגיקה)**
- `<div className="flex-1 min-h-0 flex flex-col overflow-hidden">` במקום `<section dir="rtl">`.
- כל שאר התוכן (Header, Tabs, EditableRow, AgenciesRow, EditCampaignerDialog) נשאר בדיוק כמו שהוא, כולל הסנכרון בין משתמשים לקמפיינרים — לא נוגעים.

### דיאלוג עריכת הפרטים (`EditCampaignerDialog`)
- אוודא ש-`DialogContent` כולל `max-w-2xl max-h-[90vh] overflow-y-auto` ו-`dir="rtl"` כדי שייכנס בנוחות גם במסך קטן.
- אם חסר — אוסיף. אם כבר קיים — לא נוגע. בלי שינוי בשדות, בולידציה או בהרשאות.

### מה לא משתנה
- לוגיקת השאילתות (`campaigners` query, `updateCampaignerField`, `updateCampaignerAgencies`).
- סנכרון `profiles` ↔ `campaigners` (full_name).
- כל הלשוניות (פרטים, לקוחות משויכים, משימות, פגישות).
- `EditableRow`, `AgenciesRow`.
- הרשאות, RLS, סוכנויות.

### תוצאה צפויה
- רשימת הקמפיינרים יושבת בצד ימין, יציבה, עם אווטאר צמוד לימין ושם/תפקיד/סוכנויות בעמודה לידו.
- שמות וסוכנויות ארוכים נחתכים ב-`…` ולא דוחפים את ה-layout.
- עמודת הפרטים בצד שמאל, רוחבה גמיש, נכנסת תמיד.
- דיאלוג עריכת פרטים מלאים נכנס נכון גם במסכים בינוניים.

### קבצים שיתעדכנו
- `src/components/campaigners/CampaignersChatView.tsx` — שכתוב של ה-wrapper הראשי, ה-sidebar ושורת הקמפיינר בלבד.
- `src/components/forms/EditCampaignerDialog.tsx` — רק אם חסרים `max-w-2xl max-h-[90vh] overflow-y-auto dir="rtl"` ב-`DialogContent`.

