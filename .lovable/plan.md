

## הבעיה
ללקוח **ג.ג - ישראל** מקושרים ב-DB **שני דוחות Ahrefs** עם אותו תאריך (2026-04-06):
1. ✅ `ggds.co.il` — האתר הנכון של הלקוח
2. ❌ `gg-ds.com` — דוח של אתר אחר (שייך בפועל ללקוח **ג.ג - אנגלית**)

הסלקטור של הדוחות מציג **רק תאריך** ולא דומיין, ולכן כשבוחרים דוח לא רואים לאיזה אתר הוא שייך — והסנכרון/תצוגה מתבצעים לפעמים על `gg-ds.com` במקום על `ggds.co.il`. הסיבה השורשית: בעת שיוך דוח Ahrefs ללקוח, הקוד מעדכן `client_id` לכל הדוחות עם אותו `domain`, אבל אין מנגנון שמונע שיוך של דומיין שלא תואם את ה-website של הלקוח.

## הפתרון

### 1. תיקון נתונים (Data Migration)
ניתוק הדוח של `gg-ds.com` מהלקוח **ג.ג - ישראל** והעברתו ללקוח **ג.ג - אנגלית** (שאצלו זה ה-website הנכון):

```sql
UPDATE ahrefs_reports
SET client_id = 'b43ea2a4-ebed-40fb-893a-4bcee3c639a7'  -- ג.ג - אנגלית
WHERE domain = 'gg-ds.com'
  AND client_id = '1b87dfaf-8fe1-4874-9b57-dcffe2f1a86c';  -- ג.ג - ישראל
```

### 2. שיפור UX — סלקטור דוחות מציג דומיין
ב-`SeoDashboardView.tsx` (שורה ~474-485): להוסיף את ה-**דומיין** לטקסט של כל אופציה בסלקטור הדוחות, כך שכשללקוח יש מספר דומיינים מקושרים — רואים בבירור איזה דוח נבחר:

```tsx
<SelectItem key={r.id} value={r.id}>
  <div className="flex items-center gap-2">
    <Globe className="h-3 w-3" />
    <span className="font-medium">{r.domain}</span>
    <span className="text-muted-foreground">·</span>
    <Calendar className="h-3 w-3" />
    {format(new Date(r.report_date), 'dd MMM yyyy', { locale: he })}
  </div>
</SelectItem>
```

בנוסף, להציג את ה-`SelectTrigger` תמיד (גם אם יש רק דוח אחד) — או לפחות כשיש יותר מדומיין אחד — כדי שהמשתמש יוכל להחליף בקלות.

### 3. אזהרה בעת שיוך דוח שלא תואם website של הלקוח
ב-`AhrefsSettings.tsx` (שורה ~67-133, `linkClientMutation`): לפני ביצוע ה-`UPDATE`, להשוות את ה-`domain` של הדוח ל-`client.website` המנורמל. אם לא תואם — להציג `confirm()` למשתמש:
> "שים לב — הדומיין `{domain}` לא תואם את האתר של הלקוח (`{client.website}`). לשייך בכל זאת?"

זה ימנע שגיאות שיוך עתידיות בלי לחסום מקרים לגיטימיים.

## תוצאה
- הדוח של `gg-ds.com` יופיע אצל **ג.ג - אנגלית** בלבד (איפה שצריך).
- הסלקטור בלקוח **ג.ג - ישראל** יציג רק `ggds.co.il` — ולא יהיה יותר בלבול.
- בלקוחות עם מספר דומיינים, הסלקטור יציג את הדומיין במפורש.
- שיוכים שגויים בעתיד יוצגו לאישור לפני ביצוע.

## פרטים טכניים — קבצים שיתעדכנו
1. **Migration**: `UPDATE ahrefs_reports` (שאילתה אחת).
2. **`src/components/dynamic-tables/SeoDashboardView.tsx`** — סלקטור דוחות עם הצגת דומיין + הצגה גם כשיש דוח יחיד עם רמז ברור.
3. **`src/pages/AhrefsSettings.tsx`** — הוספת אזהרת mismatch בלוגיקת `linkClientMutation`.

