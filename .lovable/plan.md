

# תיקון לופ אינסופי באוטומציות WhatsApp

## הבעיה
כשהאוטומציה שולחת הודעה לקבוצה דרך Green API, ההודעה חוזרת כ-webhook מסוג `outgoingAPIMessageReceived` → זה מפעיל את האוטומציה שוב → שולח שוב → לופ אינסופי.

## שורש הבעיה
בקוד של `green-api-webhook/index.ts`, הטריגר לאוטומציות מופעל גם על `isIncoming` וגם על `isOutgoing`, כש-`isOutgoing` כולל גם `outgoingAPIMessageReceived` (הודעות שנשלחו דרך API, כולל אוטומציות).

שני מקומות בקוד (שורות 1067 ו-1393):
```
if (isIncoming || isOutgoing) {  // ← כאן הבעיה - isOutgoing כולל גם API
    // trigger automations...
}
```

## הפתרון
שינוי ב-`green-api-webhook/index.ts` בלבד:

1. **הוספת משתנה חדש** `isManualOutgoing` שמבדיל בין הודעות יוצאות ידניות (`outgoingMessageReceived`) לבין הודעות שנשלחו דרך API (`outgoingAPIMessageReceived`)
2. **שינוי תנאי ההפעלה של אוטומציות** מ-`isIncoming || isOutgoing` ל-`isIncoming || isManualOutgoing` בשני המקומות (קבוצות ופרטי)

```text
לפני:
  isOutgoing = outgoingMessageReceived || outgoingAPIMessageReceived
  trigger if: isIncoming || isOutgoing  ← לופ!

אחרי:
  isManualOutgoing = outgoingMessageReceived (בלבד, ללא API)
  trigger if: isIncoming || isManualOutgoing  ← בטוח!
```

הודעות שנשלחות דרך API (כולל אוטומציות) עדיין יישמרו בדאטאבייס כרגיל, רק לא יפעילו אוטומציות נוספות.

## קבצים לשינוי
- `supabase/functions/green-api-webhook/index.ts` — שורה ~314 (הגדרת המשתנה), שורות ~1067 ו-~1393 (תנאי טריגר)

