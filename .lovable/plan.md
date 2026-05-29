## הבעיה האמיתית

באמת יש שתי אוטומציות נפרדות וזה עבד עד שמשהו שבר את האוטומציה של הקבוצות. מצאתי את הבאג:

**`supabase/functions/_shared/carmen.ts` שורה 743:**
```ts
const allowedGroups = carmenAutomation.configuration?.carmen_allowed_groups || [];
```

זה מפתח שגוי. ה-UI (ב-`StepConfigPanel.tsx`) ו-`trigger-automation` שומרים/קוראים תחת `carmen_allowed_group_ids` (עם `_ids`). לכן `allowedGroups` תמיד חוזר ריק, ה-check בשורה 757 (`!allowedGroups.includes(chatId)`) תמיד נכשל, וכל הודעה בקבוצה נחסמת עם `scope_group`.

בנוסף שורה 757 משווה רק ל-`chatId` המלא (פורמט `GROUPID@g.us`), בעוד שב-UI נשמרים לפעמים רק ה-IDs המספריים, אז צריך לאפשר שני הפורמטים (כמו ב-`trigger-automation`).

## תיקון

ב-`supabase/functions/_shared/carmen.ts`:

1. החלפת `carmen_allowed_groups` ב-`carmen_allowed_group_ids` (עם נפילה ל-`carmen_allowed_group_id` היחיד, בדיוק כמו ב-`trigger-automation`).
2. הרחבת הבדיקה כך שתשווה גם מול `chatId` המלא וגם מול ה-ID המספרי (`chatId.split('@')[0]`).

## ביטול השינוי הקודם

השינוי שעשיתי קודם ב-`green-api-webhook` (שינוי `sender_phone` למשתתף בפועל בקבוצות) כבר לא דרוש לפתרון הבאג הזה, אבל הוא לא מזיק — להפך, הוא נכון לכשעצמו. ארצה לאשר אם להשאיר אותו או לשחזר.

## עדכון memory

עדכון `mem://features/automations/carmen-trigger-keyword-enforcement` (או יצירת זיכרון חדש) שמתעד את שם המפתח הקנוני `carmen_allowed_group_ids` כדי שלא נדרוס אותו שוב בעתיד.

## טאסקים
- ערוך `supabase/functions/_shared/carmen.ts` (שורות 743 + 757)
- פרוס מחדש את `green-api-webhook` (משתמש ב-shared helper)
- עדכן memory