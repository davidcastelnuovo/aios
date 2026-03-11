

# תוכנית: תיקון שגיאת Build + חילוץ שדות לידים מטפסים בעברית

## בעיות שנמצאו

### 1. שגיאת Build: `NodeJS.Timeout`
בקובץ `ChatMessageList.tsx` שורה 91 — `NodeJS.Timeout` לא מוכר בסביבת Vite. צריך להחליף ל-`ReturnType<typeof setTimeout>`.

### 2. שדות לידים ריקים בסנכרון Flow-based
הקוד בשורות 578-581 של `cron-sync-facebook-leads` מחפש שדות באנגלית בלבד:
```typescript
company_name: fieldData.full_name || fieldData.company || ...
phone: fieldData.phone_number || fieldData.phone || null
```
אבל טפסי פייסבוק בעברית מחזירים מפתחות בעברית (למשל `שם_מלא`, `מספר_טלפון`). לכן כל השדות יוצאים ריקים וה-`company_name` נופל ל-"ליד מפייסבוק".

**הפתרון**: להשתמש ב-`facebook_form_fields` מה-trigger config (שכולל את ה-`type` של כל שדה — `FULL_NAME`, `PHONE`, `EMAIL`) כדי למפות את הערכים נכון לפי סוג, במקום לפי שם המפתח.

### 3. ליד מטופס שגוי
הליד שנמשך אתמול (`925195690206033`) מגיע מטופס `860909982017655` ולא מטופס הפרומו `1952043998852618`. כנראה יש אוטומציה אחרת שמצביעה על הטופס הזה. זה לא באג, אבל שווה לבדוק.

## שינויים

### קובץ 1: `src/components/chat/ChatMessageList.tsx`
שורה 91: החלפת `NodeJS.Timeout` ב-`ReturnType<typeof setTimeout>`

### קובץ 2: `supabase/functions/cron-sync-facebook-leads/index.ts`
בסקשן Flow-based sync (שורות ~565-582), לאחר פירוק `fieldData`:
- לקרוא את `facebook_form_fields` מה-`triggerStep.configuration` (שכבר נשלף בשורה 493)
- למפות לפי `type`:
  - `FULL_NAME` → `contact_name` + `company_name`
  - `PHONE` → `phone`
  - `EMAIL` → `email`
  - `CUSTOM` → ישאר ב-`fb_` fields בלבד
- Fallback: אם אין `facebook_form_fields`, להשאיר את הלוגיקה הנוכחית

```typescript
// After fieldData parsing:
const formFields = (triggerStep?.configuration as any)?.facebook_form_fields || [];
let mappedName = null, mappedPhone = null, mappedEmail = null;

for (const ff of formFields) {
  const val = fieldData[ff.key] || fieldData[ff.label] || '';
  if (!val) continue;
  if (ff.type === 'FULL_NAME') mappedName = val;
  else if (ff.type === 'PHONE') mappedPhone = val;
  else if (ff.type === 'EMAIL') mappedEmail = val;
}

// Use mapped values with fallback to English keys
const leadRecord = {
  ...
  company_name: mappedName || fieldData.full_name || ... || 'ליד מפייסבוק',
  contact_name: mappedName || fieldData.full_name || ...,
  email: mappedEmail || fieldData.email || null,
  phone: mappedPhone || fieldData.phone_number || fieldData.phone || null,
};
```

### קבצים לעריכה:
1. `src/components/chat/ChatMessageList.tsx` — תיקון טייפ
2. `supabase/functions/cron-sync-facebook-leads/index.ts` — מיפוי שדות לפי type

