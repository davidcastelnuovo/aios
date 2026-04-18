

## הבעיה
בלשונית "ניתוח מילות מפתח" של דוח SEO, רק טאב **Top 10** מציג את ביטויי GSC. הטאבים **שינוי 3 חודשים / שנתי / חודשי** מציגים רק ביטויי Ahrefs כי:

1. הטאבים האלה מסננים שורות לפי `position_3month != null` / `position_yearly != null` / `position_prev_month != null`.
2. ביטויי GSC נטענים רק לטווח אחד (ברירת מחדל 28 ימים) ב-`gscOnlyKeywords`, וכל שדות ההשוואה ההיסטורית שלהם מקבלים `null`.
3. גם ביטויים שמופיעים גם ב-Ahrefs מקבלים השוואות רק כש-Ahrefs comparison sync רץ — GSC עצמו לא מספק היסטוריה לאף טאב.

הלוגיקה הקיימת ב-`SeoDashboardView` מעשירה כל ביטוי עם `gsc_clicks/impressions/ctr` של תקופה אחת בלבד (`gscData`), בלי השוואת מיקום בין תקופות.

## הפתרון
להוסיף השוואת מיקום היסטורית גם ל-GSC (לא רק Ahrefs), ולוודא שביטויי GSC-only מופיעים בכל הטאבים.

### 1. `fetch-gsc-data` (Edge Function) — בלי שינוי במבנה
ה-API כבר תומך ב-`startDate`/`endDate`. נשתמש בו כמו שהוא — נקרא לו פעמיים-שלוש מהפרונט במקביל.

### 2. `GscIntegration.tsx` — תמיכה במשיכת מספר תקופות
כשהקומפוננטה רצה ב-`hideTable` mode (בתוך SEO Dashboard), היא תמשוך **3 תקופות** במקביל:
- **נוכחי**: 28 ימים אחרונים
- **3 חודשים אחורה**: 28 ימים שמסתיימים לפני 90 יום
- **שנה אחורה**: 28 ימים שמסתיימים לפני 365 יום
- **חודש אחורה**: 28 ימים שמסתיימים לפני 30 יום

נחזיר אותן ל-callback חדש `onMultiPeriodLoaded({ current, prevMonth, threeMonth, yearly })` במקום `onDataLoaded` בלבד.

ה-`SearchConsoleDashboard` הנפרד והבורר הקיים שלו לא משתנים.

### 3. `SeoDashboardView.tsx` — מיזוג היסטוריה מ-GSC
- לאחסן `gscMultiPeriod` עם 4 מפות (current, prevMonth, threeMonth, yearly).
- בפונקציית `enrichKeyword`: כש-`position_prev_month` / `position_3month` / `position_yearly` עדיין `null` אחרי Ahrefs, למלא מתוך `gsc.position` של אותה תקופה (שם המקור ייוצג ב-`_position_source: 'gsc'` לתצוגה עתידית).
- ב-`gscOnlyKeywords`: למלא `position_prev_month / position_3month / position_yearly` מתוך המפות של GSC בכל תקופה (נופל ל-`null` אם הביטוי לא קיים שם).

### 4. `SeoKeywordsTable.tsx` — הצגה
הלוגיקה הקיימת תעבוד אוטומטית: ביטויי GSC עם `position_3month != null` (אחרי השלב הקודם) יעברו את הפילטר ויופיעו בטאב **שינוי 3 חודשים**. אותו דבר לשנתי/חודשי. ה-Badge `GSC` הקיים ימשיך לסמן אותם.

תוספת קלה: בכותרות הטבלה כשמראים שינוי, אם המקור הוא GSC → להוסיף tooltip "השוואה מבוססת מיקום ממוצע ב-GSC".

## פרטים טכניים

```ts
// GscIntegration: 4 קריאות מקבילות במצב hideTable
const periods = {
  current:    { startOffset: 28,  endOffset: 0   },
  prevMonth:  { startOffset: 58,  endOffset: 30  },
  threeMonth: { startOffset: 118, endOffset: 90  },
  yearly:     { startOffset: 393, endOffset: 365 },
};
const responses = await Promise.all(
  Object.entries(periods).map(([k, p]) =>
    supabase.functions.invoke("fetch-gsc-data", {
      body: { integrationId, siteUrl, startDate: dateMinus(p.startOffset), endDate: dateMinus(p.endOffset) },
    })
  )
);
onMultiPeriodLoaded({ current, prevMonth, threeMonth, yearly });
```

```ts
// SeoDashboardView: gscOnlyKeywords עם השוואות
const prev = gscPrevMonthMap.get(name)?.position;
const m3   = gscThreeMonthMap.get(name)?.position;
const y1   = gscYearlyMap.get(name)?.position;
return {
  ...,
  position_prev_month: prev ?? null,
  position_3month: m3 ?? null,
  position_yearly: y1 ?? null,
};
```

## תוצאה
- בטאבים **שינוי 3 חודשים / שנתי / חודשי** יופיעו עכשיו גם ביטויי GSC (כל ביטוי שיש לו מיקום בשתי התקופות) — לא רק Ahrefs.
- אין צריכת API נוספת של Ahrefs (GSC חינמי).
- ה-Badge **GSC** ימשיך לסמן ביטויים שמקורם ב-Search Console.
- אין שינוי במסך הנפרד `SearchConsoleDashboard` או בבורר התאריכים שכבר נוסף שם.

