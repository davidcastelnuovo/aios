
# למה ה-Kanban "טוען מחדש" אחרי כל גרירה

## האבחנה

בקובץ `src/pages/Leads.tsx` יש כמה באגים שגורמים לרושם של "טעינה מחדש" של הדף בכל גרירת כרטיסיה, למרות שאין ממש `window.location.reload()` בנקודת הגרירה (זה קיים רק במחיקת ליד, שורה 234).

הסיבה האמיתית היא שילוב של 3 בעיות:

### 1. אי התאמה במפתח של ה-Query (Query Key Mismatch) — הסיבה העיקרית
- ה-Query של ה-Kanban (שורה 860) מוגדר עם המפתח:
  ```
  ["leads-kanban", tenantId, ..., PIPELINE_STAGES.map(s => s.id).join(','), isViewingAs, viewAsSalesPersonId]
  ```
- אבל ה-`onMutate` של עדכון הסטטוס (שורות 1407–1421) בונה `kanbanQueryKey` בלי `PIPELINE_STAGES.map(...).join(',')`.
- התוצאה: `queryClient.cancelQueries` ו-`queryClient.setQueryData` עובדים על מפתח **לא קיים**, ולכן:
  - העדכון האופטימי לא נכנס ל-cache בכלל.
  - הביטול של refetch לא חל על ה-Query האמיתי.
- מיד אחרי, `onSettled` (שורות 1559–1564) קורא ל-`invalidateQueries(["leads-kanban"])` — זה כן תופס את המפתח ה"אמיתי" (התאמה חלקית), ומפעיל refetch מלא מה-RPC `get_leads_by_stages` + שאילתת `agencies/sales_people` נוספת.

### 2. useEffect שגורם לרענון נוסף בכל refetch
- ה-`useEffect` בשורות 962–1010 מאזין ל-`kanbanStageData` ובכל פעם שהוא משתנה רץ שוב לשרת (`refreshAccumulatedLeads`) ועושה עוד שאילתה ל-`leads` עבור כל ה-IDs המצטברים.
- בגלל באג מס' 1, ה-refetch הכללי מתרחש בכל גרירה, וה-effect הזה מוסיף סיבוב נוסף של בקשות שמרצדות את ה-UI.

### 3. דריסה לאחור של מצב אופטימי (Optimistic flicker)
- מאחר שה-cache לא עודכן (באג 1), הליד "קופץ חזרה" למיקום המקורי לרגע, ואז ה-state האופטימי `optimisticStatusByLeadId` מזיז אותו שוב — וזה נראה כמו "ריענון" של הטור/דף.
- בנוסף, `onSuccess` (שורה 1548) מנקה את `optimisticStatusByLeadId` *לפני* שה-refetch ב-`onSettled` סיים — מה שיוצר רגע שבו אין אופטימי וגם אין נתון מעודכן בקאש.

> הערה: ההודעה "טוען..." (שורה 2161–2163) **לא** אמורה להופיע פה כי `placeholderData: previousData` שומר את הנתון הקודם. אבל ה-flicker שנגרם מהבאגים לעיל נראה למשתמש כטעינה מלאה.

---

## התיקון המוצע

### א. ליישר את `kanbanQueryKey` בתוך `onMutate` עם המפתח האמיתי של ה-Query
ב-`updateLeadStatus.onMutate` (שורות 1407–1421) להוסיף לסוף המערך:
```
PIPELINE_STAGES.map(s => s.id).join(','),
```
לפני `isViewingAs, viewAsSalesPersonId`, כך שיתאים בדיוק למפתח של ה-`useQuery` בשורה 860.

לעשות את אותו תיקון גם ב-`updateLeadResponseStatus` (סביב שורה 1604–1612) ובכל מוטציה אחרת שמבצעת `setQueryData`/`cancelQueries` על `leads-kanban`.

### ב. להפסיק לעשות `invalidateQueries` ב-`onSettled` של גרירה
מאחר שהעדכון האופטימי כבר משקף את המצב הסופי, אין שום סיבה לרוץ refetch מלא לכל הסטייג'ים בכל גרירה. להחליף את `onSettled` (1559–1564) באחד מהשניים:
- אופציה מועדפת: למחוק את `invalidateQueries` לגמרי. ה-mutationFn כבר עושה `update` ב-DB, וה-cache עודכן אופטימית.
- אופציה זהירה יותר: לקרוא ל-`invalidate` רק במקרה של שגיאה (זה כבר קיים ב-`onError`), ולהשאיר את ה-`onSettled` ריק.

### ג. למנוע רענון מיותר ב-useEffect של accumulatedLeads
ה-`useEffect` בשורות 962–1010 רץ בכל פעם ש-`kanbanStageData` משתנה. אחרי תיקון א'+ב', הוא ירוץ הרבה פחות. בנוסף:
- להזיז את ה-effect כך שירוץ רק כש-`accumulatedLeads` שונה מהותית (לא בכל refetch).
- לחלופין: להסיר את ה-effect הזה ולסמוך על העדכון האופטימי שכבר מטפל ב-status/follow_up_date דרך המוטציות.

### ד. לנקות `optimisticStatusByLeadId` רק ב-`onSettled` (אחרי שה-cache סונכרן)
להעביר את הניקוי של `optimisticStatusByLeadId` מ-`onSuccess` (1548–1554) אל `onSettled`, כדי למנוע רגע ביניים שבו הליד "קופץ" למקום הישן.

### ה. (בונוס) לוודא שאין `window.location.reload()` נוסף שמופעל מאיזה effect
לאחר התיקון, אם הבעיה ממשיכה — לבדוק את `src/components/layout/AppLayout.tsx` (שורות 94, 144) ואת `src/main.tsx` (שורות 23, 40). אלו reloads שיכולים להיות מופעלים בעקבות שגיאות רשת/חבילה במהלך הבקשות הכפולות.

---

## תוצאה צפויה

- גרירת ליד בין סטייג'ים תעדכן את העמודות **מיידית** ללא flicker.
- לא תהיה בקשת רשת מיותרת ל-`get_leads_by_stages` בכל גרירה — רק ה-`UPDATE` הבודד של הליד.
- לא תהיה תחושה של "טעינה מחדש של הדף".

## קבצים שיתעדכנו
- `src/pages/Leads.tsx` — תיקוני סעיפים א, ב, ג, ד.
