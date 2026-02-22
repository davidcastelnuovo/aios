
# תיקון שגיאת ייבוא לידים מגוגל שיטס

## הבעיה
הפונקציה `mapSource` בקובץ `ImportLeadsWithMapping.tsx` מחזירה ערכים לא חוקיים עבור שדה ה-`source` (מקור הליד). 

לדוגמה, כשבגיליון יש ערך "facebook", הפונקציה מחזירה `"facebook"` -- אבל הערכים המותרים הם רק: `website`, `referral`, `social_media`, `paid_ads`, `cold_call`, `email_campaign`, `event`, `other`, `whatsapp`.

הערכים `"facebook"`, `"instagram"`, `"linkedin"` לא קיימים ב-enum וגורמים לשגיאה.

## הפתרון
עדכון הפונקציה `mapSource` כך שתמפה את הערכים לערכי enum חוקיים:

- `facebook` / `פייסבוק` --> `paid_ads`
- `instagram` / `אינסטגרם` --> `social_media`
- `linkedin` / `לינקדאין` --> `social_media`
- הוספת מיפויים נוספים חסרים: `google` --> `paid_ads`, `אימייל` --> `email_campaign`, `אירוע` --> `event`

## פרטים טכניים

### קובץ: `src/components/forms/ImportLeadsWithMapping.tsx`
עדכון הפונקציה `mapSource` (שורות 566-574):

```typescript
const mapSource = (val: string) => {
  const v = val.toLowerCase().replace(/[\s_\-]/g, '');
  if (v.includes("אתר") || v.includes("website")) return "website";
  if (v.includes("שיחה") || v.includes("טלפון") || v.includes("coldcall")) return "cold_call";
  if (v.includes("המלצה") || v.includes("referral") || v.includes("הפניה")) return "referral";
  if (v.includes("facebook") || v.includes("פייסבוק") || v.includes("google") || v.includes("גוגל") || v.includes("paidads") || v.includes("ppc")) return "paid_ads";
  if (v.includes("instagram") || v.includes("אינסטגרם") || v.includes("linkedin") || v.includes("לינקדאין") || v.includes("socialmedia") || v.includes("רשתותחברתיות") || v.includes("tiktok") || v.includes("טיקטוק")) return "social_media";
  if (v.includes("אימייל") || v.includes("email") || v.includes("מייל") || v.includes("newsletter")) return "email_campaign";
  if (v.includes("אירוע") || v.includes("event") || v.includes("כנס") || v.includes("תערוכה")) return "event";
  if (v.includes("whatsapp") || v.includes("ווטסאפ") || v.includes("וואטסאפ")) return "whatsapp";
  return "other";
};
```

שינוי קובץ אחד בלבד, ללא שינויי מסד נתונים.
