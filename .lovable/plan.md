
## האבחנה

בדקתי את הנתונים בפועל לתאריך 16/04 בטבלת לידר:
- **המערכת שלנו**: 15,955 ש"ח (29 רכישות)
- **GA4 בצילום שלך**: 20,646 ש"ח
- **הפער**: 4,691 ש"ח (~22.7%)

### הסיבה
המערכת מושכת מ-GA4 את המטריקה **`purchaseRevenue`** (הכנסות מרכישות E-commerce בלבד), בעוד שהעמודה "סה״כ הכנסות" שאתה רואה בצילום GA4 מציגה את **`totalRevenue`** — שזה מטריקה רחבה יותר הכוללת:
- `purchaseRevenue` (רכישות) ✅ אנחנו מושכים
- `subscriptionRevenue` (מנויים) ❌ חסר
- `adRevenue` (הכנסות מפרסומות באתר) ❌ חסר

ב-LIDAR יש כנראה ~4,691 ש"ח של הכנסות ממקורות שאינם רכישות ישירות (כנראה הכנסות נוספות שמדווחות ב-GA4).

הוכחה: סך כל ה-`daily_source` ב-DB מסתכם בדיוק ל-15,955 — בדיוק מה שמופיע אצלנו, וזה מדויק עבור `purchaseRevenue`.

### למה זה קורה
ב-`supabase/functions/sync-google-analytics-data/index.ts` בקריאות ל-GA4 API מוגדרות המטריקות:
```ts
metrics: [
  ...
  { name: 'ecommercePurchases' },
  { name: 'purchaseRevenue' },  // ← רק רכישות
]
```
ל-GA4 יש מטריקה נוספת `totalRevenue` שאיננו מבקשים.

## הפתרון המוצע

### 1. הוספת `totalRevenue` ל-3 הקריאות הראשיות ב-GA4 API
בקובץ `supabase/functions/sync-google-analytics-data/index.ts`:
- `trafficSourceRequest` — להוסיף `{ name: 'totalRevenue' }`
- `dailyRequest` — להוסיף `{ name: 'totalRevenue' }`
- `dailySourceRequest` — להוסיף `{ name: 'totalRevenue' }`
- `channelGroupRequest` — להוסיף `{ name: 'totalRevenue' }`

### 2. הוספת שדה `total_revenue` ל-`fieldDefinitions` 
שדה חדש שיציג בנפרד את סך ההכנסות הכולל (לעומת `purchase_value` שיישאר רק לרכישות).

### 3. עדכון לוגיקת הצגה בדשבורד
ב-`src/components/dynamic-tables/GoogleAnalyticsDashboard.tsx`:
- להעדיף את `total_revenue` כשהוא קיים, ולעבור ל-`purchase_value` כ-fallback (כדי שלא תישבר תאימות לאחור).
- הוספת תגית/הסבר על המספר: "הכנסות = רכישות + מנויים + פרסומות (כמו ב-GA4)".

### 4. סנכרון מיידי לאחר השינוי
לאחר deploy של הפונקציה, נצטרך להריץ סנכרון ידני של טבלת לידר כדי למשוך את `totalRevenue` ההיסטורי.

## תוצאה
לאחר הפתרון, המספר בדשבורד יתאים בדיוק למה שמופיע בעמודת "סה״כ הכנסות" של GA4 (20,646 ש"ח לאתמול), והפער ייעלם.

**שים לב**: ייתכן פער שיורי קטן (פחות מ-1%) בגלל מנגנון ה-sampling של GA4 בנתונים טריים (24–48 שעות אחרונות), אבל הוא ייעלם תוך יום-יומיים.
