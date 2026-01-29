
# תוכנית: סנכרון ManyChat ברקע (ללא צורך בטאב פתוח)

## הבעיה הנוכחית

הסנכרון הנוכחי עובד כך:
1. הדפדפן שולח בקשה ל-Edge Function
2. ה-Edge Function מעבד ליד אחד ומחזיר תשובה
3. הדפדפן מקבל את התשובה ושולח בקשה חדשה
4. חוזר על שלבים 2-3 עד שנגמרים הלידים

**הבעיה**: אם סוגרים את הטאב, הלולאה נעצרת.

---

## הפתרון: Job Queue עם Realtime Updates

נשנה את הארכיטקטורה כך שהסנכרון ירוץ לגמרי בצד השרת:

### שלב 1: טבלת Jobs חדשה

ניצור טבלה חדשה `sync_jobs` שתנהל את התהליך:

| עמודה | סוג | תיאור |
|-------|-----|-------|
| id | uuid | מזהה ייחודי |
| tenant_id | uuid | הארגון |
| job_type | text | סוג (manychat_sync) |
| status | text | pending / running / completed / stopped |
| progress | jsonb | {processed, failed, remaining, conflicts} |
| settings | jsonb | {tagId, delayMs} |
| created_at | timestamp | זמן יצירה |
| updated_at | timestamp | זמן עדכון אחרון |

### שלב 2: Edge Function חדשה - `run-sync-job`

פונקציה שרצה עצמאית ומעדכנת את ה-job:

```text
1. קרא את ה-job מהטבלה
2. אם status != "running" - צא
3. עבד ליד אחד
4. עדכן את progress ב-job
5. קרא לעצמך רקורסיבית (או השתמש ב-Deno.spawn)
6. חזור על 2-5 עד שנגמרים הלידים
```

### שלב 3: Realtime Subscription

הדפדפן יאזין לשינויים בטבלת `sync_jobs` ויעדכן את ה-UI בזמן אמת:

```javascript
supabase
  .channel('sync-jobs')
  .on('postgres_changes', { 
    event: 'UPDATE', 
    table: 'sync_jobs',
    filter: `tenant_id=eq.${tenantId}` 
  }, (payload) => {
    setSyncProgress(payload.new.progress);
  })
  .subscribe();
```

### שלב 4: UI Flow חדש

1. **התחל סנכרון**: יוצר record ב-`sync_jobs` עם `status: pending`
2. **Edge Function מופעלת**: מעדכנת `status: running` ומתחילה לעבד
3. **הדפדפן מאזין**: מקבל עדכונים ב-Realtime
4. **עצור סנכרון**: מעדכן `status: stopped` - ה-Edge Function תעצור בסיבוב הבא
5. **סיום**: Edge Function מעדכנת `status: completed`

---

## קבצים חדשים/לעדכון

| קובץ | פעולה |
|------|-------|
| **SQL Migration** | יצירת טבלת `sync_jobs` + RLS + Realtime |
| `supabase/functions/start-sync-job/index.ts` | **חדש** - יוצר job ומפעיל את התהליך |
| `supabase/functions/run-sync-job/index.ts` | **חדש** - מריץ את הסנכרון ברקע |
| `src/pages/ManyChatSettings.tsx` | עדכון ל-Realtime subscription |

---

## יתרונות הפתרון

| לפני | אחרי |
|------|------|
| חייב להשאיר טאב פתוח | יכול לסגור את הדפדפן |
| אם יש disconnect הכל נעצר | ממשיך לרוץ בשרת |
| לא יודע מה קרה אם סגרת | מצב נשמר ב-DB, אפשר לחזור ולראות |
| אין אפשרות לעצור מסך אחר | אפשר לעצור מכל מכשיר |

---

## תוצאה צפויה

1. המשתמש לוחץ "התחל סנכרון"
2. מוצגת הודעה: "הסנכרון רץ ברקע - אפשר לסגור את הדפדפן"
3. גם אם סוגר את הטאב, הסנכרון ממשיך
4. כשחוזר לעמוד, רואה את ההתקדמות בזמן אמת
5. יכול ללחוץ "עצור" מכל מקום
