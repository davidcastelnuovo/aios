## תמיכה בבחירת מספר קבוצות עבור נעילת מקור של כרמן

כיום ב"קבוצה ספציפית בלבד" אפשר לבחור רק קבוצה אחת (`carmen_allowed_group_id`). נרחיב לרשימה של קבוצות, תוך תאימות לאחור.

### שינויי UI — `src/components/automations/StepConfigPanel.tsx`
- בענף `scopeMode === "specific_group"`:
  - להחליף את ה־`Select` היחיד ב־Multi-Select של קבוצות (Checkbox-list עם תיבת חיפוש מעל, מבוסס `Popover` + `Command` הקיימים בפרויקט; פולבק לרשימת Checkboxes פשוטה אם אין `Command`).
  - לקרוא/לכתוב למערך חדש `carmen_allowed_group_ids: string[]`.
  - בעת טעינה: אם המערך ריק אך קיים `carmen_allowed_group_id` ישן — להציג אותו כפריט נבחר (תאימות לאחור) ולעדכן למערך בשמירה הבאה.
  - להציג צ'יפים (Badges) עם שמות הקבוצות שנבחרו ואפשרות הסרה.
  - תווית הקטע תשתנה ל"בחר קבוצות" והודעת האישור: "✅ הסוכן יגיב ל-N קבוצות".
- שינוי הטקסט באופציית הסלקט: "קבוצה ספציפית בלבד" → "קבוצות ספציפיות בלבד" (הערך `specific_group` נשאר).

### שינויי Backend (אכיפת scope)
- `supabase/functions/trigger-automation/index.ts` (סביבות 268–276):
  - לקרוא `allowedGroupIds = safeConfig.carmen_allowed_group_ids || (safeConfig.carmen_allowed_group_id ? [safeConfig.carmen_allowed_group_id] : [])`.
  - לחסום אם הרשימה ריקה; אחרת לאשר רק אם `safeData.group_id` נמצא ברשימה.
- `supabase/functions/_shared/carmen.ts` (סביב שורה 302): נשאר חוסם בענף `specific_group` עבור הזרימה של הודעות יוצאות (כפי שהיום) — לא נדרש שינוי לוגי שם.

### תאימות לאחור
- אוטומציות קיימות עם `carmen_allowed_group_id` ימשיכו לעבוד (ה־backend וה־UI מתייחסים אליו כפריט יחיד במערך).
- בשמירה ב־UI נכתוב מעתה רק `carmen_allowed_group_ids`; לא נמחק את השדה הישן כדי לא לפגוע ב־rollback.

### קבצים שיתעדכנו
- `src/components/automations/StepConfigPanel.tsx`
- `supabase/functions/trigger-automation/index.ts`

### לא בתחום השינוי
- אין שינויי DB/מיגרציות (השדות חיים בתוך `configuration JSONB`).
- אין שינוי באפשרויות `specific_phone` / `private_only`.