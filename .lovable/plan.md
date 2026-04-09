

## תוכנית: שיפורי דשבורד CRM — ספירת סטטוסים, עריכה ידנית, ושינוי שמות

### הבעיות
1. **ספירת "לתשומת לב" שגויה** — לקוח עם flag "רגיש" מקבל ציון 80 (100-20) שנחשב "ירוק". צריך שהנוכחות של flags מסוימים (sensitive, complaint) תשפיע על הספירה בכרטיסי הסיכום גם אם הציון עצמו ירוק.
2. **אין אפשרות לעריכה ידנית** — הציון, הסטטוס וה-Flags ניתנים לעדכון רק דרך כרמן. צריך כפתור עריכה ישירה בטבלה.
3. **שם עמודה** — "תקשורת" צריך להיקרא "בדיקת דופק" ולהציג תאריך אחרון.

### פתרון

**1. תיקון ספירת סיכום — לוגיקה חדשה**

במקום לסמוך רק על `overallStatus` מהציון המספרי, הסיכום ייקח בחשבון גם flags:
- לקוח עם flag `sensitive` / `no_communication_30d` / `seo_stable` → נספר כ-"לתשומת לב" (צהוב) גם אם הציון ≥80
- לקוח עם flag `complaint` / `performance_sharp_drop` / `drop_no_action` → נספר כ-"דורש טיפול" (אדום) גם אם הציון ≥60

שינוי ב-`DMMDashboard.tsx` ו-`AgencyDashboardContent.tsx`: הוספת פונקציית `getEffectiveStatus()` שמחזירה את הסטטוס האפקטיבי (worst of score-status and flag-status).

**2. עריכה ידנית של ציון, סטטוס ו-Flags**

הוספת דיאלוג `ManualHealthEditDialog` שיאפשר:
- עריכת ציון (0-100) עם slider או input
- בחירת Flags ידנית (multi-select checkboxes)
- עדכון `communication_status` (תקין/רגיש/תלונה)
- שמירה ישירה לטבלת `clients` (שדות `health_score`, `overall_status`, `active_flags`, `mood_status`)

כפתור עריכה (עיפרון) בעמודת "פעולות" בכל שורה — גם ב-`DMMDashboard.tsx` וגם ב-`AgencyDashboardContent.tsx`.

**3. שינוי שם "תקשורת" → "בדיקת דופק"**

- שינוי כותרת העמודה בשני הקבצים
- שינוי tooltip מ-"עדכון תקשורת" ל-"בדיקת דופק"
- הצגת תאריך הבדיקה האחרונה (מ-`communication_logs`) עם תיאור "היום" / "לפני X ימים"

### קבצים שישתנו
1. `src/pages/DMMDashboard.tsx` — ספירת סיכום, שם עמודה, כפתור עריכה
2. `src/components/dynamic-tables/AgencyDashboardContent.tsx` — אותם שינויים
3. `src/components/clients/ManualHealthEditDialog.tsx` — **קובץ חדש** — דיאלוג עריכה ידנית
4. `src/lib/healthScore.ts` — הוספת פונקציית `getEffectiveStatus()` + הוספת `FLAG_SEVERITY` mapping

### שלבי ביצוע
1. הוספת `getEffectiveStatus()` ל-`healthScore.ts` — מיפוי flags לרמות חומרה
2. יצירת `ManualHealthEditDialog` — דיאלוג עם שדות ציון, flags, וסטטוס תקשורת
3. עדכון `DMMDashboard.tsx` — ספירת סיכום חדשה, שם עמודה, כפתור עריכה
4. עדכון `AgencyDashboardContent.tsx` — אותם שינויים

