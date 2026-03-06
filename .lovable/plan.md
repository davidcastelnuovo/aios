

## תיקון הרצה כפולה + אופטימיזציית ביצועים בסנכרון Google Ads

### בעיות שזוהו

**1. הרצה כפולה ב-Make.com**
כשלוחצים "סנכרן Google Ads", המערכת:
- קוראת `patch_scenario_blueprint` (עדכון תאריכים)
- קוראת `run_scenario` (הרצה)

אבל יש גם mutation נפרד של "תקן סנריו" (`patchBlueprintMutation`) שב-`onSuccess` שלו מפעיל שוב את `syncMakeGoogleAdsMutation` — מה שגורם ל-patch+run **פעם שנייה**. זה מסביר את שתי ההרצות בצילום המסך.

**2. כמות Operations גבוהה ב-Make**
הסנריו ב-Make שולח כל רשומה (campaign+date) בנפרד כ-webhook call. בצד שלנו, ב-`webhook-google-ads-sync`, לכל רשומה המערכת עושה `SELECT * FROM crm_records WHERE table_id = X` (בלי סינון!) כדי לחפש כפילויות — שליפה כבדה מאוד שחוזרת על עצמה פר-רשומה.

**3. שליפה כדוח אגרגטיבי**
כרגע הסנריו שולף נתונים פר-קמפיין-פר-יום. ניתן לשנות את ה-blueprint כך שישלוף נתונים מצומצמים יותר.

### פתרון מוצע

#### שינוי 1: הסרת הרצה כפולה
**קובץ: `src/pages/DynamicTableView.tsx`**
- הסרת `setTimeout(() => syncMakeGoogleAdsMutation.mutate())` מה-`onSuccess` של `patchBlueprintMutation`
- כפתור "תקן סנריו" יעשה רק patch, בלי להריץ אוטומטית

#### שינוי 2: אופטימיזציית webhook — batch upsert
**קובץ: `supabase/functions/webhook-google-ads-sync/index.ts`**
- במקום `SELECT *` לכל רשומה, לשלוף פעם אחת את כל הרשומות הקיימות ולבנות map בזיכרון
- להשתמש ב-batch insert/update במקום אחד-אחד
- זה יוריד את כמות ה-DB queries מ-N×2 ל-3 (select + batch insert + batch update)

#### שינוי 3 (אופציונלי): הגבלת טווח שליפה
- כרגע אם יש 100 קמפיינים × 30 ימים = 3,000 רשומות = 3,000 webhook calls מ-Make
- ניתן להוסיף אפשרות למשוך "סיכום שבועי" או "סיכום חודשי" כדי להפחית operations

### קבצים לעריכה
1. `src/pages/DynamicTableView.tsx` — הסרת trigger כפול
2. `supabase/functions/webhook-google-ads-sync/index.ts` — אופטימיזציית batch

### סיכום
התיקון העיקרי הוא מניעת הרצה כפולה (שתי הרצות = כפול operations ב-Make) + אופטימיזציה של הצד שלנו כך שלא ישלוף את כל הטבלה לכל רשומה.

