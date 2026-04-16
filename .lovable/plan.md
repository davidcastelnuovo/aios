

## אבחון

### בדיקה ראשונה — נתונים ב-DB

**ארבע על ארבע** (table `da0a8fb0`):
- 31 ימים בטבלה (3/11→4/10), אבל **הסנכרון האחרון היה לפני 6 ימים (10/04 13:10)**.
- "7 ימים אחרונים" בדשבורד מחשב על הנתונים שיש → רק יום אחד נכנס לחלון (10/04 = 67.55₪) וזה גורם להצגת "67₪".
- אין סנכרון יומי אוטומטי לטבלאות ה-ecommerce.

**לידר** (table `bbbb71c3`) — נתוני 16/04 (היום):
| קמפיין | spend | purchases | value |
|---|---|---|---|
| השקה קולקציה חדשה 29.03 | 580.95 | 39 | 25,716 |
| רכישות קטגוריית סייל | 249.02 | 33 | 14,703 |
| הרשמות פופאפ 13.4 | 88.5 | 0 | 0 |
| מעורבות וידאו אינסטגרם | 33.45 | 0 | 0 |

המספרים עדיין לא תואמים את ה-UI של פייסבוק (שמראה לדבריך פחות).

### זיהוי שורש הבעיה — מה אנחנו ספרנו לא נכון

הקוד הנוכחי בוחר action בעדיפות:
```
1. offsite_conversion.fb_pixel_purchase
2. omni_purchase
3. purchase
```

**הבעיה המרכזית**: `offsite_conversion.fb_pixel_purchase` סופר **כל אירוע פיקסל** מכל מקור (גם מסחר אורגני, גם ייחוס דרך מודעה אחרת ב-7d_view, גם מ-Cross-Device). ה-UI של פייסבוק מציג רק את "Purchases ייוחסו למודעה" שהם בדרך-כלל `omni_purchase` או `purchase` (Aggregated, deduplicated cross-platform).

בנוסף — `use_unified_attribution_setting=true` שהוספתי בשלב הקודם מחזיר את החלון של **ה-ad account** (לעיתים 7d_click+1d_view), בעוד שב-Ads Manager המשתמש בוחר "Default" שהוא לרוב 7d_click בלבד או אפילו 1d_click. אז המספרים גבוהים.

**נכון יותר** (תואם UI):
- להשתמש ב-`omni_purchase` כברירת מחדל (זה ה-deduplicated event שפייסבוק עצמה מציגה).
- להוסיף `action_attribution_windows=['7d_click']` במקום unified (תואם default UI ברוב החשבונות).

### Issue 2 — אינטגרציה עם Meta Ads דרך Unified.to

יש בפרויקט אינטגרציה ל-`meta_ads_unified` (Unified.to). כרגע `sync-facebook-ecommerce` משתמש רק ב-`facebook_lead_ads` token ישיר. לא נשתמש ב-Unified.to לצורך השוואה כי הוא לא מספק את אותם action breakdowns של ecommerce.

**במקום זאת — נוסיף כלי דיבאג**: כפתור "השווה ל-Facebook" שמריץ סנכרון בדיקה ומציג JSON גולמי של `actions` ו-`action_values` שפייסבוק מחזיר, כדי שתוכל להשוות ידנית מול UI ולוודא איזה action_type מתאים.

---

## תוכנית

### Fix 1: תיקון בחירת ה-action type ב-`sync-facebook-ecommerce`
בקובץ `supabase/functions/sync-facebook-ecommerce/index.ts`:
- שינוי סדר עדיפות ל: `omni_purchase` → `purchase` → `offsite_conversion.fb_pixel_purchase` (omni הוא ה-canonical deduplicated של פייסבוק).
- אותו דבר ל-`add_to_cart` ו-`initiate_checkout`.
- הסרת `use_unified_attribution_setting=true`. במקום זאת — שימוש ב-`action_attribution_windows=["7d_click"]` (default UI של רוב החשבונות).
- הוספת לוג מפורט שמדפיס את כל ה-action_types שפייסבוק מחזיר לקמפיין הראשון, כדי שנוכל להשוות.

### Fix 2: סנכרון יומי אוטומטי לכל טבלאות ה-ecommerce
- יצירת `cron-sync-facebook-ecommerce` (Edge Function חדש) שרץ פעם ביום (cron pg_cron).
- עובר על כל טבלאות `crm_tables` עם `integration_type='facebook_ecommerce'` ומפעיל לכל אחת `sync-facebook-ecommerce`.
- מתקין pg_cron schedule (`0 5 * * *` כל יום ב-05:00).

### Fix 3: כפתור דיבאג "השווה לפייסבוק"
- ב-`FacebookEcommerceTableDialog.tsx` — כפתור חדש "Debug Raw Data" שקורא ל-edge function חדש `debug-facebook-ecommerce` שמחזיר את ה-JSON הגולמי של 3 הקמפיינים האחרונים (כולל כל ה-action_types ללא דדופ).
- הצגת modal עם הנתונים הגולמיים, כדי שתוכל ידנית להשוות לפייסבוק UI ולומר לי איזה action_type מתאים בדיוק.

### Fix 4: סנכרון מיידי של 2 הטבלאות לאחר התיקון
- קריאה ידנית ל-`sync-facebook-ecommerce` לטבלת לידר ולטבלת ארבע-על-ארבע, כדי שהנתונים יתעדכנו עם הלוגיקה המתוקנת.

---

## שאלת הבהרה

לפני שאני מבצע — בצילום מסך של פייסבוק שאתה רואה בלידר היום (16/04), מה ה-Attribution Setting שמופיע למעלה? (לרוב כתוב "7-day click" או "7-day click, 1-day view" או "Default"). זה ישפיע ישירות על הבחירה ב-Fix 1.

אם אתה לא בטוח — נצא מנקודת הנחה של `7d_click` (הברירת מחדל הנפוצה ב-2024+) ונבדוק. אם המספרים עדיין לא יתאימו, נשתמש ב-Fix 3 (debug raw) כדי לזהות בדיוק.

---

## קבצים שישתנו
- `supabase/functions/sync-facebook-ecommerce/index.ts` — Fix 1
- `supabase/functions/cron-sync-facebook-ecommerce/index.ts` — חדש (Fix 2)
- `supabase/functions/debug-facebook-ecommerce/index.ts` — חדש (Fix 3)
- `src/components/dynamic-tables/FacebookEcommerceTableDialog.tsx` — כפתור דיבאג (Fix 3)
- Migration SQL — pg_cron schedule (Fix 2)

