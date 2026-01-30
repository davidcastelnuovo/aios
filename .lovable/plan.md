

# תוכנית תיקון: עדכון שדה מותאם אישית `phone_number` ל-Subscriber קיים

## הבעיה שזוהתה

כאשר ליד חדש נוצר במערכת והמערכת מוצאת subscriber **קיים** במניצ'ט (לפי טלפון/אימייל), היא לא מעדכנת לו את השדה המותאם אישית `phone_number`. 

השדה הזה קריטי כי:
- הוא משמש כ"מקור אמת" לזיהוי subscribers בעתיד
- בלעדיו, החיפוש לפי custom field נכשל
- האוטומציות לא יכולות למצוא את ה-subscriber הנכון

### מה קורה היום:
```
ליד חדש → מוצא subscriber קיים → שומר ID בבסיס נתונים → סיום ❌
                                      (לא מעדכן phone_number במניצ'ט!)
```

### מה צריך לקרות:
```
ליד חדש → מוצא subscriber קיים → מעדכן phone_number במניצ'ט → שומר ID בבסיס נתונים → סיום ✅
```

## הפתרון

להוסיף קריאה ל-`setPhoneCustomField` בכל מקום שבו נמצא subscriber קיים:
1. אחרי מציאה לפי טלפון/אימייל/custom field
2. אחרי מציאה בעקבות כישלון יצירה (create conflict)

## פרטים טכניים

### קובץ לעדכון
`supabase/functions/auto-sync-new-lead/index.ts`

### שינוי 1: עדכון phone_number ל-subscriber קיים (שורות 544-546)

**לפני** (שורה 545-546):
```typescript
// STEP 6: Update lead with subscriber ID
if (subscriberId) {
```

**אחרי**:
```typescript
// STEP 5.5: If subscriber was found (not created), ensure phone_number custom field is set
if (subscriberId && wasExisting) {
  console.log(`📝 Ensuring phone_number custom field is set for existing subscriber ${subscriberId}...`);
  const formattedPhoneForCustomField = `+${formattedPhone}`;
  await setPhoneCustomField(apiKey, subscriberId, formattedPhoneForCustomField);
}

// STEP 6: Update lead with subscriber ID
if (subscriberId) {
```

## סיכום השינוי

| מצב | לפני | אחרי |
|-----|------|------|
| subscriber חדש נוצר | ✅ מעדכן phone_number | ✅ מעדכן phone_number |
| subscriber קיים נמצא | ❌ לא מעדכן | ✅ מעדכן phone_number |

## יתרונות

1. **תיקון הבעיה**: כל subscriber יקבל את השדה phone_number מעודכן
2. **עקביות**: אותה לוגיקה ליצירה וגם למציאה
3. **זיהוי עתידי**: subscriber קיים ללא phone_number יקבל אותו בפעם הראשונה שליד מקושר אליו
4. **אין שבירה**: הקוד הקיים ממשיך לעבוד כרגיל

