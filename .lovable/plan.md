

## שתי בעיות נפרדות באקו

### בעיה 1: השיתוף מציג אפסים
**שורש הבעיה**: ה-cron של Google Ads רץ הבוקר (08:23), מחק את כל 90 הרשומות הקיימות, ואז ניסה להכניס מחדש - **וקיבל שגיאת FK**: 

```
insert error: insert or update on table "crm_records" violates 
foreign key constraint "crm_records_created_by_fkey"
```

הסיבה: בקריאה הפנימית מה-cron (השינוי שעשינו אתמול), הגדרנו `user.id = '00000000-0000-0000-0000-000000000000'` - מזהה placeholder שלא קיים ב-`auth.users`, ולכן ה-FK ב-`created_by` נכשל. 90 רשומות נמחקו ואף רשומה חדשה לא נכנסה.

זו לא בעיה ב-SharedTable - הקוד שלו תקין. פשוט **אין נתונים בטבלה** עכשיו (אישרתי ב-DB: 0 רשומות).

### בעיה 2: המרות מוצגות עם נקודה עשרונית (9.6, 23.5)
שורות 2743 ו-2762 ב-`DynamicTableView.tsx` משתמשות ב-`maximumFractionDigits: 1` עבור עמודת המרות.

## התיקונים

### 1. תיקון FK בסנכרון cron (קריטי)
ב-`supabase/functions/sync-google-ads-data/index.ts`:
- במקום `user.id = '00000000-...'`, נטען מזהה משתמש אמיתי קיים בטבלה (למשל `created_by` של רשומה ישנה כלשהי בטבלה, או הבעלים של ה-tenant מ-`tenant_users` שיש לו role=`owner`).
- אם לא נמצא - ניפול חזרה ל-NULL (ה-FK ב-`created_by` כנראה nullable - נבדוק; אם לא, נעדכן את העמודה כך שתאפשר NULL לקריאות מערכת).

### 2. סנכרון מיידי לאקו אחרי התיקון
לאחר ה-deploy, נריץ סנכרון ידני ל-`e4c69369-8853-42af-ac5a-5ae3787947ce` כדי שהנתונים יחזרו לדוח ולשיתוף.

### 3. עיגול המרות לספרה שלמה
ב-`DynamicTableView.tsx` שורות 2743 + 2762:
```tsx
{data.conversions.toLocaleString('he-IL', { maximumFractionDigits: 0 })}
```
(במקום `1`). יציג 10 במקום 9.6, 24 במקום 23.5.

### 4. בדיקת מקומות נוספים
חיפוש מהיר על `conversions.*toLocaleString` או `conversions.*toFixed` בכל הקבצים (כולל SharedTable) - לוודא שאין הצגה עשרונית של המרות בשום view.

## תוצאה צפויה
- הקישור `after-lead.com/shared/table/eco` יציג מיידית את כל הנתונים (Pmax, יוון/אנטארקטיקה וכו') במקום אפסים.
- עמודת המרות תציג ערכים שלמים בלבד (10, 24, 11, 8) הן בדוח הפנימי הן בשיתוף.
- ה-cron שירוץ מחר ב-04:00 יעבוד כראוי - ימחק וייכניס נכון בלי FK error.

## קבצים שיתעדכנו
- `supabase/functions/sync-google-ads-data/index.ts` - תיקון user.id ל-cron
- `src/pages/DynamicTableView.tsx` - שורות 2743, 2762 (עיגול)
- אם ימצאו - מקומות נוספים שמציגים `conversions` עם עשרוניים

