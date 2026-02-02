
# תכנית תיקון - סנכרון ManyChat לא עובד ללידים חדשים

## אבחון הבעיה

הבעיה המרכזית זוהתה:
- **ManyChat API לא תומך ב-`whatsapp_phone` ו-`wa_id` בחיפוש `findBySystemField`** - מחזיר שגיאה 400
- כאשר מנוי נרשם דרך WhatsApp ישירות ב-ManyChat, הוא נוצר **בלי שדה `phone`** - רק עם `whatsapp_phone`
- לכן:
  1. `findBySystemField?phone=...` מחזיר ריק (אין phone)
  2. `findByCustomField?phone_number=...` מחזיר ריק (Custom Field לא הוגדר ל-subscriber)
  3. `createSubscriber` נכשל עם "WhatsApp ID already exists"
  
**התוצאה:** המערכת לא יכולה למצוא את המנוי הקיים וגם לא ליצור חדש.

## פתרון

כאשר יצירת subscriber נכשלת עם `"WhatsApp ID already exists"`, יש להוסיף שלב **לפני** הכרזת כשלון:

1. **לחלץ את ה-WhatsApp ID מהשגיאה** (למשל `972523043096`)
2. **להשתמש ב-API אחר של ManyChat:** `findByName` או `getInfo` - אבל אלו דורשים subscriber_id
3. **הפתרון האמיתי:** להשתמש ב-API `/fb/sending/sendContent` עם `subscriber_id` מסוג WhatsApp ID ישירות

אבל - ManyChat לא מספק דרך ישירה למצוא subscriber לפי whatsapp_phone.

**הפתרון המעשי:**
כאשר מתקבלת שגיאה `"WhatsApp ID already exists"`:
1. סמן את הליד עם סטטוס מיוחד `EXISTING_WA_SUBSCRIBER` 
2. **המערכת צריכה Flow ב-ManyChat** שמעדכן את ה-Custom Field `phone_number` לכל נרשם חדש
3. לאחר עדכון ה-Flow - הסנכרון הבא יצליח למצוא את המנוי

## שינויים טכניים

### 1. עדכון `executeCreateManychatSubscriber` ב-`trigger-automation/index.ts`
- כאשר יצירה נכשלת עם `"WhatsApp ID already exists"`:
  - לסמן את הליד כ-`EXISTING_WA_SUBSCRIBER` במקום `NEEDS_MANUAL_LINK`
  - להחזיר תשובה מפורטת שמסבירה שצריך Flow ב-ManyChat

### 2. עדכון `executeSendWhatsapp` ב-`trigger-automation/index.ts`
- להסיר את הקריאות ל-`findBySystemField?wa_id=...` ו-`findBySystemField?whatsapp_phone=...` - הן תמיד נכשלות
- להוסיף הודעת לוג ברורה כשזה קורה

### 3. עדכון `auto-sync-new-lead/index.ts`
- אותו טיפול - סימון `EXISTING_WA_SUBSCRIBER` כאשר יש conflict

### 4. הוספת הנחיות למשתמש
- בדף הגדרות ManyChat - להוסיף הסבר על הצורך ב-Flow שמעדכן `phone_number`

## המלצה נוספת
כדי לפתור את הבעיה לחלוטין, יש ליצור Flow ב-ManyChat:
1. טריגר: New Subscriber / WhatsApp Opt-in
2. פעולה: Set Custom Field `phone_number` = `{{whatsapp_phone}}`

זה יבטיח שמנויים עתידיים יהיו ניתנים לאיתור דרך ה-API.

## קבצים לעריכה
- `supabase/functions/trigger-automation/index.ts`
- `supabase/functions/auto-sync-new-lead/index.ts`
- `src/pages/ManyChatSettings.tsx` (אופציונלי - הוספת הסבר)
