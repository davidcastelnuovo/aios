
## הבעיה

בדוח SEO של eco.co.il (וגם בכל שאר הלקוחות שבדקתי בבסיס הנתונים) ה-`snapshot` של Ahrefs שמור עם **רק שני שדות**:

```json
{ "org_traffic": 6627, "org_keywords_total": 478 }
```

הקומפוננטה `SeoSnapshotCards` מציגה עד 8 קוביות, אבל מסננת כל מטריקה שערכה `undefined`. לכן מוצגות רק **תנועה אורגנית** ו-**סה״כ מילות מפתח**.

הקוביות החסרות שצריכות להופיע:
- 🏆 דירוג דומיין (DR)
- 🥇 מילות מפתח (Top 3)
- 🔟 מילות מפתח (Top 10)
- 🔗 דומיינים מפנים (referring domains)
- 🌐 קישורים נכנסים פעילים (backlinks live)
- 📊 קישורים נכנסים כולל (backlinks all time)

## שורש הבעיה ב-`supabase/functions/fetch-ahrefs-snapshot/index.ts`

1. הקריאה ל-`/v3/site-explorer/metrics` נשלחת **בלי פרמטר `select=`**. בלעדיו, ה-API של Ahrefs מחזיר רק `org_traffic` ו-`org_keywords` (זה מה שמוסבר על ידי הנתונים השמורים). זו הסיבה שכל שאר השדות (`domain_rating`, `backlinks`, `refdomains`) חוזרים `undefined` ולכן לא נשמרים ב-snapshot.
2. השדות `org_keywords_top3`, `org_keywords_top10`, ו-`backlinks_all_time` **בכלל לא נבנים** בקוד — ה-snapshot שנכתב כולל רק 5 שדות (`dr`, `org_traffic`, `org_keywords_total`, `backlinks_live`, `referring_domains`).

## תיקון מוצע

**קובץ:** `supabase/functions/fetch-ahrefs-snapshot/index.ts`

1. להוסיף `&select=domain_rating,org_traffic,org_keywords,backlinks,refdomains` לכל קריאה ל-`/site-explorer/metrics` (הן ה-overview הנוכחי והן ההשוואות ההיסטוריות 3m/12m).
2. להוסיף קריאה אחת ל-`/v3/site-explorer/backlinks-stats` (או להישאר עם metrics) כדי להביא `backlinks_all_time` (`backlinks` היסטוריים), אם זמין בתוכנית — אחרת להשאיר את השדה ריק (זה ינטרל את הקוביה הזו בלבד).
3. לחשב **Top 3 / Top 10** מתוך רשימת ה-`organic-keywords` שכבר נשלפת (יש שם שדה `position`):

   ```ts
   const top3  = keywords.filter(k => k.position >= 1 && k.position <= 3 ).length;
   const top10 = keywords.filter(k => k.position >= 1 && k.position <= 10).length;
   ```

   ולשמור ל-`snapshot` כ-`org_keywords_top3` / `org_keywords_top10`.
   
   הערה: ה-API שולף `limit=500` מילות מפתח, כך שהמספרים יהיו מדויקים עד 500 בכל שכבה — מספיק לרוב הדומיינים. אם נדרש דיוק מלא, נוסיף קריאה נפרדת עם `position_to=10`.

4. להעדכן את ה-snapshot שנכתב להכיל גם את שלושת השדות החדשים (`org_keywords_top3`, `org_keywords_top10`, ו-`backlinks_all_time` אם נשלף).
5. אותו טיפול ב-`fetchHistoricalMetrics` כדי שההשוואות לחודש קודם/קמפיין יציגו גם הן את כל הקוביות.

**שום שינוי בקומפוננטות UI** — הן כבר תומכות בכל 8 הקוביות; ברגע שהשדות יגיעו ל-`snapshot` הן יוצגו אוטומטית.

## אחרי הפריסה

- לרוץ ידנית "סנכרן מדוחות SEO" על eco.co.il (ועל כל לקוח אחר שבו רואים את אותה בעיה) — הסנכרון יעדכן את `ahrefs_reports.report_data` ויוסיף את שאר הקוביות לדשבורד.

## למה הסקרין מציג את eco ולא את eko

מצאתי בבסיס הנתונים רק דומיין אחד שמתאים (`eco.co.il`) ולא קיים `eko`. נראה שזו אותה ישות שאתה קורא לה "eko" בדיבור. אם בכל זאת התכוונת ללקוח אחר עם דומיין שונה — תגיד לי איזה ואני אבדוק נקודתית, אבל התיקון לעיל פותר את הבעיה לכל הלקוחות בבת אחת.
