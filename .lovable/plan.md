## שינוי

ב-`src/components/dynamic-tables/CategorySyncControl.tsx`, להחליף את חישוב `lastSyncAt` (max) בחישוב **מינימום** – הדוח הכי ישן בקטגוריה.

### לוגיקה חדשה

```ts
// במקום max על כל הטבלאות, לעבור רק על syncableTables
// ולהחזיר את הישן ביותר + מונה של "מעולם לא סונכרן"
const { oldestSyncAt, neverSyncedCount, syncedCount } = useMemo(() => {
  let oldest: Date | null = null;
  let never = 0;
  let synced = 0;
  for (const t of syncableTables) {
    const ts = t.integration_settings?.last_sync_at;
    if (!ts) { never++; continue; }
    synced++;
    const d = new Date(ts);
    if (!oldest || d < oldest) oldest = d;
  }
  return { oldestSyncAt: oldest, neverSyncedCount: never, syncedCount: synced };
}, [syncableTables]);
```

### תווית שמוצגת

- אם יש דוחות שלא סונכרנו אף פעם: `סנכרון אחרון: X דוחות לא סונכרנו מעולם` (אדום עדין).
- אחרת אם יש `oldestSyncAt`: `סנכרון אחרון: לפני {formatDistanceToNow(oldestSyncAt)} (הישן ביותר)`.
- אחרת: `אין דוחות לסנכרון`.
- ה-Tooltip יראה את התאריך המדויק של הדוח הישן ביותר.

### למה

עד עכשיו הצגתי `max` – אם דוח אחד מתוך 25 סונכרן לפני 13 דקות, הקטגוריה כולה הראתה "13 דקות" למרות שהשאר מיושנים. עכשיו נראה את החוליה החלשה.

### מחוץ לסקופ

- אין שינוי ל-cron, ל-edge functions או ל-DB.
- אין שינוי בכפתור הסנכרון עצמו.
