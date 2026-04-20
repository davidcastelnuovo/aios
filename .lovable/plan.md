

## הבעיה אצל ד"ר הולדר

מה שראית בצילום הוא שכן יש חיבור GSC (כתוב "מחובר") ויש בורר נכס שמראה `holderdent.com`, אבל יש שגיאה "אין נתונים זמינים עבור הנכס שנבחר".

חיפוש בלוגים של ה-edge function `fetch-gsc-data` חשף את הסיבה המדויקת:

```
403 — User does not have sufficient permission for site 'sc-domain:holderdent.com'
```

### שורש הבעיה (data-level, לא UI bug)

יש לטננט שני חיבורי GSC של שני משתמשים שונים:

| Integration | מי מחובר | המיפוי של הולדר | רמת הרשאה |
|-------------|----------|-----------------|-----------|
| `1d6dd113…` (חדש) | משתמש A | `https://www.holderdent.com/` | **siteOwner** ✅ |
| `d39a8451…` (ישן) | משתמש B | `sc-domain:holderdent.com` | **siteUnverifiedUser** ❌ |

המשתמש שמסתכל עכשיו על הדשבורד נופל על החיבור הישן (`d39a8451`) שמיפה את הולדר ל-`sc-domain:holderdent.com` — נכס שאין לו הרשאת קריאה ב-Google. לכן GSC מחזיר 403 והממשק מציג "אין נתונים".

חשוב: **אין שום טבלת `crm_tables` של אהרפס/GSC ספציפית להולדר** (יש רק אחת לטננט הזה — של ggh-law). אז אין `targetDomain` לאוטו-match, והקוד נופל על מה ש-`client_sites[clientId]` של ה-integration הראשון מחזיר.

## התוכנית

תיקון ב-3 שכבות, בלי לשבור את ה-multi-domain ובלי לפגוע בלקוחות אחרים.

### 1. דילוג על נכסים ללא הרשאה ב-`GscIntegration.tsx`

כשבונים את `availableSites` או בוחרים אוטומטית, לסנן החוצה כל נכס שה-`permissionLevel` שלו הוא `siteUnverifiedUser`. הנכסים האלה לא נגישים ל-API ולכן אין טעם להציג אותם או להיבחר אוטומטית.

```ts
const usableSites = availableSites.filter(
  s => s.permissionLevel !== 'siteUnverifiedUser'
);
// השתמש ב-usableSites ל-matchedSite, ל-fallback ולתצוגה ב-Popover.
```

### 2. בחירת ה-integration "הטובה ביותר" בין כמה זמינות

ב-`GscIntegration.tsx` (שורה `gscIntegrations[0]`) — אם יש כמה integrations של GSC ל-tenant, לבחור את זו שכן יש לה מיפוי תקין ל-`clientId` הנוכחי עם נכס שאינו `siteUnverifiedUser`. רק אם אין כזו, ליפול על הראשונה.

```ts
const gscIntegration = useMemo(() => {
  if (!gscIntegrations.length) return null;
  // 1. integration שיש לה מיפוי לקוח לנכס מורשה
  const withGoodMapping = gscIntegrations.find(i => {
    const mapped = (i.settings as any)?.client_sites?.[clientId];
    if (!mapped) return false;
    const sites = (i.settings as any)?.available_sites || [];
    const site = sites.find((s: any) => s.siteUrl === mapped);
    return !site || site.permissionLevel !== 'siteUnverifiedUser';
  });
  return withGoodMapping || gscIntegrations[0];
}, [gscIntegrations, clientId]);
```

### 3. אם המיפוי השמור הוא `siteUnverifiedUser` — לאפס ולנסות domain match אמיתי

אם `client_sites[clientId]` הקיים מצביע על נכס שלא נגיש, להתעלם ממנו ולנסות:
1. `matchedSite` לפי `domain`/`website` (יסונן ל-usable בלבד)
2. נכס יחיד זמין כ-fallback אחרון

זה מבטיח שהולדר יבחר אוטומטית את `https://www.holderdent.com/` מהחיבור הנכון.

### 4. הודעה ברורה למשתמש כשאכן אין נכס נגיש

במקום "אין נתונים זמינים עבור הנכס שנבחר" כשמדובר ב-403, אזהיר ש-"אין הרשאות גישה לנכס הזה ב-Search Console" עם הצעה לבחור נכס אחר ידנית. זה ידרוש החזרת error code מה-edge function (כבר זמין בלוגים — רק לחשוף ב-response).

## הקבצים שיתעדכנו

- `src/components/dynamic-tables/seo/GscIntegration.tsx` — סינון `siteUnverifiedUser`, בחירה חכמה של integration, איפוס מיפוי לא-נגיש.
- `supabase/functions/fetch-gsc-data/index.ts` — להחזיר `permissionDenied: true` ב-response כשגוגל מחזיר 403, במקום רק לזרוק.
- (אופציונלי) `src/components/dynamic-tables/SeoReportTabs.tsx` — להעביר את ה-`website` של הלקוח כ-`domain` ל-`GscIntegration` כדי לשפר את ה-auto-match (כיום זה תלוי ב-`targetDomain` של טבלת אהרפס שלא קיימת להולדר).

## מה לא ישתנה

- **multi-domain**: הסינון מתבצע per-site, לא per-tenant. אם ל-ggh-law יש את `https://ggh-law.co.il/` עם `siteOwner` — הוא ימשיך לעבוד בלי שינוי.
- **per-client mapping**: `client_sites[clientId]` נשאר source of truth ראשי; רק אם המיפוי הקיים שבור (siteUnverifiedUser) ייעשה fallback.
- **per-user integrations**: לוגיקת `useUserIntegrations` (own + shared) לא משתנה, רק הבחירה בין הזמינות.

## תוצאה צפויה

אצל הולדר, הקוד ידלג על `sc-domain:holderdent.com` (siteUnverifiedUser), יבחר את ה-integration שמיפתה ל-`https://www.holderdent.com/` (siteOwner), ויציג נתונים אמיתיים. אצל לקוחות אחרים שכבר עובדים — אין שינוי.

