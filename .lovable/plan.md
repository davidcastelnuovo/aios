

## הבנתי - הבעיה והפתרון

### הבעיה
כשלוחצים "סנכרן" בדוח הדינמי, הקוד (שורה 1022 ב-`DynamicTableView.tsx`) **מוחק את כל הרשומות הקודמות** ומכניס רק את הדוח האחרון. כלומר המידע ההיסטורי נמחק מהטבלה הדינמית בכל סנכרון.

בנוסף, ה-webhook שומר דוחות חדשים ב-`ahrefs_reports` אבל לא מעדכן את הטבלה הדינמית (`crm_records`) אוטומטית.

### מה צריך לקרות
1. כל חודש מגיע דוח חדש דרך webhook → נשמר ב-`ahrefs_reports` (כבר עובד)
2. הדוח משויך אוטומטית ללקוח לפי דומיין (כבר עובד)  
3. הנתונים צריכים להיכנס לטבלה הדינמית **בלי למחוק** דוחות קודמים
4. אפשרות לפלטר לפי חודש בטבלה הדינמית

### תוכנית

**שלב 1: עדכון סנכרון הטבלה הדינמית** (`DynamicTableView.tsx`)
- שינוי `syncAhrefsMutation` כך שיכניס רשומות מ**כל** הדוחות, לא רק מהאחרון
- כל רשומה תכיל שדה `report_date` כדי לאפשר סינון
- במקום למחוק הכל → מחיקה רק של רשומות ישנות שהתעדכנו, או upsert

**שלב 2: עדכון אוטומטי מה-webhook** (`ahrefs-webhook/index.ts`)
- אחרי שמירת/עדכון דוח ב-`ahrefs_reports`, ה-webhook גם ימצא את ה-`crm_table` המתאים (לפי `client_id` + `integration_type = 'ahrefs'`)
- יכניס/יעדכן את הרשומות ב-`crm_records` ישירות — כך שהטבלה הדינמית מתעדכנת אוטומטית בלי צורך בסנכרון ידני

**שלב 3: סינון לפי חודש**
- שדה `report_date` כבר נכנס בכל רשומה
- מנגנון הפילטר הקיים ב-`DynamicTableView` (dateFilter) כבר עובד על שדה `date` — נוודא שהוא עובד גם על `report_date`

### פרטים טכניים

**`DynamicTableView.tsx` - syncAhrefsMutation:**
```
- שליפת כל הדוחות (לא רק האחרון)
- לכל דוח → יצירת רשומות עם report_date
- מחיקה ואז הכנסה מחדש של כל הרשומות (rebuild מלא)
```

**`ahrefs-webhook/index.ts` - אחרי insert/update:**
```
- חיפוש crm_table עם integration_type='ahrefs' + client_id
- אם נמצא: מחיקת רשומות ישנות לאותו report_date + הכנסת חדשות
- כך כל דוח חודשי חדש מופיע אוטומטית בטבלה
```

**קבצים שישתנו:**
- `src/pages/DynamicTableView.tsx` — syncAhrefsMutation + date filter alignment
- `supabase/functions/ahrefs-webhook/index.ts` — auto-sync to crm_records

