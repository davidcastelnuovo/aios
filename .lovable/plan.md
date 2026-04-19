

## ההבנה
- המערכת מציגה: **17 לידים** ב-7 ימים האחרונים.
- פייסבוק מציג: **16 לידים** ב-7 ימים האחרונים.
- פער: **ליד אחד**.

## אבחון מהנתונים
שלפתי את הרשומות היומיות של הקמפיין "טופס לידים | סרטונים יום צילום | 17.2" (`OUTCOME_LEADS`):
- 18.4 → 2, 17.4 → 1, 16.4 → 1, 15.4 → 1, 14.4 → 2, 13.4 → 4, 12.4 → 6
- **סה"כ: 17** ✓ (תואם בדיוק את מה שמוצג במסך).

טווח התאריכים תקין (12.4–18.4, 7 ימים, ללא היום) ותואם לפייסבוק. **הבעיה היא בלוגיקת ספירת הלידים**, לא בתאריכים.

## גורם הפער
ב-`sync-facebook-insights/index.ts` (שורה 314) הקוד מבצע:
```ts
const leads = Math.max(aggregateLeadValue, specificLeadsSum);
```
כשהקמפיין הוא **`OUTCOME_LEADS` (Lead Form)**, פייסבוק מציג ב-UI את עמודת "תוצאות" = `leadgen_grouped` (הגשות טופס בלבד).

הקוד שלנו לוקח MAX בין:
- `aggregateLeadValue` (action_type `lead`) — מצרפת של פייסבוק שיכולה לכלול אירועי `lead` נוספים מהפיקסל / מקורות נוספים.
- `specificLeadsSum` (סכום של leadgen_grouped + offsite_conversion.fb_pixel_lead + onsite + messaging + custom).

באחד הימים, `aggregateLeadValue` הוא 1 גבוה מ-`leadgen_grouped` בלבד — כי `lead` הכללי כולל אירוע נוסף שלא נחשב ב-UI של פייסבוק (לדוגמה: ליד שנספר על ידי הפיקסל מחוץ לטופס). זה יוצר פער של ליד אחד.

## התיקון
**העדפה לפי סוג קמפיין** במקום MAX אחיד:

ב-`sync-facebook-insights/index.ts` (שורות 298–314), לפני חישוב `leads`, נשתמש ב-`campaignStatus.objective` כדי להעדיף את המקור המתאים שמתאים ל-UI של פייסבוק:

- **קמפיין `OUTCOME_LEADS` / `LEAD_GENERATION`** (Lead Form) → להעדיף `leadgen_grouped` (זה מה ש-FB מציג ב-"תוצאות"). אם 0 → fallback ל-`Math.max(aggregate, specific)`.
- **קמפיין שאינו לידים** → להשאיר `Math.max(aggregate, specific)` הקיים (כי לקמפיינים אחרים אין מקור יחיד מובהק).

```ts
// Inside the map, after computing aggregateLeadValue + specificLeadsSum:
const campaignStatus = campaignStatuses[insight.campaign_id];
const objective = String(campaignStatus?.objective || '').toUpperCase();
const isLeadFormObjective = ['OUTCOME_LEADS', 'LEAD_GENERATION'].includes(objective);

const leadgenGroupedValue = allActions
  .filter((a: any) => String(a.action_type || '') === 'leadgen_grouped')
  .reduce((sum, a: any) => sum + (parseInt(a.value) || 0), 0);

const leads = isLeadFormObjective && leadgenGroupedValue > 0
  ? leadgenGroupedValue                               // Match FB UI exactly for Lead Form campaigns
  : Math.max(aggregateLeadValue, specificLeadsSum);    // Fallback for everything else
```

## גם ב-cron
לעדכן את אותה לוגיקה ב-`supabase/functions/cron-sync-facebook-insights/index.ts` (אזור שורות 255–272), כדי שגם הסנכרון האוטומטי יישאר זהה ל-FB UI.

## תוצאה צפויה
- 17 → 16, התואם בדיוק לפייסבוק UI.
- קמפיינים שאינם Lead Form ימשיכו לעבוד כרגיל (ללוגיקת MAX).

## קבצים לעריכה
- `supabase/functions/sync-facebook-insights/index.ts` (שורות 298–314)
- `supabase/functions/cron-sync-facebook-insights/index.ts` (אותו אזור לוגיקת לידים)

