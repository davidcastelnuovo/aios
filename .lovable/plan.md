
# שינוי תדירות סנכרון Facebook Leads לכל דקה

## מה ישתנה
עדכון ה-cron job `sync-facebook-leads-every-5min` מתזמון `*/5 * * * *` (כל 5 דקות) ל-`* * * * *` (כל דקה).

## שלבים טכניים

### 1. עדכון תזמון ה-Cron Job
הרצת SQL לעדכון הטבלה `cron.job`:

```sql
SELECT cron.unschedule('sync-facebook-leads-every-5min');

SELECT cron.schedule(
  'sync-facebook-leads-every-minute',
  '* * * * *',
  $$
  SELECT net.http_post(
    url:='https://jnzguisakdtcollxmgzd.supabase.co/functions/v1/cron-sync-facebook-leads',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impuemd1aXNha2R0Y29sbHhtZ3pkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA1NTcxNTcsImV4cCI6MjA3NjEzMzE1N30.VrxuppQtj-cByA2ml2krzwoM1rHwelXIr0f5D3eP4KM"}'::jsonb,
    body:='{}'::jsonb
  ) as request_id;
  $$
);
```

## תוצאה צפויה
- לידים חדשים מ-Facebook יזוהו ויכנסו למערכת **תוך דקה** במקום עד 5 דקות
- סנכרון ManyChat יתחיל מיד אחרי (כי הוא כבר event-driven)

## הערות
- אין שינוי בקוד
- אין סיכון - אפשר לחזור ל-5 דקות בכל רגע
