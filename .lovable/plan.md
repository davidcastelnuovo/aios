## הבעיה

בטאב "ביטויים במעקב" יש שורות כפולות (אותו ביטוי חוזר 5-6 פעמים). זה נובע מ-Ahrefs Rank Tracker שמחזיר את אותו ביטוי פעם נפרדת לכל שילוב של מדינה / מיקום / שפה / מכשיר (desktop+mobile), והדדופ הנוכחי ב-`fetch-ahrefs-snapshot` משתמש במפתח `keyword|country|location|language` — כך שכל וריאציה נשמרת כשורה נפרדת.

## הפתרון

דדופ לפי שם הביטוי בלבד (case-insensitive, trimmed) בצד ה-UI, כך שלא צריך לסנכרן מחדש.

### שינוי בקובץ `src/components/dynamic-tables/seo/SeoKeywordsTable.tsx`

ב-`trackedFiltered` (וגם ב-merge של `mergedKeywords`):
1. לקבץ לפי `keyword.toLowerCase().trim()`.
2. מכל קבוצה לבחור שורה אחת "טובה ביותר":
   - position הנמוך ביותר (לא null) ראשון
   - tie-break: traffic הגבוה ביותר, אחר כך volume
3. למזג מהשורות האחרות שדות חסרים (position_prev_month, position_3month, position_yearly, gsc_clicks/impressions/ctr, url, volume, kd, cpc) אם הם null בשורה הנבחרת — כך לא מאבדים נתונים שהיו רק בווריאציה אחרת.
4. להחיל את אותו דדופ גם על `top10`, `by3MonthChange`, `byYearlyChange`, `byMonthlyChange` ו-`allKeywords` כדי שכל הטאבים יהיו עקביים.
5. ה-badge "🎯 X במעקב" יציג את הספירה אחרי הדדופ (במקום `trackedKeywords.length`).

זה שינוי frontend בלבד — אין צורך בסנכרון מחדש או בקריאות API נוספות. שום נתון לא נמחק מהדאטהבייס; הדדופ הוא רק לתצוגה.

### לא נכלל בשינוי

- לא נוגעים ב-`fetch-ahrefs-snapshot` (הדאטה הגולמית נשארת מלאה כדי שנוכל למזג שדות).
- לא מוסיפים טוגל "הצג כפילויות" — לפי הבקשה פשוט מסתירים אותן.
