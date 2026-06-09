מצאתי שהסנכרון האחרון באמת לא משך ביטויים במעקב: בדוח `ggds.co.il` מהיום `tracked_keywords` ריק, וגם בלוגים של `fetch-ahrefs-snapshot` מופיע שוב ושוב `tracked=0`. בנוסף, בטבלת הדוח לא נשמר `ahrefs_project_id`, למרות שברשימת הפרויקטים של Ahrefs קיים פרויקט מתאים ל־`ggds.co.il` עם `project_id=4174619` ו־41 מילות מעקב.

## תכנית תיקון

1. **להוסיף זיהוי אוטומטי של פרויקט Ahrefs לפי דומיין**
   - אם אין `ahrefs_project_id` שמור בדוח/טבלה, הפונקציה תחפש בפרויקטים של Ahrefs פרויקט עם דומיין תואם.
   - כך סנכרון קטגוריה לא יהיה תלוי בזה שהמשתמש בחר ידנית פרויקט בעבר.

2. **להוסיף מצב `tracked_only` ל־`fetch-ahrefs-snapshot`**
   - במצב הזה הפונקציה תדלג על Site Explorer / Organic Keywords / Historical Metrics.
   - היא תמשוך רק Rank Tracker / Project Keywords, שהם endpoints חינמיים לפי ההערות הקיימות בקוד.
   - היא תמזג את `tracked_keywords` לתוך הדוח האחרון הקיים בלי למחוק את הנתונים האורגניים, GSC, snapshot או comparisons.

3. **להוסיף כפתור UI לסנכרון tracked בלבד**
   - ב־`CategorySyncControl` עבור קטגוריית SEO / Ahrefs יתווסף כפתור: “משוך ביטויים במעקב בלבד”.
   - הכפתור ירוץ על כל דוחות ה־Ahrefs בקטגוריה, יעדכן התקדמות, ויציג כמה הצליחו/נכשלו.

4. **לשמור את מזהה הפרויקט לשימוש עתידי**
   - כשסנכרון tracked-only מוצא פרויקט מתאים, נשמור `ahrefs_project_id`, `ahrefs_mode`, `ahrefs_protocol` בתוך `integration_settings` של הטבלה.
   - בדוחות החדשים/מעודכנים נשמור גם metadata מתאים, כדי שהסנכרונים הבאים יעבדו בלי חיפוש מחדש.

5. **אימות אחרי יישום**
   - אפעיל בדיקה נקודתית על `ggds.co.il` במצב tracked-only.
   - אוודא שבמסד הנתונים `report_data.tracked_keywords` כבר לא ריק ושה־UI יציג מספר גדול מ־0 בטאב “ביטויים במעקב”.

## קבצים שצפויים להשתנות

- `supabase/functions/fetch-ahrefs-snapshot/index.ts`
- `src/components/dynamic-tables/CategorySyncControl.tsx`

לא צפויה מיגרציית DB.