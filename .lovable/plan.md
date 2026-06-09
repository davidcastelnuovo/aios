## הבעיה

בדיאלוג "בדיקת אוטומציה עם לידים" יש פילטר תאריך + פילטר לפי `facebook_form_id` של הטריגר. הפילטר מחפש את ה-ID בתוך השדה `notes` של הליד:

```ts
if (facebookFormId) query = query.ilike("notes", `%${facebookFormId}%`);
```

אבל הסנכרון השוטף (`cron-sync-facebook-leads`) כותב ל-`notes` רק את **שם** הטופס, לא את ה-ID:

```
notes: `leadgen_id: ...\nFacebook Form: ${mapping.form_name || formId}\n...`
```

לכן כל הלידים של היום עבור הטופס "טופס כללי" (ID `991164743666967`) נראים בטבלת `leads` (יש 9 כאלה מהיום), אבל הדיאלוג מסנן אותם החוצה כי ה-ID לא מופיע בהערות — רק "Facebook Form: טופס כללי".

זו הסיבה ש"היום" מציג 0 לידים וגם הסנכרון הידני מהדיאלוג מחזיר synced:0 (הם כבר קיימים).

## הפתרון

### 1. `TestFlowWithLeadDialog.tsx` — להרחיב את הפילטר ל-form_id **או** form_name

לקרוא גם את `facebook_form_name` מ-`triggerConfig`, ולסנן את שאילתת הלידים באמצעות `.or()` שמכסה את שני המקרים (וגם פורמט legacy של "Form ID: <id>" שמופיע ב-`sync-facebook-leads`):

```ts
const facebookFormName = triggerConfig?.facebook_form_name || null;

if (facebookFormId || facebookFormName) {
  const orParts: string[] = [];
  if (facebookFormId) {
    orParts.push(`notes.ilike.%${facebookFormId}%`);
  }
  if (facebookFormName) {
    orParts.push(`notes.ilike.%Facebook Form: ${facebookFormName}%`);
  }
  query = query.or(orParts.join(","));
}
```

(להוסיף `facebookFormName` ל-`queryKey` כדי לרענן נכון.)

### 2. `cron-sync-facebook-leads/index.ts` — להוסיף `Form ID` ל-notes

לעדכן את שני המקומות שכותבים `notes` (שורות 169 ו-327) כך שיכללו גם את ה-ID במפורש, לזיהוי וודאי קדימה:

```
notes: `leadgen_id: ${leadgenId}\nFacebook Form: ${mapping.form_name || formId}\nForm ID: ${formId}\nCreated: ${...}`
```

זה לא משנה לידים ישנים (הם ימשיכו להיתפס דרך פילטר ה-form_name), אבל מבטיח התאמה מדויקת לכל ליד חדש.

### 3. אימות

לאחר הדיפלוי, לפתוח את הדיאלוג של האוטומציה הנוכחית (`3110642c-…`), לבחור "היום" — אמורים להופיע 9 הלידים של "טופס כללי" מהיום.

## הערות

- אין צורך לגעת במיגרציות / סכמה.
- אין שינוי בלוגיקת `trigger-automation` עצמה — רק בשכבת הבחירה של הלידים לטסט ובכתיבת ה-notes.
