
# תוכנית תיקון: לולאת עדכונים אינסופית ב-EditLeadDialog

## הבעיה שזוהתה

בקובץ `src/components/forms/EditLeadDialog.tsx` בשורות 190-199 יש `useEffect` שיוצר **לולאה אינסופית של עדכונים**.

### מקור הבעיה

```typescript
// הקוד הבעייתי (שורות 190-199)
useEffect(() => {
  if (leadSalesPeople.length > 0) {
    setSelectedSalesPeople(leadSalesPeople);
  } else if (lead.sales_person_id) {
    setSelectedSalesPeople([lead.sales_person_id]);
  } else {
    setSelectedSalesPeople([]);
  }
}, [leadSalesPeople, lead.sales_person_id, open]);
```

**למה זה יוצר לולאה אינסופית:**
1. `leadSalesPeople` הוא מערך שמגיע מ-useQuery
2. גם אם התוכן זהה, הייחוס למערך משתנה בכל render
3. זה גורם ל-useEffect לרוץ שוב ושוב
4. `setSelectedSalesPeople` משנה את ה-state, שמעדכן את הקומפוננטה
5. העדכון גורם ל-leadSalesPeople להתחשב מחדש → חוזר לשלב 1

## הפתרון

להחליף את ההשוואה ל-comparison מבוססת על ערכים (לא על reference) באמצעות `JSON.stringify`:

```typescript
// הקוד המתוקן
useEffect(() => {
  // Only run when dialog is open
  if (!open) return;
  
  if (leadSalesPeople.length > 0) {
    setSelectedSalesPeople(leadSalesPeople);
  } else if (lead.sales_person_id) {
    setSelectedSalesPeople([lead.sales_person_id]);
  } else {
    setSelectedSalesPeople([]);
  }
  // Use JSON.stringify to prevent infinite loop from array reference changes
}, [JSON.stringify(leadSalesPeople), lead.sales_person_id, open]);
```

## פרטים טכניים

### קובץ לעדכון
`src/components/forms/EditLeadDialog.tsx`

### שינוי (שורות 189-199)

**לפני:**
```typescript
// Sync selected sales people when dialog opens or data loads
useEffect(() => {
  if (leadSalesPeople.length > 0) {
    setSelectedSalesPeople(leadSalesPeople);
  } else if (lead.sales_person_id) {
    // Fallback to legacy field
    setSelectedSalesPeople([lead.sales_person_id]);
  } else {
    setSelectedSalesPeople([]);
  }
}, [leadSalesPeople, lead.sales_person_id, open]);
```

**אחרי:**
```typescript
// Sync selected sales people when dialog opens or data loads
// Using JSON.stringify to prevent infinite loop from array reference changes
useEffect(() => {
  // Only sync when dialog is open
  if (!open) return;
  
  if (leadSalesPeople.length > 0) {
    setSelectedSalesPeople(leadSalesPeople);
  } else if (lead.sales_person_id) {
    // Fallback to legacy field
    setSelectedSalesPeople([lead.sales_person_id]);
  } else {
    setSelectedSalesPeople([]);
  }
}, [JSON.stringify(leadSalesPeople), lead.sales_person_id, open]);
```

## יתרונות התיקון

1. **עוצר את הלולאה האינסופית** - `JSON.stringify` יוצר מחרוזת שלא משתנה כל עוד הערכים זהים
2. **שומר על הפונקציונליות** - הסנכרון עדיין עובד כמצופה
3. **מונע renders מיותרים** - רק שינויים אמיתיים בנתונים יגרמו לעדכון
4. **בדיקת open** - מבטיח שהעדכון קורה רק כשהדיאלוג פתוח

## השפעה

| לפני | אחרי |
|------|------|
| לולאה אינסופית → דפדפן נתקע | עדכון יחיד בפתיחת הדיאלוג |
| שגיאת "Maximum update depth exceeded" | אין שגיאות |
| לא ניתן לערוך לידים | עריכה עובדת כרגיל |
