

## הבעיה

הצילום של הדשבורד (image-304) מצולם לפני שכל הנתונים נטענו, ולכן הוא לא תואם לדשבורד החי (image-305).

**ראיות מהשוואת הצילומים:**
| | חי (305) | צילום (304) |
|---|---|---|
| לשוניות | הכל / Google Ads / Analytics / SEO | הכל / Analytics / SEO **(חסר Google Ads!)** |
| Sessions | 91 | 109 |
| CPL | ₪83 | ₪0 |
| לידים | 5 | 0 |
| הוצאה | ₪417 | ₪0 |

**שורש הבעיה:**

ב-`ClientDashboardSnapshot.tsx` רץ `<SharedDashboard />` בתוך `QueryClient` נפרד עם cache ריק. ה-edge function `public-dashboard` מבצע פעולות איטיות (pagination על `crm_records`, fetch ל-`woocommerce_orders`, `ahrefs_reports`, וסינון תאריכים) שלוקחות לעיתים 5-15 שניות.

ב-`ClientDashboardPanel.tsx`:
- שורה 310: `setTimeout(() => captureScreenshot(), 3000)` — המתנה של 3 שניות בלבד לפני קריאה ל-capture
- שורה 223: `await new Promise((r) => setTimeout(r, 2500))` — בתוך ה-capture, עוד 2.5 שניות בלבד

סה״כ ~5.5 שניות — זה לא מספיק כדי שכל ה-tabs (Google Ads, Analytics) יקבלו נתונים. הצילום נתפס כשה-`useQuery` עדיין `isLoading` או החזיר רק חלק מהנתונים, ולכן `availablePlatforms` עוד לא כולל את `google_ads` והכרטיסיות מציגות 0.

הסיבה ש-Sessions=109 אבל לידים=0: רשומות GA טוענות עם דאטה חלקי, אבל עדיין לא נכנסו רשומות Google Ads → ה-CPL/לידים/הוצאה (שמגיעים ממקור Ads) הם 0.

## הפתרון

### 1. המתנה דטרמיניסטית לטעינה אמיתית (במקום `setTimeout` קבוע)

לשנות את `ClientDashboardSnapshot.tsx` כך שיחשוף `onReady` callback או שישתמש במצב `data-ready`:

- להעביר פנימה את ה-`QueryClient` בצורה שתאפשר ל-`ClientDashboardPanel` לעקוב אחרי מצב ה-query.
- להוסיף `data-snapshot-ready="true"` על ה-root div של ה-snapshot כאשר `useQuery` הסתיים והנתונים מאוכלסים (רשומות + tables).

### 2. בצד `captureScreenshot`

להחליף את `await new Promise((r) => setTimeout(r, 2500))` ב-poll loop:

```ts
// Wait until the snapshot signals it has data (max 20s)
const start = Date.now();
while (Date.now() - start < 20000) {
  if (node.querySelector('[data-snapshot-ready="true"]')) break;
  await new Promise(r => setTimeout(r, 250));
}
// extra 500ms for chart animations to finish
await new Promise(r => setTimeout(r, 500));
```

### 3. ביטול ה-auto-capture המוקדם

ב-`useEffect` של auto-capture (שורה 302), להמתין לאיתות `data-snapshot-ready` במקום timeout שרירותי של 3 שניות. אם אין איתות תוך 25 שניות → toast עם "טעינה איטית, נסה שוב".

### 4. סימון ready ב-`SharedDashboard`

ב-`SharedDashboard.tsx`, להוסיף על ה-wrapper הראשי:
```tsx
<div data-snapshot-ready={!isLoading && !!data ? "true" : "false"}>
```
כך שה-snapshot wrapper יוכל לבדוק זאת.

### 5. בדיקת cache busting

`staleTime: 60_000` ב-`ClientDashboardSnapshot` עלול להחזיר cache ריק. להחליף ל-`staleTime: 0` ו-`gcTime: 0` כדי לכפות fetch טרי בכל פתיחה.

## קבצים שיתעדכנו

- `src/pages/SharedDashboard.tsx` — הוספת `data-snapshot-ready` על ה-root
- `src/components/clients/ClientDashboardSnapshot.tsx` — `staleTime: 0`, `gcTime: 0`
- `src/components/clients/ClientDashboardPanel.tsx` — החלפת `setTimeout` ב-poll על `data-snapshot-ready` (גם ב-auto-capture וגם בתוך `captureScreenshot`)

## תוצאה

הצילום ימתין באמת עד שכל הנתונים (Google Ads + Analytics + SEO + WooCommerce) נטענו ומוצגים, ואז יצלם — וייראה זהה למסך החי שהמשתמש רואה.

