

# שינוי תדירות cron-sync-facebook-leads ל-כל 15 דקות

## מה נעשה
נבטל את ה-cron job הנוכחי (שרץ כל דקה) ונגדיר מחדש לכל 15 דקות.

## מיגרציית SQL
```sql
-- ביטול ה-cron הנוכחי
SELECT cron.unschedule(6);

-- תזמון מחדש - כל 15 דקות
SELECT cron.schedule(
  'sync-facebook-leads-15min',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url:='https://jnzguisakdtcollxmgzd.supabase.co/functions/v1/cron-sync-facebook-leads',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impuemd1aXNha2R0Y29sbHhtZ3pkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA1NTcxNTcsImV4cCI6MjA3NjEzMzE1N30.VrxuppQtj-cByA2ml2krzwoM1rHwelXIr0f5D3eP4KM"}'::jsonb,
    body:='{}'::jsonb
  ) as request_id;
  $$
);
```

זה יפחית את העומס על בסיס הנתונים פי 15 - במקום ~850 שאילתות כל דקה, זה יהיה כל 15 דקות.

