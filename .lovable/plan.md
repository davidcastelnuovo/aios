
## הבעיה — אישור מנתוני DB

ב-`ahrefs_reports`: **כל הסנכרונים האחרונים** (מהיום, 09/06) נשמרו עם `tracked_count = 0` ו-`metadata.ahrefs_project_id = null`. בסנכרונים קודמים (לפני זה) הערכים אכן היו מאוכלסים (לדוגמה `ahrefs_project_id: 8732546`, `tracked_source: rank-tracker-overview`). אז המשיכה אכן נכשלה — זו לא בעיית UI.

## שורש הבעיה

`fetch-ahrefs-snapshot` מושך את `tracked_keywords` מ-Ahrefs Rank Tracker **רק כאשר מועבר `projectId` בגוף הבקשה** (ראה `supabase/functions/fetch-ahrefs-snapshot/index.ts:280` — `if (projectId) { ... }`).

הסנכרון הקבוצתי ("סנכרון מדוחות SEO") עובר ב-`src/components/dynamic-tables/CategorySyncControl.tsx:52` וקורא:

```ts
supabase.functions.invoke("fetch-ahrefs-snapshot", {
  body: { clientId, domain, country: settings.country || "il" },
});
```

**ללא** `projectId` — לכן כל הסנכרון הזה דורס את הדוחות ב-snapshot חדש בלי tracked_keywords. במסך הפנימי של דוח בודד (`SeoDashboardView.tsx:482`) זה כן עובד כי שם מועבר `projectId: selectedReport.metadata.ahrefs_project_id`.

## התיקון

### 1. `src/components/dynamic-tables/CategorySyncControl.tsx`
לפני קריאת `fetch-ahrefs-snapshot`, לטעון את ה-`ahrefs_project_id` של הלקוח/דומיין מהדוח האחרון שיש לו אחד שמור:

```ts
const { data: lastWithProject } = await supabase
  .from("ahrefs_reports")
  .select("metadata")
  .eq("tenant_id", t.tenant_id)
  .eq("client_id", clientId)
  .eq("domain", normalizedDomain)     // normalize like target above
  .not("metadata->ahrefs_project_id", "is", null)
  .order("report_date", { ascending: false })
  .limit(1)
  .maybeSingle();

const projectId = lastWithProject?.metadata?.ahrefs_project_id ?? settings.ahrefs_project_id ?? null;
```

ולהעביר אותו ל-body של ה-invoke (כולל `mode`/`protocol` אם נשמרו ב-`integration_settings`).

### 2. `src/components/dynamic-tables/SeoReportDialog.tsx` (תיקון "מקור")
כשמשתמש בוחר פרויקט Ahrefs ב-`AhrefsProjectPicker`, לשמור את `ahrefs_project_id` גם ב-`integration_settings` של ה-CRM table (לא רק ב-metadata של הדוח). כך לסנכרונים עתידיים יש מקור אמין גם כשאין דוח קודם עם projectId.

### 3. Backfill חד-פעמי — שחזור הדוחות שנדרסו
לכל דוח שנשמר היום עם `tracked_count = 0` אבל היה לו `ahrefs_project_id` בסנכרון הקודם — לא חייבים backfill SQL: אחרי שהתיקון נפרס, סנכרון חוזר אחד יחזיר את כל ה-tracked_keywords כי `fetch-ahrefs-snapshot` ימשוך מ-Rank Tracker שוב.

לכן אין צורך במיגרציה. רק:
- לפרוס `CategorySyncControl` (frontend, יתפוס מעצמו)
- ללחוץ "סנכרן הכל" מהקטגוריה SEO — הדוחות יתעדכנו עם tracked_keywords תקינים.

## אימות

1. אחרי הפריסה, להריץ סנכרון של קטגוריית SEO.
2. לוודא בלוגים של `fetch-ahrefs-snapshot`: `tracked_count > 0` ו-`source=rank-tracker-overview`.
3. ב-UI: לשונית "ביטויים במעקב" צריכה להציג מספר תואם בכל הדוחות.
