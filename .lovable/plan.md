

## הוספת אפשרות שינוי סוכנות בתצוגת לקוחות

### הבעיה
1. בתצוגת הצ'אט של לקוחות (ClientsChatView) אין כפתור לשינוי סוכנות
2. בבחירה מרובה של לקוחות (ClientsMultiSelectToolbar) אין אפשרות לשנות סוכנות

### הפתרון

**1. `src/components/clients/ClientsChatView.tsx`**
- בשורה 996-998 (אזור "מידע עסקי") — הוספת כפתור "שנה סוכנות" ליד שם הסוכנות
- שימוש ב-`ChangeAgencyDialog` הקיים (כבר קיים ב-chat)
- הוספת state לניהול פתיחת הדיאלוג + import של הקומפוננטה

**2. `src/components/clients/ClientsMultiSelectToolbar.tsx`**
- הוספת כפתור "שנה סוכנות" בטולבר הבחירה המרובה
- הוספת Select לבחירת סוכנות יעד מרשימת הסוכנויות של הטנאנט
- mutation שמעדכן את `agency_id` לכל הלקוחות שנבחרו בבת אחת
- הוספת prop של `tenantId` מ-Clients.tsx כדי לשלוף את רשימת הסוכנויות

**3. `src/pages/Clients.tsx`**
- העברת `tenantId` ל-`ClientsMultiSelectToolbar`

### פרטים טכניים
- ה-`ChangeAgencyDialog` הקיים תומך ב-client בודד — נשתמש בו ישירות ב-ClientsChatView
- ל-bulk נבנה Popover עם Select של סוכנויות + mutation שעושה `.update({ agency_id }).in("id", selectedIds)`

