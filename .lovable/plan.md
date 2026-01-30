

## תוכנית תיקון - אימות והתאמת ManyChat ID לפי שדה מותאם אישית

### הבעיה המזוהה
המערכת מוצאת subscriber לפי phone_number בשדה מותאם אישית, אבל:
1. לא משווה את ה-ID שנמצא לזה שכבר שמור בליד
2. אם ה-ID השמור שונה מזה שנמצא בחיפוש → לא מתקנת אותו
3. לכן האוטומציות רצות על ID ישן/לא נכון

### הפתרון
**לוגיקת "אמת אחת" - שדה phone_number במניצ'ט הוא מקור האמת**

1. **תמיד לחפש לפי phone_number** (שדה מותאם אישית)
2. **להשוות** את ה-ID שנמצא ל-ID השמור
3. **אם שונים → לעדכן** את ה-ID בליד/לקוח לפני שליחת הפקודה
4. **רק אז** לשלוח את הטאג ל-subscriber הנכון

### שינויים טכניים

**קובץ:** `supabase/functions/trigger-automation/index.ts`

**לפני (לוגיקה נוכחית):**
```
1. קורא ID משמור → בודק אם תקין (WA) → משתמש בו
2. אם לא תקין → מחפש מחדש → שומר ומשתמש
```

**אחרי (לוגיקה חדשה):**
```
1. תמיד מחפש לפי Custom Field (phone_number) → מקבל "ID אמיתי"
2. משווה ל-ID השמור
3. אם שונים → לוג + עדכון ה-ID בבסיס הנתונים
4. משתמש ב-ID שנמצא בחיפוש (לא בשמור!)
5. אז שולח את הטאג
```

### שינויי קוד

#### 1. פונקציה חדשה: `verifyAndFixSubscriberId`

פונקציה שתבצע:
- חיפוש לפי phone_number (שדה מותאם אישית)
- השוואה ל-ID השמור
- תיקון אוטומטי אם יש אי-התאמה
- החזרת ה-ID הנכון

#### 2. שינוי זרימת `executeSendWhatsapp`

במקום:
```typescript
// קודם בודקים ID שמור → רק אחרי זה מחפשים
const savedId = lead?.manychat_subscriber_id
if (savedId && await validateSubscriberHasWhatsApp(savedId)) {
  subscriberId = savedId
}
// ... ואז חיפושים רק אם אין ID
```

לשנות ל:
```typescript
// תמיד מחפשים לפי טלפון ומשווים
const correctId = await verifyAndFixSubscriberId(
  contactPhone,
  contactRecord?.manychat_subscriber_id,
  contactType,
  contactRecord?.id
)
subscriberId = correctId
```

#### 3. לוגיקת הפונקציה החדשה

```typescript
async function verifyAndFixSubscriberId(
  phone: string,
  savedId: string | null,
  contactType: 'lead' | 'client',
  recordId: string
): Promise<string | null> {
  
  // שלב 1: חיפוש לפי Custom Field
  const fieldId = await getPhoneNumberFieldIdMC(apiKey, supabase, tenantId)
  const phoneCandidates = [...] // פורמטים שונים
  const foundId = await findSubscriberByCustomFieldMC(apiKey, fieldId, phoneCandidates)
  
  // שלב 2: אם לא נמצא בכלל → יצירה
  if (!foundId) {
    return await createNewSubscriber(...)
  }
  
  // שלב 3: השוואה לשמור
  if (savedId && savedId !== foundId) {
    console.log(`🔄 ID mismatch! Saved: ${savedId}, Found: ${foundId}. Fixing...`)
    
    // עדכון בבסיס הנתונים
    await supabase
      .from(contactType === 'lead' ? 'leads' : 'clients')
      .update({ manychat_subscriber_id: foundId })
      .eq('id', recordId)
    
    console.log(`✅ Fixed ${contactType} ${recordId}: ${savedId} → ${foundId}`)
  }
  
  // שלב 4: החזרת ה-ID הנכון
  return foundId
}
```

### תוצאה צפויה

| מצב | לפני | אחרי |
|-----|------|------|
| ID שמור נכון | ✅ עובד | ✅ עובד |
| ID שמור שונה מה-ID האמיתי | ❌ טייג רשומה שגויה | ✅ מתקן ומטייג את הנכון |
| אין ID שמור | ✅ מחפש ושומר | ✅ מחפש ושומר |
| לא נמצא במניצ'ט | יוצר חדש | יוצר חדש |

### סדר ביצוע

1. **עדכון** `trigger-automation/index.ts`:
   - הוספת הפונקציה `verifyAndFixSubscriberId`
   - שינוי זרימת `executeSendWhatsapp` להשתמש בה

2. **Deploy** הפונקציה

3. **בדיקה**: קביעת פגישה לליד → וידוא שהטאג מופיע במניצ'ט על המשתמש הנכון

