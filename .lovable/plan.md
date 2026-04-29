
## האבחנה

הטבלה "ארבע על ארבע" של פייסבוק E-commerce מסווגת תחת `category = "Facebook Insights"` במקום `"Facebook Ecommerce"`. לכן היא מופיעה בטאב הלא נכון, למרות ש-`integration_type` שלה הוא `facebook_ecommerce`.

זה מקרה בודד (בדקתי - אין עוד טבלאות `facebook_ecommerce` עם קטגוריה שגויה).

## התיקון

### חלק 1: תיקון נקודתי לטבלה הקיימת
מיגרציה שתעדכן את ה-category של הטבלה `da0a8fb0-ab9f-47c6-8cbb-8aa5d658bf28` ("ארבע על ארבע") מ-`Facebook Insights` ל-`Facebook Ecommerce`.

### חלק 2: מניעת הישנות
ב-`FacebookEcommerceTableDialog.tsx` כבר ברירת המחדל היא `'Facebook Ecommerce'`. אבדוק אם יש זרימה שבה נוצרת טבלת `facebook_ecommerce` דרך מקום אחר (למשל המרה מ-Insights), ואם כן - אכפה את ה-category.

קובץ נוסף לבדיקה: `CategorySyncControl.tsx` - לוודא שכשמסנכרנים `facebook_ecommerce` הקטגוריה מתעדכנת נכון.

## תוצאה צפויה
הטבלה "ארבע על ארבע" תופיע בטאב **Facebook Ecommerce (3)** במקום ב-Facebook Insights, ותכלל בעיבוד המכירות (לא בעיבוד הלידים).

לאשר?
