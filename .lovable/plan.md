## מה המשתמש רוצה

נפח חיפוש (volume) לכל הביטויים:
1. **כל הביטויים במעקב** (tracked keywords מ-Rank Tracker)
2. **כל הביטויים המאונדקסים ב-GSC** (לא רק top 10) — כל מה שמופיע בדוח Search Console

## הבעיה היום

- Tracked keywords מ-Rank Tracker של Ahrefs **לא כוללים** `volume` כברירת מחדל — צריך לבקש את השדה.
- GSC keywords שלא נמצאים ב-organic_keywords (500 הראשונים) מציגים `—` כי אין להם נתון מ-Ahrefs.

## התוכנית

### 1. `fetch-ahrefs-snapshot/index.ts`
- **Tracked keywords**: ודא ש-`volume`, `keyword_difficulty`, `cpc` נכללים ב-`select` של קריאת Rank Tracker. אם ה-endpoint לא מחזיר volume, להעשיר אותם דרך `keywords-explorer/overview` באותה קריאה (batch 100, country=il).
- **GSC keywords**: לקבל פרמטר חדש `gsc_keywords: string[]` (כל הביטויים מ-GSC, לא רק top 10). לסנן רק את אלה שאינם כבר ב-organic_keywords + tracked_keywords (כי שם כבר יש volume). על היתר — קריאה ל-`keywords-explorer/overview` ב-batches של 100, country=il.
- שמירת תוצאות ב-`report_data.gsc_keyword_metrics` כ-map: `{ keywordLower: { volume, kd, cpc } }`.

### 2. `SeoDashboardView.tsx`
- בעת sync דרך ה-Dialog: לשלוח את **כל** ה-GSC keywords (לא רק top 10) כ-`gsc_keywords`.
- ב-`gscOnlyKeywords` (שורות 412-447): למלא `volume/kd/cpc` מ-`reportData.gsc_keyword_metrics`.
- בטבלת tracked: למשוך volume מ-`tracked_keywords` (שכבר יכלול volume אחרי שינוי 1).

## עלות קרדיטים (Ahrefs)

- **Tracked keywords**: אם ה-Rank Tracker endpoint תומך ב-volume בלי תוספת — חינם. אם לא — `keywords-explorer/overview` ל-N tracked (בדרך כלל 20-100 ביטויים = קריאה אחת).
- **GSC keywords**: GSC מחזיר לרוב 100-1000 ביטויים ייחודיים. בקיזוז כפילויות עם organic — נשארים ~50-500 שצריכים enrichment = 1-5 קריאות overview.
- **סה"כ צפוי לסנכרון**: 2-7 קריאות נוספות. `keywords-explorer/overview` בתוכנית Standard של Ahrefs זול יחסית (1 row credit לכל ביטוי).

**שאלה לפני הביצוע**: אם GSC מחזיר מאות ביטויים עם traffic זניח (impressions<10), האם להגביל ל-impressions מינימליים (למשל >5) כדי לחסוך קרדיטים, או להעשיר את **הכל** בלי סינון?
